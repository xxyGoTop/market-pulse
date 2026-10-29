# Market Pulse 图标资源

图标分三层：**业务 SVG**（渐变磁贴 + 白色图形）、**通用操作图标**（lucide 线性图标）、**应用主图**（多平台打包图标）。
所有 SVG 统一 `viewBox="0 0 64 64"`，不内嵌位图，不依赖外部字体。

生成脚本：`npm run icons`（等价于依次执行下面三个脚本）

| 脚本 | 产物 |
| --- | --- |
| `scripts/gen-icon-svgs.mjs` | `src/assets/icons/*.svg`（19 个） |
| `scripts/gen-icons.mjs` | `src-tauri/icons/app-icon.png`、`build/icon.png`、`build/tray-*.png` |
| `scripts/gen-platform-icons.mjs` | `src-tauri/icons/icon.ico / icon.icns / icon-*.png`、`build/icon.ico / icon.icns / icon-512.png` |

---

## 1. 业务图标（自定义 SVG）

磁贴铺满 64×64 画布（圆角 20 ≈ 31%），上方叠一层白色柔光，图形为纯白。
渐变色停靠点写成 `var(--tone-a, 设计稿色)` / `var(--tone-b, 设计稿色)`，
所以**单独打开 SVG 时是设计稿配色**，在界面里可由组件传 `tone` 覆盖，无需改文件。

| 名称 | 用途 | 设计稿配色 | 图形 |
| --- | --- | --- | --- |
| `market-bottom.svg` | 大盘阶段 · 底部筑底 | 蓝 `#5B9BFF → #3F7BE8` | 低位震荡折线 + 落点圆点 |
| `market-down.svg` | 大盘阶段 · 调整下行 | 橙 `#FFB35C → #EE8A2E` | 阶梯下行 + 拐角箭头 |
| `market-rebound.svg` | 大盘阶段 · 开始反弹 | 青绿 `#43D69B → #1FB37B` | 阶梯上行 + 拐角箭头 |
| `market-bull.svg` | 大盘阶段 · 牛市上行 | 粉 `#FF7FBB → #EE4A93` | 牛头剪影（双角 + 眼鼻） |
| `short-term.svg` | 分组 · 短博反弹 | 橙 `#FFB35C → #EE8A2E` | 闪电 |
| `long-term.svg` | 分组 · 中长期 | 蓝 `#5B9BFF → #3F7BE8` | 四柱递增 + 上扬箭头 |
| `dividend.svg` | 分组 · 分红型 | 金 `#F6CB5C → #DCA02A` | 三层硬币堆叠 |
| `trend-up.svg` | 股票操作 · 上涨 | `currentColor` | 折线 + 右上箭头 |
| `trend-down.svg` | 股票操作 · 下跌 | `currentColor` | 折线 + 右下箭头 |
| `stock-detail.svg` | 股票操作 · 详情 | `currentColor` | 文档 + 文本行 |
| `favorite.svg` | 股票操作 · 收藏 | `currentColor` | 五角星 |

> 说明：`trend-up` / `trend-down` / `stock-detail` / `favorite` 属于「股票操作」而非通用操作，
> 因此保留独立 SVG（可直接下载复用），不使用 lucide。

## 2. 通用操作图标

`add`、`remove`、`close`、`collapse`、`search`、`refresh`、`settings`、`pin`
这 8 个在仓库里同时提供了独立 SVG（`src/assets/icons/*.svg`，`stroke="currentColor"`），
但 **界面渲染统一走 `lucide-vue-next`**，以保证线宽、端点、圆角与其余线性图标完全一致。

SVG 文件的路径数据本身也来自 lucide（24 网格），整体缩放到 64 网格，
线宽写在缩放组内部（`stroke-width="2"`），因此放大后比例不失真。

## 3. 应用主图与打包图标

| 文件 | 尺寸 | 用途 |
| --- | --- | --- |
| `src-tauri/icons/app-icon.png` | 1024×1024 | 主图（唯一真源），深蓝底 + 薄荷绿柱状图与上涨箭头，无文字 |
| `src-tauri/icons/icon-32/64/128/256/512/1024.png` | 多尺寸 | 通用 PNG，Linux 打包、文档配图 |
| `src-tauri/icons/icon.ico` | 16/24/32/48/64/128/256 | Windows 可执行文件与安装包 |
| `src-tauri/icons/icon.icns` | 32/64/128/256/512/1024 | macOS 应用包 |
| `build/tray-light.png` | 64×64 | **浅色任务栏**用（深色磁贴） |
| `build/tray-dark.png` | 64×64 | **深色任务栏**用（浅色磁贴） |

托盘图标在 `electron/tray-service.ts` 里按 `nativeTheme.shouldUseDarkColors` 选择，
并监听 `nativeTheme` 的 `updated` 事件实时换图。

打包配置：

- Electron（实际出货）：`electron-builder.yml` → `win.icon: build/icon.ico`、`mac.icon: build/icon.icns`
- Tauri（预留）：`src-tauri/tauri.conf.json` → `bundle.icon` 指向上面这些真实文件

## 4. 在界面里使用

```vue
<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
</script>

<!-- 业务图标：渐变磁贴，tone 覆盖配色 -->
<AppIcon name="market-rebound" :size="46" tone="teal" aria-label="开始反弹" />

<!-- 通用操作图标：跟随 currentColor -->
<AppIcon name="settings" :size="16" />

<!-- 显式指定颜色 -->
<AppIcon name="close" :size="15" color="#E0524F" />
```

`AppIcon` 参数：

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | 必填 | 图标名，见上文表格 |
| `size` | `number` | `20` | 像素尺寸（宽高相同） |
| `color` | `string` | — | 覆盖 `color`，线性图标即描边色 |
| `ariaLabel` | `string` | — | 无障碍名称；不传则视为装饰性图标（`aria-hidden`） |
| `tone` | `ToneName` | — | 业务图标的磁贴配色，见 `src/services/constants.ts` 的 `TONES` |
| `strokeWidth` | `number` | `2` | 仅 lucide 图标生效 |

`TONES` 提供 8 组配色：`blue` `orange` `teal` `pink` `coral` `gold` `purple` `neutral`，
每组包含 `a`/`b`（磁贴渐变）、`soft`/`softDark`（卡片柔和底色）、`ink`/`inkDark`（强调文字色）。

## 5. 配色口径说明

图标设计稿给出的四色是 **蓝 / 橙 / 青绿 / 粉**（见 `docs/Market_Pulse_图标设计资源包`），
而 UI 设计稿的「大盘阶段样式」区给出的是 **青绿 / 琥珀 / 珊瑚红 / 紫**。

因此：

- **SVG 文件默认色** 严格对齐图标设计稿（蓝橙青粉），单独取用即为设计稿效果；
- **界面内**通过 `tone` 把磁贴重着色为 UI 设计稿的阶段色，
  保证「图标颜色 = 卡片底色 = 选中胶囊」三者一致，整屏不会出现两套配色。

若要改为「界面也统一用图标设计稿配色」，只需把 `src/services/constants.ts` 中
`MARKET_STATUS_META[*].tone` 依次改成 `blue` / `orange` / `teal` / `pink` 即可，无需改任何 SVG。
