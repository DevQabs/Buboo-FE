// 웹 푸시(push 설계서 7절). 서비스 워커는 로그인 후 대시보드가 등록한다.
import { apiFetch } from '@/lib/api'

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function registerPushWorker(): void {
  if (pushSupported()) navigator.serviceWorker.register('/sw.js').catch(() => {})
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** 알림 권한을 받아 이 기기를 구독하고 서버에 저장한다. 권한을 못 받으면 false. */
export async function enablePush(token: string): Promise<boolean> {
  if ((await Notification.requestPermission()) !== 'granted') return false
  const { public_key } = await apiFetch<{ public_key: string }>('/api/push/public-key', token)
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: public_key }))
  await apiFetch('/api/push/subscriptions', token, { method: 'POST', body: JSON.stringify(sub.toJSON()) })
  return true
}

/** 서버에서 지운 뒤 이 기기 구독을 끊는다. */
export async function disablePush(token: string): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await apiFetch('/api/push/subscriptions', token, { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) })
  await sub.unsubscribe()
}
