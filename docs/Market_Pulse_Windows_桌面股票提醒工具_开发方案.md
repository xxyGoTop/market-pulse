# Market Pulse — Windows 桌面股票提醒工具开发方案

> 文档版本：V1.0  
> 文档用途：可直接交给 Cursor / 开发人员作为首版开发依据  
> 产品定位：Windows 桌面常驻悬浮提醒工具  
> 首版边界：大盘状态完全手动切换；不接入实时行情；股票与设置保存在本地。

## 1. 项目目标

开发一款 Windows 桌面常驻股票提醒工具，用于快速查看：

1. 当前手动设置的大盘阶段；
2. 三个目标股票分组及其股票清单；
3. 当前使用的亮色 / 暗色皮肤；
4. 通过悬浮窄条快速查看状态，并可点击展开完整面板。

产品设计采用 Apple 风格的轻量化视觉语言：圆角卡片、克制的阴影、柔和描边、清晰字体层级、亮暗双主题。大盘状态通过图标、文字和颜色共同表达。

## 2. 首版范围与非目标

### 2.1 V1.0 必须实现

- Windows 桌面应用，可安装、启动和退出。
- 无边框悬浮窗口，支持始终置顶、拖动、展开 / 收起。
- 窄条模式和展开模式共用一个窗口。
- 四种大盘状态完全手动切换。
- 状态切换时同步更新主状态标题、图标、色彩和状态选择器。
- 三个固定股票分组，每组最多 5 只股票。
- 添加、删除股票；防止同一分组内重复添加。
- 亮色 / 暗色皮肤手动切换，可选跟随系统。
- 本地保存股票、状态、主题、窗口位置和用户设置。
- 系统托盘菜单：显示 / 隐藏、置顶开关、退出。
- 基本错误处理与 Windows 打包。

### 2.2 V1.0 暂不实现

- 实时股票行情、涨跌幅和行情接口。
- 自动判断大盘阶段或交易策略。
- 登录、云同步、多设备同步。
- 交易下单、投资建议或买卖信号。
- 自选股搜索服务依赖。首版可直接录入股票名称和代码；后续再接入股票数据源。
- 复杂图表、K 线和财务数据。

> 说明：大盘阶段由用户手动维护。界面必须标明“手动设置”，避免用户误以为是实时行情自动分析结果。

## 3. UI / 视觉设计方案

设计参考图：`Market_Pulse_UI设计稿.png`（与本 Markdown 同目录）。

### 3.1 整体信息架构

展开模式从上到下分为：

1. **顶部标题栏**：应用名称、置顶、设置、收起 / 关闭操作。
2. **大盘状态主卡片**：状态图标、状态名称、辅助文案、手动设置标识。
3. **四阶段切换器**：底部筑底、调整下行、开始反弹、牛市上行。
4. **股票分组区域**：固定三列，分别为短博反弹、中长期、分红型。
5. **底部状态区（可选）**：当前股票总数、当前主题、轻量状态提示。

窄条模式显示：
- 当前大盘状态图标和大字号状态名称；
- 三个分组的股票数量（例如短博 2/5、中长 3/5、分红 1/5）；
- 展开按钮；
- 可拖动区域。

### 3.2 推荐尺寸

以下均为初始建议值，应在实际 Windows 环境根据 DPI 和屏幕尺寸微调。

| 模式 | 推荐尺寸 | 说明 |
|---|---:|---|
| 窄条模式 | 宽 560–780px，高 76–100px | 默认常驻，尽量减少遮挡 |
| 展开模式 | 宽 900–1080px，高 560–680px | 三列并排显示股票分组 |
| 最小展开宽度 | 900px 左右 | 确保三列可读 |
| 分组列间距 | 12–16px | 保持清晰分隔 |
| 卡片圆角 | 14–20px | 苹果风格 |
| 页面内边距 | 16–22px | 避免信息拥挤 |

实现时可用 CSS Grid：`grid-template-columns: repeat(3, minmax(0, 1fr))`。窗口小于三列布局的可读宽度时，优先缩小间距和卡片内边距；若仍不足，则允许三列区域横向滚动，不建议直接改为竖向堆叠，以符合用户要求的“三列竖直方向排布”。

### 3.3 大盘状态与主题色

大盘状态主卡片根据当前状态变换强调色。建议使用低饱和背景 + 高对比强调色，避免大面积高亮。

| 状态 key | 中文名称 | 强调色 | 浅色背景建议 | 暗色背景建议 | 图标语义 |
|---|---|---|---|---|---|
| `bottoming` | 底部筑底 | `#6BA9FF` | `#EAF3FF` | `#263B56` | layers / compass |
| `declining` | 调整下行 | `#F0A15E` | `#FFF1E4` | `#493526` | trending-down |
| `rebounding` | 开始反弹 | `#4CCB91` | `#E5F8EF` | `#183E34` | trending-up |
| `bullish` | 牛市上行 | `#A78BFA` | `#F0EAFE` | `#382D59` | rocket / chart-no-axes-combined |

注意：
- 图标、文本、状态名称必须同时出现，不能只靠颜色表达。
- “调整下行”不建议使用刺眼纯红背景；状态卡片的颜色是视觉编码，不是买卖建议。
- 切换状态时可做 180–240ms 的颜色与图标过渡，不使用大幅弹跳动画。

### 3.4 大盘阶段字体优化

大盘阶段是整个窗口的最高优先级信息。

推荐层级：
- 辅助标签：`MARKET STATUS` 或“市场状态提醒”，12–13px，次级颜色。
- 主状态标题：24–30px，`font-weight: 650–700`，行高约 1.2。
- 辅助说明：12–14px，例如“当前阶段由你手动维护”，使用次级文字颜色。
- “手动设置”标识：小型 pill 标签，放在主状态卡片右侧或标题下方。
- 状态图标容器：44–52px，使用圆角方形背景和状态强调色。

推荐字体：
- Windows 优先使用 `Segoe UI`；
- 中文字体由系统回退到微软雅黑等系统字体；
- 不依赖外部在线字体，确保离线使用。

### 3.5 三列股票分组卡片

三列固定为：

1. **短博反弹**：橙色强调，图标建议 `zap`。
2. **中长期**：蓝色强调，图标建议 `trending-up`。
3. **分红型**：金色强调，图标建议 `coins`。

每列结构：
- 分组图标、分组名称；
- 当前数量，例如 `2 / 5`；
- 一行描述；
- 股票列表，垂直排列；
- 底部“添加股票”入口。

每只股票默认展示：
- 股票名称；
- 股票代码；
- 删除入口。

首版不展示涨跌幅、价格和实时更新时间，因为没有行情数据源。设计稿中用于展示布局的股票名称和涨跌幅均为视觉示例，开发时不得伪装成真实实时行情。可使用明确标注的演示数据，或直接以空列表状态呈现。

分组卡片颜色建议：
- 短博反弹：`#F0A15E`
- 中长期：`#6BA9FF`
- 分红型：`#E8C77D`

分组自身颜色保持稳定，不随大盘阶段改变；只有大盘状态主卡片切换主题色，避免界面颜色混乱。

### 3.6 亮色 / 暗色皮肤

提供三种设置值：
- `light`：亮色
- `dark`：暗色
- `system`：跟随系统（建议默认值）

亮色建议：
- 页面底色：`#F4F7FB`
- 主卡片：白色 / 轻微透明白
- 主文字：`#172033`
- 次级文字：`#64748B`
- 边框：`rgba(31, 45, 61, 0.10)`
- 阴影：柔和、低透明度

暗色建议：
- 页面底色：`#111722`
- 主卡片：`#1A2432`
- 主文字：`#F3F6FB`
- 次级文字：`#9AA8BA`
- 边框：`rgba(255, 255, 255, 0.10)`
- 阴影：避免黑色重阴影，优先使用边框和层级色差

使用 CSS Variables 管理主题，避免在组件中散落大量硬编码颜色。切换皮肤后保留当前大盘状态、分组数据和窗口模式。

### 3.7 空状态与异常提示

- 空分组：显示简洁图标、提示“还没有添加股票”和“添加股票”按钮。
- 分组已满：显示 `5 / 5`，添加按钮禁用，并提示“该分组最多添加 5 只股票”。
- 重复股票：提示“该股票已在此分组中”。
- 输入无效：提示“请输入股票名称和代码”。
- 删除股票：弹出轻量确认提示，确认后删除。
- 本地保存失败：提示保存失败，不要静默丢失数据。

## 4. 交互设计

### 4.1 窄条模式

- 默认启动后显示窄条或恢复上次窗口模式（建议首次启动显示窄条）。
- 点击状态区域或展开箭头，展开完整面板。
- 展开 / 收起只改变同一个窗口的 UI 状态，不创建第二个 BrowserWindow。
- 窄条显示当前状态与三组数量。
- 标题区域提供拖动手柄；按钮区域不能被拖动逻辑覆盖。

### 4.2 展开模式

- 点击四阶段切换器即可手动切换大盘状态。
- 当前状态使用强调色填充，其余状态使用中性背景。
- 切换后立即保存状态，并显示轻量 toast。
- 股票按分组纵向排列，三列并排。
- 添加股票使用弹窗或 popover，输入名称与代码后确认。
- 删除股票需确认，删除后同步更新数量。
- 点击皮肤按钮在亮色 / 暗色间切换；设置中也可选择“跟随系统”。

### 4.3 窗口行为

- 始终置顶：可开关，默认开启。
- 无边框：隐藏系统标题栏，使用自定义标题栏。
- 拖动：仅标题栏指定区域设置 `-webkit-app-region: drag`；所有按钮区域设置 `-webkit-app-region: no-drag`。
- 关闭按钮：建议默认隐藏到托盘，托盘菜单中提供真正退出，避免误关后找不到。
- 记忆窗口位置：记录上次坐标和尺寸；启动时检查窗口是否仍在可用屏幕范围内，不在范围内则恢复到主屏幕可见区域。
- 多屏幕和 DPI：测试 100%、125%、150% 缩放及主副屏切换。
- 透明度：可在设置中调整，建议范围 0.80–1.00；文字对比度不能因透明度降低而不可读。

## 5. 技术选型

| 层级 | 方案 | 选择理由 |
|---|---|---|
| 桌面容器 | Electron | Windows 窗口、置顶、托盘、启动项和打包能力成熟 |
| 前端框架 | Vue 3 + TypeScript | 适合组件化实现，类型约束清晰 |
| 构建工具 | Vite | 开发体验快，配置简洁 |
| 样式 | CSS Variables，可选 Tailwind CSS | 方便维护亮暗主题和状态色 |
| 图标 | Lucide | 线性图标风格统一 |
| 本地存储 | `electron-store` | 首版数据量小，适合设置和股票分组 |
| 打包 | `electron-builder` | 生成 Windows 安装包 |
| 测试 | Vitest + Vue Test Utils（可选） | 测试分组限制、状态映射和数据逻辑 |

不建议首版引入后端、数据库服务或重量级 UI 组件库。核心数据本地化即可，降低部署和维护成本。

## 6. 技术架构

```text
Vue 3 Renderer
├── MarketStatusCard
├── MarketStatusSelector
├── StockGroupColumn × 3
├── StockItem
├── AddStockDialog
└── SettingsPanel
        │
        │ window.desktop.*（受限 API）
        ▼
Preload（contextBridge）
        │
        │ IPC
        ▼
Electron Main
├── WindowManager
├── TrayService
├── NotificationService
└── StorageService
        │
        ▼
electron-store（本地配置与股票数据）
```

安全要求：
- `contextIsolation: true`
- `nodeIntegration: false`
- preload 只暴露业务所需的有限方法。
- 渲染进程不直接访问 Node.js、文件系统或任意 IPC。
- IPC 参数在主进程校验。
- 不需要联网时不发起外部网络请求。

## 7. 推荐项目目录

```text
market-pulse/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── window-manager.ts
│   ├── tray-service.ts
│   ├── notification-service.ts
│   └── storage-service.ts
├── src/
│   ├── components/
│   │   ├── AppTitleBar.vue
│   │   ├── CompactBar.vue
│   │   ├── MarketStatusCard.vue
│   │   ├── MarketStatusSelector.vue
│   │   ├── StockGroupColumn.vue
│   │   ├── StockItem.vue
│   │   ├── AddStockDialog.vue
│   │   └── SettingsPanel.vue
│   ├── composables/
│   │   ├── useMarketStatus.ts
│   │   ├── useStockGroups.ts
│   │   ├── useTheme.ts
│   │   └── useDesktop.ts
│   ├── services/
│   │   ├── app-data.ts
│   │   └── validation.ts
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── themes.css
│   │   └── global.css
│   ├── types/
│   │   └── index.ts
│   ├── App.vue
│   └── main.ts
├── tests/
│   ├── stock-groups.spec.ts
│   └── market-status.spec.ts
├── package.json
├── vite.config.ts
├── electron-builder.yml
└── README.md
```

## 8. 数据模型

```ts
export type MarketStatus =
  | 'bottoming'
  | 'declining'
  | 'rebounding'
  | 'bullish'

export type ThemeMode = 'light' | 'dark' | 'system'

export type StockGroupType =
  | 'short_rebound'
  | 'mid_long_term'
  | 'dividend'

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
  alwaysOnTop: boolean
  opacity: number
  compactMode: boolean
  launchAtLogin: boolean
  notifyOnStatusChange: boolean
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
```

### 8.1 默认分组

```ts
export const DEFAULT_GROUPS: StockGroup[] = [
  {
    type: 'short_rebound',
    name: '短博反弹',
    description: '短线机会观察',
    stocks: [],
  },
  {
    type: 'mid_long_term',
    name: '中长期',
    description: '中期趋势观察',
    stocks: [],
  },
  {
    type: 'dividend',
    name: '分红型',
    description: '分红及长期价值跟踪',
    stocks: [],
  },
]
```

### 8.2 业务校验规则

- 三个默认分组固定存在，首版不支持新增 / 删除分组，只允许管理组内股票。
- 每个分组最多 5 只股票。
- 同一分组内股票代码不可重复。
- 股票代码统一去除首尾空格并转为大写后比较。
- 不同分组是否允许同一股票重复出现：建议允许，因为同一股票可能被用户放在不同观察目标中。
- 删除股票必须同步更新本地数据。
- 每次大盘状态切换都保存状态；只有状态实际发生变化时才新增历史记录。
- `AppData.version` 用于后续迁移本地数据结构。

## 9. 主进程 / Preload 接口建议

Preload 只暴露明确的业务接口，例如：

```ts
interface DesktopAPI {
  getAppData(): Promise<AppData>
  saveAppData(data: AppData): Promise<void>
  setAlwaysOnTop(enabled: boolean): Promise<void>
  setOpacity(opacity: number): Promise<void>
  setWindowMode(mode: 'compact' | 'expanded'): Promise<void>
  setLaunchAtLogin(enabled: boolean): Promise<void>
  showNotification(title: string, body: string): Promise<void>
  minimizeToTray(): Promise<void>
  quitApp(): Promise<void>
}
```

接口实现要求：
- 所有输入都在主进程进行校验。
- `saveAppData` 校验分组数量、每组最多 5 只股票、状态枚举和透明度范围。
- `setOpacity` 限制在 `0.80–1.00`。
- `setWindowMode` 只接受 `compact` 或 `expanded`。
- `getAppData` 在首次启动时返回默认数据，并初始化本地存储。
- Renderer 不允许调用任意通道名称的 `ipcRenderer.send`。

## 10. 关键实现建议

### 10.1 单窗口模式切换

同一个 BrowserWindow 加载 Vue 应用：
- `compactMode = true`：显示窄条布局。
- `compactMode = false`：显示展开面板。
- Vue 层控制布局，主进程根据模式调整窗口宽高。
- 改变窗口尺寸时尽量保持窗口顶部或右侧位置稳定，避免窗口突然跳到屏幕中央。

### 10.2 状态配置映射

```ts
export const MARKET_STATUS_META = {
  bottoming: {
    label: '底部筑底',
    color: '#6BA9FF',
    icon: 'layers',
  },
  declining: {
    label: '调整下行',
    color: '#F0A15E',
    icon: 'trending-down',
  },
  rebounding: {
    label: '开始反弹',
    color: '#4CCB91',
    icon: 'trending-up',
  },
  bullish: {
    label: '牛市上行',
    color: '#A78BFA',
    icon: 'rocket',
  },
} as const
```

根据状态映射更新 CSS Variables，例如 `--market-accent`、`--market-surface` 和 `--market-text-accent`。主题切换时使用同一组状态元数据，再由亮暗主题提供不同的背景色。

### 10.3 主题状态

- `light` / `dark` 由用户设置。
- `system` 使用系统主题偏好。
- 主题设置持久化。
- 主题切换不影响大盘状态或股票数据。
- 状态颜色需在亮暗两种背景下都通过对比度检查。

### 10.4 系统托盘

托盘菜单建议：
- 显示 / 隐藏窗口
- 展开 / 收起
- 始终置顶（带勾选状态）
- 设置
- 退出程序

点击窗口关闭按钮时默认隐藏到托盘。真正退出通过托盘“退出程序”执行。

### 10.5 开机启动

V1.0 可实现一个开机启动开关。开启时通过 Electron 的 `app.setLoginItemSettings` 配置；关闭时撤销设置。需要在 Windows 安装包与开发环境中分别验证行为。

## 11. 开发阶段与交付物

| 阶段 | 工作内容 | 交付结果 |
|---|---|---|
| P1 项目初始化 | Electron + Vue 3 + TS + Vite + 打包配置 | 可运行的空桌面应用 |
| P2 窗口能力 | 无边框、置顶、拖动、窄条 / 展开、托盘 | 桌面窗口交互完成 |
| P3 状态 UI | 四阶段选择器、动态颜色、标题字体优化 | 大盘状态模块完成 |
| P4 股票分组 | 三列布局、添加 / 删除、容量与重复校验 | 分组功能完成 |
| P5 本地存储 | 数据持久化、启动恢复、窗口坐标恢复 | 重启后数据不丢失 |
| P6 主题与体验 | 亮暗主题、过渡、空状态、错误提示 | UI 打磨完成 |
| P7 测试与打包 | Windows 多 DPI / 多屏幕验证、安装包 | 可安装的 Windows 版本 |

## 12. 验收标准

### 功能验收
- [ ] 可在四种大盘状态之间手动切换。
- [ ] 状态切换后标题、图标、颜色同步更新。
- [ ] 三个股票分组始终以三列并排显示。
- [ ] 每个分组最多 5 只股票，达到上限后无法继续添加。
- [ ] 同一分组不允许重复股票代码。
- [ ] 可以添加、删除股票。
- [ ] 亮色、暗色、跟随系统主题切换有效。
- [ ] 关闭后重新启动，股票、状态和主题设置仍存在。
- [ ] 窗口可以置顶、拖动、展开和收起。
- [ ] 托盘可显示 / 隐藏窗口并安全退出。
- [ ] 窗口坐标异常时能够恢复到可见屏幕区域。
- [ ] 首版不显示伪造的实时行情。

### 视觉验收
- [ ] 大盘状态名称在展开和窄条模式下均清晰可见。
- [ ] 展开态三列宽度协调，股票名称和代码不重叠。
- [ ] 亮暗主题均有足够文字对比度。
- [ ] 颜色不是唯一的信息提示，图标和文字同时表达状态。
- [ ] 按钮点击区域足够大，拖动区域不覆盖按钮。
- [ ] 动画轻量，不影响窗口操作响应。

### 稳定性验收
- [ ] Windows 10 / 11 主流环境可启动。
- [ ] 100%、125%、150% 缩放下布局可用。
- [ ] 主屏与副屏切换后窗口不会永久移出屏幕。
- [ ] 本地存储异常时给出可理解提示。
- [ ] 应用退出后无残留后台进程（除非用户选择保留在托盘）。

## 13. 后续扩展

V1.1 可考虑：
- 状态变化系统通知与自定义声音；
- 状态历史查看；
- 自选股导入 / 导出；
- 紧凑模式宽度和透明度设置；
- 更丰富的桌面皮肤。

V1.2 再评估：
- 合规行情数据源；
- 股票价格和涨跌幅；
- 可配置的大盘状态判断规则。

自动判断市场阶段涉及策略规则和数据质量，必须明确数据来源、刷新频率和规则定义，不应仅凭单日涨跌自动推断。

## 14. 给 Cursor 的开发指令

请以本文件为唯一首版产品规格，按阶段实现，不要一次性跳过测试直接堆叠全部功能。

1. 先初始化 Electron + Vue 3 + TypeScript + Vite 项目。
2. 实现安全的 main / preload / renderer 分层。
3. 先完成窗口与托盘能力，再实现 UI。
4. UI 严格按三列股票分组、亮暗双主题和四种大盘状态设计。
5. 所有业务状态使用 TypeScript 类型约束。
6. 将分组容量、重复校验、状态映射和数据迁移写成独立模块并添加测试。
7. 首版不得接入实时行情，不得把演示数据展示成真实行情。
8. 完成每个阶段后运行构建和测试，修复错误再继续。
9. 最后提供 Windows 打包命令、运行说明和验收清单。
