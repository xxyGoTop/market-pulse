import type {
  AppData,
  DesktopAPI,
  ExportFormat,
  ImportResult,
  QuoteBatch,
  QuoteRequest,
  WindowMode,
} from '@/types'
import {
  appDataFromCsvRows,
  countStocks,
  createDefaultAppData,
  normalizeAppData,
  parseStocksCsv,
  toStocksCsv,
} from '@/services/app-data'

const STORAGE_KEY = 'market-pulse::app-data'
const MODE_KEY = 'market-pulse::window-mode'

/** 浏览器预览下的导出：直接触发下载 */
function download(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** 浏览器预览下的导入：临时文件选择框 */
function pickFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.csv,text/csv,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      resolve({ name: file.name, text: await file.text() })
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/**
 * 浏览器预览模式下的降级实现：用 localStorage 顶替 electron-store，
 * 让同一套 UI 可以直接在浏览器里跑起来做设计走查。
 */
function createWebAdapter(): DesktopAPI {
  const listeners = new Set<(data: AppData) => void>()
  const modeListeners = new Set<(mode: WindowMode) => void>()

  const read = (): AppData => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return createDefaultAppData()
      return normalizeAppData(JSON.parse(raw))
    } catch {
      return createDefaultAppData()
    }
  }

  return {
    isElectron: false,
    platform: 'web',
    async getAppData() {
      return read()
    },
    async saveAppData(data: AppData) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        listeners.forEach((cb) => cb(data))
        return { ok: true }
      } catch {
        return { ok: false, error: '本地存储写入失败' }
      }
    },
    async setAlwaysOnTop() {},
    async setOpacity() {},
    async setWindowMode(mode: WindowMode) {
      localStorage.setItem(MODE_KEY, mode)
      modeListeners.forEach((cb) => cb(mode))
    },
    async setCompactWidth() {},
    async setLaunchAtLogin() {},
    async showNotification(title: string, body: string) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body })
      }
    },
    async minimizeToTray() {},
    async quitApp() {},
    async exportData(format: ExportFormat) {
      const data = read()
      const stamp = new Date().toISOString().slice(0, 10)
      try {
        if (format === 'json') {
          const fileName = `market-pulse-备份-${stamp}.json`
          download(fileName, JSON.stringify({ app: 'market-pulse', data }, null, 2), 'application/json')
          return { ok: true, fileName }
        }
        const fileName = `market-pulse-自选股-${stamp}.csv`
        download(fileName, toStocksCsv(data.groups), 'text/csv;charset=utf-8')
        return { ok: true, fileName }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '导出失败' }
      }
    },
    async importData(): Promise<ImportResult> {
      const file = await pickFile()
      if (!file) return { ok: false, canceled: true }
      try {
        const isCsv = file.name.toLowerCase().endsWith('.csv')
        const data = isCsv
          ? appDataFromCsvRows(parseStocksCsv(file.text).rows)
          : normalizeAppData(
              (JSON.parse(file.text) as { data?: unknown }).data ?? JSON.parse(file.text),
            )
        const stockCount = countStocks(data.groups)
        if (!stockCount) return { ok: false, error: '文件里没有股票数据' }
        return { ok: true, data, stockCount, fileName: file.name }
      } catch {
        return { ok: false, error: '文件解析失败，请确认格式正确' }
      }
    },
    /**
     * 浏览器预览没有主进程代发请求，直连会被 CORS 拦掉。
     * 这里如实返回不可用，让界面显示「行情需桌面版」而不是伪造数据。
     */
    async fetchQuotes(request: QuoteRequest): Promise<QuoteBatch> {
      return {
        ok: false,
        source: request.source,
        quotes: {},
        indexes: {},
        fetchedAt: Date.now(),
        error: '浏览器预览不支持行情，请使用桌面版',
      }
    },
    onDataChanged(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },    onModeChanged(cb) {
      modeListeners.add(cb)
      return () => modeListeners.delete(cb)
    },
  }
}

const adapter: DesktopAPI = window.desktop ?? createWebAdapter()

export function useDesktop(): DesktopAPI {
  return adapter
}

export const isElectron = adapter.isElectron
