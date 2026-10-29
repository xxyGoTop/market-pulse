import type { AppData, StockGroup, StockGroupType } from '@/types'
import {
  COMPACT_WIDTH,
  MAX_STOCKS_PER_GROUP,
  OPACITY_RANGE,
  REFRESH_OPTIONS,
  STOCK_GROUP_ORDER,
  isMarketStatus,
  isQuoteSource,
  isSkinName,
  isSoundName,
  isThemeMode,
} from './constants'
import { clampCompactWidth, clampOpacity, normalizeCode } from './app-data'
import { isValidRule } from './market-rules'

export interface ValidationResult {
  ok: boolean
  error?: string
}

export interface NewStockInput {
  name: string
  code: string
}

export type NewStockValidation =
  | { ok: true }
  | { ok: false; field: 'name' | 'code' | 'group' | 'duplicate'; message: string }

/** 新增股票校验：非空、分组容量、同组代码去重 */
export function validateNewStock(
  group: StockGroup | undefined,
  input: NewStockInput,
): NewStockValidation {
  const name = input.name.trim()
  const code = normalizeCode(input.code)

  if (!group) {
    return { ok: false, field: 'group', message: '分组不存在' }
  }
  if (!name || !code) {
    return { ok: false, field: 'name', message: '请输入股票名称和代码' }
  }
  if (group.stocks.length >= MAX_STOCKS_PER_GROUP) {
    return { ok: false, field: 'group', message: `该分组最多添加 ${MAX_STOCKS_PER_GROUP} 只股票` }
  }
  if (group.stocks.some((s) => normalizeCode(s.code) === code)) {
    return { ok: false, field: 'code', message: '该股票已在此分组中' }
  }
  return { ok: true }
}

/** 主进程侧的整体数据校验，防止渲染进程写入非法结构 */
export function validateAppData(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') return { ok: false, error: '数据结构无效' }
  const d = data as Partial<AppData>

  if (!d.settings || typeof d.settings !== 'object') {
    return { ok: false, error: '缺少 settings' }
  }
  if (!isMarketStatus(d.settings.marketStatus)) {
    return { ok: false, error: 'marketStatus 非法' }
  }
  if (!isThemeMode(d.settings.theme)) {
    return { ok: false, error: 'theme 非法' }
  }
  if (!isSkinName(d.settings.skin)) {
    return { ok: false, error: 'skin 非法' }
  }
  if (!isSoundName(d.settings.notificationSound)) {
    return { ok: false, error: 'notificationSound 非法' }
  }
  if (!isQuoteSource(d.settings.quoteSource)) {
    return { ok: false, error: 'quoteSource 非法' }
  }
  if (!(REFRESH_OPTIONS as readonly number[]).includes(d.settings.quoteRefresh as number)) {
    return { ok: false, error: 'quoteRefresh 非法' }
  }
  if (!isValidRule(d.settings.marketRule)) {
    return { ok: false, error: 'marketRule 阈值顺序或取值非法' }
  }
  if (typeof d.settings.opacity !== 'number' || clampOpacity(d.settings.opacity) !== d.settings.opacity) {
    return {
      ok: false,
      error: `opacity 超出 ${OPACITY_RANGE.min.toFixed(2)}–${OPACITY_RANGE.max.toFixed(2)}`,
    }
  }
  if (
    typeof d.settings.compactWidth !== 'number' ||
    clampCompactWidth(d.settings.compactWidth) !== d.settings.compactWidth
  ) {
    return { ok: false, error: `compactWidth 超出 ${COMPACT_WIDTH.min}–${COMPACT_WIDTH.max}` }
  }
  if (!Array.isArray(d.groups) || d.groups.length !== STOCK_GROUP_ORDER.length) {
    return { ok: false, error: '分组数量必须为 3' }
  }

  const types = new Set<StockGroupType>()
  for (const group of d.groups as StockGroup[]) {
    if (!group || !STOCK_GROUP_ORDER.includes(group.type)) {
      return { ok: false, error: '分组类型非法' }
    }
    if (types.has(group.type)) return { ok: false, error: '分组类型重复' }
    types.add(group.type)
    if (!Array.isArray(group.stocks)) return { ok: false, error: 'stocks 必须为数组' }
    if (group.stocks.length > MAX_STOCKS_PER_GROUP) {
      return { ok: false, error: `单个分组最多 ${MAX_STOCKS_PER_GROUP} 只股票` }
    }
    const codes = new Set<string>()
    for (const stock of group.stocks) {
      if (!stock || typeof stock.name !== 'string' || typeof stock.code !== 'string') {
        return { ok: false, error: '股票字段非法' }
      }
      const code = normalizeCode(stock.code)
      if (!code || !stock.name.trim()) return { ok: false, error: '股票名称或代码为空' }
      if (codes.has(code)) return { ok: false, error: '同一分组内股票代码重复' }
      codes.add(code)
    }
  }

  if (!Array.isArray(d.statusHistory)) {
    return { ok: false, error: 'statusHistory 必须为数组' }
  }
  return { ok: true }
}
