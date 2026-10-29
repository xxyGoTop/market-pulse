import Store from 'electron-store'
import type { AppData } from '../src/types'
import { createDefaultAppData, normalizeAppData } from '../src/services/app-data'

interface StoreSchema {
  appData: AppData
}

const store = new Store<StoreSchema>({
  name: 'market-pulse',
  defaults: { appData: createDefaultAppData() },
  clearInvalidConfig: true,
})

export function readAppData(): AppData {
  try {
    return normalizeAppData(store.get('appData'))
  } catch (error) {
    console.error('[storage] 读取本地数据失败，回落到默认数据', error)
    return createDefaultAppData()
  }
}

export function writeAppData(data: AppData): void {
  store.set('appData', normalizeAppData(data))
}

export function storageFilePath(): string {
  return store.path
}
