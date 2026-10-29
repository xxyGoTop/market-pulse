export type MarketStatus = 'bottoming' | 'declining' | 'rebounding' | 'bullish'

export type ThemeMode = 'light' | 'dark' | 'system'

/** 桌面皮肤：只影响中性色与背景，不影响大盘阶段色与分组色 */
export type SkinName = 'sky' | 'mist' | 'sand' | 'ink'

/** 状态切换提示音 */
export type SoundName = 'none' | 'chime' | 'bell' | 'pulse'

/** 导入合并策略 */
export type ImportMode = 'replace' | 'append'

export type StockGroupType = 'short_rebound' | 'mid_long_term' | 'dividend'

export type WindowMode = 'compact' | 'expanded'

/* ------------------------------------------------------------------ *
 * 行情
 * 三个数据源都是各站公开的只读行情接口，只取价格类字段，
 * 不做任何交易动作，也不在本地留存历史数据。
 * ------------------------------------------------------------------ */

export type QuoteSource = 'eastmoney' | 'sina' | 'tencent'

/** 标准化后的行情快照：三个源统一成同一形状，差异全部在适配层吃掉 */
export interface Quote {
  /** 归一化代码：个股 600519，指数 sh000001 */
  code: string
  name: string
  price: number
  prevClose: number
  /** 涨跌额，由 price - prevClose 本地计算，避免各源字段口径差异 */
  change: number
  /** 涨跌幅（%），同样本地计算 */
  changePercent: number
  open: number
  high: number
  low: number
  /** 成交量（手） */
  volume: number
  /** 成交额（元） */
  amount: number
  /** 行情时间戳（ms），源未提供时回落到抓取时间 */
  time: number
  source: QuoteSource
}

export interface QuoteRequest {
  source: QuoteSource
  /** 个股代码，最多 40 个 */
  codes: string[]
  /** 指数代码，只能是 MARKET_INDEXES 里的键 */
  indexCodes: string[]
}

export interface QuoteBatch {
  ok: boolean
  source: QuoteSource
  /** 个股：归一化代码 → 行情 */
  quotes: Record<string, Quote>
  /** 指数：sh000001 → 行情 */
  indexes: Record<string, Quote>
  fetchedAt: number
  error?: string
}

/**
 * 大盘状态自动判断规则
 *
 * 只用「基准指数当日涨跌幅」单一维度分档，规则完全透明可解释：
 *   pct ≥ bullish → 牛市上行
 *   pct ≥ rebound → 开始反弹
 *   pct ≤ decline → 调整下行
 *   其余          → 底部筑底
 * 并要求连续 confirm 次观测落在同一档才真正切换，避免单次跳动误判。
 */
export interface MarketRuleConfig {
  /** 关闭时完全手动维护，规则只做展示 */
  auto: boolean
  /** 基准指数代码，取 MARKET_INDEXES 的键 */
  indexCode: string
  bullish: number
  rebound: number
  decline: number
  /** 连续确认次数 1–10 */
  confirm: number
}

export interface StockItem {
  id: string
  code: string
  name: string
  addedAt: number
  note?: string
}

export interface StockGroup {
  type: StockGroupType
  name: string
  description: string
  stocks: StockItem[]
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface AppSettings {
  marketStatus: MarketStatus
  theme: ThemeMode
  skin: SkinName
  alwaysOnTop: boolean
  opacity: number
  /** 窄条模式宽度（px），560–900 */
  compactWidth: number
  compactMode: boolean
  launchAtLogin: boolean
  notifyOnStatusChange: boolean
  /** 状态切换提示音 */
  notificationSound: SoundName
  /** 行情数据源 */
  quoteSource: QuoteSource
  /** 行情刷新间隔（秒），0 表示只在手动点击时刷新 */
  quoteRefresh: number
  /** 大盘状态自动判断规则 */
  marketRule: MarketRuleConfig
  windowBounds?: WindowBounds
}

export interface StatusHistoryItem {
  status: MarketStatus
  changedAt: number
}

export interface AppData {
  version: number
  settings: AppSettings
  groups: StockGroup[]
  statusHistory: StatusHistoryItem[]
}

export type ExportFormat = 'json' | 'csv'

export interface FileResult {
  ok: boolean
  /** 用户主动取消，不算错误 */
  canceled?: boolean
  path?: string
  fileName?: string
  error?: string
}

export interface ImportResult extends FileResult {
  /** 解析并规整后的数据，交给渲染层确认合并方式 */
  data?: AppData
  /** 导入文件里实际识别到的股票条数 */
  stockCount?: number
}

/** preload 通过 contextBridge 暴露的受限接口 */
export interface DesktopAPI {
  getAppData(): Promise<AppData>
  saveAppData(data: AppData): Promise<{ ok: boolean; error?: string }>
  setAlwaysOnTop(enabled: boolean): Promise<void>
  setOpacity(opacity: number): Promise<void>
  setWindowMode(mode: WindowMode): Promise<void>
  setCompactWidth(width: number): Promise<void>
  setLaunchAtLogin(enabled: boolean): Promise<void>
  showNotification(title: string, body: string): Promise<void>
  minimizeToTray(): Promise<void>
  quitApp(): Promise<void>
  exportData(format: ExportFormat): Promise<FileResult>
  importData(): Promise<ImportResult>
  fetchQuotes(request: QuoteRequest): Promise<QuoteBatch>
  onDataChanged(cb: (data: AppData) => void): () => void
  onModeChanged(cb: (mode: WindowMode) => void): () => void
  platform: string
  isElectron: boolean
}
