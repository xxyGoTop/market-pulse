/**
 * 行情轮询与规则自动判断
 *
 * 分工：
 * - 主进程负责取数（见 electron/quote-service.ts）；
 * - 这里负责「什么时候取」和「取回来怎么用」：
 *   按设置里的间隔轮询、交易时段之外停手、连续确认后才交给规则切换状态。
 *
 * 状态放在模块级单例里，所有组件共享同一份快照，
 * 避免每个组件各轮询一次。
 */

import { computed, reactive, watch } from 'vue'
import type { MarketStatus, Quote, QuoteBatch } from '@/types'
import { collectQuoteCodes } from '@/services/quote-code'
import { evaluateStatus } from '@/services/market-rules'
import { isTradingTime } from '@/services/time'
import { useAppData } from './useAppData'
import { useDesktop } from './useDesktop'
import { useMarketStatus } from './useMarketStatus'

interface QuoteState {
  /** 规范代码（sh600519）→ 行情 */
  quotes: Record<string, Quote>
  /** 指数代码（sh000001）→ 行情 */
  indexes: Record<string, Quote>
  fetchedAt: number
  loading: boolean
  error: string | null
}

const state = reactive<QuoteState>({
  quotes: {},
  indexes: {},
  fetchedAt: 0,
  loading: false,
  error: null,
})

const desktop = useDesktop()

let timer: ReturnType<typeof setTimeout> | null = null
let running = false
let inFlight = false
/** 连续确认计数：同一档连续命中 confirm 次才真正切换 */
let streak: { status: MarketStatus | null; count: number } = { status: null, count: 0 }

function stockCodes(): string[] {
  const { groups } = useAppData()
  return collectQuoteCodes(groups.value.flatMap((group) => group.stocks.map((s) => s.code)))
}

/** 取回一批行情后交给规则引擎判断是否需要自动切换状态 */
async function applyRule(batch: QuoteBatch): Promise<void> {
  const { settings } = useAppData()
  const rule = settings.value.marketRule
  if (!rule.auto) {
    streak = { status: null, count: 0 }
    return
  }

  const quote = batch.indexes[rule.indexCode]
  if (!quote) return

  const { current, applyAutoStatus } = useMarketStatus()
  const next = evaluateStatus(quote.changePercent, rule)

  if (next === current.value) {
    streak = { status: null, count: 0 }
    return
  }

  if (streak.status === next) {
    streak.count += 1
  } else {
    streak = { status: next, count: 1 }
  }

  if (streak.count >= Math.max(1, rule.confirm)) {
    streak = { status: null, count: 0 }
    await applyAutoStatus(next, quote)
  }
}

/** 拉一次行情。并发调用会直接返回，避免设置变更时连打源站。 */
export async function refreshQuotes(): Promise<void> {
  if (inFlight) return
  const { settings } = useAppData()

  inFlight = true
  state.loading = true
  try {
    const batch = await desktop.fetchQuotes({
      source: settings.value.quoteSource,
      codes: stockCodes(),
      indexCodes: [settings.value.marketRule.indexCode],
    })

    if (!batch.ok) {
      // 失败时保留上一次的行情，界面标灰并给出原因，比清空更有用
      state.error = batch.error ?? '行情获取失败'
      return
    }

    state.quotes = batch.quotes
    state.indexes = batch.indexes
    state.fetchedAt = batch.fetchedAt
    state.error = null
    await applyRule(batch)
  } catch (error) {
    state.error = error instanceof Error ? error.message : '行情获取失败'
  } finally {
    inFlight = false
    state.loading = false
  }
}

function schedule(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!running) return
  const { settings } = useAppData()
  const interval = settings.value.quoteRefresh
  // 0 表示只在手动触发时刷新
  if (!interval) return
  timer = setTimeout(() => void tick(), Math.max(5, interval) * 1000)
}

async function tick(): Promise<void> {
  timer = null
  if (!running) return
  // 收盘后行情不再变化，轮询空转既浪费流量也打扰源站
  if (document.visibilityState === 'visible' && isTradingTime()) {
    await refreshQuotes()
  }
  schedule()
}

/**
 * 启动轮询，返回停止函数。
 * 数据源、刷新间隔、基准指数、自选股列表任一变化都会立即重新取一次。
 */
export function startQuotePolling(): () => void {
  if (running) return () => undefined
  running = true

  const { settings, groups } = useAppData()

  const stopSettings = watch(
    () =>
      [
        settings.value.quoteSource,
        settings.value.quoteRefresh,
        settings.value.marketRule.indexCode,
        settings.value.marketRule.auto,
      ] as const,
    () => {
      void refreshQuotes()
      schedule()
    },
  )

  const stopCodes = watch(
    () => groups.value.map((group) => group.stocks.map((s) => s.code).join(',')).join('|'),
    () => void refreshQuotes(),
  )

  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') void refreshQuotes()
  }
  document.addEventListener('visibilitychange', onVisibility)

  void refreshQuotes()
  schedule()

  return () => {
    running = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    streak = { status: null, count: 0 }
    stopSettings()
    stopCodes()
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

export function useQuotes() {
  const { settings } = useAppData()

  const indexQuote = computed<Quote | undefined>(
    () => state.indexes[settings.value.marketRule.indexCode],
  )
  /** 有数据且最近一次没报错才算「实时」 */
  const live = computed(() => state.fetchedAt > 0 && !state.error)

  function quoteOf(code: string): Quote | undefined {
    const normalized = collectQuoteCodes([code])[0]
    return normalized ? state.quotes[normalized] : undefined
  }

  return { state, indexQuote, live, quoteOf, refresh: refreshQuotes }
}
