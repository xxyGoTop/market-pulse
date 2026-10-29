import { computed } from 'vue'
import type { MarketStatus, Quote } from '@/types'
import { MARKET_STATUS_META, MARKET_STATUS_ORDER } from '@/services/constants'
import { appendStatusHistory } from '@/services/app-data'
import { formatPercent } from '@/services/market-rules'
import { playStatusSound } from '@/services/sound'
import { useAppData } from './useAppData'
import { useDesktop } from './useDesktop'
import { useToast } from './useToast'

const desktop = useDesktop()

export function useMarketStatus() {
  const { state, settings, updateSettings } = useAppData()
  const toast = useToast()

  const current = computed<MarketStatus>(() => settings.value.marketStatus)
  const meta = computed(() => MARKET_STATUS_META[current.value])
  const options = computed(() =>
    MARKET_STATUS_ORDER.map((key) => ({ key, ...MARKET_STATUS_META[key] })),
  )
  const history = computed(() => state.data.statusHistory)

  /**
   * 手动与自动共用一条提交路径：写历史、存设置、播提示音、推通知。
   * 区别只在文案与通知标题，避免两条链路各写一遍导致行为漂移。
   */
  async function commitStatus(
    next: MarketStatus,
    origin: 'manual' | 'auto',
    detail?: string,
  ): Promise<void> {
    if (next === current.value) return

    state.data.statusHistory = appendStatusHistory(state.data.statusHistory, next, Date.now())
    await updateSettings({ marketStatus: next })

    const label = MARKET_STATUS_META[next].label
    playStatusSound(settings.value.notificationSound)

    if (origin === 'manual') {
      toast.success(`大盘状态已切换为「${label}」`)
    } else {
      toast.info(`规则判断切换为「${label}」${detail ? ` · ${detail}` : ''}`)
    }

    if (settings.value.notifyOnStatusChange) {
      if (origin === 'manual') {
        void desktop.showNotification('Market Pulse · 大盘状态变更', `当前阶段：${label}（手动设置）`)
      } else {
        void desktop.showNotification(
          'Market Pulse · 大盘阶段自动调整',
          `当前阶段：${label}${detail ? `（${detail}）` : ''}`,
        )
      }
    }
  }

  /** 手动切换 */
  async function setStatus(next: MarketStatus): Promise<void> {
    await commitStatus(next, 'manual')
  }

  /** 规则命中并满足连续确认后由行情轮询调用 */
  async function applyAutoStatus(next: MarketStatus, quote?: Quote): Promise<void> {
    await commitStatus(
      next,
      'auto',
      quote ? `${quote.name} ${formatPercent(quote.changePercent)}` : undefined,
    )
  }

  return { current, meta, options, history, setStatus, applyAutoStatus }
}
