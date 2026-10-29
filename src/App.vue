<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppTitleBar from '@/components/AppTitleBar.vue'
import CompactBar from '@/components/CompactBar.vue'
import MarketStatusCard from '@/components/MarketStatusCard.vue'
import MarketStatusSelector from '@/components/MarketStatusSelector.vue'
import StockGroupColumn from '@/components/StockGroupColumn.vue'
import AddStockDialog from '@/components/AddStockDialog.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import StatusHistoryPanel from '@/components/StatusHistoryPanel.vue'
import ImportConfirmDialog from '@/components/ImportConfirmDialog.vue'
import ToastHost from '@/components/ToastHost.vue'
import { loadAppData, useAppData } from '@/composables/useAppData'
import { useDesktop } from '@/composables/useDesktop'
import { useMarketStatus } from '@/composables/useMarketStatus'
import { useQuotes, startQuotePolling } from '@/composables/useQuotes'
import { useStockGroups } from '@/composables/useStockGroups'
import { useTheme } from '@/composables/useTheme'
import { useToast } from '@/composables/useToast'
import { mergeGroups } from '@/services/app-data'
import { MARKET_INDEXES, QUOTE_SOURCE_META, SKIN_META, STOCK_GROUP_META, tone } from '@/services/constants'
import { formatPercent } from '@/services/market-rules'
import { formatClock } from '@/services/time'
import { previewSound } from '@/services/sound'
import type {
  ExportFormat,
  ImportMode,
  ImportResult,
  SoundName,
  StockGroupType,
  WindowMode,
} from '@/types'

const desktop = useDesktop()
const { state, settings, totalStocks, updateSettings, replaceGroups } = useAppData()
const { current, meta, options, history, setStatus } = useMarketStatus()
const { groups, totalCapacity, addStock, removeStock } = useStockGroups()
const { state: quoteState, indexQuote, refresh: refreshQuotes } = useQuotes()
const { resolved, applyMarketAccent } = useTheme()
const toast = useToast()

const ready = ref(false)
const settingsOpen = ref(false)
const historyOpen = ref(false)
const addingType = ref<StockGroupType | null>(null)
/** 导入结果待用户确认合并方式 */
const pendingImport = ref<ImportResult | null>(null)
const ioBusy = ref(false)
const themeLabel = computed(() => (resolved.value === 'dark' ? '暗色' : '亮色'))
const skinLabel = computed(() => SKIN_META[settings.value.skin ?? 'sky'].label)

const compact = computed(() => settings.value.compactMode)
const addingGroup = computed(
  () => groups.value.find((group) => group.type === addingType.value) ?? null,
)
const addingColor = computed(() =>
  addingType.value ? tone(STOCK_GROUP_META[addingType.value].tone).b : '#1FB37B',
)
const lastChangedAt = computed(() => history.value[history.value.length - 1]?.changedAt)

const autoRule = computed(() => settings.value.marketRule.auto)

/** 底栏行情状态：优先展示行情自带的时间戳，比「本地抓取时间」更可信 */
const quoteStatusText = computed(() => {
  if (quoteState.error) return quoteState.error
  if (!quoteState.fetchedAt) return '行情加载中…'
  const source = QUOTE_SOURCE_META[settings.value.quoteSource].label
  const stamp = indexQuote.value ? formatClock(indexQuote.value.time) : formatClock(quoteState.fetchedAt)
  return `${source} · ${stamp} 行情`
})

/** 自动模式下的规则说明，挂在状态卡的「规则自动」标签上 */
const ruleHint = computed(() => {
  const rule = settings.value.marketRule
  const name = MARKET_INDEXES[rule.indexCode]?.label ?? rule.indexCode
  return [
    `${name} 当日涨跌幅：`,
    `≥ ${formatPercent(rule.bullish)} → 牛市上行`,
    `≥ ${formatPercent(rule.rebound)} → 开始反弹`,
    `≤ ${formatPercent(rule.decline)} → 调整下行`,
    '其余 → 底部筑底',
    `需连续 ${rule.confirm} 次确认才切换`,
  ].join('\n')
})

watch(current, (status) => applyMarketAccent(status), { immediate: true })

watch(
  () => settings.value.alwaysOnTop,
  (enabled) => void desktop.setAlwaysOnTop(enabled),
)

watch(
  () => settings.value.launchAtLogin,
  (enabled) => void desktop.setLaunchAtLogin(enabled),
)

async function switchMode(mode: WindowMode): Promise<void> {
  const nextCompact = mode === 'compact'
  if (nextCompact === compact.value) return
  // 先让主进程把窗口尺寸调到位，再切布局：
  // 之前先 await 落盘（220ms 防抖）导致窗口要等 200ms 才变尺寸，视觉上就是卡一下
  await desktop.setWindowMode(mode)
  void updateSettings({ compactMode: nextCompact })
}

function openAdd(type: StockGroupType): void {
  addingType.value = type
}

function handleAdd(payload: { name: string; code: string }): void {
  if (!addingType.value) return
  addStock(addingType.value, payload.name, payload.code)
}

function handleSettingsUpdate(patch: Parameters<typeof updateSettings>[0]): void {
  void updateSettings(patch)
}

async function closeWindow(): Promise<void> {
  await desktop.minimizeToTray()
}

function openSettings(): void {
  settingsOpen.value = true
}

function handleCompactWidth(value: number): void {
  // 主进程按右上角锚点实时改宽度，无需等落盘
  void desktop.setCompactWidth(value)
}

function handlePreviewSound(sound: SoundName): void {
  previewSound(sound)
}

function openHistory(): void {
  historyOpen.value = true
}

async function handleExport(format: ExportFormat): Promise<void> {
  if (ioBusy.value) return
  ioBusy.value = true
  try {
    const result = await desktop.exportData(format)
    if (result.canceled) return
    if (!result.ok) {
      toast.error(result.error ?? '导出失败')
      return
    }
    toast.success(`已导出到 ${result.fileName ?? '所选位置'}`)
  } finally {
    ioBusy.value = false
  }
}

async function handleImport(): Promise<void> {
  if (ioBusy.value) return
  ioBusy.value = true
  try {
    const result = await desktop.importData()
    if (result.canceled) return
    if (!result.ok || !result.data) {
      toast.error(result.error ?? '导入失败')
      return
    }
    pendingImport.value = result
  } finally {
    ioBusy.value = false
  }
}

async function confirmImport(mode: ImportMode): Promise<void> {
  const pending = pendingImport.value
  if (!pending?.data) return
  const next = mergeGroups(groups.value, pending.data.groups, mode)
  pendingImport.value = null
  await replaceGroups(next)
  const count = next.reduce((sum, group) => sum + group.stocks.length, 0)
  toast.success(mode === 'replace' ? `已覆盖为 ${count} 只自选股` : `已追加，共 ${count} 只自选股`)
}

let stopPolling: (() => void) | null = null

onMounted(async () => {
  await loadAppData()
  ready.value = true
  applyMarketAccent(state.data.settings.marketStatus)
  // 数据加载完再起轮询：否则首轮取数时自选股还是空的
  stopPolling = startQuotePolling()
  if (!desktop.isElectron && settings.value.compactMode) {
    // 浏览器预览默认展示完整面板
    void updateSettings({ compactMode: false })
  }
})

const offMode = desktop.onModeChanged((mode) => {
  // 托盘切换窗口模式后同步 UI 状态（不再回写主进程尺寸）
  if ((mode === 'compact') !== settings.value.compactMode) {
    void updateSettings({ compactMode: mode === 'compact' })
  }
})

const openSettingsFromTray = () => {
  settingsOpen.value = true
}
window.addEventListener('market-pulse:open-settings', openSettingsFromTray)

onBeforeUnmount(() => {
  stopPolling?.()
  offMode?.()
  window.removeEventListener('market-pulse:open-settings', openSettingsFromTray)
})
</script>

<template>
  <div class="app-surface" :class="compact ? 'is-compact' : 'is-expanded'">
    <!-- 两种形态常驻 DOM，只切换显隐：展开/收起不再重建整棵子树 -->
    <template v-if="ready">
      <CompactBar
        v-show="compact"
        :status="current"
        :groups="groups"
        :index-quote="indexQuote"
        :quotes="quoteState.quotes"
        @expand="switchMode('expanded')"
        @close="closeWindow"
      />

      <div v-show="!compact" class="expanded-root">
        <AppTitleBar
          :always-on-top="settings.alwaysOnTop"
          :status-label="meta.label"
          @toggle-top="updateSettings({ alwaysOnTop: !settings.alwaysOnTop })"
          @open-settings="openSettings"
          @collapse="switchMode('compact')"
          @close="closeWindow"
        />

        <main class="panel">
          <MarketStatusCard
            :status="current"
            :last-changed-at="lastChangedAt"
            :index-quote="indexQuote"
            :auto="autoRule"
            :rule-hint="ruleHint"
            @open-history="openHistory"
          />
          <MarketStatusSelector :options="options" :current="current" @select="setStatus" />

          <section class="groups">
            <header class="groups-head">
              <h2>我的股票分组</h2>
              <span class="total">
                共 <strong>{{ totalStocks }}</strong> / {{ totalCapacity }} 只
              </span>
            </header>
            <div class="grid">
              <StockGroupColumn
                v-for="group in groups"
                :key="group.type"
                :group="group"
                :quotes="quoteState.quotes"
                @add="openAdd"
                @remove="removeStock"
              />
            </div>
          </section>

          <footer class="foot">
            <span class="foot-left">
              <button
                class="foot-refresh"
                :class="{ spinning: quoteState.loading, error: !!quoteState.error }"
                :title="quoteState.error ? `${quoteState.error}（点击重试）` : '立即刷新行情'"
                @click="refreshQuotes()"
              >
                <AppIcon name="refresh" :size="11" />
              </button>
              <span class="foot-quote">{{ quoteStatusText }}</span>
            </span>
            <span class="foot-right">
              {{ skinLabel }} · {{ themeLabel }} · {{ totalStocks }} 只自选
            </span>
          </footer>
        </main>
      </div>
    </template>

    <AddStockDialog
      :open="!!addingType"
      :group="addingGroup"
      :color="addingColor"
      @close="addingType = null"
      @submit="handleAdd"
    />

    <SettingsPanel
      :open="settingsOpen"
      :settings="settings"
      :total-stocks="totalStocks"
      :history-count="history.length"
      :is-electron="desktop.isElectron"
      :resolved-theme="resolved"
      :busy="ioBusy"
      @close="settingsOpen = false"
      @update="handleSettingsUpdate"
      @opacity-input="(v) => desktop.setOpacity(v)"
      @compact-width-input="handleCompactWidth"
      @preview-sound="handlePreviewSound"
      @open-history="historyOpen = true"
      @export-data="handleExport"
      @import-data="handleImport"
      @quit="desktop.quitApp()"
    />

    <StatusHistoryPanel
      :open="historyOpen"
      :history="history"
      :current="current"
      @close="historyOpen = false"
    />

    <ImportConfirmDialog
      :open="!!pendingImport"
      :file-name="pendingImport?.fileName ?? ''"
      :groups="pendingImport?.data?.groups ?? []"
      :current-groups="groups"
      @close="pendingImport = null"
      @confirm="confirmImport"
    />

    <ToastHost />
  </div>
</template>

<style scoped>
.app-surface {
  border: 1px solid var(--border);
}

.app-surface.is-expanded {
  border-radius: 20px;
}

/* 窄条是浮在桌面上的胶囊，用皮肤的主卡片色而不是整屏渐变 */
.app-surface.is-compact {
  border-radius: 23px;
  border-color: var(--border-strong);
  background: linear-gradient(
    155deg,
    var(--card-solid),
    color-mix(in srgb, var(--card-solid) 86%, var(--bg-grad-a))
  );
  box-shadow: var(--shadow-float);
}

.expanded-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 0 16px 12px;
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.groups-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 2px 2px 0;
}

.groups-head h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 680;
  letter-spacing: 0.01em;
  color: var(--text);
}

.total {
  font-size: 11px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.total strong {
  color: var(--text);
  font-weight: 650;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
  font-size: 10.5px;
  color: var(--text-3);
  flex: none;
}

.foot-left {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.foot-refresh {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex: none;
  border-radius: 6px;
  color: var(--text-3);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}

.foot-refresh:hover {
  background: var(--hover);
  color: var(--text);
}

.foot-refresh.error {
  color: var(--danger);
}

.foot-refresh.spinning {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.foot-quote {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
