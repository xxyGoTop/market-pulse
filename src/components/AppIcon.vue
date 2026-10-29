/**
 * AppIcon —— 统一图标入口
 *
 * 两种来源：
 * 1. 通用操作图标 → lucide-vue-next（线性、currentColor、随字号缩放）
 * 2. 业务图标     → src/assets/icons/*.svg 独立矢量资源（渐变磁贴 + 白色图形）
 *
 * 业务图标的渐变色停靠点写成 `var(--tone-a, 设计稿色)`，
 * 因此传 `tone` 就能换色，不需要改动 SVG 文件本身。
 */
<script lang="ts">
/** 模块级自增：给每个实例的 SVG 渐变 id 加前缀，避免同页多实例串色 */
let instanceSeq = 0
</script>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Bell,
  ChevronDown,
  CircleAlert,
  Check,
  Info,
  Minus,
  Monitor,
  Moon,
  Pin,
  PinOff,
  Plus,
  Power,
  RotateCw,
  Search,
  Settings,
  Sun,
  Trash2,
  ChevronUp,
  X,
} from 'lucide-vue-next'
import type { ToneName } from '@/services/constants'
import { TONES } from '@/services/constants'

/** 通用操作图标：全部走 lucide，保证线性风格一致 */
const LUCIDE = {
  add: Plus,
  remove: Minus,
  close: X,
  collapse: ChevronUp,
  expand: ChevronDown,
  search: Search,
  refresh: RotateCw,
  settings: Settings,
  pin: Pin,
  'pin-off': PinOff,
  trash: Trash2,
  bell: Bell,
  info: Info,
  alert: CircleAlert,
  check: Check,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  power: Power,
} as const

/** 业务图标：自定义 SVG（渐变磁贴 + 白色图形） */
const CUSTOM = [
  'market-bottom',
  'market-down',
  'market-rebound',
  'market-bull',
  'short-term',
  'long-term',
  'dividend',
  'trend-up',
  'trend-down',
  'stock-detail',
  'favorite',
] as const

type IconName = keyof typeof LUCIDE | (typeof CUSTOM)[number]

const props = withDefaults(
  defineProps<{
    name: IconName | string
    /** 像素尺寸，默认 20 */
    size?: number
    /** 线条 / 图形颜色；磁贴图标用于覆盖磁贴渐变 */
    color?: string
    /** 无障碍名称；不传视为装饰性图标 */
    ariaLabel?: string
    /** 磁贴配色（仅业务图标生效） */
    tone?: ToneName
    strokeWidth?: number
  }>(),
  { size: 20, strokeWidth: 2 },
)

const rawSvg = import.meta.glob<string>('../assets/icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const instanceId = `ai${++instanceSeq}`

const isLucide = computed(() => (props.name as string) in LUCIDE)
const lucideComp = computed(() => LUCIDE[props.name as keyof typeof LUCIDE])

/**
 * 内联自定义 SVG：
 * - 去掉固定 width/height，交给外层 CSS 控制；
 * - 把渐变 id 加上实例前缀，避免同页多实例互相串色。
 */
const svgMarkup = computed(() => {
  if (isLucide.value) return ''
  const key = `../assets/icons/${props.name}.svg`
  const raw = rawSvg[key]
  if (!raw) return ''
  return raw
    .replace(/\swidth="64"[\s\S]*?height="64"/, '')
    .replaceAll(`id="${props.name}`, `id="${instanceId}-${props.name}`)
    .replaceAll(`url(#${props.name}`, `url(#${instanceId}-${props.name}`)
    .replace(/\srole="img"/, '')
    .replace(/\saria-label="[^"]*"/, '')
})

const style = computed<Record<string, string>>(() => {
  const s: Record<string, string> = {
    width: `${props.size}px`,
    height: `${props.size}px`,
  }
  if (props.tone) {
    s['--tone-a'] = TONES[props.tone].a
    s['--tone-b'] = TONES[props.tone].b
  }
  if (props.color) s.color = props.color
  return s
})
</script>

<template>
  <span
    class="app-icon"
    :class="{ 'is-tile': !isLucide }"
    :style="style"
    :role="ariaLabel ? 'img' : undefined"
    :aria-label="ariaLabel"
    :aria-hidden="ariaLabel ? undefined : 'true'"
  >
    <component
      :is="lucideComp"
      v-if="isLucide"
      :size="size"
      :stroke-width="strokeWidth"
      aria-hidden="true"
    />
    <!-- eslint-disable-next-line vue/no-v-html -- 图标为本仓库内置的静态 SVG 资源 -->
    <span v-else class="tile" v-html="svgMarkup" />
  </span>
</template>

<style scoped>
.app-icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  line-height: 0;
  color: inherit;
}

.app-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.tile {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
