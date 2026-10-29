import { contextBridge, ipcRenderer } from 'electron'
import type { AppData, DesktopAPI, ExportFormat, QuoteRequest, WindowMode } from '../src/types'

/** 渲染进程只能使用这里明确暴露的方法，无法调用任意通道 */
const api: DesktopAPI = {
  isElectron: true,
  platform: process.platform,
  getAppData: () => ipcRenderer.invoke('app-data:get'),
  saveAppData: (data: AppData) => ipcRenderer.invoke('app-data:save', data),
  setAlwaysOnTop: (enabled: boolean) => ipcRenderer.invoke('window:set-always-on-top', enabled),
  setOpacity: (opacity: number) => ipcRenderer.invoke('window:set-opacity', opacity),
  setWindowMode: (mode: WindowMode) => ipcRenderer.invoke('window:set-mode', mode),
  setCompactWidth: (width: number) => ipcRenderer.invoke('window:set-compact-width', width),
  setLaunchAtLogin: (enabled: boolean) => ipcRenderer.invoke('app:set-launch-at-login', enabled),
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('notification:show', title, body),
  minimizeToTray: () => ipcRenderer.invoke('window:minimize-to-tray'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  exportData: (format: ExportFormat) => ipcRenderer.invoke('data:export', format),
  importData: () => ipcRenderer.invoke('data:import'),
  fetchQuotes: (request: QuoteRequest) => ipcRenderer.invoke('quotes:fetch', request),
  onDataChanged: (cb: (data: AppData) => void) => {
    const listener = (_event: unknown, data: AppData) => cb(data)
    ipcRenderer.on('app-data:changed', listener)
    return () => ipcRenderer.removeListener('app-data:changed', listener)
  },
  onModeChanged: (cb: (mode: WindowMode) => void) => {
    const listener = (_event: unknown, mode: WindowMode) => cb(mode)
    ipcRenderer.on('window:mode', listener)
    return () => ipcRenderer.removeListener('window:mode', listener)
  },
}

contextBridge.exposeInMainWorld('desktop', api)

// 托盘“设置…”入口：渲染层通过 window 事件转发，避免额外暴露通道
ipcRenderer.on('ui:open-settings', () => {
  window.dispatchEvent(new CustomEvent('market-pulse:open-settings'))
})
