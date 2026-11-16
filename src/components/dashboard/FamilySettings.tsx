'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import { apiFetch } from '@/lib/api'
import { TABS, permissionSummary, visibleTabs } from '@/lib/menus'
import type { InvitePreset, Member, MenuKey, PermLevel } from '@/types'

const CARD = 'mx-3 mb-2.5 rounded-[22px] bg-white p-4 shadow-[0_4px_14px_rgba(120,90,60,.07)]'

const LEVELS: { key: PermLevel; label: string }[] = [
  { key: 'hidden', label: '숨김' },
  { key: 'view', label: '보기' },
  { key: 'edit', label: '편집' },
]

const PRESETS: { key: InvitePreset; label: string }[] = [
  { key: 'spouse', label: '배우자 (전체)' },
  { key: 'grandparent', label: '조부모 (아기만)' },
  { key: 'custom', label: '직접 설정' },
]

function Header({ small, title, onBack }: { small: string; title: string; onBack: () => void }) {
  return (
    <div className="flex items-end justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]">
      <div>
        <small className="block text-[11px] text-stone-400">{small}</small>
        <b className="text-xl font-extrabold">{title}</b>
      </div>
      <button type="button" onClick={onBack} aria-label="뒤로" className="p-2 text-stone-400">
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
    </div>
  )
}

function Segment({ value, onChange }: { value: PermLevel; onChange: (v: PermLevel) => void }) {
  return (
    <div className="flex w-[150px] rounded-[10px] bg-[#f5efe6] p-0.5 text-[11px] font-bold">
      {LEVELS.map(l => (
        <button
          key={l.key}
          type="button"
          onClick={() => onChange(l.key)}
          className={`flex-1 rounded-lg py-1.5 ${value === l.key ? 'bg-white text-brand-600 shadow-sm' : 'text-stone-400'}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

function InviteCard({ accessToken }: { accessToken: string }) {
  const [preset, setPreset] = useState<InvitePreset>('spouse')
  const [nickname, setNickname] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch('/api/auth/invite', accessToken, {
        method: 'POST',
        body: JSON.stringify({ preset, nickname: nickname.trim() }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const inv: { code: string } = await res.json()
      setUrl(`${window.location.origin}/invite/${inv.code}`)
    } catch {
      setError('초대 링크를 만들지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={CARD}>
      <b className="text-sm">초대하기</b>
      <p className="mb-2 mt-1 text-[11px] text-stone-400">초대할 때 권한 묶음을 고르면 링크에 담겨요</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => { setPreset(p.key); setUrl(null) }}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
              preset === p.key ? 'border-brand-500 bg-brand-500 text-white' : 'border-[#eee7dd] bg-white text-stone-500'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        value={nickname}
        onChange={e => { setNickname(e.target.value); setUrl(null) }}
        maxLength={30}
        placeholder="이름 (예: 친정엄마)"
        className="mt-2.5 w-full rounded-xl border border-[#eee7dd] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {preset === 'custom' && (
        <p className="mt-1.5 text-[11px] text-stone-400">가입하면 모든 메뉴가 숨김이에요. 목록에서 눌러 권한을 정해 주세요.</p>
      )}
      {url ? (
        <>
          <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-[#f5efe6] px-3 py-2">
            <span className="flex-1 truncate text-xs text-stone-600">{url}</span>
            <button type="button" onClick={copy} aria-label="링크 복사" className="shrink-0 text-brand-600">
              {copied ? <CheckIcon className="h-4 w-4 text-emerald-500" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-stone-400">초대 링크 (7일 유효, 한 번만 쓸 수 있어요)</p>
        </>
      ) : (
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="mt-2.5 w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? '만드는 중...' : '초대 링크 만들기'}
        </button>
      )}
      {error && <p className="mt-1.5 text-[11px] text-rose-500">{error}</p>}
    </div>
  )
}

function MemberList({ members, error, accessToken, onSelect, onClose }: {
  members: Member[]
  error: string | null
  accessToken: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <>
      <Header small="설정" title="가족 구성원" onBack={onClose} />
      {error && <p className="px-4 pb-2 text-xs text-rose-500">{error}</p>}
      <div className={`${CARD} py-1.5`}>
        {members.map((m, i) => (
          <button
            key={m.id}
            type="button"
            disabled={m.is_owner}
            onClick={() => onSelect(m.id)}
            className={`flex w-full items-center justify-between py-2.5 text-left ${
              i < members.length - 1 ? 'border-b border-[#f5f0e8]' : ''
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: m.avatar_color }}
              >
                {m.name[0]}
              </span>
              <span>
                <b className="text-sm">{m.name}</b>
                <br />
                <span className="text-[11px] text-stone-400">{permissionSummary(m)}</span>
              </span>
            </span>
            {!m.is_owner && <ChevronRightIcon className="h-4 w-4 text-stone-300" />}
          </button>
        ))}
      </div>
      <InviteCard accessToken={accessToken} />
    </>
  )
}

function MemberDetail({ member, accessToken, onBack, onChanged }: {
  member: Member
  accessToken: string
  onBack: () => void
  onChanged: () => Promise<void>
}) {
  const [menus, setMenus] = useState<Record<MenuKey, PermLevel>>(member.menus)
  const [error, setError] = useState<string | null>(null)

  // ponytail: 바뀔 때마다 전체 맵을 바로 저장한다. 아주 빠르게 연달아 누르면 응답 순서가 뒤바뀔 수 있음 — 문제되면 저장 버튼으로.
  const save = async (next: Record<MenuKey, PermLevel>) => {
    const prev = menus
    setMenus(next)
    setError(null)
    const res = await apiFetch(`/api/members/${member.id}/permissions`, accessToken, {
      method: 'PUT',
      body: JSON.stringify({ menus: next }),
    }).catch(() => null)
    if (!res?.ok) {
      setMenus(prev)
      setError('저장하지 못했습니다')
      return
    }
    await onChanged()
  }
  const setOne = (m: MenuKey, l: PermLevel) => save({ ...menus, [m]: l })
  const setAll = (subs: MenuKey[], l: PermLevel) => {
    const next = { ...menus }
    for (const s of subs) next[s] = l
    save(next)
  }

  const remove = async () => {
    if (!confirm(`${member.name}님을 가족에서 내보낼까요? 이 사람이 남긴 기록은 그대로 남아요.`)) return
    const res = await apiFetch(`/api/members/${member.id}`, accessToken, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) {
      setError('내보내지 못했습니다')
      return
    }
    await onChanged()
    onBack()
  }

  const preview = visibleTabs({ is_owner: false, menus }).map(t => t.label).join(', ') || '없음'

  return (
    <>
      <Header small="설정 · 가족 구성원" title={member.name} onBack={onBack} />
      {error && <p className="px-4 pb-2 text-xs text-rose-500">{error}</p>}
      {TABS.map(tab => (
        <div key={tab.key} className={`${CARD} py-3`}>
          {tab.subs.length === 1 ? (
            <div className="flex items-center justify-between">
              <b className="text-sm">{tab.label}</b>
              <Segment value={menus[tab.subs[0].key]} onChange={l => setOne(tab.subs[0].key, l)} />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-1.5">
                <b className="text-sm">{tab.label}</b>
                <select
                  value=""
                  onChange={e => setAll(tab.subs.map(s => s.key), e.target.value as PermLevel)}
                  aria-label={`${tab.label} 전체 변경`}
                  className="bg-transparent text-[11px] text-stone-400 focus:outline-none"
                >
                  <option value="" disabled>전체 ▾</option>
                  {LEVELS.map(l => <option key={l.key} value={l.key}>전체 {l.label}</option>)}
                </select>
              </div>
              {tab.subs.map(s => (
                <div key={s.key} className="flex items-center justify-between py-1">
                  <span className="text-[13px]">{s.label}</span>
                  <Segment value={menus[s.key]} onChange={l => setOne(s.key, l)} />
                </div>
              ))}
            </>
          )}
        </div>
      ))}
      <p className="px-4 py-2 text-center text-[11px] text-stone-400">이 사람에게 보이는 하단 탭: {preview}</p>
      <div className="px-3">
        <button type="button" onClick={remove} className="w-full rounded-xl py-3 text-sm font-semibold text-rose-500">
          구성원 내보내기
        </button>
      </div>
    </>
  )
}

export default function FamilySettings({ accessToken, onClose }: { accessToken: string; onClose: () => void }) {
  const [members, setMembers] = useState<Member[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await apiFetch('/api/members', accessToken).catch(() => null)
    if (!res?.ok) {
      setError('구성원을 불러오지 못했습니다')
      return
    }
    setError(null)
    setMembers(await res.json())
  }, [accessToken])

  useEffect(() => { load() }, [load])

  const selected = members.find(m => m.id === selectedId)

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#FBF8F3] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] text-stone-800">
      <div className="mx-auto max-w-2xl">
        {selected ? (
          <MemberDetail key={selected.id} member={selected} accessToken={accessToken} onBack={() => setSelectedId(null)} onChanged={load} />
        ) : (
          <MemberList members={members} error={error} accessToken={accessToken} onSelect={setSelectedId} onClose={onClose} />
        )}
      </div>
    </div>
  )
}
