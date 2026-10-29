import { reactive } from 'vue'

export interface ToastItem {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

const items = reactive<ToastItem[]>([])
let seed = 0

function push(type: ToastItem['type'], message: string, duration = 2200): void {
  const id = ++seed
  items.push({ id, type, message })
  setTimeout(() => {
    const index = items.findIndex((item) => item.id === id)
    if (index >= 0) items.splice(index, 1)
  }, duration)
}

export function useToast() {
  return {
    items,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message, 3200),
    info: (message: string) => push('info', message),
  }
}
