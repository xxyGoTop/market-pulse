<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Quote, StockItem } from '@/types'
import { QUOTE_SOURCE_META } from '@/services/constants'
import { formatAmount, formatPercent, trendOf } from '@/services/market-rules'
import { formatClock } from '@/services/time'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ stock: StockItem; quote?: Quote }>()
const emit = defineEmits<{ (e: 'remove', id: string): void }>()

const confirming = ref(false)

const trend = computed(() => (props.quote ? trendOf(props.quote.changePercent) : 0))
const priceText = computed(() => (props.quote ? props.quote.price.toFixed(2) : ''))
const pctText = computed(() => (props.quote ? formatPercent(props.quote.changePercent) : ''))

/** 悬停显示完整快照，避免在 5 行的小格子里塞太多字段 */
const detail = computed(() => {
  const q = props.quote
  if (!q) return `${props.stock.name} ${props.stock.code}\n暂无行情`
  return [
    `${q.name} ${q.code}`,
    `现价 ${q.price.toFixed(2)}  昨收 ${q.prevClose.toFixed(2)}`,
    `今开 ${q.open.toFixed(2)}  最高 ${q.high.toFixed(2)}  最低 ${q.low.toFixed(2)}`,
    `成交额 ${formatAmount(q.amount)}`,
    `${formatClock(q.time)} · ${QUOTE_SOURCE_META[q.source].label}`,
  ].join('\n')
})

function confirmRemove(): void {
  emit('remove', props.stock.id)
  confirming.value = false
}
</script>

<template>
  <li class="stock" :class="{ confirming }" :title="detail">
    <div class="stock-main">
      <span class="stock-name">{{ stock.name }}</span>
      <span class="stock-code">{{ stock.code }}</span>
    </div>

    <div v-if="quote" class="quote" :class="{ up: trend > 0, down: trend < 0 }">
      <span class="price">{{ priceText }}</span>
      <span class="pct">{{ pctText }}</span>
    </div>

    <button v-if="!confirming" class="remove" title="移除" @click="confirming = true">
      <AppIcon name="trash" :size="13" />
    </button>

    <div v-else class="confirm">
      <span>确认移除？</span>
      <button class="mini ghost" @click="confirming = false">取消</button>
      <button class="mini solid" @click="confirmRemove">移除</button>
    </div>
  </li>
</template>

<style scoped>
.stock {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 42px;
  padding: 5px 4px 5px 5px;
  border-bottom: 1px solid color-mix(in srgb, var(--text) 6%, transparent);
  transition: background var(--dur) var(--ease);
}

.stock:last-child {
  border-bottom: none;
}

.stock:hover {
  background: color-mix(in srgb, var(--card-solid) 46%, transparent);
}

.stock-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.stock-name {
  font-size: 12.5px;
  font-weight: 620;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stock-code {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-3);
}

/* 价格区固定右对齐、等宽数字，避免跳动时左右抖动 */
.quote {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  flex: none;
  font-variant-numeric: tabular-nums;
  transition: color var(--dur) var(--ease);
}

.price {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.2;
  color: var(--text-2);
}

.pct {
  font-size: 10px;
  font-weight: 650;
  line-height: 1.2;
  color: var(--text-3);
}

.quote.up .price,
.quote.up .pct {
  color: var(--up);
}

.quote.down .price,
.quote.down .pct {
  color: var(--down);
}

.remove {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: 7px;
  color: var(--text-3);
  opacity: 0;
  transition: opacity var(--dur) var(--ease), color var(--dur) var(--ease),
    background var(--dur) var(--ease);
}

.stock:hover .remove,
.remove:focus-visible {
  opacity: 1;
}

.remove:hover {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 14%, transparent);
}

.confirm {
  position: absolute;
  inset: 1px 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  padding: 0 4px;
  border-radius: var(--radius-xs);
  background: var(--card-solid);
  border: 1px solid color-mix(in srgb, var(--danger) 34%, transparent);
  font-size: 11px;
  color: var(--text-2);
}

.confirm span {
  margin-right: auto;
  padding-left: 2px;
}

.mini {
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--border);
  color: var(--text-2);
  background: var(--card-sub);
}

.mini:hover {
  background: var(--hover);
  color: var(--text);
}

.mini.solid {
  border-color: transparent;
  background: var(--danger);
  color: #fff;
}

.mini.solid:hover {
  background: var(--danger);
  color: #fff;
  filter: brightness(1.06);
}
</style>
