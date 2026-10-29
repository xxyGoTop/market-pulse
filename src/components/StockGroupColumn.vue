<script setup lang="ts">
import { computed } from 'vue'
import type { Quote, StockGroup, StockGroupType } from '@/types'
import { MAX_STOCKS_PER_GROUP, STOCK_GROUP_META, tone } from '@/services/constants'
import { normalizeQuoteCode } from '@/services/quote-code'
import AppIcon from './AppIcon.vue'
import StockItemRow from './StockItem.vue'

const props = defineProps<{
  group: StockGroup
  /** 规范代码 → 行情；拿不到时行内不显示价格 */
  quotes?: Record<string, Quote>
}>()

const emit = defineEmits<{
  (e: 'add', type: StockGroupType): void
  (e: 'remove', type: StockGroupType, id: string): void
}>()

const meta = computed(() => STOCK_GROUP_META[props.group.type])
const palette = computed(() => tone(meta.value.tone))
const columnStyle = computed<Record<string, string>>(() => ({
  '--g-a': palette.value.a,
  '--g-b': palette.value.b,
  '--g-soft': palette.value.soft,
  '--g-soft-dark': palette.value.softDark,
  '--g-ink': palette.value.ink,
  '--g-ink-dark': palette.value.inkDark,
}))

const isFull = computed(() => props.group.stocks.length >= MAX_STOCKS_PER_GROUP)

function quoteFor(code: string): Quote | undefined {
  if (!props.quotes) return undefined
  const key = normalizeQuoteCode(code)
  return key ? props.quotes[key] : undefined
}
</script>

<template>
  <article class="column" :style="columnStyle">
    <header class="col-head">
      <AppIcon :name="meta.icon" :size="28" :tone="meta.tone" />
      <div class="col-title">
        <h2>{{ group.name }}</h2>
        <p>{{ group.description }}</p>
      </div>
      <span class="count" :class="{ full: isFull }">
        {{ group.stocks.length }}/{{ MAX_STOCKS_PER_GROUP }}
      </span>
    </header>

    <ul v-if="group.stocks.length" class="stock-list">
      <StockItemRow
        v-for="stock in group.stocks"
        :key="stock.id"
        :stock="stock"
        :quote="quoteFor(stock.code)"
        @remove="(id) => emit('remove', group.type, id)"
      />
    </ul>

    <div v-else class="empty" @click="emit('add', group.type)">
      <AppIcon :name="meta.icon" :size="26" :tone="meta.tone" class="empty-icon" />
      <p>{{ meta.emptyHint }}</p>
      <span class="link">添加第一只股票</span>
    </div>

    <footer class="col-foot">
      <button
        class="add"
        :disabled="isFull"
        :title="isFull ? `该分组最多添加 ${MAX_STOCKS_PER_GROUP} 只股票` : '添加股票'"
        @click="emit('add', group.type)"
      >
        <AppIcon name="add" :size="13" :stroke-width="2.4" />
        <span>{{ isFull ? '已达上限' : '添加股票' }}</span>
      </button>
    </footer>
  </article>
</template>

<style scoped>
.column {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px 12px 11px;
  gap: 9px;
  border-radius: var(--radius-card);
  border: 1px solid color-mix(in srgb, var(--g-a) 16%, var(--border));
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--g-soft) 100%, var(--card-solid)) 0%,
      color-mix(in srgb, var(--g-soft) 70%, var(--card-solid)) 58%,
      color-mix(in srgb, var(--g-soft) 38%, var(--card-solid)) 100%
    );
  box-shadow: var(--shadow-card);
}

:root[data-theme='dark'] .column {
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--g-soft-dark) 46%, var(--card-solid)) 0%,
      color-mix(in srgb, var(--g-soft-dark) 24%, var(--card-solid)) 62%,
      var(--card-solid) 100%
    );
}

.col-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.col-title {
  min-width: 0;
  flex: 1;
}

.col-title h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 680;
  letter-spacing: 0.01em;
  color: var(--text);
}

.col-title p {
  margin: 1px 0 0;
  font-size: 10.5px;
  color: color-mix(in srgb, var(--g-ink) 46%, var(--text-3));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:root[data-theme='dark'] .col-title p {
  color: color-mix(in srgb, var(--g-ink-dark) 40%, var(--text-3));
}

.count {
  flex: none;
  height: 20px;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-pill);
  font-size: 10.5px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--g-ink);
  background: color-mix(in srgb, var(--card-solid) 78%, transparent);
}

:root[data-theme='dark'] .count {
  color: var(--g-ink-dark);
  background: color-mix(in srgb, #000 22%, transparent);
}

.count.full {
  color: var(--text-3);
}

.stock-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 0;
  cursor: pointer;
  color: var(--text-3);
}

.empty-icon {
  opacity: 0.55;
  filter: saturate(0.6);
}

.empty p {
  margin: 0;
  font-size: 11.5px;
}

.link {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--g-ink);
}

:root[data-theme='dark'] .link {
  color: var(--g-ink-dark);
}

.col-foot {
  flex: none;
}

.add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 1px dashed color-mix(in srgb, var(--g-a) 40%, transparent);
  color: color-mix(in srgb, var(--g-ink) 82%, var(--text-2));
  font-size: 11.5px;
  font-weight: 600;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}

:root[data-theme='dark'] .add {
  color: color-mix(in srgb, var(--g-ink-dark) 80%, var(--text-2));
}

.add:hover:not(:disabled) {
  background: color-mix(in srgb, var(--g-a) 12%, transparent);
  border-style: solid;
}

.add:disabled {
  cursor: not-allowed;
  color: var(--text-3);
  border-color: var(--border);
}
</style>
