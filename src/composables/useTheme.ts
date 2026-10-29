import { computed, watch } from 'vue'
import type { MarketStatus, SkinName, ThemeMode } from '@/types'
import { MARKET_STATUS_META, isSkinName, tone } from '@/services/constants'
import { useAppData } from './useAppData'

const media = window.matchMedia('(prefers-color-scheme: dark)')

export function useTheme() {
  const { settings, updateSettings } = useAppData()

  const mode = computed<ThemeMode>(() => settings.value.theme)
  const skin = computed<SkinName>(() => settings.value.skin)
  const resolved = computed<'light' | 'dark'>(() => {
    if (mode.value === 'system') return media.matches ? 'dark' : 'light'
    return mode.value
  })

  function apply(next: 'light' | 'dark'): void {
    const root = document.documentElement
    root.dataset.theme = next
    root.style.colorScheme = next
  }

  function applySkin(next: SkinName): void {
    const root = document.documentElement
    root.dataset.skin = isSkinName(next) ? next : 'sky'
  }

  function setMode(next: ThemeMode): void {
    void updateSettings({ theme: next })
  }

  function setSkin(next: SkinName): void {
    void updateSettings({ skin: next })
  }

  /** 亮 / 暗之间直接切换（标题栏快捷按钮） */
  function toggle(): void {
    setMode(resolved.value === 'dark' ? 'light' : 'dark')
  }

  /** 大盘状态只影响主状态卡的强调色，不影响分组色 */
  function applyMarketAccent(status: MarketStatus): void {
    const meta = MARKET_STATUS_META[status]
    const t = tone(meta.tone)
    const dark = resolved.value === 'dark'
    const root = document.documentElement
    const set = (name: string, value: string): void => root.style.setProperty(name, value)
    set('--market-a', t.a)
    set('--market-b', t.b)
    set('--market-soft', dark ? t.softDark : t.soft)
    set('--market-ink', dark ? t.inkDark : t.ink)
    // 兼容旧变量名
    set('--market-accent', dark ? t.inkDark : t.ink)
    set('--market-surface', dark ? t.softDark : t.soft)
    root.dataset.market = status
  }

  watch(
    resolved,
    (next) => {
      apply(next)
      applyMarketAccent(settings.value.marketStatus)
    },
    { immediate: true },
  )

  watch(skin, (next) => applySkin(next), { immediate: true })

  media.addEventListener('change', () => {
    if (mode.value === 'system') apply(resolved.value)
  })

  return { mode, skin, resolved, setMode, setSkin, toggle, applyMarketAccent }
}
