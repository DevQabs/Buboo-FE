'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function SetupPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [coupleName, setCoupleName] = useState('')
  const [nickname, setNickname] = useState('')
  const [role, setRole] = useState<'husband' | 'wife'>('husband')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.googleSub) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/api/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_email: session.user.googleEmail ?? session.user.email,
          google_sub: session.user.googleSub,
          couple_name: coupleName,
          nickname,
          role,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        // User already registered (e.g. first click succeeded but session update failed)
        // Try callback to get JWT for existing user
        if (res.status === 409) {
          const cbRes = await fetch(`${API_BASE}/api/auth/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              google_email: session.user.googleEmail ?? session.user.email,
              google_sub: session.user.googleSub,
            }),
          })
          const cbData = await cbRes.json()
          if (cbData.access_token) {
            await update({ accessToken: cbData.access_token, backendUser: cbData.user, needsSetup: false })
            router.push('/dashboard')
            return
          }
        }
        setError(data.error ?? '오류가 발생했습니다')
        return
      }

      await update({
        accessToken: data.access_token,
        backendUser: data.user,
        needsSetup: false,
      })

      // Store invite code in sessionStorage to show on dashboard
      if (data.invite_code) {
        sessionStorage.setItem('initialInviteCode', data.invite_code)
      }

      router.push('/dashboard')
    } catch {
      setError('서버 연결에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center px-5">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 w-full max-w-sm">
        <h1 className="text-base font-bold text-slate-800 mb-1">커플 계정 만들기</h1>
        <p className="text-xs text-slate-500 mb-6">처음 사용하시는군요! 커플 정보를 입력해 주세요.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">커플 이름</label>
            <input
              type="text"
              value={coupleName}
              onChange={(e) => setCoupleName(e.target.value)}
              placeholder="예: 태국&다현"
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">내 닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 김태국"
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">내 역할</label>
            <div className="grid grid-cols-2 gap-2">
              {(['husband', 'wife'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    role === r
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {r === 'husband' ? '남편' : '아내'}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !coupleName.trim() || !nickname.trim()}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-40"
          >
            {loading ? '생성 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
