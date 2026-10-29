import { app, ipcMain } from 'electron'
import type { AppData, ExportFormat, WindowMode } from '../src/types'
import { clampCompactWidth, clampOpacity } from '../src/services/app-data'
import { validateAppData } from '../src/services/validation'
import { readAppData, writeAppData, storageFilePath } from './storage-service'
import { notify } from './notification-service'
import { exportData, importData } from './file-service'
import { fetchQuotes, sanitizeQuoteRequest } from './quote-service'
import {
  createMainWindow,
  getMainWindow,
  markQuitting,
  setAlwaysOnTop,
  setCompactWidth,
  setOpacity,
  setWindowMode,
  showWindow,
} from './window-manager'
import { createTray, refreshTray } from './tray-service'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())
  void bootstrap()
}

const isMac = process.platform === 'darwin'

function applyLaunchAtLogin(enabled: boolean): void {
  if (!app.isPackaged) return
  if (isMac) {
    // macOS 只有 openAtLogin；openAsHidden 是 Windows 专属参数
    app.setLoginItemSettings({ openAtLogin: enabled })
    return
  }
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
}

async function bootstrap(): Promise<void> {
  await app.whenReady()

  if (isMac) {
    // 常驻小工具收进菜单栏，不在 Dock 里占位（打包时 Info.plist 也带了 LSUIElement）
    app.dock?.hide()
  } else {
    // Windows 用来把通知归到应用名下
    app.setAppUserModelId('com.marketpulse.app')
  }

  const data = readAppData()

  createMainWindow({
    mode: data.settings.compactMode ? 'compact' : 'expanded',
    alwaysOnTop: data.settings.alwaysOnTop,
    opacity: data.settings.opacity,
    compactWidth: data.settings.compactWidth,
    bounds: data.settings.windowBounds,
    onBounds: (bounds) => {
      const latest = readAppData()
      writeAppData({ ...latest, settings: { ...latest.settings, windowBounds: bounds } })
    },
  })

  applyLaunchAtLogin(data.settings.launchAtLogin)
  registerIpc()

  createTray({
    isAlwaysOnTop: () => readAppData().settings.alwaysOnTop,
    onToggleAlwaysOnTop: (enabled) => {
      const latest = readAppData()
      writeAppData({ ...latest, settings: { ...latest.settings, alwaysOnTop: enabled } })
      broadcastData()
    },
    onOpenSettings: () => {
      showWindow()
      getMainWindow()?.webContents.send('ui:open-settings')
    },
    onQuit: () => quit(),
  })

  app.on('activate', () => showWindow())
  app.on('window-all-closed', () => {
    // 常驻托盘，不随窗口关闭退出
  })

  console.info('[market-pulse] 数据文件：', storageFilePath())
}

function broadcastData(): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send('app-data:changed', readAppData())
}

function registerIpc(): void {
  ipcMain.handle('app-data:get', () => readAppData())

  ipcMain.handle('app-data:save', (_event, payload: unknown) => {
    const check = validateAppData(payload)
    if (!check.ok) {
      console.warn('[market-pulse] 拒绝写入非法数据：', check.error)
      return { ok: false, error: check.error }
    }
    const data = payload as AppData
    try {
      // 窗口坐标以主进程的实时值为准，避免渲染层用启动时的旧坐标覆盖
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        data.settings.windowBounds = win.getBounds()
      }
      writeAppData(data)
      setOpacity(clampOpacity(data.settings.opacity))
      setAlwaysOnTop(data.settings.alwaysOnTop)
      setCompactWidth(clampCompactWidth(data.settings.compactWidth))
      return { ok: true }
    } catch (error) {
      console.error('[market-pulse] 保存失败', error)
      return { ok: false, error: '本地保存失败，请检查磁盘权限' }
    }
  })

  ipcMain.handle('window:set-always-on-top', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') return
    setAlwaysOnTop(enabled)
  })

  ipcMain.handle('window:set-opacity', (_event, value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    setOpacity(clampOpacity(value))
  })

  ipcMain.handle('window:set-mode', (_event, mode: unknown) => {
    if (mode !== 'compact' && mode !== 'expanded') return
    setWindowMode(mode as WindowMode)
    refreshTray()
  })

  ipcMain.handle('window:set-compact-width', (_event, width: unknown) => {
    if (typeof width !== 'number' || !Number.isFinite(width)) return
    setCompactWidth(width)
  })

  ipcMain.handle('data:export', async (_event, format: unknown) => {
    if (format !== 'json' && format !== 'csv') {
      return { ok: false, error: '导出格式非法' }
    }
    return exportData(getMainWindow(), format as ExportFormat, readAppData())
  })

  ipcMain.handle('data:import', () => importData(getMainWindow()))

  ipcMain.handle('quotes:fetch', async (_event, payload: unknown) => {
    const request = sanitizeQuoteRequest(payload)
    if (!request) {
      return {
        ok: false,
        source: 'eastmoney',
        quotes: {},
        indexes: {},
        fetchedAt: Date.now(),
        error: '行情请求参数非法',
      }
    }
    return fetchQuotes(request)
  })

  ipcMain.handle('app:set-launch-at-login', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') return
    applyLaunchAtLogin(enabled)
  })

  ipcMain.handle('notification:show', (_event, title: unknown, body: unknown) => {
    if (typeof title !== 'string' || typeof body !== 'string') return
    notify(title, body)
  })

  ipcMain.handle('window:minimize-to-tray', () => {
    getMainWindow()?.hide()
  })

  ipcMain.handle('app:quit', () => quit())
}

function quit(): void {
  markQuitting()
  app.quit()
}

// 主进程未捕获异常兜底，避免直接崩溃退出
process.on('uncaughtException', (error) => {
  console.error('[market-pulse] uncaughtException', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('[market-pulse] unhandledRejection', reason)
})
