import { BrowserWindow, app, screen, shell } from 'electron'
import path from 'node:path'
import type { WindowBounds, WindowMode } from '../src/types'
import { COMPACT_HEIGHT, COMPACT_WIDTH } from '../src/services/constants'
import { clampCompactWidth } from '../src/services/app-data'

const isMac = process.platform === 'darwin'

const EXPANDED = { width: 1000, height: 640 }

/** 窄条宽度可由设置调整，其余尺寸固定 */
export const WINDOW_SIZE: Record<WindowMode, { width: number; height: number }> = {
  compact: { width: COMPACT_WIDTH.default, height: COMPACT_HEIGHT },
  expanded: EXPANDED,
}

let compactWidth = COMPACT_WIDTH.default

const MIN_EXPANDED = { width: 900, height: 540 }
const isDev = !!process.env.VITE_DEV_SERVER_URL

let mainWindow: BrowserWindow | null = null
let currentMode: WindowMode = 'compact'
let boundsTimer: ReturnType<typeof setTimeout> | null = null
let onBoundsChange: ((bounds: WindowBounds) => void) | null = null

/** 当前模式下窗口应有的尺寸（窄条宽度取实时设置值） */
function sizeOf(mode: WindowMode): { width: number; height: number } {
  return mode === 'compact'
    ? { width: compactWidth, height: COMPACT_HEIGHT }
    : { width: EXPANDED.width, height: EXPANDED.height }
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function getWindowMode(): WindowMode {
  return currentMode
}

export function getCompactWidth(): number {
  return compactWidth
}

/** 判断矩形是否还有足够面积落在某块屏幕内 */
function isUsable(bounds: WindowBounds): boolean {
  // 阈值不能写死：窄条只有 46px 高，用固定 48 会让所有窄条坐标都被判为不可用
  const needX = Math.min(120, bounds.width)
  const needY = Math.min(48, bounds.height)
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea
    const overlapX =
      Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x)
    const overlapY =
      Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y)
    return overlapX >= needX && overlapY >= needY
  })
}

function clampToDisplay(bounds: WindowBounds): WindowBounds {
  const display = screen.getDisplayMatching({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  })
  const area = display.workArea
  const width = Math.min(bounds.width, area.width)
  const height = Math.min(bounds.height, area.height)
  const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - height)
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
}

function defaultBounds(mode: WindowMode): WindowBounds {
  const area = screen.getPrimaryDisplay().workArea
  const size = sizeOf(mode)
  return {
    x: Math.round(area.x + area.width - size.width - 32),
    y: Math.round(area.y + 72),
    width: size.width,
    height: size.height,
  }
}

function resolveInitialBounds(mode: WindowMode, saved?: WindowBounds): WindowBounds {
  const size = sizeOf(mode)
  if (saved && isUsable(saved)) {
    return clampToDisplay({ ...saved, width: size.width, height: size.height })
  }
  return defaultBounds(mode)
}

export function createMainWindow(options: {
  mode: WindowMode
  alwaysOnTop: boolean
  opacity: number
  compactWidth?: number
  bounds?: WindowBounds
  onBounds: (bounds: WindowBounds) => void
}): BrowserWindow {
  currentMode = options.mode
  onBoundsChange = options.onBounds
  compactWidth = clampCompactWidth(options.compactWidth ?? COMPACT_WIDTH.default)
  const initial = resolveInitialBounds(options.mode, options.bounds)

  const win = new BrowserWindow({
    ...initial,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    // macOS 默认会给无边框窗口加一层系统圆角，和 CSS 的 20px 圆角叠在一起会发毛边
    roundedCorners: false,
    // 悬浮小工具的关键细节：窗口未激活时，第一次点击也要直接命中控件
    acceptFirstMouse: true,
    resizable: options.mode === 'expanded',
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: options.alwaysOnTop,
    useContentSize: true,
    title: 'Market Pulse',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      devTools: isDev,
    },
  })

  win.setOpacity(options.opacity)
  if (options.alwaysOnTop) {
    win.setAlwaysOnTop(true, 'floating')
    // macOS 的置顶默认只在当前 Space 生效，切桌面就看不见了
    if (isMac) win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  win.once('ready-to-show', () => win.show())

  win.on('close', (event) => {
    // 关闭按钮默认隐藏到托盘，真正退出走托盘菜单
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  win.on('moved', scheduleBoundsSave)
  win.on('resized', scheduleBoundsSave)

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL as string)
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow = win
  return win
}

function scheduleBoundsSave(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (boundsTimer) clearTimeout(boundsTimer)
  boundsTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const b = mainWindow.getBounds()
    onBoundsChange?.(b)
  }, 400)
}

export function setWindowMode(mode: WindowMode): void {
  const win = mainWindow
  if (!win || win.isDestroyed() || mode === currentMode) return
  currentMode = mode
  const size = sizeOf(mode)
  const current = win.getBounds()

  // 以右上角为锚点缩放，避免窗口跳到屏幕中央
  const target = clampToDisplay({
    x: current.x + current.width - size.width,
    y: current.y,
    width: size.width,
    height: size.height,
  })

  if (mode === 'expanded') {
    win.setMinimumSize(MIN_EXPANDED.width, MIN_EXPANDED.height)
    win.setResizable(true)
  } else {
    // 先降低最小尺寸，否则窗口无法缩回窄条
    win.setMinimumSize(size.width, size.height)
    win.setResizable(false)
  }

  win.setBounds(target)
  win.webContents.send('window:mode', mode)
}

/**
 * 调整窄条宽度：当前就在窄条模式下时立刻按右上角锚点改宽度，
 * 展开模式下只记下来，等下次收起时生效。
 */
export function setCompactWidth(width: number): void {
  compactWidth = clampCompactWidth(width)
  const win = mainWindow
  if (!win || win.isDestroyed() || currentMode !== 'compact') return
  const current = win.getBounds()
  win.setMinimumSize(compactWidth, COMPACT_HEIGHT)
  win.setBounds(
    clampToDisplay({
      x: current.x + current.width - compactWidth,
      y: current.y,
      width: compactWidth,
      height: COMPACT_HEIGHT,
    }),
  )
}

export function setAlwaysOnTop(enabled: boolean): void {
  const win = mainWindow
  if (!win || win.isDestroyed()) return
  win.setAlwaysOnTop(enabled, 'floating')
  // macOS 下不同步到所有 Space 的话，切桌面后置顶窗口就消失了
  if (isMac) win.setVisibleOnAllWorkspaces(enabled, { visibleOnFullScreen: enabled })
}

export function setOpacity(value: number): void {
  mainWindow?.setOpacity(value)
}

export function showWindow(): void {
  if (!mainWindow) return
  // macOS 收在菜单栏（Dock 无图标）时，不主动激活的话窗口拿不到键盘焦点
  if (isMac) app.focus({ steal: true })
  mainWindow.show()
  mainWindow.focus()
}

export function toggleWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isVisible()) mainWindow.hide()
  else showWindow()
}

let isQuitting = false
export function markQuitting(): void {
  isQuitting = true
}
