/**
 * 大盘状态判断规则
 *
 * 设计原则（对应开发方案第 13 节）：
 * 1. 只用「基准指数当日涨跌幅」一个维度分档，规则完全透明、可逐条解释，
 *    不做多因子黑箱，也不拿单根分时跳动去推断趋势；
 * 2. 阈值可配置，但必须满足 decline < rebound < bullish，
 *    否则整组回落到默认值，避免出现永远命中不了的空档；
 * 3. 真正切换前要求连续 confirm 次观测落在同一档，用时间换稳定性。
 *
 * 本文件全部是纯函数，便于单测，也不依赖任何 DOM / Electron 能力。
 */

import type { MarketRuleConfig, MarketStatus } from '@/types'
import { DEFAULT_MARKET_RULE, MARKET_STATUS_META, RULE_RANGE, isMarketIndexCode } from './constants'

const { min, max } = RULE_RANGE.threshold

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** 阈值统一保留一位小数并夹在 -9.9 ~ +9.9 */
export function clampThreshold(value: number): number {
  return round1(clamp(num(value, 0), min, max))
}

export function clampConfirm(value: number): number {
  return Math.round(clamp(num(value, DEFAULT_MARKET_RULE.confirm), RULE_RANGE.confirm.min, RULE_RANGE.confirm.max))
}

/**
 * 三档阈值必须严格递增。任意一档越界或顺序被破坏时，
 * 整组回落到默认值——比悄悄改写其中一档更好预测。
 */
export function clampThresholds(
  decline: number,
  rebound: number,
  bullish: number,
): Pick<MarketRuleConfig, 'decline' | 'rebound' | 'bullish'> {
  const d = clampThreshold(decline)
  const r = clampThreshold(rebound)
  const b = clampThreshold(bullish)
  if (d < r && r < b) return { decline: d, rebound: r, bullish: b }
  return {
    decline: DEFAULT_MARKET_RULE.decline,
    rebound: DEFAULT_MARKET_RULE.rebound,
    bullish: DEFAULT_MARKET_RULE.bullish,
  }
}

/** 把任意来源的规则规整成合法结构（旧存档、导入文件、损坏数据都要过这里） */
export function clampRule(raw: unknown): MarketRuleConfig {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<MarketRuleConfig>
  return {
    auto: typeof input.auto === 'boolean' ? input.auto : DEFAULT_MARKET_RULE.auto,
    indexCode: isMarketIndexCode(input.indexCode)
      ? input.indexCode
      : DEFAULT_MARKET_RULE.indexCode,
    confirm: clampConfirm(num(input.confirm, DEFAULT_MARKET_RULE.confirm)),
    ...clampThresholds(
      num(input.decline, DEFAULT_MARKET_RULE.decline),
      num(input.rebound, DEFAULT_MARKET_RULE.rebound),
      num(input.bullish, DEFAULT_MARKET_RULE.bullish),
    ),
  }
}

/** 规则是否已经合法（主进程写入前的校验用） */
export function isValidRule(rule: unknown): boolean {
  if (!rule || typeof rule !== 'object') return false
  const r = rule as Partial<MarketRuleConfig>
  if (typeof r.auto !== 'boolean') return false
  if (!isMarketIndexCode(r.indexCode)) return false
  if (typeof r.confirm !== 'number' || clampConfirm(r.confirm) !== r.confirm) return false
  for (const key of ['decline', 'rebound', 'bullish'] as const) {
    const value = r[key]
    if (typeof value !== 'number' || clampThreshold(value) !== value) return false
  }
  return (r.decline as number) < (r.rebound as number) && (r.rebound as number) < (r.bullish as number)
}

/** 涨跌幅 → 大盘阶段 */
export function evaluateStatus(changePercent: number, rule: MarketRuleConfig): MarketStatus {
  if (!Number.isFinite(changePercent)) return 'bottoming'
  if (changePercent >= rule.bullish) return 'bullish'
  if (changePercent >= rule.rebound) return 'rebounding'
  if (changePercent <= rule.decline) return 'declining'
  return 'bottoming'
}

/**
 * 交互式修改某一档阈值：自动把相邻档推开，保证顺序永远成立。
 * 设置面板里直接调数字时用它，避免用户来回试出合法组合。
 */
export function applyThreshold(
  rule: MarketRuleConfig,
  field: 'decline' | 'rebound' | 'bullish',
  value: number,
): MarketRuleConfig {
  const step = RULE_RANGE.threshold.step
  let { decline, rebound, bullish } = rule
  const next = clampThreshold(value)

  if (field === 'decline') {
    decline = next
    if (rebound <= decline) rebound = clampThreshold(decline + step)
    if (bullish <= rebound) bullish = clampThreshold(rebound + step)
  } else if (field === 'rebound') {
    rebound = next
    if (decline >= rebound) decline = clampThreshold(rebound - step)
    if (bullish <= rebound) bullish = clampThreshold(rebound + step)
  } else {
    bullish = next
    if (rebound >= bullish) rebound = clampThreshold(bullish - step)
    if (decline >= rebound) decline = clampThreshold(rebound - step)
  }

  return { ...rule, ...clampThresholds(decline, rebound, bullish) }
}

export interface RuleBand {
  status: MarketStatus
  label: string
  /** 区间文字，如「≥ +1.5%」 */
  range: string
}

function signed(value: number): string {
  const fixed = value.toFixed(1)
  return value > 0 ? `+${fixed}` : fixed
}

/** 按当前规则生成四档区间描述，用于设置面板与卡片提示 */
export function ruleBands(rule: MarketRuleConfig): RuleBand[] {
  return [
    {
      status: 'bullish',
      label: MARKET_STATUS_META.bullish.label,
      range: `≥ ${signed(rule.bullish)}%`,
    },
    {
      status: 'rebounding',
      label: MARKET_STATUS_META.rebounding.label,
      range: `${signed(rule.rebound)}% ~ ${signed(rule.bullish)}%`,
    },
    {
      status: 'bottoming',
      label: MARKET_STATUS_META.bottoming.label,
      range: `${signed(rule.decline)}% ~ ${signed(rule.rebound)}%`,
    },
    {
      status: 'declining',
      label: MARKET_STATUS_META.declining.label,
      range: `≤ ${signed(rule.decline)}%`,
    },
  ]
}

/** 涨跌幅格式化：+1.23% / -0.45% / 0.00%（先四舍五入再判符号，避免出现 -0.0%） */
export function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  if (rounded === 0) return `${(0).toFixed(digits)}%`
  return rounded > 0 ? `+${rounded.toFixed(digits)}%` : `${rounded.toFixed(digits)}%`
}

/** 涨跌方向：1 涨 / -1 跌 / 0 平，用于红涨绿跌的样式切换 */
export function trendOf(value: number): 1 | -1 | 0 {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return 0
  return value > 0 ? 1 : -1
}

/** 成交额：1.23 亿 / 4560 万 / 890 */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)} 亿`
  if (value >= 1e4) return `${Math.round(value / 1e4)} 万`
  return value.toFixed(0)
}
