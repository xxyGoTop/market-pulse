/**
 * 生成 Market Pulse 图标库（统一 viewBox="0 0 64 64"）。
 *
 * - 业务图标（大盘状态 / 分组）为渐变圆角磁贴 + 白色图形，颜色取自设计稿。
 * - 通用操作图标沿用 lucide 的路径数据（24 网格）并整体缩放到 64 网格，
 *   统一 stroke="currentColor"，方便通过 CSS 或组件属性换色。
 *
 * 用法：node scripts/gen-icon-svgs.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const outDir = path.resolve('src/assets/icons')
mkdirSync(outDir, { recursive: true })

/**
 * 渐变磁贴：铺满 64×64 画布（圆角 20 ≈ 31%）。
 * 这样在界面里 `size` 就等于磁贴实际尺寸，无需再换算内边距。
 */
const TILE = { x: 0, y: 0, size: 64, r: 20 }

/**
 * 渐变色停靠点写成 `var(--tone-a, 设计稿色)`：
 * - 单独打开 SVG 时用设计稿原色（蓝色 / 橙色 / 青绿色 / 粉色）；
 * - 在界面里由 AppIcon 传入 --tone-a / --tone-b 覆盖，
 *   因此不需要改动 SVG 文件内容就能换主题色。
 */
function tile(id, from, to) {
  return `
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--tone-a, ${from})"/>
      <stop offset="1" stop-color="var(--tone-b, ${to})"/>
    </linearGradient>
    <linearGradient id="${id}-gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/>
      <stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="${TILE.x}" y="${TILE.y}" width="${TILE.size}" height="${TILE.size}" rx="${TILE.r}" fill="url(#${id})"/>
  <rect x="${TILE.x}" y="${TILE.y}" width="${TILE.size}" height="${TILE.size}" rx="${TILE.r}" fill="url(#${id}-gloss)"/>`
}

function businessIcon({ name, title, from, to, glyph }) {
  // 图形按 1.12 倍围绕中心放大：磁贴铺满画布后，图形在 46px 等界面尺寸下
  // 仍能占到约 55% 的可视面积，与设计稿比例一致
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${title}">
  <title>${title}</title>${tile(name, from, to)}
  <g transform="translate(32 32) scale(1.12) translate(-32 -32)">
${glyph}
  </g>
</svg>
`
  writeFileSync(path.join(outDir, `${name}.svg`), svg)
}

/** 通用图标：把 lucide 的 24 网格路径整体放大到 64 网格 */
function lucideIcon({ name, title, paths, stroke = 2 }) {
  // 路径是 lucide 的 24 网格数据，整体缩放到 64 网格；
  // 线宽写在缩放组内，保持 24 网格下的原始比例（默认 2）
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${title}">
  <title>${title}</title>
  <g transform="scale(2.6667)" stroke-width="${stroke}">
${paths
  .map((p) => `    ${p}`)
  .join('\n')}
  </g>
</svg>
`
  writeFileSync(path.join(outDir, `${name}.svg`), svg)
}

/* ------------------------------------------------------------------ *
 * 1. 大盘状态
 * ------------------------------------------------------------------ */

// 底部筑底：低位震荡折线 + 落点圆点
businessIcon({
  name: 'market-bottom',
  title: '底部筑底',
  from: '#5B9BFF',
  to: '#3F7BE8',
  glyph: `  <g fill="none" stroke="#FFFFFF" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 41 L23 29 L30 37 L37 27"/>
  </g>
  <circle cx="45.5" cy="24" r="5.4" fill="#FFFFFF"/>`,
})

// 调整下行：向右下台阶 + 拐角箭头
businessIcon({
  name: 'market-down',
  title: '调整下行',
  from: '#FFB35C',
  to: '#EE8A2E',
  glyph: `  <g fill="none" stroke="#FFFFFF" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 21 L27 32 L34 25 L46 40"/>
    <path d="M46 29 L46 40 L35 40"/>
  </g>`,
})

// 开始反弹：向右上台阶 + 拐角箭头
businessIcon({
  name: 'market-rebound',
  title: '开始反弹',
  from: '#43D69B',
  to: '#1FB37B',
  glyph: `  <g fill="none" stroke="#FFFFFF" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 43 L27 32 L34 39 L46 24"/>
    <path d="M46 35 L46 24 L35 24"/>
  </g>`,
})

// 牛市上行：牛头剪影（设计稿为侧身牛，此处按一致的矢量风格重绘为牛头）
businessIcon({
  name: 'market-bull',
  title: '牛市上行',
  from: '#FF7FBB',
  to: '#EE4A93',
  glyph: `  <g fill="none" stroke="#FFFFFF" stroke-width="4.6" stroke-linecap="round">
    <path d="M24 30.5C18.5 29.6 14 25.4 12.4 19.6"/>
    <path d="M40 30.5C45.5 29.6 50 25.4 51.6 19.6"/>
  </g>
  <ellipse cx="32" cy="36.5" rx="11" ry="10.2" fill="#FFFFFF"/>
  <g fill="url(#market-bull)">
    <circle cx="27.6" cy="34" r="1.9"/>
    <circle cx="36.4" cy="34" r="1.9"/>
    <circle cx="29" cy="42" r="1.15"/>
    <circle cx="35" cy="42" r="1.15"/>
  </g>`,
})

/* ------------------------------------------------------------------ *
 * 2. 股票分组
 * ------------------------------------------------------------------ */

// 短博反弹：闪电
businessIcon({
  name: 'short-term',
  title: '短博反弹',
  from: '#FFB35C',
  to: '#EE8A2E',
  glyph: `  <path d="M35.6 13.4 20.4 35.2a1.4 1.4 0 0 0 1.15 2.2h8.3l-2.1 13.2a1.4 1.4 0 0 0 2.5 1l15.2-21.8a1.4 1.4 0 0 0-1.15-2.2h-8.3l2.1-13.2a1.4 1.4 0 0 0-2.5-1z" fill="#FFFFFF"/>`,
})

// 中长期：柱状图 + 上扬箭头
businessIcon({
  name: 'long-term',
  title: '中长期',
  from: '#5B9BFF',
  to: '#3F7BE8',
  glyph: `  <g fill="#FFFFFF">
    <rect x="14" y="38" width="7.4" height="12" rx="3.2"/>
    <rect x="24" y="33" width="7.4" height="17" rx="3.2" opacity="0.88"/>
    <rect x="34" y="27" width="7.4" height="23" rx="3.2" opacity="0.72"/>
    <rect x="44" y="22" width="7.4" height="28" rx="3.2" opacity="0.58"/>
  </g>
  <g fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 30 L25 19 L33 25 L46 12"/>
    <path d="M46 21 L46 12 L37 12"/>
  </g>`,
})

// 分红型：硬币堆叠
businessIcon({
  name: 'dividend',
  title: '分红型',
  from: '#F6CB5C',
  to: '#DCA02A',
  glyph: `  <g fill="#FFFFFF">
    <ellipse cx="32" cy="43.4" rx="12" ry="3.4" opacity="0.7"/>
    <ellipse cx="32" cy="34.4" rx="12" ry="3.4" opacity="0.87"/>
    <ellipse cx="32" cy="25.4" rx="12" ry="3.4"/>
  </g>
  <ellipse cx="32" cy="25.4" rx="4.8" ry="1.2" fill="url(#dividend)"/>`,
})

/* ------------------------------------------------------------------ *
 * 3. 应用操作 / 股票操作（lucide 路径）
 * ------------------------------------------------------------------ */

const L = {
  add: { title: '添加', paths: ['<path d="M5 12h14"/>', '<path d="M12 5v14"/>'] },
  remove: { title: '删除', paths: ['<path d="M5 12h14"/>'] },
  close: { title: '关闭', paths: ['<path d="M18 6 6 18"/>', '<path d="m6 6 12 12"/>'] },
  collapse: { title: '收起', paths: ['<path d="m6 9 6 6 6-6"/>'] },
  search: {
    title: '搜索',
    paths: ['<circle cx="11" cy="11" r="8"/>', '<path d="m21 21-4.3-4.3"/>'],
  },
  settings: {
    title: '设置',
    stroke: 1.7,
    paths: [
      '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>',
      '<circle cx="12" cy="12" r="3"/>',
    ],
  },
  pin: {
    title: '置顶',
    paths: [
      '<path d="M12 17v5"/>',
      '<path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    ],
  },
  refresh: {
    title: '刷新',
    paths: [
      '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>',
      '<path d="M21 3v5h-5"/>',
      '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>',
      '<path d="M8 16H3v5"/>',
    ],
  },
  'trend-up': {
    title: '上涨',
    paths: ['<path d="M16 7h6v6"/>', '<path d="m22 7-8.5 8.5-5-5L2 17"/>'],
  },
  'trend-down': {
    title: '下跌',
    paths: ['<path d="M16 17h6v-6"/>', '<path d="m22 17-8.5-8.5-5 5L2 7"/>'],
  },
  'stock-detail': {
    title: '详情',
    paths: [
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>',
      '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
      '<path d="M8 13h2"/>',
      '<path d="M8 17h8"/>',
      '<path d="M14 13h2"/>',
    ],
  },
  favorite: {
    title: '收藏',
    stroke: 1.8,
    paths: [
      '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    ],
  },
}

for (const [name, def] of Object.entries(L)) {
  lucideIcon({ name, title: def.title, paths: def.paths, stroke: def.stroke })
}

console.log(`icons written to ${outDir}`)
