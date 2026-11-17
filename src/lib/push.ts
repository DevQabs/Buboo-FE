// 웹 푸시(push 설계서 7절). 서비스 워커는 로그인 후 대시보드가 등록한다.

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function registerPushWorker(): void {
  if (pushSupported()) navigator.serviceWorker.register('/sw.js').catch(() => {})
}
