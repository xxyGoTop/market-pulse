import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MARKET_RULE,
  MARKET_INDEXES,
  MARKET_INDEX_ORDER,
  RULE_RANGE,
} from '@/services/constants'
import {
  applyThreshold,
  clampRule,
  clampThresholds,
  evaluateStatus,
  formatAmount,
  formatPercent,
  isValidRule,
  ruleBands,
  trendOf,
} from '@/services/market-rules'
import {
  bareCode,
  collectQuoteCodes,
  eastmoneySecid,
  isValidQuoteCode,
  marketOf,
  normalizeQuoteCode,
  sinaSymbol,
} from '@/services/quote-code'

describe('代码归一化', () => {
  it('裸 6 位按首位推断市场', () => {
    expect(normalizeQuoteCode('600519')).toBe('sh600519')
    expect(normalizeQuoteCode('510300')).toBe('sh510300')
    expect(normalizeQuoteCode('000001')).toBe('sz000001')
    expect(normalizeQuoteCode('300750')).toBe('sz300750')
    expect(normalizeQuoteCode('159915')).toBe('sz159915')
    expect(normalizeQuoteCode('830799')).toBe('bj830799')
  })

  it('已带市场前缀的代码保持原样，指数不会被当成个股', () => {
    expect(normalizeQuoteCode('sh000001')).toBe('sh000001')
    expect(normalizeQuoteCode('SH600519')).toBe('sh600519')
    expect(normalizeQuoteCode('sz399006')).toBe('sz399006')
  })

  it('兼容后缀与东财 secid 写法', () => {
    expect(normalizeQuoteCode('600519.SH')).toBe('sh600519')
    expect(normalizeQuoteCode('000001.sz')).toBe('sz000001')
    expect(normalizeQuoteCode('1.600519')).toBe('sh600519')
    expect(normalizeQuoteCode('0.000001')).toBe('sz000001')
    // 东财对北交所也用市场 0，这里仍按首位还原成 bj
    expect(normalizeQuoteCode('0.830799')).toBe('bj830799')
  })

  it('无法识别时返回空串', () => {
    expect(normalizeQuoteCode('')).toBe('')
    expect(normalizeQuoteCode('abc')).toBe('')
    expect(normalizeQuoteCode('12345')).toBe('')
    expect(normalizeQuoteCode('1234567')).toBe('')
  })

  it('各源符号推导一致', () => {
    expect(sinaSymbol('600519')).toBe('sh600519')
    expect(eastmoneySecid('600519')).toBe('1.600519')
    expect(eastmoneySecid('000001')).toBe('0.000001')
    expect(eastmoneySecid('830799')).toBe('0.830799')
    expect(eastmoneySecid('sh000001')).toBe('1.000001')
    expect(eastmoneySecid('sz399006')).toBe('0.399006')
  })

  it('marketOf / bareCode / isValidQuoteCode', () => {
    expect(marketOf('sh600519')).toBe('sh')
    expect(marketOf('bj830799')).toBe('bj')
    expect(marketOf('600519')).toBe(null)
    expect(bareCode('sh000001')).toBe('000001')
    expect(isValidQuoteCode('600519')).toBe(true)
    expect(isValidQuoteCode('sh000001')).toBe(true)
    expect(isValidQuoteCode('6005190')).toBe(false)
  })

  it('collectQuoteCodes 去重、保序、按上限截断', () => {
    expect(collectQuoteCodes(['600519', 'sh600519', '000001'])).toEqual(['sh600519', 'sz000001'])
    expect(collectQuoteCodes(['600519', '000001', '300750'], 2)).toEqual(['sh600519', 'sz000001'])
    expect(collectQuoteCodes(['', 'abc'])).toEqual([])
  })

  it('指数表与顺序表保持一致', () => {
    expect(Object.keys(MARKET_INDEXES).sort()).toEqual([...MARKET_INDEX_ORDER].sort())
  })
})

describe('evaluateStatus 阈值分档', () => {
  const rule = DEFAULT_MARKET_RULE

  it('按三档阈值切分四个阶段', () => {
    expect(evaluateStatus(3.2, rule)).toBe('bullish')
    expect(evaluateStatus(rule.bullish, rule)).toBe('bullish')
    expect(evaluateStatus(rule.bullish - 0.01, rule)).toBe('rebounding')
    expect(evaluateStatus(rule.rebound, rule)).toBe('rebounding')
    expect(evaluateStatus(rule.rebound - 0.01, rule)).toBe('bottoming')
    expect(evaluateStatus(0, rule)).toBe('bottoming')
    expect(evaluateStatus(rule.decline + 0.01, rule)).toBe('bottoming')
    expect(evaluateStatus(rule.decline, rule)).toBe('declining')
    expect(evaluateStatus(-6, rule)).toBe('declining')
  })

  it('拿不到涨跌幅时归入底部筑底，不抛错', () => {
    expect(evaluateStatus(Number.NaN, rule)).toBe('bottoming')
    // 非有限数值一律按「无有效行情」处理，不参与分档
    expect(evaluateStatus(Number.POSITIVE_INFINITY, rule)).toBe('bottoming')
    expect(evaluateStatus(Number.NEGATIVE_INFINITY, rule)).toBe('bottoming')
  })

  it('规则改动后分档随之变化', () => {
    const loose = { ...rule, bullish: 5, rebound: 2, decline: -3 }
    expect(evaluateStatus(1.5, rule)).toBe('bullish')
    expect(evaluateStatus(1.5, loose)).toBe('bottoming')
    expect(evaluateStatus(2.2, loose)).toBe('rebounding')
  })
})

describe('规则夹取与校验', () => {
  it('阈值顺序被破坏时整组回落到默认值', () => {
    expect(clampThresholds(1, 0.3, -1)).toEqual({
      decline: DEFAULT_MARKET_RULE.decline,
      rebound: DEFAULT_MARKET_RULE.rebound,
      bullish: DEFAULT_MARKET_RULE.bullish,
    })
  })

  it('阈值保留一位小数并夹在区间内', () => {
    expect(clampThresholds(-1.04, 0.34, 1.46)).toEqual({ decline: -1, rebound: 0.3, bullish: 1.5 })
    const clamped = clampThresholds(-99, 0.3, 99)
    expect(clamped.decline).toBe(RULE_RANGE.threshold.min)
    expect(clamped.bullish).toBe(RULE_RANGE.threshold.max)
  })

  it('非法输入回落到默认规则', () => {
    expect(clampRule(undefined)).toEqual(DEFAULT_MARKET_RULE)
    expect(clampRule({ indexCode: 'sh999999', confirm: 99, auto: 'yes' })).toEqual({
      ...DEFAULT_MARKET_RULE,
      auto: DEFAULT_MARKET_RULE.auto,
      confirm: RULE_RANGE.confirm.max,
    })
  })

  it('isValidRule 只接受完全合法的规则', () => {
    expect(isValidRule(DEFAULT_MARKET_RULE)).toBe(true)
    expect(isValidRule({ ...DEFAULT_MARKET_RULE, confirm: 0 })).toBe(false)
    expect(isValidRule({ ...DEFAULT_MARKET_RULE, indexCode: 'sz000001' })).toBe(false)
    expect(isValidRule({ ...DEFAULT_MARKET_RULE, bullish: 0.1 })).toBe(false)
    expect(isValidRule(null)).toBe(false)
  })

  it('applyThreshold 会把相邻档推开', () => {
    const up = applyThreshold(DEFAULT_MARKET_RULE, 'rebound', 2)
    expect(up.rebound).toBe(2)
    expect(up.bullish).toBe(2.1)
    expect(up.decline).toBe(-1)

    const down = applyThreshold(DEFAULT_MARKET_RULE, 'decline', 1)
    expect(down.decline).toBe(1)
    expect(down.rebound).toBe(1.1)
    expect(down.bullish).toBe(1.5)

    // 极端输入也会收敛成合法规则
    expect(isValidRule(applyThreshold(DEFAULT_MARKET_RULE, 'bullish', -9))).toBe(true)
  })
})

describe('展示格式化', () => {
  it('涨跌幅带正负号，零值不带符号', () => {
    expect(formatPercent(1.234)).toBe('+1.23%')
    expect(formatPercent(-0.456)).toBe('-0.46%')
    expect(formatPercent(0)).toBe('0.00%')
    expect(formatPercent(Number.NaN)).toBe('—')
    expect(formatPercent(1.234, 1)).toBe('+1.2%')
  })

  it('涨跌方向与成交额', () => {
    expect(trendOf(1)).toBe(1)
    expect(trendOf(-1)).toBe(-1)
    expect(trendOf(0)).toBe(0)
    expect(formatAmount(2.5e8)).toBe('2.50 亿')
    expect(formatAmount(4_560_000)).toBe('456 万')
    expect(formatAmount(0)).toBe('—')
  })

  it('ruleBands 输出四档且顺序固定', () => {
    const bands = ruleBands(DEFAULT_MARKET_RULE)
    expect(bands.map((b) => b.status)).toEqual(['bullish', 'rebounding', 'bottoming', 'declining'])
    expect(bands[0].range).toBe('≥ +1.5%')
    expect(bands[3].range).toBe('≤ -1.0%')
  })
})
