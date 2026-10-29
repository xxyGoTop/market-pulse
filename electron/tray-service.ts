import { Menu, Tray, app, nativeImage, nativeTheme } from 'electron'
import path from 'node:path'
import { getMainWindow, getWindowMode, setAlwaysOnTop, setWindowMode, showWindow, toggleWindow } from './window-manager'

const isMac = process.platform === 'darwin'

interface TrayCallbacks {
  isAlwaysOnTop: () => boolean
  onToggleAlwaysOnTop: (enabled: boolean) => void
  onOpenSettings: () => void
  onQuit: () => void
}

let tray: Tray | null = null

/**
 * 图标分两套，两个平台的托盘机制不一样：
 * - macOS 菜单栏只认「单色 + alpha」的模板图，系统按菜单栏明暗自动反色，
 *   彩色磁贴放进去会显得又重又脏；
 * - Windows 任务栏需要按明暗切换彩色磁贴（tray-dark / tray-light）。
 */
function trayIcon(): Electron.NativeImage {
  if (isMac) {
    const image = nativeImage.createFromPath(path.join(__dirname, '../build/trayTemplate.png'))
    if (image.isEmpty()) return nativeImage.createEmpty()
    // 同目录的 trayTemplate@2x.png 会被自动加载为 Retina 表示
    image.setTemplateImage(true)
    return image
  }

  const variant = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  const image = nativeImage.createFromPath(path.join(__dirname, `../build/tray-${variant}.png`))
  if (image.isEmpty()) {
    return nativeImage.createEmpty()
  }
  return image.resize({ width: 16, height: 16 })
}

export function createTray(callbacks: TrayCallbacks): void {
  tray = new Tray(trayIcon())
  tray.setToolTip('Market Pulse · 大盘状态提醒')

  const render = () => {
    const menu = Menu.buildFromTemplate([
      { label: '显示 / 隐藏窗口', click: () => toggleWindow() },
      {
        label: getWindowMode() === 'compact' ? '展开面板' : '收起为窄条',
        click: () => {
          showWindow()
          setWindowMode(getWindowMode() === 'compact' ? 'expanded' : 'compact')
        },
      },
      { type: 'separator' },
      {
        label: '始终置顶',
        type: 'checkbox',
        checked: callbacks.isAlwaysOnTop(),
        click: (item) => {
          setAlwaysOnTop(item.checked)
          callbacks.onToggleAlwaysOnTop(item.checked)
          render()
        },
      },
      {
        label: '设置…',
        click: () => {
          showWindow()
          callbacks.onOpenSettings()
        },
      },
      { type: 'separator' },
      { label: '退出程序', click: () => callbacks.onQuit() },
    ])
    tray?.setContextMenu(menu)
  }

  render()

  if (!isMac) {
    // Windows 上左键点托盘直接唤出窗口；macOS 的惯例是弹出菜单（已由 setContextMenu 接管）
    tray.on('click', () => {
      showWindow()
      getMainWindow()?.focus()
    })

    // 系统切换深浅色时同步换托盘图标（macOS 的模板图会自己反色，不用管）
    const onThemeUpdated = (): void => {
      if (!tray || tray.isDestroyed()) return
      tray.setImage(trayIcon())
    }
    nativeTheme.on('updated', onThemeUpdated)
    app.on('before-quit', () => nativeTheme.off('updated', onThemeUpdated))
  }

  app.on('before-quit', () => {
    tray?.destroy()
    tray = null
  })
}

export function refreshTray(): void {
  tray?.setToolTip(`Market Pulse · ${getWindowMode() === 'compact' ? '窄条模式' : '展开模式'}`)
}
