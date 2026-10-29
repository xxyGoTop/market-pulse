<script setup lang="ts">
import AppIcon from './AppIcon.vue'

defineProps<{
  alwaysOnTop: boolean
  statusLabel: string
}>()

const emit = defineEmits<{
  (e: 'toggle-top'): void
  (e: 'open-settings'): void
  (e: 'collapse'): void
  (e: 'close'): void
}>()
</script>

<template>
  <header class="titlebar drag">
    <div class="brand">
      <span class="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M3 15.5h4.2l2.6-7 3 10 2.2-5.6H21" />
        </svg>
      </span>
      <span class="brand-name">Market Pulse</span>
      <span class="brand-sep">·</span>
      <span class="brand-sub">{{ statusLabel }}</span>
    </div>

    <div class="actions no-drag">
      <button
        class="icon-btn"
        :class="{ on: alwaysOnTop }"
        :title="alwaysOnTop ? '取消置顶' : '始终置顶'"
        @click="emit('toggle-top')"
      >
        <AppIcon :name="alwaysOnTop ? 'pin' : 'pin-off'" :size="15" />
      </button>
      <button class="icon-btn" title="设置" @click="emit('open-settings')">
        <AppIcon name="settings" :size="15" :stroke-width="1.9" />
      </button>
      <button class="icon-btn" title="收起为窄条" @click="emit('collapse')">
        <AppIcon name="collapse" :size="16" />
      </button>
      <button class="icon-btn danger" title="隐藏到托盘" @click="emit('close')">
        <AppIcon name="close" :size="15" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 12px 0 14px;
  flex: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  opacity: 0.92;
}

.logo {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  flex: none;
  border-radius: 7px;
  background: linear-gradient(140deg, #4fd3a4, #2aa87c);
  box-shadow: 0 2px 8px rgba(31, 179, 123, 0.28);
}

.logo svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: #fff;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.brand-name {
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.01em;
  color: var(--text-2);
}

.brand-sep,
.brand-sub {
  font-size: 11px;
  color: var(--text-3);
}

.brand-sub {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 9px;
  color: var(--text-3);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}

.icon-btn:hover {
  background: var(--hover);
  color: var(--text);
}

.icon-btn.on {
  color: var(--market-ink);
  background: var(--market-soft);
}

.icon-btn.danger:hover {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
}
</style>
