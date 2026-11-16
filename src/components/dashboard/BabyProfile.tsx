'use client'

import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { daysSinceBirth } from '@/lib/mediaRules'
import type { Baby, BabySex } from '@/types'

/** 성별 기호 — 이모지 대신 SVG */
function SexIcon({ male }: { male: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {male ? (
        <>
          <circle cx="10" cy="14" r="5" />
          <path d="M14 10l6-6M15 4h5v5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="9" r="5" />
          <path d="M12 14v8M9 18h6" />
        </>
      )}
    </svg>
  )
}

/** B 톤 흰 카드 클래스(ui/Card 와 같은 토큰) */
export const CARD = 'rounded-card bg-white shadow-warm'

/** 기기 시간대 기준 오늘 YYYY-MM-DD */
export function localToday(): string {
  return new Date().toLocaleDateString('sv-SE')
}

/** GET /api/baby — undefined: 불러오는 중, null: 미등록 */
export function useBaby(accessToken: string) {
  const [baby, setBaby] = useState<Baby | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      setBaby(await apiFetch<Baby | null>('/api/baby', accessToken))
      setError(null)
    } catch {
      setError('아기 정보를 불러오지 못했어요')
    }
  }, [accessToken])
  useEffect(() => { reload() }, [reload])
  return { baby, error, reload }
}

function BabyProfileForm({ accessToken, initial, onSaved, onCancel }: {
  accessToken: string
  initial: Baby | null
  onSaved: () => Promise<void>
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [birth, setBirth] = useState(initial?.birth_date ?? '')
  const [sex, setSex] = useState<BabySex>(initial?.sex ?? 'female')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!name.trim() || !birth) { setError('이름과 생일을 입력해 주세요'); return }
    setSaving(true)
    setError(null)
    try {
      await apiFetch('/api/baby', accessToken, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), birth_date: birth, sex }),
      })
    } catch (e) {
      setSaving(false)
      setError(e instanceof Error ? e.message : '저장하지 못했어요')
      return
    }
    setSaving(false)
    await onSaved()
  }

  const input = 'w-full rounded-xl border border-line px-3 py-2.5 text-sm'
  return (
    <div className={`${CARD} space-y-3 p-4`}>
      <b className="text-sm">{initial ? '아기 정보 고치기' : '아기를 등록해 주세요'}</b>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="이름(태명도 좋아요)" className={input} />
      <label className="block text-xs text-stone-400">
        생일
        <input type="date" value={birth} max={localToday()} onChange={e => setBirth(e.target.value)} className={`${input} mt-1`} />
      </label>
      <div className="flex gap-2">
        {(['male', 'female'] as const).map(s => {
          const on = sex === s
          const male = s === 'male'
          const tone = male ? 'border-brand-500 bg-brand-500 text-white' : 'border-rose-400 bg-rose-400 text-white'
          const off = male ? 'border-line bg-white text-brand-500' : 'border-line bg-white text-rose-400'
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => setSex(s)}
              className={`flex h-14 w-1/2 items-center justify-center gap-2 rounded-card border text-sm font-semibold transition-colors ${on ? tone : off}`}
            >
              <SexIcon male={male} />
              {male ? '남아' : '여아'}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-stone-400">성별은 성장 화면의 또래 표준 곡선을 고르는 데만 써요.</p>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl bg-stone-100 py-3 text-sm text-stone-500">취소</button>
        )}
        <button type="button" onClick={save} disabled={saving} className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}

/** 프로필이 있어야 children 을 그린다(설계서 6.2). 미등록이면 owner 는 등록 카드, 나머지는 안내. */
export function BabyGate({ accessToken, isOwner, children }: {
  accessToken: string
  isOwner: boolean
  children: (baby: Baby) => ReactNode
}) {
  const { baby, error, reload } = useBaby(accessToken)
  const [editing, setEditing] = useState(false)

  if (error) {
    return (
      <div className="flex items-center gap-2 px-1 text-xs">
        <span className="text-rose-500">{error}</span>
        <button type="button" onClick={reload} className="relative before:absolute before:content-[''] before:-inset-y-3 before:-inset-x-2 font-semibold text-brand-500">다시 시도</button>
      </div>
    )
  }
  if (baby === undefined) return null
  if (baby === null || editing) {
    if (!isOwner) {
      return (
        <div className={`${CARD} p-8 text-center`}>
          <p className="text-sm font-semibold text-stone-700">아직 아기 정보가 등록 전이에요</p>
          <p className="mt-1 text-xs text-stone-400">가족 관리자가 등록하면 볼 수 있어요</p>
        </div>
      )
    }
    return (
      <BabyProfileForm
        accessToken={accessToken}
        initial={baby}
        onSaved={async () => { await reload(); setEditing(false) }}
        onCancel={baby ? () => setEditing(false) : undefined}
      />
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 px-1">
        <div className="h-[38px] w-[38px] shrink-0 rounded-full bg-gradient-to-br from-[#fde2e4] to-[#cde5f5]" />
        <div className="flex-1">
          <b className="text-[13px]">{baby.name}</b>
          <div className="text-xs text-stone-400">
            {baby.birth_date.replaceAll('-', '.')} 출생 · 생후 {daysSinceBirth(baby.birth_date, localToday())}일
          </div>
        </div>
        {isOwner && (
          <button type="button" onClick={() => setEditing(true)} className="relative before:absolute before:content-[''] before:-inset-y-3 before:-inset-x-2 text-xs text-stone-400">수정</button>
        )}
      </div>
      {children(baby)}
    </div>
  )
}
