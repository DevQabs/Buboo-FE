import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { callBackendAuth } from '@/lib/backendAuth'

export async function POST(req: Request) {
  const session = await auth()
  const googleSub = session?.user?.googleSub
  if (!googleSub) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (typeof body.invite_code !== 'string' || body.invite_code === '') {
    return NextResponse.json({ error: 'invite_code required' }, { status: 400 })
  }
  const { status, data } = await callBackendAuth('/api/auth/callback', {
    google_email: session.user.googleEmail ?? session.user.email ?? '',
    google_sub: googleSub,
    invite_code: body.invite_code,
    nickname: body.nickname,
  })
  return NextResponse.json(data, { status })
}
