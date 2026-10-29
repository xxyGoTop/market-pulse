/**
 * 状态切换提示音：用 WebAudio 现场合成，不引入任何音频文件。
 * 好处是离线可用、零体积、音量可控；代价是需要一个 AudioContext，
 * 首次播放若被自动播放策略拦住，会在下一次用户交互后自动恢复。
 */
import type { SoundName } from '@/types'

type Wave = OscillatorType

let ctx: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface NoteOptions {
  freq: number
  /** 相对现在的时间偏移（秒） */
  at: number
  duration: number
  type?: Wave
  gain?: number
  /** 叠加一个八度泛音，声音更"厚" */
  harmonic?: number
}

function note(context: AudioContext, options: NoteOptions): void {
  const { freq, at, duration, type = 'sine', gain = 0.09, harmonic = 0 } = options
  const start = context.currentTime + at
  const end = start + duration

  const voice = (f: number, level: number, wave: Wave): void => {
    const osc = context.createOscillator()
    const amp = context.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(f, start)
    // 快起慢落，听感接近真实的敲击/铃音
    amp.gain.setValueAtTime(0.0001, start)
    amp.gain.exponentialRampToValueAtTime(level, start + 0.012)
    amp.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(amp).connect(context.destination)
    osc.start(start)
    osc.stop(end + 0.02)
  }

  voice(freq, gain, type)
  if (harmonic > 0) voice(freq * 2, gain * harmonic, type)
}

/**
 * 播放提示音。`none` 直接返回，调用方无需判断。
 * 每次音量都压在 0.1 以下，避免在办公场景里突兀。
 */
export function playStatusSound(name: SoundName): void {
  if (name === 'none') return
  const context = audioContext()
  if (!context) return

  if (name === 'chime') {
    // 轻铃：C5 → G5 两声上行
    note(context, { freq: 523.25, at: 0, duration: 0.26, type: 'triangle', gain: 0.075 })
    note(context, { freq: 783.99, at: 0.11, duration: 0.34, type: 'triangle', gain: 0.065 })
    note(context, { freq: 1046.5, at: 0.11, duration: 0.3, type: 'sine', gain: 0.02 })
    return
  }

  if (name === 'bell') {
    // 铃铛：单声 + 八度泛音，长衰减
    note(context, { freq: 880, at: 0, duration: 0.85, type: 'sine', gain: 0.085, harmonic: 0.3 })
    return
  }

  // 脉冲：两声极短的木质敲击
  note(context, { freq: 659.25, at: 0, duration: 0.075, type: 'square', gain: 0.035 })
  note(context, { freq: 493.88, at: 0.085, duration: 0.09, type: 'square', gain: 0.03 })
}

/** 试听用：忽略 none，直接按给定音色播放 */
export function previewSound(name: SoundName): void {
  playStatusSound(name === 'none' ? 'chime' : name)
}
