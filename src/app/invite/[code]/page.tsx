'use client'

import { useSession, signIn } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

interface InviteInfo {
  couple_id: string
  couple_name: string
  preset: 'spouse' | 'grandparent' | 'custom'
  nickname: string
  expires_at: string
}

export default function InvitePage() {
  const params = useParams()
  const code = params.code as string
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [inviteError, setInviteError] = useState('')
  const [nickname, setNickname] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    fetch(`${API_BASE}/api/auth/invite/${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setInviteError(data.error)
        else {
          setInviteInfo(data)
          setNickname(data.nickname ?? '')
        }
      })
      .catch(() => setInviteError('초대 정보를 불러올 수 없습니다'))
  }, [code])

  // If user is logged in with Google but hasn't joined yet, join automatically
  useEffect(() => {
    if (
      status === 'authenticated' &&
      session?.user?.googleSub &&
      session?.user?.needsSetup &&
      inviteInfo &&
      !joining
    ) {
      // User is signed in but not registered — they came here to join
    }
  }, [status, session, inviteInfo, joining])

  const handleJoin = async () => {
    if (!session?.user?.googleSub) {
      // Not signed in — store invite code and sign in
      sessionStorage.setItem('pendingInviteCode', code)
      await signIn('google', { callbackUrl: `/invite/${code}` })
      return
    }

    setJoining(true)
    setError('')

    try {
      const res = await fetch('/api/account/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: code, nickname }),
      })
      const data = await res.json()
      if (!res.ok || !data.access_token) {
        setError(data.error ?? '참여에 실패했습니다')
        setJoining(false)
        return
      }

      await update({
        accessToken: data.access_token,
        backendUser: data.user,
        needsSetup: false,
      })
      router.push('/dashboard')
    } catch {
      setError('서버 연결에 실패했습니다')
      setJoining(false)
    }
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center px-5">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 w-full max-w-sm text-center">
          <p className="text-sm text-rose-500 mb-4">{inviteError}</p>
          <p className="text-xs text-slate-400">초대 링크가 만료되었거나 유효하지 않습니다.</p>
        </div>
      </div>
    )
  }

  if (!inviteInfo) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <p className="text-sm text-slate-500">초대 정보 확인 중...</p>
      </div>
    )
  }

  const isSignedIn = status === 'authenticated' && session?.user?.googleSub
  const alreadyRegistered = isSignedIn && !session?.user?.needsSetup

  if (alreadyRegistered) {
    router.push('/dashboard')
    return null
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center px-5">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 w-full max-w-sm">
        <h1 className="text-base font-bold text-slate-800 mb-1">가족 초대</h1>
        <p className="text-xs text-slate-500 mb-6">
          <span className="font-semibold text-slate-700">{inviteInfo.couple_name}</span>에
          합류하시겠습니까?
        </p>

        {isSignedIn && (
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500 mb-1 block">내 닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 이다현"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}

        {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-40"
        >
          {joining
            ? '참여 중...'
            : isSignedIn
              ? '참여하기'
              : 'Google로 로그인 후 참여'}
        </button>
      </div>
    </div>
  )
}
