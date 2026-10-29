import { describe, expect, it } from 'vitest'
import type { StockGroup } from '@/types'
import {
  APP_VERSION,
  COMPACT_WIDTH,
  DEFAULT_MARKET_RULE,
  MAX_STOCKS_PER_GROUP,
  OPACITY_RANGE,
  REFRESH_OPTIONS,
  SOUND_ORDER,
  SKIN_ORDER,
  isSkinName,
  isSoundName,
} from '@/services/constants'
import {
  appDataFromCsvRows,
  clampCompactWidth,
  clampOpacity,
  countStocks,
  createStock,
  mergeGroups,
  normalizeAppData,
  parseStocksCsv,
  toStocksCsv,
} from '@/services/app-data'
import { formatDate, formatDuration, formatRelative, toDays } from '@/services/time'

function group(type: StockGroup['type'], codes: string[]): StockGroup {
  return {
    type,
    name: type,
    description: '',
    stocks: codes.map((code) => createStock(code, code)),
  }
}

describe('clampCompactWidth', () => {
  it('取整到 step', () => {
    expect(clampCompactWidth(344)).toBe(340)
    expect(clampCompactWidth(346)).toBe(350)
  })

  it('夹在 300–560 之间', () => {
    expect(clampCompactWidth(120)).toBe(COMPACT_WIDTH.min)
    expect(clampCompactWidth(4000)).toBe(COMPACT_WIDTH.max)
  })

  it('非法值回落到默认宽度', () => {
    expect(clampCompactWidth(Number.NaN)).toBe(COMPACT_WIDTH.default)
    expect(clampCompactWidth(Number.POSITIVE_INFINITY)).toBe(COMPACT_WIDTH.default)
  })
})

describe('clampOpacity', () => {
  it('下限放宽到 0.65', () => {
    expect(clampOpacity(0.3)).toBe(OPACITY_RANGE.min)
    expect(clampOpacity(0.72)).toBe(0.72)
    expect(clampOpacity(1.4)).toBe(1)
  })
})

describe('枚举守卫', () => {
  it('皮肤与提示音白名单', () => {
    expect(SKIN_ORDER.every(isSkinName)).toBe(true)
    expect(SOUND_ORDER.every(isSoundName)).toBe(true)
    expect(isSkinName('neon')).toBe(false)
    expect(isSoundName('boom')).toBe(false)
    expect(isSoundName(undefined)).toBe(false)
  })
})

describe('parseStocksCsv', () => {
  it('识别表头与三列格式', () => {
    const result = parseStocksCsv('分组,名称,代码\r\n短博反弹,贵州茅台,600519\r\n中长期,宁德时代,300750\r\n')
    expect(result.hasHeader).toBe(true)
    expect(result.skipped).toBe(0)
    expect(result.rows).toEqual([
      { type: 'short_rebound', name: '贵州茅台', code: '600519' },
      { type: 'mid_long_term', name: '宁德时代', code: '300750' },
    ])
  })

  it('两列文件按名称/代码解析并归入中长期', () => {
    const result = parseStocksCsv('名称,代码\n平安银行,000001\n')
    expect(result.rows).toEqual([{ type: 'mid_long_term', name: '平安银行', code: '000001' }])
  })

  it('分组别名与枚举值都能识别', () => {
    const result = parseStocksCsv('分红,长江电力,600900\nmid_long_term,中国平安,601318\n')
    expect(result.rows.map((r) => r.type)).toEqual(['dividend', 'mid_long_term'])
  })

  it('代码统一大写、忽略 BOM 与空行', () => {
    const result = parseStocksCsv('\uFEFF短博反弹,平安银行,sz000001\n\n\n')
    expect(result.rows[0].code).toBe('SZ000001')
  })

  it('无法识别的分组计入 skipped', () => {
    const result = parseStocksCsv('火星股,某公司,600000\n短博反弹,贵州茅台,600519\n')
    expect(result.skipped).toBe(1)
    expect(result.rows).toHaveLength(1)
  })

  it('引号包裹的逗号不被拆开', () => {
    const result = parseStocksCsv('短博反弹,"某某, 科技",600519\n')
    expect(result.rows[0].name).toBe('某某, 科技')
  })
})

describe('toStocksCsv', () => {
  it('带 BOM 与表头，可按原样解析回来', () => {
    const groups = [
      group('short_rebound', ['600519']),
      group('mid_long_term', ['300750', '601318']),
      group('dividend', []),
    ]
    const csv = toStocksCsv(groups)
    expect(csv.startsWith('\uFEFF分组,名称,代码')).toBe(true)

    const parsed = parseStocksCsv(csv)
    expect(parsed.rows).toHaveLength(3)
    expect(parsed.rows.map((r) => r.code)).toEqual(['600519', '300750', '601318'])
  })

  it('含逗号的名称被引号包裹', () => {
    const csv = toStocksCsv([{ ...group('short_rebound', []), stocks: [createStock('某某, 科技', '600519')] }])
    expect(csv).toContain('"某某, 科技"')
  })
})

describe('appDataFromCsvRows', () => {
  it('同组重复代码被跳过，容量受 5 只限制', () => {
    const codes = ['600519', '600519', '600001', '600002', '600003', '600004', '600005', '600006']
    const rows = codes.map((code, i) => ({ type: 'short_rebound' as const, name: `股票${i}`, code }))
    const data = appDataFromCsvRows(rows)
    const target = data.groups.find((g) => g.type === 'short_rebound')!
    expect(target.stocks).toHaveLength(MAX_STOCKS_PER_GROUP)
    expect(target.stocks.filter((s) => s.code === '600519')).toHaveLength(1)
    expect(target.stocks.map((s) => s.code)).toEqual([
      '600519',
      '600001',
      '600002',
      '600003',
      '600004',
    ])
  })

  it('设置沿用默认值', () => {
    const data = appDataFromCsvRows([{ type: 'dividend', name: '长江电力', code: '600900' }])
    expect(data.settings.skin).toBe('sky')
    expect(data.settings.compactWidth).toBe(COMPACT_WIDTH.default)
  })
})

describe('mergeGroups', () => {
  const current = [
    group('short_rebound', ['600519']),
    group('mid_long_term', ['300750']),
    group('dividend', []),
  ]

  it('append 模式追加并去重', () => {
    const incoming = [
      group('short_rebound', ['600519', '000001']),
      group('mid_long_term', []),
      group('dividend', ['600900']),
    ]
    const merged = mergeGroups(current, incoming, 'append')
    expect(merged.find((g) => g.type === 'short_rebound')!.stocks.map((s) => s.code)).toEqual([
      '600519',
      '000001',
    ])
    expect(merged.find((g) => g.type === 'dividend')!.stocks).toHaveLength(1)
    expect(countStocks(merged)).toBe(4)
  })

  it('append 模式超出容量时截断', () => {
    const incoming = [
      group('short_rebound', ['1', '2', '3', '4', '5', '6']),
      group('mid_long_term', []),
      group('dividend', []),
    ]
    const merged = mergeGroups(current, incoming, 'append')
    expect(merged.find((g) => g.type === 'short_rebound')!.stocks).toHaveLength(MAX_STOCKS_PER_GROUP)
  })

  it('replace 模式整体替换', () => {
    const incoming = [group('short_rebound', ['000001'])]
    const merged = mergeGroups(current, incoming, 'replace')
    expect(merged).toBe(incoming)
  })

  it('append 不修改原数组', () => {
    mergeGroups(current, [group('short_rebound', ['000001'])], 'append')
    expect(current[0].stocks).toHaveLength(1)
  })
})

describe('normalizeAppData 版本迁移', () => {
  it('v1 数据补齐后续版本新增字段', () => {
    const data = normalizeAppData({
      version: 1,
      settings: { marketStatus: 'bullish', theme: 'dark', opacity: 0.9, compactMode: false },
      groups: [],
      statusHistory: [],
    })
    expect(data.version).toBe(APP_VERSION)
    expect(data.settings.skin).toBe('sky')
    expect(data.settings.compactWidth).toBe(COMPACT_WIDTH.default)
    expect(data.settings.notificationSound).toBe('chime')
    expect(data.settings.marketStatus).toBe('bullish')
    expect(data.settings.compactMode).toBe(false)
    // V1.2：行情与规则回落到默认值
    expect(data.settings.quoteSource).toBe('eastmoney')
    expect(data.settings.quoteRefresh).toBe(30)
    expect(data.settings.marketRule).toEqual(DEFAULT_MARKET_RULE)
  })

  it('v3 数据补上行情字段，原有设置保留', () => {
    const data = normalizeAppData({
      version: 3,
      settings: { marketStatus: 'declining', skin: 'sand', compactWidth: 420 },
    })
    expect(data.version).toBe(APP_VERSION)
    expect(data.settings.skin).toBe('sand')
    expect(data.settings.compactWidth).toBe(420)
    expect(data.settings.marketRule.auto).toBe(false)
  })

  it('非法的数据源与刷新间隔回落到默认值', () => {
    const data = normalizeAppData({
      settings: { quoteSource: 'baidu', quoteRefresh: 7 },
    })
    expect(data.settings.quoteSource).toBe('eastmoney')
    expect(data.settings.quoteRefresh).toBe(30)
    expect(REFRESH_OPTIONS).toContain(data.settings.quoteRefresh)
  })

  it('阈值顺序被破坏时整组回落到默认值', () => {
    const data = normalizeAppData({
      settings: { marketRule: { auto: true, bullish: -2, rebound: 0.3, decline: -1 } },
    })
    expect(data.settings.marketRule.bullish).toBe(DEFAULT_MARKET_RULE.bullish)
    expect(data.settings.marketRule.auto).toBe(true)
  })

  it('旧版本的窄条宽度回到新默认值', () => {
    // v2 存的是 700×88 时代的宽度，在新刻度下没有意义
    const data = normalizeAppData({ version: 2, settings: { compactWidth: 560 } })
    expect(data.settings.compactWidth).toBe(COMPACT_WIDTH.default)
  })

  it('当前版本的 compactWidth 被规整到 step 与区间', () => {
    expect(normalizeAppData({ version: 3, settings: { compactWidth: 343 } }).settings.compactWidth).toBe(340)
    expect(normalizeAppData({ version: 3, settings: { compactWidth: 280 } }).settings.compactWidth).toBe(
      COMPACT_WIDTH.default,
    )
  })
})

describe('时间格式化', () => {
  const now = new Date('2026-10-28T15:00:00').getTime()

  it('formatRelative 分级', () => {
    expect(formatRelative(now - 30_000, now)).toBe('刚刚')
    expect(formatRelative(now - 12 * 60_000, now)).toBe('12 分钟前')
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe('3 小时前')
    expect(formatRelative(now - 2 * 86_400_000, now)).toBe('2 天前')
  })

  it('formatRelative 超过 30 天回到具体日期', () => {
    const old = new Date('2026-08-01T09:05:00').getTime()
    expect(formatRelative(old, now)).toBe('08-01 09:05')
  })

  it('formatDate 跨年带年份', () => {
    const old = new Date('2025-12-31T23:10:00').getTime()
    expect(formatDate(old, new Date(now))).toBe('2025-12-31 23:10')
  })

  it('formatDuration 分级', () => {
    expect(formatDuration(30_000)).toBe('不到 1 分钟')
    expect(formatDuration(8 * 60_000)).toBe('8 分钟')
    expect(formatDuration(2 * 3_600_000 + 15 * 60_000)).toBe('2 小时 15 分')
    expect(formatDuration(2 * 3_600_000)).toBe('2 小时')
    expect(formatDuration(26 * 3_600_000)).toBe('1 天 2 小时')
    expect(formatDuration(48 * 3_600_000)).toBe('2 天')
  })

  it('toDays 保留一位小数', () => {
    expect(toDays(36 * 3_600_000)).toBe(1.5)
    expect(toDays(86_400_000)).toBe(1)
  })
})
