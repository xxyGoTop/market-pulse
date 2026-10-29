import { describe, expect, it } from 'vitest'
import type { StockGroup } from '@/types'
import { COMPACT_WIDTH, MAX_STOCKS_PER_GROUP, OPACITY_RANGE } from '@/services/constants'
import { createStock, normalizeAppData, normalizeCode } from '@/services/app-data'
import { validateAppData, validateNewStock } from '@/services/validation'

function groupWith(codes: string[]): StockGroup {
  return {
    type: 'short_rebound',
    name: '短博反弹',
    description: '短线机会观察',
    stocks: codes.map((code, index) => ({
      id: `id-${index}`,
      code: normalizeCode(code),
      name: `股票${index}`,
      addedAt: index,
    })),
  }
}

describe('validateNewStock', () => {
  it('名称和代码必填', () => {
    const result = validateNewStock(groupWith([]), { name: '  ', code: '600519' })
    expect(result).toEqual({ ok: false, field: 'name', message: '请输入股票名称和代码' })
  })

  it('代码为空同样拒绝', () => {
    const result = validateNewStock(groupWith([]), { name: '贵州茅台', code: '   ' })
    expect(result.ok).toBe(false)
  })

  it('同一分组内代码不可重复（忽略大小写与空格）', () => {
    const group = groupWith(['600519'])
    const result = validateNewStock(group, { name: '贵州茅台', code: ' 600519 ' })
    expect(result).toEqual({ ok: false, field: 'code', message: '该股票已在此分组中' })
  })

  it('大小写不同的代码视为重复', () => {
    const group = groupWith(['sz000001'])
    const result = validateNewStock(group, { name: '平安银行', code: 'SZ000001' })
    expect(result.ok).toBe(false)
  })

  it('达到 5 只后拒绝新增', () => {
    const group = groupWith(['1', '2', '3', '4', '5'])
    expect(group.stocks).toHaveLength(MAX_STOCKS_PER_GROUP)
    const result = validateNewStock(group, { name: '新股票', code: '600000' })
    expect(result).toEqual({
      ok: false,
      field: 'group',
      message: `该分组最多添加 ${MAX_STOCKS_PER_GROUP} 只股票`,
    })
  })

  it('合法输入通过校验', () => {
    const result = validateNewStock(groupWith(['600519']), { name: '宁德时代', code: '300750' })
    expect(result).toEqual({ ok: true })
  })
})

describe('normalizeAppData', () => {
  it('空数据返回默认三组', () => {
    const data = normalizeAppData(undefined)
    expect(data.groups).toHaveLength(3)
    expect(data.groups.every((group) => group.stocks.length === 0)).toBe(true)
    expect(data.settings.opacity).toBe(1)
  })

  it('超出容量的股票被截断到 5 只', () => {
    const data = normalizeAppData({
      groups: [{ type: 'short_rebound', stocks: ['a', 'b', 'c', 'd', 'e', 'f'].map((code) => ({ id: code, code, name: code, addedAt: 0 })) }],
    })
    expect(data.groups[0].stocks).toHaveLength(MAX_STOCKS_PER_GROUP)
  })

  it('重复代码在读取时被去重', () => {
    const data = normalizeAppData({
      groups: [
        {
          type: 'short_rebound',
          stocks: [
            { id: '1', code: '600519', name: '贵州茅台', addedAt: 0 },
            { id: '2', code: '600519', name: '贵州茅台', addedAt: 1 },
          ],
        },
      ],
    })
    expect(data.groups[0].stocks).toHaveLength(1)
  })

  it('非法枚举回落到默认值，透明度被夹到 0.65–1', () => {
    const data = normalizeAppData({
      settings: { marketStatus: 'unknown', theme: 'neon', opacity: 0.2 },
    })
    expect(data.settings.marketStatus).toBe('rebounding')
    expect(data.settings.theme).toBe('system')
    expect(data.settings.opacity).toBe(OPACITY_RANGE.min)
  })
})

describe('validateAppData', () => {
  it('合法数据通过', () => {
    expect(validateAppData(normalizeAppData(undefined))).toEqual({ ok: true })
  })

  it('拒绝超过 5 只股票的分组', () => {
    const data = normalizeAppData(undefined)
    data.groups[0].stocks = ['1', '2', '3', '4', '5', '6'].map((code) => createStock(code, code))
    expect(validateAppData(data)).toEqual({
      ok: false,
      error: `单个分组最多 ${MAX_STOCKS_PER_GROUP} 只股票`,
    })
  })

  it('拒绝透明度越界', () => {
    const data = normalizeAppData(undefined)
    data.settings.opacity = 0.5
    expect(validateAppData(data)).toEqual({
      ok: false,
      error: `opacity 超出 ${OPACITY_RANGE.min.toFixed(2)}–${OPACITY_RANGE.max.toFixed(2)}`,
    })
  })

  it('拒绝紧凑宽度越界', () => {
    const data = normalizeAppData(undefined)
    data.settings.compactWidth = COMPACT_WIDTH.min - 40
    expect(validateAppData(data)).toEqual({
      ok: false,
      error: `compactWidth 超出 ${COMPACT_WIDTH.min}–${COMPACT_WIDTH.max}`,
    })
  })

  it('拒绝非法皮肤与提示音', () => {
    const skin = normalizeAppData(undefined)
    skin.settings.skin = 'neon' as never
    expect(validateAppData(skin)).toEqual({ ok: false, error: 'skin 非法' })

    const sound = normalizeAppData(undefined)
    sound.settings.notificationSound = 'boom' as never
    expect(validateAppData(sound)).toEqual({ ok: false, error: 'notificationSound 非法' })
  })

  it('拒绝分组数量不足', () => {
    const data = normalizeAppData(undefined)
    data.groups = data.groups.slice(0, 2)
    expect(validateAppData(data)).toEqual({ ok: false, error: '分组数量必须为 3' })
  })
})
