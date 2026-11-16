'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { apiFetch } from '@/lib/api'
import { Section } from '@/components/ui/Loading'
import { babyAgeLabel, MEDIA_ERROR_RELOAD_GAP_MS, MEDIA_STALE_MS } from '@/lib/mediaRules'
import { BabyGate, CARD } from './BabyProfile'
import MomentComposer from './MomentComposer'
import type { Baby, BabyMedia, BabyMoment, User } from '@/types'

const monthDay = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`


function MediaThumb({ media, className, onClick, onError }: { media: BabyMedia; className: string; onClick: () => void; onError: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative block overflow-hidden bg-gradient-to-br from-[#fde2e4] to-[#cde5f5] ${className}`}>
      {media.kind === 'video'
        ? <video src={`${media.url}#t=0.1`} muted playsInline preload="metadata" onError={onError} className="h-full w-full object-cover" />
        // eslint-disable-next-line @next/next/no-img-element -- presigned R2 주소라 next/image 를 못 쓴다
        : <img src={media.url} alt="" loading="lazy" onError={onError} className="h-full w-full object-cover" />}
      {media.kind === 'video' && <PlayIcon className="absolute inset-0 m-auto h-9 w-9 text-white drop-shadow" />}
    </button>
  )
}

/** 전체 화면 뷰어: 사진은 눌러서 확대/축소(뷰포트 확대가 막혀 있어 직접 처리), 영상은 재생. */
function MediaViewer({ media, index, label, onClose, onError }: { media: BabyMedia[]; index: number; label: string; onClose: () => void; onError: () => void }) {
  const [i, setI] = useState(index)
  const [zoom, setZoom] = useState(false)
  const cur = media[i]
  const go = (n: number) => { setI(n); setZoom(false) }
  return (
    <div className="fixed inset-0 z-[80] bg-black">
      <div className={`h-full w-full ${zoom ? 'overflow-auto' : 'flex items-center justify-center'}`}>
        {cur.kind === 'video' ? (
          <video key={cur.id} src={cur.url} controls autoPlay playsInline onError={onError} className="max-h-full max-w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- presigned R2 주소라 next/image 를 못 쓴다
          <img src={cur.url} alt="" onError={onError} onClick={() => setZoom(z => !z)}
            className={zoom ? 'w-[200%] max-w-none' : 'max-h-full max-w-full object-contain'} />
        )}
      </div>
      <p className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1.25rem)] text-xs text-white/80">{label}</p>
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

/** 날짜별 카드: 큰 대표 사진 + 나머지 격자, "생후 N일(태어나기 전엔 임신 주수) · 날짜 · 작성자"(시안 B). */
function MomentCard({ m, age, author, canEdit, onOpen, onEdit, onDelete, onMediaError }: {
  m: BabyMoment
  age: string
  author: string
  canEdit: boolean
  onOpen: (i: number) => void
  onEdit: () => void
  onDelete: () => void
  onMediaError: () => void
}) {
  const [first, ...rest] = m.media
  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-warm">
      {first && <MediaThumb media={first} className="h-[260px] w-full" onClick={() => onOpen(0)} onError={onMediaError} />}
      <div className="px-3.5 py-2.5">
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>{age} · {monthDay(m.date)}{author && ` · ${author}`}</span>
          {canEdit && (
            <span className="flex gap-2.5">
              <button type="button" onClick={onEdit} className="relative before:absolute before:-inset-x-1 before:-inset-y-4 before:content-['']">수정</button>
              <button type="button" onClick={onDelete} className="relative text-rose-400 before:absolute before:-inset-x-1 before:-inset-y-4 before:content-['']">삭제</button>
            </span>
          )}
        </div>
        {m.content && <p className="mt-0.5 whitespace-pre-wrap text-[13px] font-semibold text-stone-800">{m.content}</p>}
      </div>
      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-2 px-3.5 pb-3.5">
          {rest.map((md, i) => (
            <MediaThumb key={md.id} media={md} className="h-[110px] rounded-[18px]" onClick={() => onOpen(i + 1)} onError={onMediaError} />
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
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  // 뷰어는 기록 id 로 들고 있어 다시 받은 새 주소를 바로 쓴다
  const [viewer, setViewer] = useState<{ momentId: string; index: number } | null>(null)
  const loadedAt = useRef(0)
  const [composer, setComposer] = useState<BabyMoment | 'new' | null>(null)

  const load = useCallback(async () => {
    loadedAt.current = Date.now()
    setBusy(true)
    setLoadFailed(false)
    try {
      // 서버는 빈 목록·빈 media 를 null 로 줄 수 있다(Go nil 슬라이스)
      const ms = (await apiFetch<BabyMoment[] | null>('/api/baby/moments', accessToken)) ?? []
      setMoments(ms.map(m => ({ ...m, media: m.media ?? [] })))
      setError(null)
    } catch {
      setLoadFailed(true)
      setError('사진일기를 새로 고치지 못했어요') // 이미 받은 목록이 있을 때만 보인다
    } finally {
      setBusy(false)
    }
  }, [accessToken])
  useEffect(() => { load() }, [load])

  // 주소 만료 대비: 오래 숨겨 뒀다 돌아오면 다시 받는다
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > MEDIA_STALE_MS) load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // 미디어가 안 열리면(주소 만료 등) 한 번 다시 받는다. 여러 장이 한꺼번에 깨져도 한 번만.
  const onMediaError = useCallback(() => {
    if (Date.now() - loadedAt.current > MEDIA_ERROR_RELOAD_GAP_MS) load()
  }, [load])
  const viewerMoment = viewer && moments?.find(m => m.id === viewer.momentId)
  const viewerMedia = viewerMoment && viewerMoment.media

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
      {moments && error && <p className="px-1 text-xs text-rose-500">{error}</p>}
      <Section minH={200} s={{
        view: moments ? (busy ? 'refreshing' : 'content') : loadFailed ? 'error' : 'spinner',
        onRetry: load,
      }}>
      <div className="space-y-3 empty:hidden">
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
          age={babyAgeLabel(baby.birth_date, m.date)}
          author={nameOf(m.user_id)}
          canEdit={canEdit}
          onOpen={i => setViewer({ momentId: m.id, index: i })}
          onEdit={() => setComposer(m)}
          onDelete={() => remove(m)}
          onMediaError={onMediaError}
        />
      ))}
      </div>
      </Section>
      {viewer && viewerMedia && viewerMedia.length > 0 && (
        <MediaViewer media={viewerMedia} index={Math.min(viewer.index, viewerMedia.length - 1)}
          label={`${babyAgeLabel(baby.birth_date, viewerMoment.date)} · ${monthDay(viewerMoment.date)}`}
          onClose={() => setViewer(null)} onError={onMediaError} />
      )}
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
