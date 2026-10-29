import { describe, expect, it } from 'vitest'
import type { StatusHistoryItem } from '@/types'
import {
  MARKET_STATUS_META,
  MARKET_STATUS_ORDER,
  STOCK_GROUP_META,
  STOCK_GROUP_ORDER,
  TONES,
  isMarketStatus,
  tone,
} from '@/services/constants'
import { appendStatusHistory } from '@/services/app-data'

const HEX = /^#[0-9A-Fa-f]{6}$/

describe('MARKET_STATUS_META', () => {
  it('四种状态与顺序一致', () => {
    expect(MARKET_STATUS_ORDER).toEqual(['bottoming', 'declining', 'rebounding', 'bullish'])
    expect(Object.keys(MARKET_STATUS_META)).toHaveLength(4)
  })

  it('每个状态都有中文名、副标题、配色、图标与提示', () => {
    for (const key of MARKET_STATUS_ORDER) {
      const meta = MARKET_STATUS_META[key]
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.subtitle.length).toBeGreaterThan(0)
      expect(meta.icon.length).toBeGreaterThan(0)
      expect(meta.hint.length).toBeGreaterThan(0)
      expect(meta.tone in TONES).toBe(true)
    }
  })

  it('每个 tone 的 6 个颜色值都合法', () => {
    for (const t of Object.values(TONES)) {
      expect(t.a).toMatch(HEX)
      expect(t.b).toMatch(HEX)
      expect(t.soft).toMatch(HEX)
      expect(t.softDark).toMatch(HEX)
      expect(t.ink).toMatch(HEX)
      expect(t.inkDark).toMatch(HEX)
    }
  })

  it('四种状态使用互不相同的 tone（颜色可区分）', () => {
    const tones = MARKET_STATUS_ORDER.map((key) => MARKET_STATUS_META[key].tone)
    expect(new Set(tones).size).toBe(4)
  })

  it('tone() 对未知值退回 neutral', () => {
    expect(tone('nope' as never)).toBe(TONES.neutral)
    expect(tone(undefined)).toBe(TONES.neutral)
  })

  it('状态 key 校验', () => {
    expect(isMarketStatus('bullish')).toBe(true)
    expect(isMarketStatus('moon')).toBe(false)
    expect(isMarketStatus(undefined)).toBe(false)
  })
})

describe('STOCK_GROUP_META', () => {
  it('三个固定分组，配色固定不随大盘变化', () => {
    expect(STOCK_GROUP_ORDER).toEqual(['short_rebound', 'mid_long_term', 'dividend'])
    expect(STOCK_GROUP_META.short_rebound.tone).toBe('orange')
    expect(STOCK_GROUP_META.mid_long_term.tone).toBe('blue')
    expect(STOCK_GROUP_META.dividend.tone).toBe('gold')
  })

  it('分组缩写用于窄条，长度不超过 2 字', () => {
    for (const type of STOCK_GROUP_ORDER) {
      expect(STOCK_GROUP_META[type].shortName.length).toBeLessThanOrEqual(2)
    }
  })
})

describe('appendStatusHistory', () => {
  it('首次切换写入一条记录', () => {
    const history = appendStatusHistory([], 'declining', 1000)
    expect(history).toEqual([{ status: 'declining', changedAt: 1000 }])
  })

  it('状态未变化时不重复写入', () => {
    const history = appendStatusHistory([{ status: 'bullish', changedAt: 1 }], 'bullish', 2)
    expect(history).toHaveLength(1)
  })

  it('最多保留 50 条', () => {
    let history: StatusHistoryItem[] = []
    for (let i = 0; i < 80; i++) {
      history = appendStatusHistory(history, i % 2 === 0 ? 'bottoming' : 'declining', i)
    }
    expect(history).toHaveLength(50)
    expect(history[history.length - 1].changedAt).toBe(79)
  })
})
