<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import type { StockGroup } from '@/types'
import { MAX_STOCKS_PER_GROUP } from '@/services/constants'
import { validateNewStock } from '@/services/validation'

const props = defineProps<{
  open: boolean
  group: StockGroup | null
  color: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { name: string; code: string }): void
}>()

const name = ref('')
const code = ref('')
const error = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    name.value = ''
    code.value = ''
    error.value = ''
    await nextTick()
    nameInput.value?.focus()
  },
)

function submit(): void {
  const check = validateNewStock(props.group ?? undefined, { name: name.value, code: code.value })
  if (!check.ok) {
    error.value = check.message
    return
  }
  emit('submit', { name: name.value.trim(), code: code.value.trim() })
  emit('close')
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="overlay" @mousedown.self="emit('close')">
      <div
        class="dialog card"
        :style="{ '--group-color': color }"
        role="dialog"
        aria-modal="true"
        @keydown.esc="emit('close')"
      >
        <header class="dialog-head">
          <div>
            <h3>添加股票</h3>
            <p>添加到「{{ group?.name }}」，最多 {{ MAX_STOCKS_PER_GROUP }} 只</p>
          </div>
          <button class="close" title="关闭" @click="emit('close')"><AppIcon name="close" :size="15" /></button>
        </header>

        <div class="fields">
          <label class="field">
            <span>股票名称</span>
            <input
              ref="nameInput"
              v-model="name"
              type="text"
              maxlength="24"
              placeholder="例如：贵州茅台"
              @input="error = ''"
              @keydown.enter="submit"
            />
          </label>
          <label class="field">
            <span>股票代码</span>
            <input
              v-model="code"
              class="mono"
              type="text"
              maxlength="16"
              placeholder="例如：600519"
              @input="error = ''"
              @keydown.enter="submit"
            />
          </label>

          <p v-if="error" class="error">
            <AppIcon name="alert" :size="13" />
            {{ error }}
          </p>
          <p v-else class="hint">代码会自动去空格并转大写；同一分组内不可重复。</p>
        </div>

        <footer class="dialog-foot">
          <button class="btn ghost" @click="emit('close')">取消</button>
          <button class="btn primary" @click="submit">
            <AppIcon name="add" :size="14" :stroke-width="2.4" />
            添加
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: 20px;
  background: color-mix(in srgb, #0b1220 42%, transparent);
  backdrop-filter: blur(3px);
}

.dialog {
  width: 100%;
  max-width: 392px;
  padding: 18px;
  background: var(--card-solid);
  box-shadow: var(--shadow-float);
  animation: rise 180ms var(--ease);
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}

.dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.dialog-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 680;
  color: var(--text);
}

.dialog-head p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--text-2);
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

.fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field > span {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-2);
}

.field input {
  height: 38px;
  padding: 0 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--card-sub);
  color: var(--text);
  font-size: 13px;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}

.field input.mono {
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.field input::placeholder {
  color: var(--text-3);
}

.field input:focus {
  outline: none;
  border-color: var(--group-color);
  background: var(--card-solid);
}

.error,
.hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-size: 11.5px;
  min-height: 16px;
}

.error {
  color: var(--danger);
}

.hint {
  color: var(--text-3);
}

.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  font-weight: 600;
  border: 1px solid transparent;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease);
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

.btn.primary {
  background: var(--group-color);
  color: #fff;
  box-shadow: 0 6px 16px color-mix(in srgb, var(--group-color) 30%, transparent);
}

.btn.primary:hover {
  filter: brightness(1.05);
}
</style>
