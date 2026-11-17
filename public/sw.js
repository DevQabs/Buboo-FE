// 우리집 웹 푸시 서비스 워커(push 설계서 7절). 캐시 없음 — 알림 표시와 누르면 화면 열기만 한다.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  const d = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(d.title || '우리집', {
    body: d.body || '',
    icon: '/icon-192.png',
    tag: d.tag,
    data: { url: d.url || '/dashboard' },
  }))
})

// 열린 창이 있으면 앞으로 가져와 그 화면으로, 없으면 새 창.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/dashboard', self.location.origin).href
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const win = wins.find((w) => new URL(w.url).origin === self.location.origin)
    if (!win) return self.clients.openWindow(url)
    await win.focus()
    return win.navigate(url).catch(() => self.clients.openWindow(url))
  })())
})
