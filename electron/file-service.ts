import { BrowserWindow, dialog } from 'electron'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AppData, ExportFormat, FileResult, ImportResult } from '../src/types'
import {
  appDataFromCsvRows,
  countStocks,
  normalizeAppData,
  parseStocksCsv,
  toStocksCsv,
} from '../src/services/app-data'

/** 导入文件大小上限，避免误选大文件把内存打满 */
const MAX_IMPORT_BYTES = 8 * 1024 * 1024

function stamp(): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('JSON')) return 'JSON 格式有误，无法解析'
    return error.message
  }
  return '未知错误'
}

/** 导出：JSON 为完整备份，CSV 为 Excel 可直接打开的自选股清单 */
export async function exportData(
  win: BrowserWindow | null,
  format: ExportFormat,
  data: AppData,
): Promise<FileResult> {
  const isJson = format === 'json'
  const defaultName = isJson
    ? `market-pulse-备份-${stamp()}.json`
    : `market-pulse-自选股-${stamp()}.csv`

  const options: Electron.SaveDialogOptions = {
    title: isJson ? '导出备份' : '导出自选股',
    defaultPath: defaultName,
    filters: isJson
      ? [{ name: '备份文件', extensions: ['json'] }]
      : [{ name: 'CSV 表格', extensions: ['csv'] }],
  }

  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return { ok: false, canceled: true }

  const payload = isJson
    ? JSON.stringify(
        {
          app: 'market-pulse',
          schema: data.version,
          exportedAt: new Date().toISOString(),
          data,
        },
        null,
        2,
      )
    : toStocksCsv(data.groups)

  try {
    // CSV 由 toStocksCsv 自带 BOM，这里统一按 utf8 写
    await writeFile(result.filePath, payload, 'utf8')
    return {
      ok: true,
      path: result.filePath,
      fileName: path.basename(result.filePath),
    }
  } catch (error) {
    return { ok: false, error: `写入失败：${toMessage(error)}` }
  }
}

/** 导入：由用户在系统对话框里选文件，主进程读盘并解析成合法 AppData */
export async function importData(win: BrowserWindow | null): Promise<ImportResult> {
  const options: Electron.OpenDialogOptions = {
    title: '导入自选股',
    properties: ['openFile'],
    filters: [
      { name: '自选股 / 备份', extensions: ['json', 'csv'] },
      { name: 'CSV 表格', extensions: ['csv'] },
      { name: '备份文件', extensions: ['json'] },
    ],
  }

  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }

  const file = result.filePaths[0]
  const fileName = path.basename(file)

  try {
    const info = await stat(file)
    if (info.size > MAX_IMPORT_BYTES) {
      return { ok: false, error: '文件超过 8MB，请确认是否选错了文件' }
    }
    const text = await readFile(file, 'utf8')
    const ext = path.extname(file).toLowerCase()

    let data: AppData
    if (ext === '.csv') {
      const parsed = parseStocksCsv(text)
      if (parsed.rows.length === 0) {
        return {
          ok: false,
          error: parsed.skipped > 0 ? 'CSV 里没有可识别的股票行（需为「分组,名称,代码」）' : 'CSV 内容为空',
        }
      }
      data = appDataFromCsvRows(parsed.rows)
    } else {
      const parsed = JSON.parse(text) as { data?: unknown } | unknown
      const candidate =
        parsed && typeof parsed === 'object' && 'data' in (parsed as Record<string, unknown>)
          ? (parsed as { data: unknown }).data
          : parsed
      data = normalizeAppData(candidate)
    }

    const stockCount = countStocks(data.groups)
    if (stockCount === 0) {
      return { ok: false, error: '文件里没有股票数据' }
    }

    return { ok: true, data, stockCount, fileName, path: file }
  } catch (error) {
    return { ok: false, error: `读取失败：${toMessage(error)}` }
  }
}
