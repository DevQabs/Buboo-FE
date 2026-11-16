import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { callBackendAuth } from '@/lib/backendAuth'

export async function POST(req: Request) {
  const session = await auth()
  const googleSub = session?.user?.googleSub
  if (!googleSub) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const googleEmail = session.user.googleEmail ?? session.user.email ?? ''

    const body = await req.json().catch(() => ({}))
    const setup = await callBackendAuth('/api/auth/setup', {
      google_email: googleEmail,
      google_sub: googleSub,
      couple_name: body.couple_name,
      role: body.role,
      nickname: body.nickname,
    })

    // Already registered (first click succeeded but the session update failed):
    // return the existing user's token instead.
    if (setup.status === 409) {
      const cb = await callBackendAuth('/api/auth/callback', { google_email: googleEmail, google_sub: googleSub })
      return NextResponse.json(cb.data, { status: cb.status })
    }
    return NextResponse.json(setup.data, { status: setup.status })
  } catch {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 })
  }
}
