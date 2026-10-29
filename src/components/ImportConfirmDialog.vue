<script setup lang="ts">
import { computed } from 'vue'
import type { ImportMode, StockGroup } from '@/types'
import { MAX_STOCKS_PER_GROUP, STOCK_GROUP_META } from '@/services/constants'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  open: boolean
  fileName: string
  groups: StockGroup[]
  currentGroups: StockGroup[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', mode: ImportMode): void
}>()

const incomingTotal = computed(() =>
  props.groups.reduce((sum, group) => sum + group.stocks.length, 0),
)

const currentTotal = computed(() =>
  props.currentGroups.reduce((sum, group) => sum + group.stocks.length, 0),
)

const rows = computed(() =>
  props.groups
    .filter((group) => group.stocks.length > 0)
    .map((group) => ({
      type: group.type,
      name: STOCK_GROUP_META[group.type].name,
      tone: STOCK_GROUP_META[group.type].tone,
      count: group.stocks.length,
      names: group.stocks.map((s) => s.name).join('、'),
    })),
)

/** 追加后可能超出容量的分组，提前提示 */
const overflow = computed(() =>
  props.groups
    .map((group) => {
      const current = props.currentGroups.find((g) => g.type === group.type)
      const merged = (current?.stocks.length ?? 0) + group.stocks.length
      return merged > MAX_STOCKS_PER_GROUP
        ? { name: STOCK_GROUP_META[group.type].name, merged }
        : null
    })
    .filter((item): item is { name: string; merged: number } => item !== null),
)
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="mask" @mousedown.self="emit('close')">
      <section class="dialog card" role="dialog" aria-label="导入自选股">
        <header class="dialog-head">
          <div>
            <h3>导入自选股</h3>
            <p class="file" :title="fileName">{{ fileName }}</p>
          </div>
          <button class="close" title="关闭" @click="emit('close')">
            <AppIcon name="close" :size="15" />
          </button>
        </header>

        <p class="lede">
          识别到 <strong>{{ incomingTotal }}</strong> 只股票，当前已有
          <strong>{{ currentTotal }}</strong> 只。
        </p>

        <ul class="rows">
          <li v-for="row in rows" :key="row.type">
            <AppIcon :name="STOCK_GROUP_META[row.type].icon" :size="20" :tone="row.tone" />
            <div class="row-text">
              <span class="row-name">{{ row.name }}</span>
              <span class="row-names">{{ row.names }}</span>
            </div>
            <span class="row-count">{{ row.count }} 只</span>
          </li>
        </ul>

        <p v-if="overflow.length" class="warn">
          <AppIcon name="alert" :size="12" />
          追加后
          {{ overflow.map((o) => `${o.name}将达 ${o.merged} 只`).join('、') }}，
          超出每组 {{ MAX_STOCKS_PER_GROUP }} 只的部分会被丢弃。
        </p>
        <p v-else class="hint">覆盖会清空现有自选股；追加会跳过同组重复代码。</p>

        <footer class="dialog-foot">
          <button class="btn ghost" @click="emit('close')">取消</button>
          <button class="btn danger" @click="emit('confirm', 'replace')">覆盖现有</button>
          <button class="btn primary" @click="emit('confirm', 'append')">追加到现有</button>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: 22px;
  background: color-mix(in srgb, #0b1220 42%, transparent);
  backdrop-filter: blur(3px);
}

.dialog {
  width: 100%;
  max-width: 400px;
  padding: 17px;
  background: var(--card-solid);
  box-shadow: var(--shadow-float);
  animation: rise 180ms var(--ease);
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
}

.dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.dialog-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 680;
  color: var(--text);
}

.file {
  margin: 3px 0 0;
  max-width: 280px;
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.close {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: none;
  border-radius: 8px;
  color: var(--text-3);
}

.close:hover {
  background: var(--hover);
  color: var(--text);
}

.lede {
  margin: 12px 0 10px;
  font-size: 12px;
  color: var(--text-2);
}

.lede strong {
  color: var(--text);
  font-weight: 680;
  font-variant-numeric: tabular-nums;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 8px 10px;
  list-style: none;
  border-radius: var(--radius-sm);
  background: var(--card-sub);
  max-height: 168px;
  overflow-y: auto;
}

.rows li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
}

.row-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.row-name {
  font-size: 12px;
  font-weight: 620;
  color: var(--text);
}

.row-names {
  font-size: 10.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-count {
  flex: none;
  font-size: 11px;
  font-weight: 650;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.warn,
.hint {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin: 10px 0 0;
  font-size: 10.5px;
  line-height: 1.6;
}

.warn {
  color: var(--danger);
}

.hint {
  color: var(--text-3);
}

.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 15px;
}

.btn {
  height: 32px;
  padding: 0 13px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  transition: background var(--dur) var(--ease), filter var(--dur) var(--ease);
}

.btn.ghost {
  border-color: var(--border);
  color: var(--text-2);
  background: var(--card-sub);
}

.btn.ghost:hover {
  background: var(--hover);
  color: var(--text);
}

.btn.danger {
  border-color: color-mix(in srgb, var(--danger) 34%, transparent);
  color: var(--danger);
  background: transparent;
}

.btn.danger:hover {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.btn.primary {
  color: #fff;
  background: linear-gradient(135deg, var(--market-a), var(--market-b));
  box-shadow: 0 6px 16px color-mix(in srgb, var(--market-b) 32%, transparent);
}

.btn.primary:hover {
  filter: brightness(1.05);
}
</style>
