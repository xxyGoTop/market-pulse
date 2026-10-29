<script setup lang="ts">
import type { MarketStatus } from '@/types'
import type { ToneName } from '@/services/constants'
import { tone } from '@/services/constants'

interface Option {
  key: MarketStatus
  label: string
  tone: ToneName
}

defineProps<{
  options: Option[]
  current: MarketStatus
}>()

const emit = defineEmits<{ (e: 'select', status: MarketStatus): void }>()

/** 每个阶段自带一套柔和底色，未选中时也能看出颜色归属 */
function stageStyle(name: ToneName): Record<string, string> {
  const t = tone(name)
  return {
    '--stage-a': t.a,
    '--stage-b': t.b,
    '--stage-soft': t.soft,
    '--stage-soft-dark': t.softDark,
    '--stage-ink': t.ink,
    '--stage-ink-dark': t.inkDark,
  }
}
</script>

<template>
  <div class="selector" role="tablist" aria-label="大盘阶段（手动设置）">
    <button
      v-for="option in options"
      :key="option.key"
      class="stage"
      :class="{ active: option.key === current }"
      :style="stageStyle(option.tone)"
      role="tab"
      :aria-selected="option.key === current"
      @click="emit('select', option.key)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.selector {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  flex: none;
}

.stage {
  position: relative;
  height: 36px;
  padding: 0 6px;
  border-radius: 11px;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  /* 未选中：只用极浅的本色底，文字保持中性灰，避免四块颜色抢眼 */
  color: var(--text-2);
  background: color-mix(in srgb, var(--stage-soft) 55%, transparent);
  border: 1px solid transparent;
  transition:
    background var(--dur) var(--ease),
    color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease),
    transform 120ms var(--ease);
}

:root[data-theme='dark'] .stage {
  background: color-mix(in srgb, var(--stage-soft-dark) 46%, transparent);
}

.stage:hover {
  color: var(--text);
  background: color-mix(in srgb, var(--stage-soft) 72%, transparent);
}

:root[data-theme='dark'] .stage:hover {
  background: color-mix(in srgb, var(--stage-soft-dark) 88%, transparent);
}

.stage:active {
  transform: scale(0.985);
}

.stage.active,
.stage.active:hover {
  color: #fff;
  background: linear-gradient(135deg, var(--stage-a), var(--stage-b));
  box-shadow: 0 5px 14px color-mix(in srgb, var(--stage-b) 32%, transparent);
}
</style>
