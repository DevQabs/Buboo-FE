'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { apiFetch } from '@/lib/api'
import { daysSinceBirth } from '@/lib/mediaRules'
import { BabyGate, CARD } from './BabyProfile'
import MomentComposer from './MomentComposer'
import type { Baby, BabyMedia, BabyMoment, User } from '@/types'

const monthDay = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`

function MediaThumb({ media, className, onClick }: { media: BabyMedia; className: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative block overflow-hidden bg-gradient-to-br from-[#fde2e4] to-[#cde5f5] ${className}`}>
      {media.kind === 'video'
        ? <video src={`${media.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        // eslint-disable-next-line @next/next/no-img-element -- presigned R2 주소라 next/image 를 못 쓴다
        : <img src={media.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
      {media.kind === 'video' && <PlayIcon className="absolute inset-0 m-auto h-9 w-9 text-white drop-shadow" />}
    </button>
  )
}

/** 전체 화면 뷰어: 사진은 눌러서 확대/축소(뷰포트 확대가 막혀 있어 직접 처리), 영상은 재생. */
function MediaViewer({ media, index, onClose }: { media: BabyMedia[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index)
  const [zoom, setZoom] = useState(false)
  const cur = media[i]
  const go = (n: number) => { setI(n); setZoom(false) }
  return (
    <div className="fixed inset-0 z-[80] bg-black">
      <div className={`h-full w-full ${zoom ? 'overflow-auto' : 'flex items-center justify-center'}`}>
        {cur.kind === 'video' ? (
          <video key={cur.id} src={cur.url} controls autoPlay playsInline className="max-h-full max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- presigned R2 주소라 next/image 를 못 쓴다
          <img src={cur.url} alt="" onClick={() => setZoom(z => !z)}
            className={zoom ? 'w-[200%] max-w-none' : 'max-h-full max-w-full object-contain'} />
        )}
      </div>
      <button type="button" aria-label="닫기" onClick={onClose}
        className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] p-2 text-white">
        <XMarkIcon className="h-6 w-6" />
      </button>
      {i > 0 && (
        <button type="button" aria-label="이전" onClick={() => go(i - 1)} className="absolute left-1 top-1/2 -translate-y-1/2 p-2 text-white">
          <ChevronLeftIcon className="h-7 w-7" />
        </button>
      )}
      {i < media.length - 1 && (
        <button type="button" aria-label="다음" onClick={() => go(i + 1)} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-white">
          <ChevronRightIcon className="h-7 w-7" />
        </button>
      )}
    </div>
  )
}

/** 날짜별 카드: 큰 대표 사진 + 나머지 격자, "생후 N일 · 날짜 · 작성자"(시안 B). */
function MomentCard({ m, days, author, canEdit, onOpen, onEdit, onDelete }: {
  m: BabyMoment
  days: number
  author: string
  canEdit: boolean
  onOpen: (i: number) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [first, ...rest] = m.media
  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-warm">
      {first && <MediaThumb media={first} className="h-[260px] w-full" onClick={() => onOpen(0)} />}
      <div className="px-3.5 py-2.5">
        <div className="flex items-center justify-between text-[11px] text-stone-400">
          <span>생후 {days}일 · {monthDay(m.date)}{author && ` · ${author}`}</span>
          {canEdit && (
            <span className="flex gap-2.5">
              <button type="button" onClick={onEdit}>수정</button>
              <button type="button" onClick={onDelete} className="text-rose-400">삭제</button>
            </span>
          )}
        </div>
        {m.content && <p className="mt-0.5 whitespace-pre-wrap text-[13px] font-semibold text-stone-800">{m.content}</p>}
      </div>
      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-2 px-3.5 pb-3.5">
          {rest.map((md, i) => (
            <MediaThumb key={md.id} media={md} className="h-[110px] rounded-[18px]" onClick={() => onOpen(i + 1)} />
          ))}
        </div>
      )}
    </div>
  )
}

function MomentFeed({ accessToken, users, baby, canEdit }: {
  accessToken: string
  users: User[]
  baby: Baby
  canEdit: boolean
}) {
  const [moments, setMoments] = useState<BabyMoment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ media: BabyMedia[]; index: number } | null>(null)
  const [composer, setComposer] = useState<BabyMoment | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      // 서버는 빈 목록·빈 media 를 null 로 줄 수 있다(Go nil 슬라이스)
      const ms = (await apiFetch<BabyMoment[] | null>('/api/baby/moments', accessToken)) ?? []
      setMoments(ms.map(m => ({ ...m, media: m.media ?? [] })))
      setError(null)
    } catch {
      setError('사진일기를 불러오지 못했어요')
    }
  }, [accessToken])
  useEffect(() => { load() }, [load])

  const remove = async (m: BabyMoment) => {
    if (!confirm('이 기록과 사진·영상을 모두 지울까요?')) return
    try {
      await apiFetch(`/api/baby/moments/${m.id}`, accessToken, { method: 'DELETE' })
      setMoments(ms => ms?.filter(x => x.id !== m.id) ?? null)
    } catch {
      setError('지우지 못했어요')
    }
  }

  const nameOf = (id: string) => users.find(u => u.id === id)?.name ?? ''

  return (
    <>
      {canEdit && (
        <button type="button" onClick={() => setComposer('new')}
          className={`${CARD} w-full py-3 text-center text-[13px] font-bold text-brand-500`}>
          + 오늘의 순간 남기기
        </button>
      )}
      {error && <p className="px-1 text-xs text-rose-500">{error}</p>}
      {moments?.length === 0 && (
        <div className={`${CARD} p-8 text-center`}>
          <p className="text-sm font-semibold text-stone-700">아직 기록이 없어요</p>
          {canEdit && <p className="mt-1 text-xs text-stone-400">첫 사진을 남겨 보세요</p>}
        </div>
      )}
      {moments?.map(m => (
        <MomentCard
          key={m.id}
          m={m}
          days={daysSinceBirth(baby.birth_date, m.date)}
          author={nameOf(m.user_id)}
          canEdit={canEdit}
          onOpen={i => setViewer({ media: m.media, index: i })}
          onEdit={() => setComposer(m)}
          onDelete={() => remove(m)}
        />
      ))}
      {viewer && <MediaViewer media={viewer.media} index={viewer.index} onClose={() => setViewer(null)} />}
      {composer && (
        <MomentComposer
          accessToken={accessToken}
          moment={composer === 'new' ? null : composer}
          onClose={() => { setComposer(null); load() }}
          onSaved={async () => { setComposer(null); await load() }}
        />
      )}
    </>
  )
}

export default function BabyPhotoTab({ accessToken, users, isOwner, canEdit }: {
  accessToken: string
  users: User[]
  isOwner: boolean
  canEdit: boolean
}) {
  return (
    <BabyGate accessToken={accessToken} isOwner={isOwner}>
      {baby => <MomentFeed accessToken={accessToken} users={users} baby={baby} canEdit={canEdit} />}
    </BabyGate>
  )
}
