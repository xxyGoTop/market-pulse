/** 时间与时长格式化：状态卡与历史面板共用，避免各写一套 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 相对时间：刚刚 / 12 分钟前 / 3 小时前 / 2 天前 */
export function formatRelative(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(timestamp)
}

/** 具体日期：10-28 14:32（跨年时带年份） */
export function formatDate(timestamp: number, now = new Date()): string {
  const d = new Date(timestamp)
  const base = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return d.getFullYear() === now.getFullYear() ? base : `${d.getFullYear()}-${base}`
}

/** 时长：1 天 3 小时 / 2 小时 15 分 / 8 分钟 / 不到 1 分钟 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, ms)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (total < minute) return '不到 1 分钟'
  if (total < hour) return `${Math.floor(total / minute)} 分钟`
  if (total < day) {
    const h = Math.floor(total / hour)
    const m = Math.floor((total % hour) / minute)
    return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`
  }
  const d = Math.floor(total / day)
  const h = Math.floor((total % day) / hour)
  return h > 0 ? `${d} 天 ${h} 小时` : `${d} 天`
}

/** 只取天数（用于阶段累计统计） */
export function toDays(ms: number): number {
  return Math.round((ms / 86_400_000) * 10) / 10
}

/** 行情时间：11:04:03（非当日时带日期） */
export function formatClock(timestamp: number, now = new Date()): string {
  const d = new Date(timestamp)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay ? time : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`
}

/**
 * A 股交易时段（北京时间，周一至周五 9:15–15:05）。
 * 收盘后行情不再变化，轮询可以停下来，既省流量也对源站更友好。
 * 系统时区不一定是 +08:00，所以先把时间换算成北京时间再判断。
 * 不含节假日判断：节假日拿到的就是上一交易日的收盘数据，展示层会标注时间。
 */
export function isTradingTime(now = new Date()): boolean {
  const beijing = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60_000)
  const day = beijing.getDay()
  if (day === 0 || day === 6) return false
  const minutes = beijing.getHours() * 60 + beijing.getMinutes()
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 5
}
