import type {
  MarketRuleConfig,
  MarketStatus,
  QuoteSource,
  SkinName,
  SoundName,
  StockGroup,
  StockGroupType,
  ThemeMode,
} from '@/types'

/**
 * 数据结构版本
 * 2：新增 skin / compactWidth / notificationSound
 * 3：窄条尺寸刻度变更（默认 700×88 → 340×46），旧的 compactWidth 不再有意义
 * 4：新增 quoteSource / quoteRefresh / marketRule
 */
export const APP_VERSION = 4
export const MAX_STOCKS_PER_GROUP = 5

/** 窄条模式尺寸：默认 340×46 的小胶囊，宽度可调 */
export const COMPACT_WIDTH = { min: 300, max: 560, step: 10, default: 340 }
export const COMPACT_HEIGHT = 46
/** 透明度可调范围 */
export const OPACITY_RANGE = { min: 0.65, max: 1, step: 0.01 }

/* ------------------------------------------------------------------ *
 * 配色体系
 * 一个 tone 同时描述：图标磁贴渐变（a→b）、卡片柔和底色（soft）、
 * 文字 / 强调色（ink）。亮暗两套取值，避免用 color-mix 反复推导。
 * ------------------------------------------------------------------ */

export type ToneName = 'blue' | 'orange' | 'teal' | 'pink' | 'coral' | 'gold' | 'purple' | 'neutral'

export interface Tone {
  /** 磁贴渐变起色（也是 active 胶囊的起色） */
  a: string
  /** 磁贴渐变止色 */
  b: string
  /** 亮色主题下的柔和底色 */
  soft: string
  /** 暗色主题下的柔和底色 */
  softDark: string
  /** 亮色主题下的强调文字色 */
  ink: string
  /** 暗色主题下的强调文字色 */
  inkDark: string
}

export const TONES: Record<ToneName, Tone> = {
  blue: {
    a: '#5B9BFF',
    b: '#3F7BE8',
    soft: '#E8F1FE',
    softDark: '#1D2A3D',
    ink: '#3A72D8',
    inkDark: '#8FB8FF',
  },
  orange: {
    a: '#FFB35C',
    b: '#EE8A2E',
    soft: '#FDF0E1',
    softDark: '#2E2620',
    ink: '#D97C24',
    inkDark: '#FFC486',
  },
  teal: {
    a: '#43D69B',
    b: '#1FB37B',
    soft: '#DEF7EC',
    softDark: '#16302A',
    ink: '#16A175',
    inkDark: '#6EE7B7',
  },
  pink: {
    a: '#FF7FBB',
    b: '#EE4A93',
    soft: '#FCE3EF',
    softDark: '#2F2230',
    ink: '#DE4A8C',
    inkDark: '#FFA8CE',
  },
  coral: {
    a: '#FB808C',
    b: '#E8525F',
    soft: '#FCE1E4',
    softDark: '#312427',
    ink: '#D94654',
    inkDark: '#FFA3AB',
  },
  gold: {
    a: '#F6CB5C',
    b: '#DCA02A',
    soft: '#FCF3DA',
    softDark: '#2D2820',
    ink: '#C08F1F',
    inkDark: '#F5D67F',
  },
  purple: {
    a: '#A78BFA',
    b: '#7C5CE0',
    soft: '#EBE4FD',
    softDark: '#252238',
    ink: '#7350D8',
    inkDark: '#C0ACFF',
  },
  neutral: {
    a: '#94A3B8',
    b: '#64748B',
    soft: '#F1F4F8',
    softDark: '#232D3B',
    ink: '#5A6A80',
    inkDark: '#A6B4C6',
  },
}

/** 取 tone 的完整色组，未命中时退回 neutral */
export function tone(name: ToneName | undefined): Tone {
  return TONES[name ?? 'neutral'] ?? TONES.neutral
}

/* ------------------------------------------------------------------ *
 * 大盘阶段
 * 图标资源按图标设计稿配色（蓝 / 橙 / 青绿 / 粉）；
 * 界面里通过 tone 覆盖磁贴渐变，使图标与卡片同色，保持整屏一致。
 * ------------------------------------------------------------------ */

export const MARKET_STATUS_ORDER: MarketStatus[] = [
  'bottoming',
  'declining',
  'rebounding',
  'bullish',
]

interface MarketStatusMeta {
  label: string
  /** 卡片副标题（设计稿的 4 字短句） */
  subtitle: string
  tone: ToneName
  icon: string
  hint: string
}

export const MARKET_STATUS_META: Record<MarketStatus, MarketStatusMeta> = {
  bottoming: {
    label: '底部筑底',
    subtitle: '积蓄力量',
    tone: 'orange',
    icon: 'market-bottom',
    hint: '低位反复磨底，耐心等待方向确认',
  },
  declining: {
    label: '调整下行',
    subtitle: '控制风险',
    tone: 'coral',
    icon: 'market-down',
    hint: '趋势走弱，控制仓位与出手频率',
  },
  rebounding: {
    label: '开始反弹',
    subtitle: '希望与机会',
    tone: 'teal',
    icon: 'market-rebound',
    hint: '低位企稳回升，关注量能是否延续',
  },
  bullish: {
    label: '牛市上行',
    subtitle: '加速阶段',
    tone: 'purple',
    icon: 'market-bull',
    hint: '趋势向上，持股为主，避免频繁换手',
  },
}

export function isMarketStatus(value: unknown): value is MarketStatus {
  return typeof value === 'string' && value in MARKET_STATUS_META
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

/* ------------------------------------------------------------------ *
 * 桌面皮肤
 * 只改中性色与背景光晕，大盘阶段色与分组色保持不变，
 * 因此换皮肤不会让「颜色 = 状态」的语义失效。
 * ------------------------------------------------------------------ */

interface SkinMeta {
  label: string
  description: string
  /** 设置面板里的缩略预览：[桌面底色起, 桌面底色止, 卡片色]；亮暗各一套 */
  swatch: { light: [string, string, string]; dark: [string, string, string] }
}

export const SKIN_ORDER: SkinName[] = ['sky', 'mist', 'sand', 'ink']

export const SKIN_META: Record<SkinName, SkinMeta> = {
  sky: {
    label: '天光',
    description: '淡蓝渐变，通透清爽',
    swatch: {
      light: ['#dce8f7', '#fbfdff', '#ffffff'],
      dark: ['#172233', '#0a0f18', '#182130'],
    },
  },
  mist: {
    label: '雾灰',
    description: '中性灰调，长时间不刺眼',
    swatch: {
      light: ['#e2e6ec', '#fbfcfd', '#ffffff'],
      dark: ['#1a1f27', '#0b0e13', '#181c23'],
    },
  },
  sand: {
    label: '暖砂',
    description: '米杏底色，纸感偏暖',
    swatch: {
      light: ['#efe6d8', '#fdfbf7', '#fffdf9'],
      dark: ['#221c15', '#0e0b08', '#1c1813'],
    },
  },
  ink: {
    label: '墨蓝',
    description: '冷调深蓝，白天更沉静',
    swatch: {
      light: ['#d6e0ee', '#f8fbff', '#ffffff'],
      dark: ['#0f1620', '#05080d', '#0f1621'],
    },
  },
}

export function isSkinName(value: unknown): value is SkinName {
  return typeof value === 'string' && value in SKIN_META
}

/* ------------------------------------------------------------------ *
 * 状态切换提示音
 * 由 WebAudio 现场合成，不引入音频文件，离线可用、体积极小。
 * ------------------------------------------------------------------ */

interface SoundMeta {
  label: string
  description: string
}

export const SOUND_ORDER: SoundName[] = ['chime', 'bell', 'pulse', 'none']

export const SOUND_META: Record<SoundName, SoundMeta> = {
  chime: { label: '轻铃', description: '两声上行，柔和' },
  bell: { label: '铃铛', description: '单声衰减，清晰' },
  pulse: { label: '脉冲', description: '短促双击，克制' },
  none: { label: '静音', description: '不播放提示音' },
}

export function isSoundName(value: unknown): value is SoundName {
  return typeof value === 'string' && value in SOUND_META
}

/* ------------------------------------------------------------------ *
 * 股票分组
 * ------------------------------------------------------------------ */

interface GroupMeta {
  name: string
  /** 窄条里的 2 字缩写 */
  shortName: string
  description: string
  tone: ToneName
  icon: string
  emptyHint: string
}

export const STOCK_GROUP_META: Record<StockGroupType, GroupMeta> = {
  short_rebound: {
    name: '短博反弹',
    shortName: '短博',
    description: '短线机会观察',
    tone: 'orange',
    icon: 'short-term',
    emptyHint: '还没有添加股票',
  },
  mid_long_term: {
    name: '中长期',
    shortName: '中长',
    description: '中期趋势观察',
    tone: 'blue',
    icon: 'long-term',
    emptyHint: '还没有添加股票',
  },
  dividend: {
    name: '分红型',
    shortName: '分红',
    description: '分红及长期价值跟踪',
    tone: 'gold',
    icon: 'dividend',
    emptyHint: '还没有添加股票',
  },
}

export const STOCK_GROUP_ORDER: StockGroupType[] = [
  'short_rebound',
  'mid_long_term',
  'dividend',
]

export const DEFAULT_GROUPS: StockGroup[] = STOCK_GROUP_ORDER.map((type) => ({
  type,
  name: STOCK_GROUP_META[type].name,
  description: STOCK_GROUP_META[type].description,
  stocks: [],
}))

/* ------------------------------------------------------------------ *
 * 行情数据源
 * 三家都是公开的只读行情接口，只取价格类字段，不做交易、不落库。
 * ------------------------------------------------------------------ */

interface QuoteSourceMeta {
  label: string
  description: string
  host: string
}

export const QUOTE_SOURCE_ORDER: QuoteSource[] = ['eastmoney', 'sina', 'tencent']

export const QUOTE_SOURCE_META: Record<QuoteSource, QuoteSourceMeta> = {
  eastmoney: {
    label: '东方财富',
    description: 'push2 公开行情接口，字段最全，推荐默认',
    host: 'push2.eastmoney.com',
  },
  sina: {
    label: '新浪财经',
    description: 'hq.sinajs.cn 公开行情接口，响应最轻',
    host: 'hq.sinajs.cn',
  },
  tencent: {
    label: '腾讯财经',
    description: 'qt.gtimg.cn 公开行情接口，含成交额',
    host: 'qt.gtimg.cn',
  },
}

export function isQuoteSource(value: unknown): value is QuoteSource {
  return typeof value === 'string' && value in QUOTE_SOURCE_META
}

/** 刷新间隔候选（秒），0 表示不自动刷新 */
export const REFRESH_OPTIONS = [10, 30, 60, 0] as const

export function refreshLabel(seconds: number): string {
  return seconds > 0 ? `${seconds} 秒` : '手动'
}

export function isRefreshOption(value: unknown): value is number {
  return typeof value === 'number' && (REFRESH_OPTIONS as readonly number[]).includes(value)
}

/* ------------------------------------------------------------------ *
 * 基准指数
 * 指数与个股的 6 位代码会撞车（上证指数 000001 vs 平安银行 000001），
 * 所以指数一律带市场前缀，且各源符号在这里一次性映射好。
 * ------------------------------------------------------------------ */

export interface MarketIndexMeta {
  label: string
  short: string
  /** 新浪 / 腾讯的符号 */
  symbol: string
  /** 东方财富 secid：1=沪，0=深 */
  secid: string
}

export const MARKET_INDEX_ORDER = ['sh000001', 'sz399001', 'sz399006']

export const MARKET_INDEXES: Record<string, MarketIndexMeta> = {
  sh000001: { label: '上证指数', short: '上证', symbol: 'sh000001', secid: '1.000001' },
  sz399001: { label: '深证成指', short: '深证', symbol: 'sz399001', secid: '0.399001' },
  sz399006: { label: '创业板指', short: '创业板', symbol: 'sz399006', secid: '0.399006' },
}

export function isMarketIndexCode(value: unknown): value is string {
  return typeof value === 'string' && value in MARKET_INDEXES
}

/** 指数取不到时的兜底名称 */
export function indexLabel(code: string): string {
  return MARKET_INDEXES[code]?.label ?? code
}

/* ------------------------------------------------------------------ *
 * 大盘状态自动判断规则
 * ------------------------------------------------------------------ */

export const RULE_RANGE = {
  /** 三档阈值都落在 -9.9 ~ +9.9 之间，步长 0.1 */
  threshold: { min: -9.9, max: 9.9, step: 0.1 },
  confirm: { min: 1, max: 10, step: 1 },
}

export const DEFAULT_MARKET_RULE: MarketRuleConfig = {
  auto: false,
  indexCode: 'sh000001',
  bullish: 1.5,
  rebound: 0.3,
  decline: -1,
  confirm: 3,
}
