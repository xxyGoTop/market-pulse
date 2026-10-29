/**
 * 股票代码归一化
 *
 * 用户可能输入 600519 / sh600519 / 600519.SH / 1.600519 等多种写法，
 * 三个行情源又各有一套符号（新浪腾讯用 sh600519，东财用 1.600519）。
 * 这里统一收敛成「市场前缀 + 6 位数字」的规范形式，作为全局唯一键：
 *   个股 sh600519 / sz000001 / bj830799
 *   指数 sh000001 / sz399001 / sz399006
 *
 * 指数与个股的 6 位代码会撞车（上证指数 000001 vs 平安银行 000001），
 * 因此裸 6 位数字一律按个股处理，指数必须带市场前缀。
 */

export type MarketPrefix = 'sh' | 'sz' | 'bj'

const PREFIXED = /^(sh|sz|bj)(\d{6})$/
const SUFFIXED = /^(\d{6})\.(sh|sz|bj)$/
const SECID = /^[01]\.(\d{6})$/
const BARE = /^(\d{6})$/

/** 沪：5/6/7/9 开头（ETF、A 股、申购、B 股）；深：0/1/2/3；北交所：4/8 */
function marketByDigits(code: string): MarketPrefix | null {
  const head = code[0]
  if (head === '5' || head === '6' || head === '7' || head === '9') return 'sh'
  if (head === '0' || head === '1' || head === '2' || head === '3') return 'sz'
  if (head === '4' || head === '8') return 'bj'
  return null
}

/**
 * 归一化成「前缀 + 6 位」，无法识别时返回空串。
 * 已带前缀的输入保持原样（这样 sh000001 不会被当成个股）。
 */
export function normalizeQuoteCode(input: string): string {
  const raw = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
  if (!raw) return ''

  const prefixed = PREFIXED.exec(raw)
  if (prefixed) return `${prefixed[1]}${prefixed[2]}`

  const suffixed = SUFFIXED.exec(raw)
  if (suffixed) return `${suffixed[2]}${suffixed[1]}`

  const digits = SECID.exec(raw)?.[1] ?? BARE.exec(raw)?.[1] ?? ''
  if (!digits) return ''
  const market = marketByDigits(digits)
  return market ? `${market}${digits}` : ''
}

/** 规范代码 → 市场前缀；非法返回 null */
export function marketOf(code: string): MarketPrefix | null {
  const match = PREFIXED.exec(String(code ?? '').trim().toLowerCase())
  return match ? (match[1] as MarketPrefix) : null
}

/** 规范代码 → 6 位数字，用于界面展示 */
export function bareCode(code: string): string {
  return normalizeQuoteCode(code).slice(2)
}

/** 新浪 / 腾讯的符号就是规范代码本身 */
export function sinaSymbol(code: string): string {
  return normalizeQuoteCode(code)
}

export const tencentSymbol = sinaSymbol

/** 东方财富 secid：沪市 1，深市与北交所 0 */
export function eastmoneySecid(code: string): string {
  const normalized = normalizeQuoteCode(code)
  if (!normalized) return ''
  return `${normalized.startsWith('sh') ? '1' : '0'}.${normalized.slice(2)}`
}

/** 是否是可以去行情源查的有效代码 */
export function isValidQuoteCode(code: string): boolean {
  return normalizeQuoteCode(code).length === 8
}

/**
 * 从一组股票代码里收集去重后的规范代码，保持原有顺序。
 * 上限 40 个，避免把 URL 拼得过长或触发源站限流。
 */
export function collectQuoteCodes(codes: readonly string[], limit = 40): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const code of codes) {
    const normalized = normalizeQuoteCode(code)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
    if (result.length >= limit) break
  }
  return result
}
