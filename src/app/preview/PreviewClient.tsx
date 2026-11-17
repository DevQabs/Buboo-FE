'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import DashboardClient from '@/app/dashboard/DashboardClient'
import { respond, users } from './fixtures'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

// 백엔드 호출(apiFetch)을 가로채 fixtures 로 답한다. GET 이 아니면 빈 성공.
if (typeof window !== 'undefined' && !(window as { __preview?: boolean }).__preview) {
  ;(window as { __preview?: boolean }).__preview = true
  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(`${API_BASE}/api/`) || url.includes('/api/auth/session') || url.includes('/api/auth/csrf')) return real(input, init)
    const u = new URL(url, location.origin)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method !== 'GET') return new Response('{}', { status: 200 })
    const body = respond(u.pathname, u.searchParams)
    if (body === null) {
      console.warn('[preview] 응답 없음', u.pathname)
      return new Response('{"error":"preview: 응답 없음"}', { status: 404 })
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
}

const session: Session = {
  user: { name: users[0].name, email: users[0].email, accessToken: 'preview', backendUser: users[0] },
  expires: '2099-01-01T00:00:00Z',
}

// ?screen= → 누를 버튼 글자 차례(하단 탭 → 2단 메뉴)
const ROUTES: Record<string, string[]> = {
  ledger: ['가계부'],
  schedule: ['일상', '일정'],
  diary: ['일상', '일기'],
  wealth: ['자산', '자산현황'],
  roadmap: ['자산', '로드맵'],
  'baby-photo': ['아기', '사진일기'],
  'baby-growth': ['아기', '성장'],
  'family-settings': ['@avatar', '가족 구성원'],
  'push-menu': ['@avatar'],
}

function clickByText(text: string): boolean {
  if (text === '@avatar') {
    const b = document.querySelector<HTMLButtonElement>('header button')
    if (!b || !b.querySelector('div')) return false
    b.click()
    return true
  }
  const b = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .find(el => el.textContent?.trim() === text)
  b?.click()
  return Boolean(b)
}

export default function PreviewClient() {
  const screen = useSearchParams().get('screen') ?? 'ledger'
  useEffect(() => {
    const steps = [...(ROUTES[screen] ?? ROUTES.ledger)]
    const id = window.setInterval(() => {
      if (steps.length === 0) { window.clearInterval(id); document.documentElement.dataset.previewReady = '1'; return }
      if (clickByText(steps[0])) steps.shift()
    }, 150)
    return () => window.clearInterval(id)
  }, [screen])
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false} refetchInterval={0}>
      <DashboardClient />
    </SessionProvider>
  )
}
