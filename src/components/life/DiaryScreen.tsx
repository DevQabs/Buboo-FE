'use client'

// 일기 A (시안 diary-a): 한 달 기분 색 띠 + 사진 표지 카드 피드 + 하단 "오늘 하루는 어땠어요?".
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronLeftIcon, ChevronRightIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Card, FloatingBar, IconButton, PageTitle } from '@/components/ui/Card'
import StorageWarning from '@/components/ui/StorageWarning'
import { toastError } from '@/components/ui/Toast'
import { AddDiaryModal, EditDiaryModal, MOOD_LABEL, MOOD_TONE, PhotoLightbox, photoSrc } from './DiaryModals'
import { todayKST } from '@/lib/date'
import { MEDIA_ERROR_RELOAD_GAP_MS, MEDIA_STALE_MS } from '@/lib/mediaRules'
import { lunarFullLabel } from '@/lib/lunar'
import type { CreateDiaryRequest, DiaryEntry, DiaryMood, UpdateDiaryRequest, User } from '@/types'

interface DiaryScreenProps {
  diaries: DiaryEntry[]
  users: User[]
  currentUserID: string
  /** 저장 공간 경고(owner 만 보임) */
  accessToken: string
  /** 저장 공간 사용량은 owner 전용 API 라 owner 일 때만 부른다 */
  isOwner: boolean
  /** 일기 목록을 받은 시각. 사진 주소(presigned, 1시간)가 만료됐는지 가늠한다 */
  photosLoadedAt: number
  /** 목록을 다시 받아 사진 주소를 새로 한다 */
  onReloadPhotos: () => Promise<void>
  canEdit: boolean
  hasNav: boolean
  /** 2단 메뉴 칩 줄(제목 아래) */
  chips: ReactNode
  onAdd: (req: CreateDiaryRequest, photos: File[]) => Promise<void>
  onUpdate: (id: string, req: UpdateDiaryRequest, newPhotos: File[]) => Promise<void>
  onDeletePhoto: (id: string, photo: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function DiaryScreen({
  diaries, users, currentUserID, accessToken, isOwner, photosLoadedAt, onReloadPhotos, canEdit, hasNav, chips, onAdd, onUpdate, onDeletePhoto, onDelete,
}: DiaryScreenProps) {
  const today = todayKST()
  const [ym, setYm] = useState(today.slice(0, 7)) // "YYYY-MM"
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<DiaryEntry | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  // 사진 주소 만료 대비(BabyPhotoTab 과 같은 방식): 깨진 사진이 나오면 60초 간격으로 한 번,
  // 오래 숨겨 뒀다 돌아오면 50분이 지났을 때 목록을 다시 받는다. 여러 장이 한꺼번에 깨져도 한 번만.
  const reloadAt = useRef(0)
  const lastLoad = () => Math.max(photosLoadedAt, reloadAt.current)
  const reload = () => { reloadAt.current = Date.now(); onReloadPhotos() }
  const onPhotoError = () => { if (Date.now() - lastLoad() > MEDIA_ERROR_RELOAD_GAP_MS) reload() }
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - Math.max(photosLoadedAt, reloadAt.current) > MEDIA_STALE_MS) {
        reloadAt.current = Date.now()
        onReloadPhotos()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [photosLoadedAt, onReloadPhotos])

  const [y, m] = ym.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const month = diaries
    .filter(d => d.date.startsWith(ym))
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  // 하루에 여러 편이면 먼저 쓴 일기의 기분
  const moodByDay = new Map<number, DiaryMood>()
  for (const d of [...month].reverse()) {
    const day = Number(d.date.slice(8))
    if (!moodByDay.has(day)) moodByDay.set(day, d.mood)
  }
  const userMap = Object.fromEntries(users.map(u => [u.id, u]))

  const shift = (d: number) => {
    const t = new Date(y, m - 1 + d, 1)
    setYm(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`)
  }
  const remove = (id: string) => {
    setConfirmDel(null)
    onDelete(id).catch(e => toastError('일기 삭제', e))
  }

  return (
    <div className="space-y-3 pb-20">
      <PageTitle
        eyebrow="일상"
        title="일기"
        right={<>
          <IconButton label="이전 달" onClick={() => shift(-1)}><ChevronLeftIcon className="h-4 w-4" /></IconButton>
          <span className="px-1 text-xs font-semibold tabular-nums text-stone-500">{m}월</span>
          <IconButton label="다음 달" onClick={() => shift(1)}><ChevronRightIcon className="h-4 w-4" /></IconButton>
        </>}
      />
      {chips}
      {isOwner && accessToken && <StorageWarning accessToken={accessToken} className="rounded-card bg-white p-4 shadow-warm" />}

      {/* 한 달 기분 띠 */}
      <Card className="px-3 py-2.5">
        <p className="mb-1.5 text-xs text-stone-400">{m}월 기분</p>
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
          {Array.from({ length: daysInMonth }, (_, i) => {
            const mood = moodByDay.get(i + 1)
            return (
              <span
                key={i}
                title={`${i + 1}일${mood ? ` · ${MOOD_LABEL[mood]}` : ''}`}
                className={`h-2.5 rounded-[3px] ${mood ? MOOD_TONE[mood].strip : 'bg-sand'}`}
              />
            )
          })}
        </div>
      </Card>

      {month.length === 0 && <Card className="px-4 py-8 text-center text-sm text-stone-400">이 달 일기가 아직 없어요</Card>}

      {month.map(d => (
        <Card key={d.id} className="overflow-hidden">
          {d.photo_urls.length > 0 && (
            <button type="button" className="relative block w-full" onClick={() => setLightbox(photoSrc(d.photo_urls[0]))}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc(d.photo_urls[0])} alt="" onError={onPhotoError} className="h-44 w-full object-cover" />
              {d.photo_urls.length > 1 && (
                <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">+{d.photo_urls.length - 1}</span>
              )}
            </button>
          )}
          <div className="px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-stone-400">
                {Number(d.date.slice(5, 7))}월 {Number(d.date.slice(8))}일 · {lunarFullLabel(d.date)}
                {userMap[d.user_id] ? ` · ${userMap[d.user_id].name}` : ''}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${MOOD_TONE[d.mood]?.badge ?? 'bg-stone-100 text-stone-600'}`}>
                {MOOD_LABEL[d.mood] ?? d.mood}
              </span>
            </div>
            <button type="button" onClick={() => setExpanded(e => (e === d.id ? null : d.id))} className="mt-1.5 block w-full text-left">
              <p className={`whitespace-pre-wrap text-sm leading-relaxed text-stone-700 ${expanded === d.id ? '' : 'line-clamp-3'}`}>{d.content}</p>
            </button>
            {expanded === d.id && d.photo_urls.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {d.photo_urls.slice(1).map((ph, k) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={d.photos[k + 1] ?? k} src={photoSrc(ph)} alt="" onError={onPhotoError} onClick={() => setLightbox(photoSrc(ph))} className="h-20 w-20 cursor-pointer rounded-xl object-cover" />
                ))}
              </div>
            )}
            {canEdit && (
              <div className="mt-2 flex justify-end gap-1">
                {confirmDel === d.id ? (
                  <>
                    <button type="button" onClick={() => remove(d.id)} className="relative before:absolute before:content-[''] before:-inset-y-2.5 rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-medium text-white">삭제</button>
                    <button type="button" onClick={() => setConfirmDel(null)} className="relative before:absolute before:content-[''] before:-inset-y-2.5 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">취소</button>
                  </>
                ) : (
                  <>
                    <IconButton label="수정" onClick={() => setEditing(d)}><PencilSquareIcon className="h-4 w-4" /></IconButton>
                    <IconButton label="삭제" onClick={() => setConfirmDel(d.id)}><TrashIcon className="h-4 w-4" /></IconButton>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>
      ))}

      {canEdit && (
        <FloatingBar hasNav={hasNav} onClick={() => setAdding(true)} className="border border-dashed border-stone-300 bg-white text-stone-400 shadow-warm">
          <span>오늘 하루는 어땠어요?</span>
        </FloatingBar>
      )}

      {lightbox && <PhotoLightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <AnimatePresence>
        {adding && <AddDiaryModal currentUserID={currentUserID} initialDate={today} onClose={() => setAdding(false)} onSave={onAdd} />}
      </AnimatePresence>
      <AnimatePresence>
        {editing && (
          <EditDiaryModal diary={editing} onClose={() => setEditing(null)} onSave={onUpdate} onDeletePhoto={onDeletePhoto} />
        )}
      </AnimatePresence>
    </div>
  )
}
