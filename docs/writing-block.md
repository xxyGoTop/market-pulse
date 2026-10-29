# Market Pulse 图标资源工程化任务

基于现有 Market Pulse 图标设计稿，为  Vue 3 + TypeScript 项目建立正式的图标资源体系。

## 1. 自定义 SVG 图标

重新绘制并提供以下独立 SVG：

- 市场状态：market-bottom、market-down、market-rebound、market-bull
- 股票分组：short-term、long-term、dividend
- 应用操作：add、remove、settings、pin、collapse、search、refresh、close
- 股票操作：trend-up、trend-down、stock-detail、favorite

要求：
- 每个 SVG 都是独立矢量文件，不得使用嵌入 PNG 的方式伪装成 SVG。
- 统一使用 viewBox="0 0 64 64"。
- 保持圆角、简洁、苹果风格的视觉语言。
- 市场状态颜色：蓝色、橙色、青绿色、粉色。
- 通用操作图标支持 currentColor。
- 不要通过改变 SVG 文件内容来动态切换主题；使用 CSS 或组件属性控制颜色。
- 为每个图标提供可访问的名称。

## 2. Vue 组件封装

创建 AppIcon.vue，支持：
- name：图标名称
- size：图标尺寸
- color：可选颜色
- ariaLabel：无障碍名称

优先使用 lucide-vue-next 实现通用操作图标，自定义业务图标使用独立 SVG 资源。

## 3. 桌面应用图标

设计独立的 1024×1024 应用主图：
- 深蓝色背景
- 薄荷绿色上涨趋势曲线与柱状图
- 不包含文字
- 缩小后仍然清晰

将主图保存到 src-tauri/icons/app-icon.png，并使用 Tauri CLI 生成所需的 Windows ICO、macOS ICNS 及其他平台图标。

## 4. 交付要求

- 提交所有 SVG、PNG、ICO、ICNS 文件。
- 更新 Tauri bundle.icon 配置，确保路径与真实文件一致。
- 添加 README，说明每个图标的名称、用途、颜色和使用方式。
- 验证构建流程，不得删除现有项目配置。
- 不要将整张 PNG 设计稿直接当成最终图标库。
- 对无法从设计稿准确还原的图形，采用一致的矢量风格重新绘制。