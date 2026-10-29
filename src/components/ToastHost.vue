<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import { useToast } from '@/composables/useToast'

const { items } = useToast()
</script>

<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div v-for="item in items" :key="item.id" class="toast" :class="item.type">
        <AppIcon v-if="item.type === 'success'" name="check" :size="13" :stroke-width="2.6" />
        <AppIcon v-else-if="item.type === 'error'" name="alert" :size="13" :stroke-width="2.4" />
        <AppIcon v-else name="info" :size="13" :stroke-width="2.4" />
        <span>{{ item.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 420px;
  padding: 7px 12px;
  border-radius: var(--radius-pill);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text);
  background: var(--card-solid);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-float);
  white-space: nowrap;
}

.toast.success {
  color: var(--market-accent);
  border-color: color-mix(in srgb, var(--market-accent) 34%, transparent);
}

.toast.error {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 34%, transparent);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms var(--ease), transform 180ms var(--ease);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
