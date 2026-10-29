import { computed, ref } from 'vue'
import type { StockGroupType } from '@/types'
import { MAX_STOCKS_PER_GROUP } from '@/services/constants'
import { createStock, normalizeCode } from '@/services/app-data'
import { validateNewStock } from '@/services/validation'
import { useAppData } from './useAppData'
import { useToast } from './useToast'

export function useStockGroups() {
  const { groups, totalStocks, replaceGroups } = useAppData()
  const toast = useToast()
  const busy = ref(false)

  const totalCapacity = MAX_STOCKS_PER_GROUP * groups.value.length

  function findGroup(type: StockGroupType) {
    return groups.value.find((group) => group.type === type)
  }

  function isFull(type: StockGroupType): boolean {
    const group = findGroup(type)
    return !!group && group.stocks.length >= MAX_STOCKS_PER_GROUP
  }

  function addStock(type: StockGroupType, name: string, code: string): boolean {
    const group = findGroup(type)
    const check = validateNewStock(group, { name, code })
    if (!check.ok) {
      toast.error(check.message)
      return false
    }
    const next = groups.value.map((item) =>
      item.type === type ? { ...item, stocks: [...item.stocks, createStock(name, code)] } : item,
    )
    void replaceGroups(next)
    toast.success(`已添加 ${name.trim()}（${normalizeCode(code)}）`)
    return true
  }

  async function removeStock(type: StockGroupType, stockId: string): Promise<void> {
    const group = findGroup(type)
    const target = group?.stocks.find((stock) => stock.id === stockId)
    if (!group || !target) return

    busy.value = true
    const next = groups.value.map((item) =>
      item.type === type
        ? { ...item, stocks: item.stocks.filter((stock) => stock.id !== stockId) }
        : item,
    )
    await replaceGroups(next)
    busy.value = false
    toast.info(`已移除 ${target.name}`)
  }

  return {
    groups,
    totalStocks,
    totalCapacity: computed(() => totalCapacity),
    busy,
    findGroup,
    isFull,
    addStock,
    removeStock,
  }
}
