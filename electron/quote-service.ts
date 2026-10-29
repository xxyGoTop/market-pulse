/**
 * 行情服务（主进程）
 *
 * 为什么放在主进程：
 * 1. 渲染层是 contextIsolation + 无 Node 的沙箱，直连第三方接口会被 CORS 拦掉；
 * 2. 三家源都需要自定义 UA / Referer，浏览器环境下改不了；
 * 3. 网络请求、超时、缓存、限流集中一处，渲染层只拿结构化数据。
 *
 * 合规边界：只读取公开行情接口的价格类字段，用于本地展示；
 * 不做交易动作、不落库、不转发、不对外提供接口。
 */

import type { Quote, QuoteBatch, QuoteRequest, QuoteSource } from '../src/types'
import {
  MARKET_INDEXES,
  QUOTE_SOURCE_META,
  isMarketIndexCode,
  isQuoteSource,
} from '../src/services/constants'
import { collectQuoteCodes, eastmoneySecid, normalizeQuoteCode } from '../src/services/quote-code'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const TIMEOUT_MS = 6000
/** 同参数请求的最小间隔：切换设置时可能连续触发，避免把源站打爆 */
const CACHE_TTL_MS = 1500
const MAX_CODES = 40

interface RawQuote {
  code: string
  name: string
  price: number
  prevClose: number
  open: number
  high: number
  low: number
  volume: number
  amount: number
  time: number
}

/* ------------------------------------------------------------------ *
 * 通用工具
 * ------------------------------------------------------------------ */

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '-' || trimmed === '--') return Number.NaN
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }
  return Number.NaN
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * 新浪与腾讯返回 GBK，东财返回 UTF-8。
 * 先按预期编码解，出现替换字符再换另一种，避免硬编码单一编码出错。
 */
function decodeBody(buffer: ArrayBuffer, gbkFirst: boolean): string {
  const order = gbkFirst ? ['gbk', 'utf-8'] : ['utf-8', 'gbk']
  for (const encoding of order) {
    try {
      const text = new TextDecoder(encoding).decode(buffer)
      if (!text.includes('\uFFFD')) return text
    } catch {
      // 运行时没有该编码，换下一个
    }
  }
  return new TextDecoder('utf-8').decode(buffer)
}

async function request(
  url: string,
  options: { headers?: Record<string, string>; gbkFirst?: boolean } = {},
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: '*/*', ...options.headers },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return decodeBody(await response.arrayBuffer(), options.gbkFirst ?? false)
  } finally {
    clearTimeout(timer)
  }
}

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return '请求超时'
    if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(error.message)) return '网络不可达'
    return error.message
  }
  return String(error)
}

/** 涨跌额与涨跌幅统一本地计算，不吃各源字段口径的差异 */
function buildQuote(raw: RawQuote, source: QuoteSource): Quote | null {
  if (!Number.isFinite(raw.price) || raw.price <= 0) return null
  const prevClose = positive(raw.prevClose, raw.price)
  const change = raw.price - prevClose
  return {
    code: raw.code,
    name: raw.name,
    price: raw.price,
    prevClose,
    change,
    changePercent: prevClose > 0 ? (change / prevClose) * 100 : 0,
    open: positive(raw.open, raw.price),
    high: positive(raw.high, raw.price),
    low: positive(raw.low, raw.price),
    volume: Number.isFinite(raw.volume) ? raw.volume : 0,
    amount: Number.isFinite(raw.amount) ? raw.amount : 0,
    time: Number.isFinite(raw.time) && raw.time > 0 ? raw.time : Date.now(),
    source,
  }
}

/* ------------------------------------------------------------------ *
 * 东方财富：push2 批量接口
 * f2 最新价 / f5 成交量(手) / f6 成交额(元) / f12 代码 / f13 市场
 * f14 名称 / f15 最高 / f16 最低 / f17 今开 / f18 昨收 / f124 时间戳(秒)
 * ------------------------------------------------------------------ */

const EASTMONEY_FIELDS = 'f2,f5,f6,f12,f13,f14,f15,f16,f17,f18,f124'

async function fetchEastmoney(codes: string[]): Promise<RawQuote[]> {
  const out: RawQuote[] = []
  for (const part of chunk(codes, MAX_CODES)) {
    const lookup = new Map<string, string>()
    for (const code of part) {
      const secid = eastmoneySecid(code)
      if (secid) lookup.set(secid, code)
    }
    if (!lookup.size) continue

    const url =
      `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=${EASTMONEY_FIELDS}` +
      `&secids=${[...lookup.keys()].join(',')}`
    const text = await request(url, { headers: { Referer: 'https://quote.eastmoney.com/' } })

    let payload: { data?: { diff?: unknown } }
    try {
      payload = JSON.parse(text) as { data?: { diff?: unknown } }
    } catch {
      throw new Error('返回内容不是合法 JSON')
    }

    const diff = payload?.data?.diff
    const rows = Array.isArray(diff)
      ? diff
      : diff && typeof diff === 'object'
        ? Object.values(diff)
        : []

    for (const row of rows as Array<Record<string, unknown>>) {
      const code = lookup.get(`${toNumber(row.f13)}.${String(row.f12 ?? '')}`)
      if (!code) continue
      const seconds = toNumber(row.f124)
      out.push({
        code,
        name: typeof row.f14 === 'string' ? row.f14 : '',
        price: toNumber(row.f2),
        prevClose: toNumber(row.f18),
        open: toNumber(row.f17),
        high: toNumber(row.f15),
        low: toNumber(row.f16),
        volume: toNumber(row.f5),
        amount: toNumber(row.f6),
        time: Number.isFinite(seconds) ? seconds * 1000 : Date.now(),
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * 新浪财经：hq.sinajs.cn，GBK，必须带 Referer
 * 0 名称 / 1 今开 / 2 昨收 / 3 现价 / 4 最高 / 5 最低
 * 8 成交量(股) / 9 成交额(元) / 30 日期 / 31 时间
 * ------------------------------------------------------------------ */

const SINA_LINE = /var hq_str_([a-z]{2}\d{6})="([^"]*)"/g

function parseSinaTime(date: string, time: string): number {
  const parsed = Date.parse(`${date}T${time}+08:00`)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

async function fetchSina(codes: string[]): Promise<RawQuote[]> {
  const out: RawQuote[] = []
  for (const part of chunk(codes, 30)) {
    const url = `https://hq.sinajs.cn/list=${part.join(',')}`
    const text = await request(url, {
      headers: { Referer: 'https://finance.sina.com.cn/' },
      gbkFirst: true,
    })

    for (const match of text.matchAll(SINA_LINE)) {
      const code = normalizeQuoteCode(match[1])
      const cells = match[2].split(',')
      // 停牌或代码无效时新浪返回空串，长度不足直接跳过
      if (!code || cells.length < 32) continue
      out.push({
        code,
        name: cells[0],
        open: toNumber(cells[1]),
        prevClose: toNumber(cells[2]),
        price: toNumber(cells[3]),
        high: toNumber(cells[4]),
        low: toNumber(cells[5]),
        // 新浪的成交量单位是股，统一换算成手
        volume: toNumber(cells[8]) / 100,
        amount: toNumber(cells[9]),
        time: parseSinaTime(cells[30], cells[31]),
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * 腾讯财经：qt.gtimg.cn，GBK
 * 1 名称 / 3 现价 / 4 昨收 / 5 今开 / 6 成交量(手)
 * 30 时间(yyyyMMddHHmmss) / 33 最高 / 34 最低 / 37 成交额(万元)
 * ------------------------------------------------------------------ */

const TENCENT_LINE = /v_([a-z]{2}\d{6})="([^"]*)"/g

function parseTencentTime(value: string): number {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return Date.now()
  const [, year, month, day, hour, minute, second] = match
  const parsed = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

async function fetchTencent(codes: string[]): Promise<RawQuote[]> {
  const out: RawQuote[] = []
  for (const part of chunk(codes, 30)) {
    const url = `https://qt.gtimg.cn/q=${part.join(',')}`
    const text = await request(url, { gbkFirst: true })

    for (const match of text.matchAll(TENCENT_LINE)) {
      const code = normalizeQuoteCode(match[1])
      const cells = match[2].split('~')
      if (!code || cells.length < 38) continue
      out.push({
        code,
        name: cells[1],
        price: toNumber(cells[3]),
        prevClose: toNumber(cells[4]),
        open: toNumber(cells[5]),
        volume: toNumber(cells[6]),
        high: toNumber(cells[33]),
        low: toNumber(cells[34]),
        // 腾讯的成交额单位是万元
        amount: toNumber(cells[37]) * 10000,
        time: parseTencentTime(cells[30]),
      })
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * 对外接口
 * ------------------------------------------------------------------ */

const ADAPTERS: Record<QuoteSource, (codes: string[]) => Promise<RawQuote[]>> = {
  eastmoney: fetchEastmoney,
  sina: fetchSina,
  tencent: fetchTencent,
}

const cache = new Map<string, QuoteBatch>()

function cacheKey(request: QuoteRequest): string {
  return `${request.source}|${request.codes.join(',')}|${request.indexCodes.join(',')}`
}

/** 主进程侧的入参校验：渲染层传什么都先过这一层 */
export function sanitizeQuoteRequest(payload: unknown): QuoteRequest | null {
  if (!payload || typeof payload !== 'object') return null
  const input = payload as Partial<QuoteRequest>
  if (!isQuoteSource(input.source)) return null
  if (!Array.isArray(input.codes) || !Array.isArray(input.indexCodes)) return null

  const codes = collectQuoteCodes(
    input.codes.filter((code): code is string => typeof code === 'string'),
    MAX_CODES,
  )
  const indexCodes = [...new Set(input.indexCodes.filter(isMarketIndexCode))]
  return { source: input.source, codes, indexCodes }
}

export async function fetchQuotes(request: QuoteRequest): Promise<QuoteBatch> {
  const key = cacheKey(request)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached

  const all = [...request.codes, ...request.indexCodes]
  if (!all.length) {
    const empty: QuoteBatch = {
      ok: true,
      source: request.source,
      quotes: {},
      indexes: {},
      fetchedAt: Date.now(),
    }
    cache.set(key, empty)
    return empty
  }

  try {
    const raws = await ADAPTERS[request.source](all)
    const quotes: Record<string, Quote> = {}
    const indexes: Record<string, Quote> = {}

    for (const raw of raws) {
      const quote = buildQuote(raw, request.source)
      if (!quote) continue
      if (request.indexCodes.includes(raw.code)) {
        // 指数名称以本地表为准，避免个别源返回空名
        indexes[raw.code] = { ...quote, name: MARKET_INDEXES[raw.code]?.label ?? quote.name }
      } else if (request.codes.includes(raw.code)) {
        quotes[raw.code] = quote
      }
    }

    const batch: QuoteBatch = {
      ok: true,
      source: request.source,
      quotes,
      indexes,
      fetchedAt: Date.now(),
    }
    cache.set(key, batch)
    if (cache.size > 8) {
      const oldest = cache.keys().next().value
      if (oldest) cache.delete(oldest)
    }
    return batch
  } catch (error) {
    return {
      ok: false,
      source: request.source,
      quotes: {},
      indexes: {},
      fetchedAt: Date.now(),
      error: `${QUOTE_SOURCE_META[request.source].label}行情获取失败：${toMessage(error)}`,
    }
  }
}
