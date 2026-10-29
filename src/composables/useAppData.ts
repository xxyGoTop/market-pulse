import { computed, reactive } from 'vue'
import type { AppData, AppSettings, StockGroup } from '@/types'
import { createDefaultAppData, normalizeAppData } from '@/services/app-data'
import { useDesktop } from './useDesktop'

interface AppState {
  data: AppData
  ready: boolean
  saving: boolean
  saveError: string | null
}

const state = reactive<AppState>({
  data: createDefaultAppData(),
  ready: false,
  saving: false,
  saveError: null,
})

const desktop = useDesktop()

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingResolvers: Array<() => void> = []

async function flush(): Promise<void> {
  state.saving = true
  const result = await desktop.saveAppData(JSON.parse(JSON.stringify(state.data)) as AppData)
  state.saving = false
  state.saveError = result.ok ? null : (result.error ?? '保存失败')
  pendingResolvers.forEach((resolve) => resolve())
  pendingResolvers = []
}

/** 合并短时间内的多次修改，避免频繁写盘 */
function scheduleSave(delay = 220): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer)
  return new Promise((resolve) => {
    pendingResolvers.push(resolve)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void flush()
    }, delay)
  })
}

export async function loadAppData(): Promise<void> {
  const raw = await desktop.getAppData()
  state.data = normalizeAppData(raw)
  state.ready = true
  desktop.onDataChanged((next) => {
    state.data = normalizeAppData(next)
  })
}

export function useAppData() {
  const settings = computed(() => state.data.settings)
  const groups = computed(() => state.data.groups)
  const totalStocks = computed(() =>
    state.data.groups.reduce((sum, group) => sum + group.stocks.length, 0),
  )

  function updateSettings(patch: Partial<AppSettings>): Promise<void> {
    Object.assign(state.data.settings, patch)
    return scheduleSave()
  }

  function replaceGroups(next: StockGroup[]): Promise<void> {
    state.data.groups = next
    return scheduleSave()
  }

  return {
    state,
    settings,
    groups,
    totalStocks,
    updateSettings,
    replaceGroups,
    saveNow: flush,
  }
}
