<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { MarketStatus, StatusHistoryItem } from '@/types'
import type { ToneName } from '@/services/constants'
import { MARKET_STATUS_META, MARKET_STATUS_ORDER, tone } from '@/services/constants'
import { formatDate, formatDuration, formatRelative, toDays } from '@/services/time'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  open: boolean
  history: StatusHistoryItem[]
  current: MarketStatus
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const listEl = ref<HTMLElement | null>(null)
/** 列表是否已滚动 / 是否到底，用于决定上下渐隐遮罩 */
const scrolled = ref(false)
const atBottom = ref(true)

function syncScrollState(): void {
  const el = listEl.value
  if (!el) return
  scrolled.value = el.scrollTop > 4
  atBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 4
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    void nextTick(syncScrollState)
  },
  { immediate: true },
)

interface Row {
  key: string
  status: MarketStatus
  label: string
  icon: string
  tone: ToneName
  changedAt: number
  duration: number
  isCurrent: boolean
}

/** 倒序列出每次变更，并算出它持续了多久 */
const rows = computed<Row[]>(() => {
  const list = props.history
  const now = Date.now()
  return list
    .map((item, index) => {
      const next = list[index + 1]
      const meta = MARKET_STATUS_META[item.status]
      return {
        key: `${item.changedAt}-${index}`,
        status: item.status,
        label: meta.label,
        icon: meta.icon,
        tone: meta.tone,
        changedAt: item.changedAt,
        duration: Math.max(0, (next ? next.changedAt : now) - item.changedAt),
        isCurrent: index === list.length - 1,
      }
    })
    .reverse()
})

/** 各阶段累计停留时长 */
const summary = computed(() => {
  const totals = new Map<MarketStatus, number>()
  for (const row of rows.value) {
    totals.set(row.status, (totals.get(row.status) ?? 0) + row.duration)
  }
  const grand = [...totals.values()].reduce((a, b) => a + b, 0) || 1
  return MARKET_STATUS_ORDER.filter((status) => totals.has(status)).map((status) => {
    const ms = totals.get(status) ?? 0
    return {
      status,
      label: MARKET_STATUS_META[status].label,
      tone: MARKET_STATUS_META[status].tone,
      color: tone(MARKET_STATUS_META[status].tone).a,
      days: toDays(ms),
      percent: Math.round((ms / grand) * 100),
    }
  })
})

const total = computed(() => props.history.length)
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="mask" @mousedown.self="emit('close')">
      <section class="sheet card" role="dialog" aria-label="状态历史">
        <header class="sheet-head">
          <div>
            <h3>状态历史</h3>
            <p>
              共 {{ total }} 次变更 · 仅记录手动切换，全部保存在本机
            </p>
          </div>
          <button class="close" title="关闭" @click="emit('close')">
            <AppIcon name="close" :size="15" />
          </button>
        </header>

        <div v-if="rows.length === 0" class="empty">
          <AppIcon :name="MARKET_STATUS_META[current].icon" :size="40" :tone="MARKET_STATUS_META[current].tone" />
          <strong>还没有切换记录</strong>
          <span>在下方选择大盘阶段后，这里会留下每一次变更</span>
        </div>

        <template v-else>
          <div class="summary">
            <div v-for="item in summary" :key="item.status" class="stat">
              <span class="stat-bar" :style="{ background: item.color, width: `${Math.max(6, item.percent)}%` }" />
              <div class="stat-row">
                <span class="stat-name">{{ item.label }}</span>
                <span class="stat-value">{{ item.days }} 天</span>
                <span class="stat-percent">{{ item.percent }}%</span>
              </div>
            </div>
          </div>

          <div class="list-wrap" :class="{ 'fade-top': scrolled, 'fade-bottom': !atBottom }">
            <ul ref="listEl" class="list" @scroll.passive="syncScrollState">
              <li v-for="row in rows" :key="row.key" class="row" :class="{ current: row.isCurrent }">
                <AppIcon :name="row.icon" :size="26" :tone="row.tone" />
                <div class="row-main">
                  <div class="row-title">
                    <span class="row-label">{{ row.label }}</span>
                    <span v-if="row.isCurrent" class="badge">当前</span>
                  </div>
                  <span class="row-time">
                    {{ formatDate(row.changedAt) }} · {{ formatRelative(row.changedAt) }}
                  </span>
                </div>
                <span class="row-duration">{{ formatDuration(row.duration) }}</span>
              </li>
            </ul>
          </div>
        </template>

        <footer class="sheet-foot">
          最多保留最近 50 次切换 · 不接入任何行情数据
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-popover);
  /* 用 flex 而不是 grid：grid 的行高是 auto，会让 max-height: 100% 失去参照，
     列表再长也会把面板顶出屏幕（实测 20 条时面板高 1277px） */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, #0b1220 38%, transparent);
  backdrop-filter: blur(3px);
}

.sheet {
  width: 100%;
  max-width: 468px;
  max-height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 16px 16px 12px;
  background: var(--card-solid);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
  animation: rise 200ms var(--ease);
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.985);
  }
}

.sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex: none;
}

.sheet-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 680;
  color: var(--text);
}

.sheet-head p {
  margin: 3px 0 0;
  font-size: 11px;
  color: var(--text-3);
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

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 34px 0;
  text-align: center;
  color: var(--text-3);
}

.empty strong {
  font-size: 13px;
  font-weight: 650;
  color: var(--text-2);
}

.empty span {
  font-size: 11.5px;
  max-width: 260px;
  line-height: 1.6;
}

.summary {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 14px 0 4px;
  padding: 11px 12px;
  border-radius: var(--radius-md);
  background: var(--card-sub);
  flex: none;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-bar {
  height: 4px;
  border-radius: var(--radius-pill);
  opacity: 0.85;
}

.stat-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
}

.stat-name {
  color: var(--text-2);
  font-weight: 600;
}

.stat-value {
  margin-left: auto;
  color: var(--text);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.stat-percent {
  width: 34px;
  text-align: right;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

/* 列表容器：用上下渐隐提示「还有内容」，避免行被硬切一刀 */
.list-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  margin: 8px 0 0;
}

.list-wrap::before,
.list-wrap::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 18px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 160ms var(--ease);
  z-index: 1;
}

.list-wrap::before {
  top: 0;
  background: linear-gradient(to bottom, var(--card-solid), transparent);
}

.list-wrap::after {
  bottom: 0;
  background: linear-gradient(to top, var(--card-solid), transparent);
}

.list-wrap.fade-top::before,
.list-wrap.fade-bottom::after {
  opacity: 1;
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0;
  padding: 0 2px 0 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--text) 6%, transparent);
}

.row:last-child {
  border-bottom: none;
}

.row.current {
  background: color-mix(in srgb, var(--market-soft) 34%, transparent);
  border-radius: var(--radius-sm);
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.row-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.row-label {
  font-size: 12.5px;
  font-weight: 620;
  color: var(--text);
}

.badge {
  font-size: 9.5px;
  font-weight: 650;
  line-height: 1;
  padding: 3px 6px;
  border-radius: var(--radius-pill);
  color: var(--market-ink);
  background: color-mix(in srgb, var(--market-soft) 80%, transparent);
}

.row-time {
  font-size: 10.5px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.row-duration {
  flex: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}

.sheet-foot {
  flex: none;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-3);
  text-align: center;
}
</style>
