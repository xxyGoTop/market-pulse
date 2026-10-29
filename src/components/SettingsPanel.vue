<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import type {
  AppSettings,
  ExportFormat,
  MarketRuleConfig,
  SkinName,
  SoundName,
  ThemeMode,
} from '@/types'
import {
  COMPACT_WIDTH,
  DEFAULT_MARKET_RULE,
  MARKET_INDEXES,
  MARKET_INDEX_ORDER,
  OPACITY_RANGE,
  QUOTE_SOURCE_META,
  QUOTE_SOURCE_ORDER,
  REFRESH_OPTIONS,
  RULE_RANGE,
  SKIN_META,
  SKIN_ORDER,
  SOUND_META,
  SOUND_ORDER,
  refreshLabel,
} from '@/services/constants'
import { applyThreshold, formatPercent } from '@/services/market-rules'

const props = defineProps<{
  open: boolean
  settings: AppSettings
  totalStocks: number
  historyCount: number
  isElectron: boolean
  /** 当前实际生效的亮暗（system 已解析），用于皮肤缩略图 */
  resolvedTheme: 'light' | 'dark'
  /** 正在进行的导入 / 导出，用于禁用按钮 */
  busy?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update', patch: Partial<AppSettings>): void
  (e: 'opacity-input', value: number): void
  (e: 'compact-width-input', value: number): void
  (e: 'preview-sound', sound: SoundName): void
  (e: 'open-history'): void
  (e: 'export-data', format: ExportFormat): void
  (e: 'import-data'): void
  (e: 'quit'): void
}>()

const themes: Array<{ key: ThemeMode; label: string; icon: string }> = [
  { key: 'light', label: '亮色', icon: 'sun' },
  { key: 'dark', label: '暗色', icon: 'moon' },
  { key: 'system', label: '跟随系统', icon: 'monitor' },
]

const opacityPercent = computed(() => Math.round(props.settings.opacity * 100))
const compactWidth = computed(() => props.settings.compactWidth ?? COMPACT_WIDTH.default)
const sound = computed(() => props.settings.notificationSound ?? 'chime')

/** 皮肤缩略图按当前亮暗取色，暗色下才不会看到一片白 */
function swatchOf(key: SkinName): [string, string, string] {
  return SKIN_META[key].swatch[props.resolvedTheme]
}

function swatchStyle(key: SkinName): Record<string, string> {
  const [from, to] = swatchOf(key)
  return { background: `linear-gradient(150deg, ${from}, ${to})` }
}

function onOpacity(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  emit('update', { opacity: value })
  emit('opacity-input', value)
}

function onCompactWidth(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  emit('update', { compactWidth: value })
  emit('compact-width-input', value)
}

function pickSkin(skin: SkinName): void {
  emit('update', { skin })
}

function pickSound(next: SoundName): void {
  emit('update', { notificationSound: next })
  emit('preview-sound', next)
}

/* ---------------- 行情与规则 ---------------- */

const rule = computed(() => props.settings.marketRule)
const sourceMeta = computed(() => QUOTE_SOURCE_META[props.settings.quoteSource])

function setRule(patch: Partial<MarketRuleConfig>): void {
  emit('update', { marketRule: { ...rule.value, ...patch } })
}

/** 阈值改动后自动把相邻档推开，保证 decline < rebound < bullish */
function onThreshold(field: 'decline' | 'rebound' | 'bullish', event: Event): void {
  const raw = (event.target as HTMLInputElement).value.trim()
  if (!raw) return
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  emit('update', { marketRule: applyThreshold(rule.value, field, value) })
}

function onConfirm(event: Event): void {
  const raw = (event.target as HTMLInputElement).value.trim()
  if (!raw) return
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  setRule({ confirm: Math.round(value) })
}

function resetRule(): void {
  emit('update', { marketRule: { ...DEFAULT_MARKET_RULE } })
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="mask" @mousedown.self="emit('close')">
      <aside class="panel" role="dialog" aria-label="设置">
        <header class="panel-head">
          <div>
            <h3>设置</h3>
            <p>全部数据仅保存在本机 · v1.2.0</p>
          </div>
          <button class="close" title="关闭" @click="emit('close')">
            <AppIcon name="close" :size="15" />
          </button>
        </header>

        <div class="panel-body">
          <section class="group">
            <h4>外观</h4>
            <div class="segmented">
              <button
                v-for="theme in themes"
                :key="theme.key"
                :class="{ active: settings.theme === theme.key }"
                @click="emit('update', { theme: theme.key })"
              >
                <AppIcon :name="theme.icon" :size="14" />
                <span>{{ theme.label }}</span>
              </button>
            </div>

            <div class="skins">
              <button
                v-for="key in SKIN_ORDER"
                :key="key"
                class="skin"
                :class="{ active: settings.skin === key }"
                :title="SKIN_META[key].description"
                @click="pickSkin(key)"
              >
                <span class="swatch" :style="swatchStyle(key)">
                  <i :style="{ background: swatchOf(key)[2] }" />
                </span>
                <span class="skin-label">{{ SKIN_META[key].label }}</span>
              </button>
            </div>
          </section>

          <section class="group">
            <h4>窗口</h4>

            <div class="row">
              <div class="row-text">
                <strong>始终置顶</strong>
                <span>浮在其他窗口上方</span>
              </div>
              <button
                class="switch"
                :class="{ on: settings.alwaysOnTop }"
                role="switch"
                :aria-checked="settings.alwaysOnTop"
                @click="emit('update', { alwaysOnTop: !settings.alwaysOnTop })"
              >
                <i />
              </button>
            </div>

            <div class="slider-row">
              <div class="row-text">
                <strong>窄条宽度</strong>
                <span>{{ COMPACT_WIDTH.min }}–{{ COMPACT_WIDTH.max }}px，收起时生效</span>
              </div>
              <span class="value">{{ compactWidth }}px</span>
            </div>
            <input
              class="slider"
              type="range"
              :min="COMPACT_WIDTH.min"
              :max="COMPACT_WIDTH.max"
              :step="COMPACT_WIDTH.step"
              :value="compactWidth"
              @input="onCompactWidth"
            />

            <div class="slider-row">
              <div class="row-text">
                <strong>窗口透明度</strong>
                <span>
                  {{ Math.round(OPACITY_RANGE.min * 100) }}% –
                  {{ Math.round(OPACITY_RANGE.max * 100) }}%，过低会影响可读性
                </span>
              </div>
              <span class="value">{{ opacityPercent }}%</span>
            </div>
            <input
              class="slider"
              type="range"
              :min="OPACITY_RANGE.min"
              :max="OPACITY_RANGE.max"
              :step="OPACITY_RANGE.step"
              :value="settings.opacity"
              @input="onOpacity"
            />
          </section>

          <section class="group">
            <h4>行情</h4>

            <div class="segmented tight">
              <button
                v-for="key in QUOTE_SOURCE_ORDER"
                :key="key"
                :class="{ active: settings.quoteSource === key }"
                @click="emit('update', { quoteSource: key })"
              >
                <span>{{ QUOTE_SOURCE_META[key].label }}</span>
              </button>
            </div>
            <p class="hint">{{ sourceMeta.description }}</p>

            <div class="chips-row">
              <span class="chips-label">刷新频率</span>
              <div class="chips">
                <button
                  v-for="option in REFRESH_OPTIONS"
                  :key="option"
                  :class="{ active: settings.quoteRefresh === option }"
                  @click="emit('update', { quoteRefresh: option })"
                >
                  {{ refreshLabel(option) }}
                </button>
              </div>
            </div>

            <div class="row">
              <div class="row-text">
                <strong>
                  <AppIcon name="refresh" :size="12" />
                  大盘状态自动判断
                </strong>
                <span>按基准指数涨跌幅套用下面的规则</span>
              </div>
              <button
                class="switch"
                :class="{ on: rule.auto }"
                role="switch"
                :aria-checked="rule.auto"
                @click="setRule({ auto: !rule.auto })"
              >
                <i />
              </button>
            </div>

            <template v-if="rule.auto">
              <div class="chips-row">
                <span class="chips-label">基准指数</span>
                <div class="chips">
                  <button
                    v-for="code in MARKET_INDEX_ORDER"
                    :key="code"
                    :class="{ active: rule.indexCode === code }"
                    :title="MARKET_INDEXES[code].label"
                    @click="setRule({ indexCode: code })"
                  >
                    {{ MARKET_INDEXES[code].short }}
                  </button>
                </div>
              </div>

              <div class="thresholds">
                <label class="thr">
                  <span>牛市上行 ≥</span>
                  <span class="thr-input">
                    <input
                      type="number"
                      :step="RULE_RANGE.threshold.step"
                      :min="RULE_RANGE.threshold.min"
                      :max="RULE_RANGE.threshold.max"
                      :value="rule.bullish"
                      @change="onThreshold('bullish', $event)"
                    />
                    <i>%</i>
                  </span>
                </label>
                <label class="thr">
                  <span>开始反弹 ≥</span>
                  <span class="thr-input">
                    <input
                      type="number"
                      :step="RULE_RANGE.threshold.step"
                      :min="RULE_RANGE.threshold.min"
                      :max="RULE_RANGE.threshold.max"
                      :value="rule.rebound"
                      @change="onThreshold('rebound', $event)"
                    />
                    <i>%</i>
                  </span>
                </label>
                <label class="thr">
                  <span>调整下行 ≤</span>
                  <span class="thr-input">
                    <input
                      type="number"
                      :step="RULE_RANGE.threshold.step"
                      :min="RULE_RANGE.threshold.min"
                      :max="RULE_RANGE.threshold.max"
                      :value="rule.decline"
                      @change="onThreshold('decline', $event)"
                    />
                    <i>%</i>
                  </span>
                </label>
              </div>
              <p class="hint">
                区间之间的涨跌幅归入「底部筑底」，如
                {{ formatPercent((rule.decline + rule.rebound) / 2) }} 这类横盘状态。
              </p>

              <div class="chips-row">
                <span class="chips-label">连续确认</span>
                <span class="thr-input compact">
                  <input
                    type="number"
                    :min="RULE_RANGE.confirm.min"
                    :max="RULE_RANGE.confirm.max"
                    :step="RULE_RANGE.confirm.step"
                    :value="rule.confirm"
                    @change="onConfirm"
                  />
                  <i>次</i>
                </span>
              </div>

              <button class="reset-rule" @click="resetRule">恢复默认阈值</button>
            </template>

            <p class="note">
              数据来自 {{ sourceMeta.host }} 的公开只读接口，仅在本机展示，不落库、不转发；
              行情可能延迟或中断，不构成任何投资建议。
            </p>
          </section>

          <section class="group">
            <h4>提醒</h4>

            <div class="row">
              <div class="row-text">
                <strong>开机自动启动</strong>
                <span>{{ isElectron ? '登录 Windows 后自动运行' : '仅桌面版可用' }}</span>
              </div>
              <button
                class="switch"
                :class="{ on: settings.launchAtLogin }"
                role="switch"
                :aria-checked="settings.launchAtLogin"
                :disabled="!isElectron"
                @click="emit('update', { launchAtLogin: !settings.launchAtLogin })"
              >
                <i />
              </button>
            </div>

            <div class="row">
              <div class="row-text">
                <strong>
                  <AppIcon name="bell" :size="12" />
                  状态变更通知
                </strong>
                <span>切换大盘阶段时弹出系统通知</span>
              </div>
              <button
                class="switch"
                :class="{ on: settings.notifyOnStatusChange }"
                role="switch"
                :aria-checked="settings.notifyOnStatusChange"
                @click="emit('update', { notifyOnStatusChange: !settings.notifyOnStatusChange })"
              >
                <i />
              </button>
            </div>

            <div class="sound-row">
              <div class="row-text">
                <strong>提示音</strong>
                <span>{{ SOUND_META[sound].description }} · 本地合成，无需联网</span>
              </div>
              <button
                class="preview"
                :disabled="sound === 'none'"
                title="试听"
                @click="emit('preview-sound', sound)"
              >
                试听
              </button>
            </div>
            <div class="sounds">
              <button
                v-for="key in SOUND_ORDER"
                :key="key"
                class="sound"
                :class="{ active: sound === key }"
                @click="pickSound(key)"
              >
                {{ SOUND_META[key].label }}
              </button>
            </div>
          </section>

          <section class="group">
            <h4>数据</h4>
            <div class="stats">
              <div class="stat">
                <strong>{{ totalStocks }}</strong>
                <span>已录入股票</span>
              </div>
              <button class="stat stat-btn" @click="emit('open-history')">
                <strong>{{ historyCount }}</strong>
                <span>状态变更记录 ›</span>
              </button>
            </div>

            <div class="io">
              <button class="io-btn" :disabled="busy" @click="emit('export-data', 'json')">
                <AppIcon name="stock-detail" :size="13" />
                导出备份
              </button>
              <button class="io-btn" :disabled="busy" @click="emit('export-data', 'csv')">
                <AppIcon name="trend-up" :size="13" />
                导出 CSV
              </button>
              <button class="io-btn" :disabled="busy" @click="emit('import-data')">
                <AppIcon name="refresh" :size="13" />
                导入
              </button>
            </div>
            <p class="note">导出的 JSON 含设置与状态历史，CSV 只含分组、名称、代码三列。</p>
          </section>
        </div>

        <footer class="panel-foot">
          <p class="foot-note">
            <AppIcon name="info" :size="12" />
            关闭窗口会隐藏到托盘
          </p>
          <button class="quit" @click="emit('quit')">
            <AppIcon name="power" :size="14" />
            退出程序
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-popover);
  background: color-mix(in srgb, #0b1220 30%, transparent);
  backdrop-filter: blur(2px);
}

.panel {
  position: absolute;
  inset: 0 0 0 auto;
  width: 356px;
  display: flex;
  flex-direction: column;
  background: var(--card-solid);
  border-left: 1px solid var(--border);
  box-shadow: var(--shadow-float);
  animation: slide 220ms var(--ease);
}

@keyframes slide {
  from {
    transform: translateX(16px);
    opacity: 0;
  }
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--border);
  flex: none;
}

.panel-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 680;
}

.panel-head p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--text-3);
}

.close {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: var(--text-3);
}

.close:hover {
  background: var(--hover);
  color: var(--text);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 2px 16px 6px;
}

.group {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}

.group:last-child {
  border-bottom: none;
}

.group h4 {
  margin: 0 0 10px;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
}

.segmented {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-pill);
  background: var(--card-sub);
  border: 1px solid var(--border);
}

.segmented button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  border-radius: var(--radius-pill);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-2);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}

.segmented button:hover {
  color: var(--text);
}

.segmented button.active {
  /* 反相胶囊：亮色下是深色药丸，暗色下是白色药丸 */
  background: var(--text);
  color: var(--card-solid);
  box-shadow: var(--shadow-pill);
}

/* 三个数据源名称较长，字号和高度都收一点 */
.segmented.tight button {
  height: 30px;
  padding: 0 4px;
  font-size: 11px;
}

.hint {
  margin: 6px 0 0;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--text-3);
}

.chips-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 10px;
}

.chips-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  flex: none;
}

.chips {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: var(--card-sub);
  border: 1px solid var(--border);
}

.chips button {
  height: 24px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-2);
  white-space: nowrap;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}

.chips button:hover {
  color: var(--text);
}

.chips button.active {
  background: var(--text);
  color: var(--card-solid);
  box-shadow: var(--shadow-pill);
}

/* 三档阈值：标签在左、数字输入在右，竖排比三列横排更易读 */
.thresholds {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.thr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11.5px;
  color: var(--text-2);
}

.thr-input {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 26px;
  padding: 0 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border);
  background: var(--card-sub);
  flex: none;
}

.thr-input input {
  width: 42px;
  border: none;
  background: transparent;
  outline: none;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 650;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* 数字框去掉上下箭头，避免挤占宽度 */
.thr-input input::-webkit-inner-spin-button,
.thr-input input::-webkit-outer-spin-button {
  appearance: none;
  margin: 0;
}

.thr-input i {
  font-style: normal;
  font-size: 10.5px;
  color: var(--text-3);
}

.thr-input.compact input {
  width: 28px;
}

.reset-rule {
  margin-top: 10px;
  width: 100%;
  height: 28px;
  border-radius: var(--radius-xs);
  border: 1px dashed var(--border-strong);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease);
}

.reset-rule:hover {
  color: var(--text-2);
  border-color: var(--text-3);
}

/* 皮肤色卡 */
.skins {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}

.skin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 5px 3px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
}

.skin:hover {
  background: var(--hover);
}

.skin.active {
  border-color: color-mix(in srgb, var(--market-a) 52%, transparent);
  background: color-mix(in srgb, var(--market-soft) 40%, transparent);
}

.swatch {
  position: relative;
  display: block;
  width: 100%;
  height: 30px;
  border-radius: 9px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px var(--border-strong);
}

/* 缩略预览：外层是桌面底色渐变，内嵌一块是卡片色 */
.swatch i {
  position: absolute;
  inset: 7px;
  border-radius: 5px;
  /* 深色皮肤下底色与卡片几乎同色，靠一圈细描边把卡片托出来 */
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--text) 14%, transparent),
    0 1px 3px rgba(15, 23, 42, 0.18);
}

.skin-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-2);
}

.skin.active .skin-label {
  color: var(--text);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
}

.row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-text strong {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}

.row-text span {
  font-size: 10.5px;
  color: var(--text-3);
}

.switch {
  flex: none;
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: var(--radius-pill);
  background: var(--track);
  transition: background var(--dur) var(--ease);
}

.switch i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.24);
  transition: transform var(--dur) var(--ease);
}

.switch.on {
  background: var(--market-a);
}

.switch.on i {
  transform: translateX(16px);
}

.switch:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.slider-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-top: 8px;
}

.value {
  font-size: 11.5px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: var(--market-ink);
}

.slider {
  width: 100%;
  margin: 6px 0 2px;
  appearance: none;
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--track);
  outline: none;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--card-solid);
  border: 3px solid var(--market-a);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.24);
}

.sound-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding-top: 8px;
}

.preview {
  flex: none;
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-strong);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
}

.preview:hover:not(:disabled) {
  color: var(--text);
  background: var(--hover);
}

.preview:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sounds {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
  margin-top: 8px;
}

.sound {
  height: 28px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border);
  background: var(--card-sub);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease),
    border-color var(--dur) var(--ease);
}

.sound:hover {
  color: var(--text);
}

.sound.active {
  color: var(--market-ink);
  border-color: color-mix(in srgb, var(--market-a) 46%, transparent);
  background: color-mix(in srgb, var(--market-soft) 62%, transparent);
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--card-sub);
  border: 1px solid var(--border);
  text-align: left;
}

.stat strong {
  font-size: 17px;
  font-weight: 680;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.stat span {
  font-size: 10.5px;
  color: var(--text-3);
}

.stat-btn:hover {
  border-color: var(--border-strong);
  background: var(--hover);
}

.io {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.io-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 30px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border);
  background: var(--card-sub);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}

.io-btn:hover:not(:disabled) {
  background: var(--hover);
  color: var(--text);
}

.io-btn:disabled {
  opacity: 0.5;
  cursor: progress;
}

.note {
  margin: 8px 0 0;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--text-3);
}

.quit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 34px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent);
  color: var(--danger);
  font-size: 12px;
  font-weight: 600;
  transition: background var(--dur) var(--ease);
}

.quit:hover {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}

.panel-foot {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 16px 14px;
  border-top: 1px solid var(--border);
}

.foot-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 0;
  font-size: 10.5px;
  color: var(--text-3);
}
</style>
