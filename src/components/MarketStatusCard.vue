<script setup lang="ts">
import { computed } from 'vue'
import type { MarketStatus, Quote } from '@/types'
import { MARKET_STATUS_META } from '@/services/constants'
import { formatPercent, trendOf } from '@/services/market-rules'
import { formatClock, formatRelative } from '@/services/time'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  status: MarketStatus
  lastChangedAt?: number
  /** 基准指数行情；取不到时整块隐藏，不留空占位 */
  indexQuote?: Quote
  /** 是否处于规则自动判断模式 */
  auto?: boolean
  /** 悬停提示：当前规则是怎么分档的 */
  ruleHint?: string
}>()

const emit = defineEmits<{ (e: 'open-history'): void }>()

const meta = computed(() => MARKET_STATUS_META[props.status])

const changedText = computed(() =>
  props.lastChangedAt ? formatRelative(props.lastChangedAt) : '尚未切换过',
)

const trend = computed(() => (props.indexQuote ? trendOf(props.indexQuote.changePercent) : 0))

const indexTitle = computed(() => {
  const q = props.indexQuote
  if (!q) return ''
  return [
    `${q.name} ${q.price.toFixed(2)}`,
    `涨跌 ${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)}（${formatPercent(q.changePercent)}）`,
    `今开 ${q.open.toFixed(2)} 最高 ${q.high.toFixed(2)} 最低 ${q.low.toFixed(2)}`,
    `${formatClock(q.time)} 更新`,
  ].join('\n')
})
</script>

<template>
  <section class="status-card">
    <AppIcon class="status-icon" :name="meta.icon" :size="46" :tone="meta.tone" />

    <div class="status-text">
      <span class="eyebrow">市场状态提醒</span>
      <h1 class="status-title">{{ meta.label }}</h1>
    </div>

    <div class="status-right">
      <div
        v-if="indexQuote"
        class="index"
        :class="{ up: trend > 0, down: trend < 0 }"
        :title="indexTitle"
      >
        <span class="index-name">{{ indexQuote.name }}</span>
        <span class="index-value">{{ indexQuote.price.toFixed(2) }}</span>
        <span class="index-pct">{{ formatPercent(indexQuote.changePercent) }}</span>
      </div>

      <div class="status-side">
        <span
          class="pill"
          :class="auto ? 'auto' : 'manual'"
          :title="auto ? ruleHint : '大盘阶段由你手动维护'"
        >
          <i class="dot" />
          {{ auto ? '规则自动' : '手动设置' }}
        </span>
        <button class="changed" title="查看状态历史" @click="emit('open-history')">
          {{ changedText }}
          <AppIcon name="expand" :size="10" :stroke-width="2.6" class="changed-icon" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.status-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 13px 16px;
  flex: none;
  border-radius: var(--radius-card);
  border: 1px solid color-mix(in srgb, var(--market-a) 22%, var(--border));
  background:
    linear-gradient(
      112deg,
      color-mix(in srgb, var(--market-soft) 100%, var(--card-solid)) 0%,
      color-mix(in srgb, var(--market-soft) 64%, var(--card-solid)) 52%,
      color-mix(in srgb, var(--market-soft) 26%, var(--card-solid)) 100%
    );
  box-shadow:
    0 1px 2px rgba(22, 32, 47, 0.04),
    0 12px 30px color-mix(in srgb, var(--market-b) 12%, transparent);
}

.status-icon {
  filter: drop-shadow(0 5px 12px color-mix(in srgb, var(--market-b) 40%, transparent));
}

.status-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.eyebrow {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-3);
}

.status-title {
  margin: 0;
  font-size: var(--fs-title);
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--text);
}

.status-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
  flex: none;
}

/* 指数读数：等宽数字，涨跌色沿用 A 股红涨绿跌 */
.index {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-right: 14px;
  border-right: 1px solid color-mix(in srgb, var(--text) 9%, transparent);
  font-variant-numeric: tabular-nums;
}

.index-name {
  font-size: 10.5px;
  color: var(--text-3);
}

.index-value {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text);
}

.index-pct {
  font-size: 11.5px;
  font-weight: 650;
  color: var(--text-3);
}

.index.up .index-value,
.index.up .index-pct {
  color: var(--up);
}

.index.down .index-value,
.index.down .index-pct {
  color: var(--down);
}

.status-side {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.pill {
  height: 24px;
  padding: 0 11px;
  border: none;
  color: var(--market-ink);
  background: color-mix(in srgb, var(--market-soft) 72%, var(--card-solid));
}

/* 自动模式下加一圈描边，和手动状态区分开 */
.pill.auto {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--market-a) 42%, transparent);
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.pill.auto .dot {
  animation: pulse 2.4s var(--ease) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.changed {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 18px;
  padding: 0 5px;
  border-radius: 6px;
  font-size: 10px;
  color: var(--text-3);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}

.changed:hover {
  background: color-mix(in srgb, var(--market-soft) 60%, transparent);
  color: var(--market-ink);
}

.changed-icon {
  transform: rotate(180deg);
  opacity: 0.7;
}
</style>
