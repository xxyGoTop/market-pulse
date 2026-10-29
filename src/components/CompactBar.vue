<script setup lang="ts">
import { computed } from 'vue'
import type { MarketStatus, Quote, StockGroup } from '@/types'
import {
  MARKET_STATUS_META,
  MAX_STOCKS_PER_GROUP,
  STOCK_GROUP_META,
  tone,
} from '@/services/constants'
import { formatPercent, trendOf } from '@/services/market-rules'
import { normalizeQuoteCode } from '@/services/quote-code'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  status: MarketStatus
  groups: StockGroup[]
  /** 基准指数行情，用于在胶囊里直接给出大盘涨跌幅 */
  indexQuote?: Quote
  /** 规范代码 → 行情 */
  quotes?: Record<string, Quote>
}>()

const emit = defineEmits<{
  (e: 'expand'): void
  (e: 'close'): void
}>()

const meta = computed(() => MARKET_STATUS_META[props.status])

const indexTrend = computed(() =>
  props.indexQuote ? trendOf(props.indexQuote.changePercent) : 0,
)

const indexPct = computed(() =>
  props.indexQuote ? formatPercent(props.indexQuote.changePercent) : '',
)

const statusTitle = computed(() => {
  const q = props.indexQuote
  if (!q) return `${meta.value.label} · 展开面板`
  return `${meta.value.label} · ${q.name} ${q.price.toFixed(2)} ${formatPercent(q.changePercent)}`
})

function chipStyle(type: StockGroup['type']): Record<string, string> {
  const t = tone(STOCK_GROUP_META[type].tone)
  return {
    '--chip-soft': t.soft,
    '--chip-soft-dark': t.softDark,
    '--chip-ink': t.ink,
    '--chip-ink-dark': t.inkDark,
  }
}

function dotStyle(type: StockGroup['type']): Record<string, string> {
  const t = tone(STOCK_GROUP_META[type].tone)
  return { background: `linear-gradient(135deg, ${t.a}, ${t.b})` }
}

/** 分组内已取到行情的股票平均涨跌幅，用来在窄条里一眼看出哪组在动 */
function groupPercent(group: StockGroup): number | null {
  if (!props.quotes) return null
  const list: Quote[] = []
  for (const stock of group.stocks) {
    const key = normalizeQuoteCode(stock.code)
    const quote = key ? props.quotes[key] : undefined
    if (quote) list.push(quote)
  }
  if (!list.length) return null
  return list.reduce((sum, quote) => sum + quote.changePercent, 0) / list.length
}

function chipText(group: StockGroup): string {
  const percent = groupPercent(group)
  if (percent === null) return `${group.stocks.length}/${MAX_STOCKS_PER_GROUP}`
  return formatPercent(percent, 1)
}

function chipTrend(group: StockGroup): 1 | -1 | 0 {
  const percent = groupPercent(group)
  return percent === null ? 0 : trendOf(percent)
}

function chipTitle(group: StockGroup): string {
  const base = `${STOCK_GROUP_META[group.type].name} ${group.stocks.length}/${MAX_STOCKS_PER_GROUP}`
  const percent = groupPercent(group)
  return percent === null ? base : `${base} · 平均 ${formatPercent(percent)}`
}
</script>

<template>
  <div class="bar drag">
    <button class="status no-drag" :title="statusTitle" @click="emit('expand')">
      <AppIcon :name="meta.icon" :size="26" :tone="meta.tone" class="status-icon" />
      <span class="status-text">{{ meta.label }}</span>
      <span v-if="indexQuote" class="index" :class="{ up: indexTrend > 0, down: indexTrend < 0 }">
        {{ indexPct }}
      </span>
    </button>

    <ul class="groups no-drag">
      <li
        v-for="group in groups"
        :key="group.type"
        :style="chipStyle(group.type)"
        :title="chipTitle(group)"
        :class="{ up: chipTrend(group) > 0, down: chipTrend(group) < 0 }"
      >
        <i :style="dotStyle(group.type)" />
        <span class="g-name">{{ STOCK_GROUP_META[group.type].shortName }}</span>
        <span class="g-count">{{ chipText(group) }}</span>
      </li>
    </ul>

    <div class="actions no-drag">
      <button class="icon-btn expand" title="展开面板" @click="emit('expand')">
        <AppIcon name="expand" :size="13" :stroke-width="2.6" />
      </button>
      <button class="icon-btn" title="隐藏到托盘" @click="emit('close')">
        <AppIcon name="close" :size="13" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 容器查询：窄条宽度可调，够宽时才补出分组简称 */
.bar {
  container-type: inline-size;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 0 7px;
}

.status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  height: 34px;
  padding: 0 4px 0 0;
  border-radius: 14px;
  transition: background var(--dur) var(--ease);
}

.status:hover {
  background: color-mix(in srgb, var(--market-soft) 55%, transparent);
}

.status-icon {
  flex: none;
  filter: drop-shadow(0 3px 8px color-mix(in srgb, var(--market-b) 38%, transparent));
}

.status-text {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1;
  color: var(--text);
  white-space: nowrap;
}

/* 基准指数涨跌幅：宽一点才显示，340px 默认宽度下让位给分组胶囊 */
.index {
  display: none;
  font-size: 10px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--text-3);
  white-space: nowrap;
}

.index.up {
  color: var(--up);
}

.index.down {
  color: var(--down);
}

@container (min-width: 392px) {
  .index {
    display: inline;
  }
}

.groups {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  flex: 1;
  min-width: 0;
  /* 靠右聚拢：居中会让加宽后的胶囊飘在中间 */
  justify-content: flex-end;
  overflow: hidden;
}

.groups li {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  padding: 0 7px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--chip-soft) 74%, transparent);
  flex: none;
}

:root[data-theme='dark'] .groups li {
  background: color-mix(in srgb, var(--chip-soft-dark) 82%, transparent);
}

.groups i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex: none;
}

.g-name {
  display: none;
  font-size: 9.5px;
  font-weight: 600;
  color: color-mix(in srgb, var(--chip-ink) 70%, var(--text-2));
  white-space: nowrap;
}

:root[data-theme='dark'] .g-name {
  color: color-mix(in srgb, var(--chip-ink-dark) 66%, var(--text-2));
}

@container (min-width: 470px) {
  .g-name {
    display: inline;
  }
}

/* 极窄时只留数字：隐藏圆点并收紧内边距，避免最左侧胶囊被裁掉 */
@container (max-width: 316px) {
  .groups i {
    display: none;
  }

  .groups li {
    padding: 0 5px;
  }
}

.g-count {
  font-size: 10px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--text-3);
  white-space: nowrap;
}

/* 有行情时用涨跌色替代中性灰，一眼看出方向 */
.groups li.up .g-count {
  color: var(--up);
}

.groups li.down .g-count {
  color: var(--down);
}

.actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  color: var(--text-3);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}

.icon-btn:hover {
  background: var(--hover);
  color: var(--text);
}

.expand {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, var(--market-a), var(--market-b));
  box-shadow: 0 3px 9px color-mix(in srgb, var(--market-b) 38%, transparent);
}

.expand:hover {
  color: #fff;
  filter: brightness(1.06);
}
</style>
