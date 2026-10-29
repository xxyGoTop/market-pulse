# Market Pulse

Windows 桌面常驻的「大盘状态 + 自选分组」提醒工具。窄条常驻屏幕一角，点开是三列观察分组；行情取自公开只读接口，大盘阶段可以手动维护，也可以交给可配置的规则自动判断。

当前版本 **v1.2.0**：在 V1.1 基础上接入三路合规行情数据源（东方财富 / 新浪 / 腾讯）、股票价格与涨跌幅、可配置的大盘状态判断规则。代码已做 macOS 适配，**但 mac 包必须在 macOS 上构建**（见「macOS 打包」）。

> 本项目严格按 `docs/Market_Pulse_Windows_桌面股票提醒工具_开发方案.md` 实现，视觉参照 `docs/Market_Pulse_UI设计稿.png`。

## 技术栈

| 层级 | 方案 |
|---|---|
| 桌面容器 | Electron 33（无边框 + 透明圆角 + 托盘；Windows 任务栏 / macOS 菜单栏双形态） |
| 前端 | Vue 3 + TypeScript + Vite 6 |
| 图标 | 业务图标为自定义 SVG（`src/assets/icons`），通用操作走 lucide-vue-next，统一经 `AppIcon` 渲染 |
| 行情 | 主进程代发 HTTP（`fetch` + AbortSignal 超时），三源适配器统一成同一 `Quote` 结构 |
| 本地存储 | electron-store（`%APPDATA%/market-pulse/market-pulse.json`） |
| 打包 | electron-builder（NSIS 安装包） |
| 测试 | Vitest（分组容量 / 重复校验 / 状态映射 / 数据迁移 / CSV 与合并 / 代码归一化 / 规则分档） |

## 功能一览

**V1.0**

- 窄条常驻 + 展开面板双形态，切换 11–13ms 到位、稳定 60fps
- 四种大盘阶段手动切换，标题 / 图标 / 强调色 / 选择器同步过渡
- 三列固定分组（短博反弹 / 中长期 / 分红型），每组最多 5 只
- 亮色 / 暗色 / 跟随系统，置顶开关，透明度滑杆，托盘菜单，开机自启

**V1.1 新增**

| 功能 | 说明 |
|---|---|
| 状态变更提示音 | `chime` 轻铃 / `bell` 铃铛 / `pulse` 脉冲 / `none` 静音，由 WebAudio 现场合成，不引入音频文件、离线可用，设置面板可试听 |
| 状态历史 | 点状态卡「x 天前」或设置里的变更记录数即可打开；倒序列出每次切换、持续时长，并统计各阶段累计天数与占比 |
| 自选股导入 / 导出 | 导出 JSON 备份（含设置与历史）或 CSV（`分组,名称,代码`，带 BOM，Excel 双击不乱码）；导入支持 CSV / JSON，先预览再选择「追加到现有」或「覆盖现有」 |
| 窄条宽度 | 300–560px 可调（步长 10，默认 340×46 的小胶囊），主进程按右上角锚点实时改宽度，收起态立即生效；宽度够 400px 时胶囊内额外显示分组简称 |
| 透明度 | 放宽到 65%–100%，滑杆实时预览 |
| 桌面皮肤 | 天光（淡蓝）/ 雾灰（中性）/ 暖砂（米杏）/ 墨蓝（冷调深蓝），亮暗各一套中性色，不影响「颜色 = 状态」的语义 |

截图见 `docs/screenshots/`（`history.png`、`import.png`、`settings.png`、`settings-io.png`、`skin-sand.png`、`skin-ink.png`、`compact-wide.png`）。

**V1.2 新增**

| 功能 | 说明 |
|---|---|
| 三路行情数据源 | 东方财富（`push2.eastmoney.com`，默认）/ 新浪财经（`hq.sinajs.cn`）/ 腾讯财经（`qt.gtimg.cn`），设置面板一键切换，三源输出同一 `Quote` 结构 |
| 股票价格与涨跌幅 | 每行右侧显示现价 + 涨跌幅，遵循 A 股习惯**红涨绿跌**；悬停显示昨收 / 今开 / 最高 / 最低 / 成交额 / 行情时间 |
| 窄条行情 | 分组胶囊显示该组平均涨跌幅；宽度 ≥392px 时状态文字旁补出基准指数涨跌幅，≥470px 时补出分组简称 |
| 基准指数读数 | 状态卡右侧常驻「上证指数 3650.64 -0.84%」，涨跌同色；点击可查看完整快照 |
| 大盘状态自动判断 | 以基准指数（上证 / 深证 / 创业板）当日涨跌幅分档，三档阈值可改，并要求连续 N 次确认才真正切换；关闭时完全手动，状态卡标签在「手动设置 / 规则自动」间切换 |
| 刷新策略 | 10 / 30 / 60 秒或手动；收盘后（非 9:15–15:05）自动停轮询，窗口隐藏到托盘时也暂停；同参数请求 1.5s 内走缓存 |
| 合规边界 | 只读取公开只读接口的价格字段，仅本机展示，不落库、不转发、不提供对外接口，界面明示「不构成投资建议」 |

截图：`expanded-light.png`（价格与指数）、`expanded-auto.png`（规则自动）、`settings-quote.png`（数据源与刷新）、`settings-rule.png`（阈值与确认次数）、`compact-wide.png`（窄条行情）。

## 快速开始

```bash
npm install

npm run dev          # 浏览器预览（localhost:5178），用 localStorage 顶替本地存储
npm run dev:electron # 真机开发：Vite + Electron 同起，支持托盘/置顶/窗口尺寸
```

首次启动默认是**窄条模式**，点击右侧绿色箭头展开完整面板。

## 构建与打包

```bash
npm run build    # 构建渲染层(dist) + 主进程(dist-electron)
npm start        # 构建后以生产模式启动

npm run pack     # 生成免安装目录 release/win-unpacked
npm run dist     # 生成 NSIS 安装包 release/Market Pulse-1.2.0-x64.exe

npm run pack:mac # macOS：生成 release/mac-arm64/Market Pulse.app（需在 macOS 上执行）
npm run dist:mac # macOS：生成 dmg + zip（arm64 与 x64 各一份）

npm run icons    # 重新生成 SVG 图标库 + 1024 主图 + ICO/ICNS/多尺寸 PNG + 菜单栏模板图
```

### macOS 打包

**必须在一台 macOS 上构建**，Windows / Linux 交叉打包会被 electron-builder 直接拒绝：

```
⨯ Build for macOS is supported only on macOS, please see https://electron.build/multi-platform-build
```

原因是 dmg 依赖系统自带的 `hdiutil`，签名与公证依赖 `codesign` / `xcrun`，这些在 Windows 上都没有。

在 Mac 上：

```bash
npm install
npm run dist:mac
```

产物：

- `release/Market Pulse-1.2.0-arm64.dmg`（Apple Silicon）
- `release/Market Pulse-1.2.0-x64.dmg`（Intel）
- 同名 `.zip`，用于自动更新或直接分发

**未签名说明**：`electron-builder.yml` 里 `identity: null` + `hardenedRuntime: false`，产出的是未签名包。首次打开需要：

1. 右键 App →「打开」→ 在弹窗里再点「打开」，或
2. 系统设置 → 隐私与安全性 → 底部「仍要打开」，或
3. 终端执行 `xattr -dr com.apple.quarantine "/Applications/Market Pulse.app"`

正式分发则需要 Apple Developer ID：

```bash
export CSC_LINK=/path/to/dev_id.p12
export CSC_KEY_PASSWORD=你的证书密码
# 并把 electron-builder.yml 里的 identity / hardenedRuntime / notarize 改回来
```

**macOS 下的形态差异**：`LSUIElement: true` + `app.dock.hide()`，App 只常驻菜单栏、不占 Dock；菜单栏图标用单色模板图（`build/trayTemplate.png`，系统按菜单栏明暗自动反色），点击弹出菜单而不是直接唤出窗口；「始终置顶」会同步到所有 Space，切桌面不会消失。

## 目录结构

```text
electron/
  main.ts                # 入口：单实例锁、IPC 注册、异常兜底
  preload.ts             # contextBridge 暴露受限 API
  window-manager.ts      # 无边框窗口、窄条/展开切换、窄条宽度、坐标恢复
  file-service.ts        # 导入 / 导出：文件对话框 + 大小限制 + CSV/JSON 解析
  quote-service.ts       # 行情：三源适配器、GBK 解码、分片批量、超时与缓存
  tray-service.ts        # 托盘菜单
  notification-service.ts
  storage-service.ts     # electron-store 读写 + 数据规整
src/
  assets/icons/          # 19 个独立 SVG + README（图标名称/用途/配色/用法）
  components/            # AppIcon / 标题栏 / 窄条 / 状态卡 / 切换器 / 分组列 / 股票行 / 弹窗 / 设置 / 状态历史 / 导入确认 / Toast
  composables/           # useAppData / useMarketStatus / useQuotes / useStockGroups / useTheme / useDesktop / useToast
  services/              # 常量与状态映射、默认数据与迁移、校验规则、导入导出、行情代码归一化、大盘规则引擎、提示音、时间格式化
  styles/                # tokens / themes（亮暗 × 四套皮肤）/ global
src-tauri/icons/         # app-icon.png（1024 主图）+ icon.ico / icon.icns / icon-*.png
  types/                 # 全部业务类型
tests/                   # stock-groups / market-status / import-export / market-rules
```

## 关键设计约定

- **配色体系**：所有颜色收敛到 `TONES`（8 组 tone，每组含磁贴渐变 a/b、柔和底 soft/softDark、强调字 ink/inkDark）。组件只引用 tone，不写死十六进制，亮暗切换自动跟随。
- **三列固定**：短博反弹（orange）、中长期（blue）、分红型（gold）。分组色恒定，只有大盘状态卡与选择器随状态换色。
- **状态色**：底部筑底（orange）/ 调整下行（coral）/ 开始反弹（teal）/ 牛市上行（purple），每个状态同时用图标 + 文字 + 颜色表达，不依赖单一色彩。
- **图标口径**：SVG 文件默认色对齐图标设计稿（蓝橙青粉），界面内通过 `AppIcon` 的 `tone` 重着色为 UI 设计稿阶段色，保证「图标 = 卡片底色 = 选中胶囊」三者一致。详见 `src/assets/icons/README.md`。
- **容量**：每组最多 5 只，同一分组内股票代码去空格转大写后判重，跨分组允许重复；列头 `n/5` 角标反映剩余容量。
- **无伪造行情**：界面上的每个价格都来自当次真实请求；请求失败时保留上一次快照并在底栏标红原因，绝不填演示数据。浏览器预览没有主进程代发请求，会明确提示「请使用桌面版」。
- **行情走主进程**：渲染层是 `contextIsolation` 沙箱，直连第三方接口会被 CORS 拦掉，三家源还都要自定义 UA / Referer。因此 `electron/quote-service.ts` 统一取数，渲染层只通过 `fetchQuotes` 拿结构化结果；主进程对入参做枚举、长度（≤40）与代码格式校验。
- **三源同一形状**：涨跌额与涨跌幅一律由 `price - prevClose` 本地计算，不直接吃各源的 `f3` / `涨跌幅` 字段，规避口径差异；成交量统一换算成手、成交额统一换算成元。
- **规则单一维度**：自动判断只用「基准指数当日涨跌幅」，`pct ≥ bullish → 牛市上行`、`≥ rebound → 开始反弹`、`≤ decline → 调整下行`、其余 → 底部筑底。阈值必须满足 `decline < rebound < bullish`，破坏顺序时整组回落默认值；`applyThreshold` 在交互时自动推开相邻档，用户不会试出非法组合。
- **连续确认抗抖动**：同一档连续命中 `confirm` 次（默认 3）才真正切换，避免一根分时就把状态刷掉。实测 `confirm=2` 时第一次观测不切换、第二次才切换。
- **轮询不打扰源站**：10 / 30 / 60 秒可调，收盘后（北京时间 9:15–15:05 之外）停止轮询，窗口隐藏到托盘时也暂停；相同参数的请求 1.5 秒内直接命中缓存。
- **安全**：`contextIsolation: true`、`nodeIntegration: false`，preload 只暴露 `window.desktop` 的固定方法；主进程对 `saveAppData` 做结构、枚举、容量、透明度全量校验。
- **窗口**：关闭按钮 = 隐藏到托盘；托盘菜单提供显示/隐藏、展开/收起、置顶开关、设置、退出。窗口坐标异常时回落到主屏可见区域。
- **展开/收起性能**：窄条与展开面板常驻 DOM，只用 `v-show` 切显隐，不重建组件树；切换时先让主进程 `setBounds` 把窗口尺寸调到位，再切布局（不等待落盘防抖）。实测点击到窗口变尺寸 11–13ms，稳定 60fps。
- **皮肤只改中性色**：`SKIN_META` 只覆盖 `--bg*` / `--card*` / `--text*` / `--border*` / 阴影，`--market-*` 与分组 tone 保持不变，所以换皮肤不会让「颜色 = 状态」失效；设置面板的缩略图按当前亮暗取色（`swatch.light` / `swatch.dark`）。
- **导入是纯函数**：`parseStocksCsv` / `toStocksCsv` / `mergeGroups` / `appDataFromCsvRows` 都在 `src/services/app-data.ts`，主进程与渲染层共用同一份实现，单测直接覆盖；合并语义由渲染层确认后再落盘，`append` 会跳过同组重复代码并按 5 只截断。
- **提示音不落文件**：`src/services/sound.ts` 用 `OscillatorNode` + 指数包络合成三种音色，`AudioContext` 懒创建（遵循浏览器自动播放策略），静音档直接短路。
- **托盘图标分平台**：Windows 任务栏要彩色磁贴并按 `nativeTheme.shouldUseDarkColors` 在 `tray-light` / `tray-dark` 之间切换；macOS 菜单栏只认「单色 + alpha」的模板图（`build/trayTemplate.png` + `@2x`），系统自己按菜单栏明暗反色。模板图在 16×16 逻辑网格上按整数坐标绘制、`@2x` 按 2 倍整数放大，**不能靠降采样**——那样影线会糊成半透明。
- **窗口的平台差异**：macOS 关掉系统自带的 `roundedCorners`（否则和 CSS 的 20px 圆角叠出毛边），开启 `acceptFirstMouse`（未激活窗口的第一次点击也命中控件）；置顶时同步 `setVisibleOnAllWorkspaces`，否则切 Space 就看不见了；`LSUIElement` + `app.dock.hide()` 让它只活在菜单栏，因此 `showWindow()` 需要先 `app.focus({ steal: true })` 才能拿到键盘焦点。

## 数据模型

```ts
AppData {
  version: number                 // 4：新增 quoteSource / quoteRefresh / marketRule
  settings: {
    marketStatus, theme, skin, alwaysOnTop, opacity,
    compactWidth,                 // 300–560，步长 10，默认 340
    compactMode, launchAtLogin, notifyOnStatusChange,
    notificationSound,            // chime | bell | pulse | none
    quoteSource,                  // eastmoney | sina | tencent
    quoteRefresh,                 // 10 | 30 | 60 | 0（手动）
    marketRule: {                 // 大盘状态自动判断
      auto,                       // 关闭时完全手动
      indexCode,                  // sh000001 | sz399001 | sz399006
      bullish, rebound, decline,  // 三档阈值（%），必须严格递增
      confirm,                    // 连续确认次数 1–10
    },
    windowBounds?
  }
  groups: StockGroup[]            // 固定 3 组，每组 stocks ≤ 5
  statusHistory: { status, changedAt }[]  // 仅状态真正变化时追加，最多 50 条
}
```

读取时统一走 `normalizeAppData()`：缺失分组补齐、超量截断、重复代码去重、非法枚举回落默认值、`opacity` 夹到 0.65–1、`compactWidth` 取整到 step 并夹在 300–560、`quoteRefresh` 必须落在候选集内、`marketRule` 经 `clampRule()` 收敛（阈值乱序整组回落默认）。因此 V1.0 / V1.1 的旧存档、外部导入文件或损坏数据都不会导致白屏。窄条尺寸刻度在 v3 改过（旧默认 700×88），所以低版本存档的 `compactWidth` 会直接回到新默认值 340，而不是被夹到上限。

行情快照不入库：`Quote` 只活在渲染层内存里，退出即丢，存档中不含任何行情历史。

导出格式：

- **JSON**：`{ app, schema, exportedAt, data }`，`data` 即完整 `AppData`，用于整机迁移
- **CSV**：`分组,名称,代码` 三列 + UTF-8 BOM；导入时也接受两列（`名称,代码`，归入中长期），分组列支持「短博反弹 / 短博 / 中长期 / 中长 / 分红型 / 分红」及对应枚举值

## 验收自检

**V1.0**

- [x] 四种大盘状态可手动切换，标题 / 图标 / 强调色 / 选择器同步更新（180ms 过渡）
- [x] 三列分组始终并排，窗口最小宽度 900px
- [x] 每组上限 5 只，满 5 只后添加按钮禁用并提示
- [x] 同组代码重复、空输入、超容量均有明确文案
- [x] 删除股票为行内二次确认，删除后数量同步
- [x] 亮色 / 暗色 / 跟随系统，切换不影响状态与股票数据
- [x] 重启后股票、状态、主题、窗口坐标恢复
- [x] 置顶开关、拖动区域、窄条 ↔ 展开、托盘显示/隐藏/退出
- [x] 界面不出现任何伪造的实时行情数据
- [x] 19 个 SVG 图标 + 1024 主图 + ICO/ICNS/多尺寸 PNG 齐全，托盘按任务栏明暗自动换图

**V1.1**

- [x] 切换大盘阶段时按所选音色播放提示音，静音档不发声，试听按钮即时反馈
- [x] 状态历史可查看每次变更的时间、持续时长、当前标记，以及各阶段累计天数与占比（条宽与百分比一致）
- [x] 导出 JSON / CSV 成功后有 Toast 提示，取消不报错
- [x] 导入先预览（文件名、识别到的股票数、分组明细），可追加或覆盖；追加会跳过同组重复代码，超出 5 只时提前红色提示
- [x] 窄条宽度 560–900px 实时生效，收起态窗口按右上角锚点收放
- [x] 透明度 0.65–1.00，滑杆实时生效
- [x] 四套皮肤在亮暗两种主题下都能正确呈现，状态色与分组色不随皮肤改变
- [x] `npm test` 53 项用例通过，`npm run typecheck` 无报错

**V1.2**

- [x] 三个数据源都能取到同一批个股与指数，同一时刻三家返回的价格一致（实测 600519 / 000001 / 300750 / sh000001 / sz399006）
- [x] 价格与涨跌幅按红涨绿跌渲染，涨跌为 0 时回落中性灰，不会出现 `-0.0%`
- [x] 非法数据源、超长代码列表、非指数代码都会被主进程拒绝并返回明确错误
- [x] 窄条在 300 / 340 / 520px 三档下都不裁切：窄时只留数字，宽时补出指数涨跌幅与分组简称
- [x] 自动判断在 `confirm=1` 时当次切换，`confirm=2` 时首次不切换、第二次才切换（已用 CDP 实测）
- [x] 关闭自动判断后状态卡回到「手动设置」，历史仍按真实切换记录
- [x] 阈值乱序（如 bullish 小于 rebound）时保存会被夹回默认值，不会出现永远命中不了的区间
- [x] `npm test` 76 项用例通过，`npm run typecheck` 无报错

## 已知边界（V1.2 范围外）

分时 / K 线图、涨跌家数等市场宽度指标、盘口五档、交易下单、登录与云同步、自选股搜索。

行情来自各站公开只读接口，可能延迟、限流或临时不可用；本项目不做任何交易动作，展示内容不构成投资建议。
