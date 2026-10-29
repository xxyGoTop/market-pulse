import { Notification } from 'electron'

/** 系统通知：仅在用户开启通知开关时由渲染层触发 */
export function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title: title.slice(0, 80),
    body: body.slice(0, 240),
    silent: false,
  })
  notification.on('click', () => notification.close())
  notification.show()
}
