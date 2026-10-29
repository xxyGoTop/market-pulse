import type {
  AppData,
  AppSettings,
  ImportMode,
  MarketStatus,
  StatusHistoryItem,
  StockGroup,
  StockGroupType,
  StockItem,
} from '@/types'
import {
  APP_VERSION,
  COMPACT_WIDTH,
  DEFAULT_GROUPS,
  DEFAULT_MARKET_RULE,
  MAX_STOCKS_PER_GROUP,
  OPACITY_RANGE,
  REFRESH_OPTIONS,
  STOCK_GROUP_META,
  STOCK_GROUP_ORDER,
  isMarketStatus,
  isQuoteSource,
  isSkinName,
  isSoundName,
  isThemeMode,
} from './constants'
import { clampRule } from './market-rules'

export const DEFAULT_SETTINGS: AppSettings = {
  marketStatus: 'rebounding',
  theme: 'system',
  skin: 'sky',
  alwaysOnTop: true,
  opacity: 1,
  compactWidth: COMPACT_WIDTH.default,
  compactMode: true,
  launchAtLogin: false,
  notifyOnStatusChange: false,
  notificationSound: 'chime',
  quoteSource: 'eastmoney',
  quoteRefresh: 30,
  marketRule: { ...DEFAULT_MARKET_RULE },
}

export function createDefaultAppData(): AppData {
  return {
    version: APP_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    groups: DEFAULT_GROUPS.map((group) => ({ ...group, stocks: [] })),
    statusHistory: [],
  }
}

export function createStock(name: string, code: string, note?: string): StockItem {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    code: normalizeCode(code),
    name: name.trim(),
    addedAt: Date.now(),
    ...(note ? { note } : {}),
  }
}

/** 股票代码统一去空格并转大写后比较 */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

export function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(OPACITY_RANGE.max, Math.max(OPACITY_RANGE.min, value))
}

/** 窄条宽度取整到 step，并夹在允许区间内 */
export function clampCompactWidth(value: number): number {
  if (!Number.isFinite(value)) return COMPACT_WIDTH.default
  const { min, max, step } = COMPACT_WIDTH
  const snapped = Math.round(value / step) * step
  return Math.min(max, Math.max(min, snapped))
}

/**
 * 记录状态变更历史：只有状态真正变化时才追加，最多保留 50 条。
 */
export function appendStatusHistory(
  history: StatusHistoryItem[],
  status: MarketStatus,
  changedAt: number,
): StatusHistoryItem[] {
  const last = history[history.length - 1]
  if (last && last.status === status) return history
  return [...history, { status, changedAt }].slice(-50)
}

/**
 * 把任意来源（历史版本、损坏数据、外部输入）的原始数据规整成合法的 AppData。
 * 缺失分组补齐、超出容量的股票截断、非法枚举回落到默认值。
 */
export function normalizeAppData(raw: unknown): AppData {
  const base = createDefaultAppData()
  if (!raw || typeof raw !== 'object') return base

  const input = raw as Partial<AppData>
  const inputSettings = (input.settings ?? {}) as Partial<AppSettings>

  // 窄条宽度刻度在 v3 变了（旧默认 700×88，新默认 340×46），
  // 旧存档里的值在新刻度下没有意义，直接回到新默认值而不是夹到上限
  const incomingVersion = typeof input.version === 'number' ? input.version : 0
  const rawWidth =
    typeof inputSettings.compactWidth === 'number' ? inputSettings.compactWidth : Number.NaN
  const widthUsable =
    incomingVersion >= 3 &&
    Number.isFinite(rawWidth) &&
    rawWidth >= COMPACT_WIDTH.min &&
    rawWidth <= COMPACT_WIDTH.max

  const settings: AppSettings = {
    marketStatus: isMarketStatus(inputSettings.marketStatus)
      ? inputSettings.marketStatus
      : base.settings.marketStatus,
    theme: isThemeMode(inputSettings.theme) ? inputSettings.theme : base.settings.theme,
    skin: isSkinName(inputSettings.skin) ? inputSettings.skin : base.settings.skin,
    alwaysOnTop:
      typeof inputSettings.alwaysOnTop === 'boolean'
        ? inputSettings.alwaysOnTop
        : base.settings.alwaysOnTop,
    opacity: clampOpacity(
      typeof inputSettings.opacity === 'number' ? inputSettings.opacity : base.settings.opacity,
    ),
    compactWidth: widthUsable ? clampCompactWidth(rawWidth) : base.settings.compactWidth,
    compactMode:
      typeof inputSettings.compactMode === 'boolean'
        ? inputSettings.compactMode
        : base.settings.compactMode,
    launchAtLogin:
      typeof inputSettings.launchAtLogin === 'boolean'
        ? inputSettings.launchAtLogin
        : base.settings.launchAtLogin,
    notifyOnStatusChange:
      typeof inputSettings.notifyOnStatusChange === 'boolean'
        ? inputSettings.notifyOnStatusChange
        : base.settings.notifyOnStatusChange,
    notificationSound: isSoundName(inputSettings.notificationSound)
      ? inputSettings.notificationSound
      : base.settings.notificationSound,
    quoteSource: isQuoteSource(inputSettings.quoteSource)
      ? inputSettings.quoteSource
      : base.settings.quoteSource,
    quoteRefresh: (REFRESH_OPTIONS as readonly number[]).includes(inputSettings.quoteRefresh as number)
      ? (inputSettings.quoteRefresh as number)
      : base.settings.quoteRefresh,
    marketRule: clampRule(inputSettings.marketRule),
  }

  const bounds = inputSettings.windowBounds
  if (
    bounds &&
    [bounds.x, bounds.y, bounds.width, bounds.height].every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    settings.windowBounds = {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    }
  }

  const rawGroups = Array.isArray(input.groups) ? input.groups : []
  const groups: StockGroup[] = STOCK_GROUP_ORDER.map((type) => {
    const meta = base.groups.find((g) => g.type === type)!
    const found = rawGroups.find((g) => g && g.type === type)
    if (!found) return { ...meta, stocks: [] }

    const seen = new Set<string>()
    const stocks: StockItem[] = []
    for (const item of Array.isArray(found.stocks) ? found.stocks : []) {
      if (!item || typeof item.name !== 'string' || typeof item.code !== 'string') continue
      const code = normalizeCode(item.code)
      const name = item.name.trim()
      if (!code || !name) continue
      if (seen.has(code)) continue
      seen.add(code)
      stocks.push({
        id: typeof item.id === 'string' && item.id ? item.id : createStock(name, code).id,
        code,
        name,
        addedAt: typeof item.addedAt === 'number' ? item.addedAt : Date.now(),
        ...(typeof item.note === 'string' && item.note ? { note: item.note } : {}),
      })
      if (stocks.length >= MAX_STOCKS_PER_GROUP) break
    }
    return { ...meta, stocks }
  })

  const statusHistory = Array.isArray(input.statusHistory)
    ? input.statusHistory
        .filter((h) => h && isMarketStatus(h.status) && typeof h.changedAt === 'number')
        .slice(-50)
        .map((h) => ({ status: h.status, changedAt: h.changedAt }))
    : []

  return { version: APP_VERSION, settings, groups, statusHistory }
}

/* ------------------------------------------------------------------ *
 * 自选股导入 / 导出
 * CSV 采用「分组,名称,代码」三列；两列文件按「名称,代码」解析并归入中长期。
 * 解析与生成都是纯函数，便于单测与在主进程复用。
 * ------------------------------------------------------------------ */

export interface CsvStockRow {
  type: StockGroupType
  name: string
  code: string
}

export interface CsvParseResult {
  rows: CsvStockRow[]
  /** 分组无法识别 / 字段缺失而被跳过的行数 */
  skipped: number
  /** 是否识别到表头 */
  hasHeader: boolean
}

/** 分组名 / 别名 / 枚举值都能识别 */
const GROUP_ALIAS = new Map<string, StockGroupType>([
  ['短博反弹', 'short_rebound'],
  ['短博', 'short_rebound'],
  ['short_rebound', 'short_rebound'],
  ['中长期', 'mid_long_term'],
  ['中长', 'mid_long_term'],
  ['mid_long_term', 'mid_long_term'],
  ['分红型', 'dividend'],
  ['分红', 'dividend'],
  ['dividend', 'dividend'],
])

const HEADER_HINTS = new Set(['分组', '组别', 'group', '名称', '股票名称', 'name', '代码', '股票代码', 'code'])

/** 支持引号包裹、逗号与换行的 CSV 行拆分 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      cells.push(cell)
      cell = ''
    } else {
      cell += ch
    }
  }
  cells.push(cell)
  return cells.map((c) => c.trim())
}

function isHeaderRow(cells: string[]): boolean {
  return cells.some((c) => HEADER_HINTS.has(c.toLowerCase()) || HEADER_HINTS.has(c))
}

/** 解析 CSV 文本，容忍 BOM、CRLF、空行、多余列 */
export function parseStocksCsv(text: string): CsvParseResult {
  const rows: CsvStockRow[] = []
  let skipped = 0
  let hasHeader = false

  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0)

  for (const line of lines) {
    const cells = splitCsvLine(line)
    if (!hasHeader && isHeaderRow(cells)) {
      hasHeader = true
      continue
    }

    if (cells.length >= 3) {
      const type = GROUP_ALIAS.get(cells[0].toLowerCase()) ?? GROUP_ALIAS.get(cells[0])
      const name = cells[1]
      const code = normalizeCode(cells[2])
      if (!type || !name || !code) {
        skipped++
        continue
      }
      rows.push({ type, name, code })
    } else if (cells.length === 2) {
      const name = cells[0]
      const code = normalizeCode(cells[1])
      if (!name || !code) {
        skipped++
        continue
      }
      rows.push({ type: 'mid_long_term', name, code })
    } else if (cells.length === 1) {
      if (cells[0]) skipped++
    }
  }

  return { rows, skipped, hasHeader }
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** 导出 CSV：带 BOM，Excel 直接双击打开不乱码 */
export function toStocksCsv(groups: StockGroup[]): string {
  const lines = ['分组,名称,代码']
  for (const group of groups) {
    const label = STOCK_GROUP_META[group.type].name
    for (const stock of group.stocks) {
      lines.push([csvCell(label), csvCell(stock.name), csvCell(stock.code)].join(','))
    }
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

/** 由 CSV 行构造一份只含自选股的 AppData（设置走默认值） */
export function appDataFromCsvRows(rows: CsvStockRow[]): AppData {
  const data = createDefaultAppData()
  for (const row of rows) {
    const group = data.groups.find((g) => g.type === row.type)
    if (!group || group.stocks.length >= MAX_STOCKS_PER_GROUP) continue
    if (group.stocks.some((s) => s.code === row.code)) continue
    group.stocks.push(createStock(row.name, row.code))
  }
  return data
}

export function countStocks(groups: StockGroup[]): number {
  return groups.reduce((sum, group) => sum + group.stocks.length, 0)
}

/**
 * 导入合并：
 * - replace：整体替换（容量与去重由调用方先规整过）
 * - append：按分组追加，同组同代码跳过，超出容量截断
 */
export function mergeGroups(
  current: StockGroup[],
  incoming: StockGroup[],
  mode: ImportMode,
): StockGroup[] {
  if (mode === 'replace') return incoming

  return STOCK_GROUP_ORDER.map((type) => {
    const base = current.find((g) => g.type === type) ?? {
      type,
      ...STOCK_GROUP_META[type],
      stocks: [],
    }
    const extra = incoming.find((g) => g.type === type)
    const seen = new Set<string>()
    const stocks: StockItem[] = []
    for (const stock of [...base.stocks, ...(extra?.stocks ?? [])]) {
      const code = normalizeCode(stock.code)
      if (!code || seen.has(code)) continue
      seen.add(code)
      stocks.push({ ...stock, code })
      if (stocks.length >= MAX_STOCKS_PER_GROUP) break
    }
    return { ...base, stocks }
  })
}
