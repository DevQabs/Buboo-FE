'use client'

// 일기 A (시안 diary-a): 한 달 기분 색 띠 + 사진 표지 카드 피드 + 하단 "오늘 하루는 어땠어요?".
import { useState, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronLeftIcon, ChevronRightIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Card, FloatingBar, IconButton, PageTitle } from '@/components/ui/Card'
import StorageWarning from '@/components/ui/StorageWarning'
import { toastError } from '@/components/ui/Toast'
import { AddDiaryModal, EditDiaryModal, MOOD_LABEL, MOOD_TONE, PhotoLightbox, photoSrc } from './DiaryModals'
import { todayKST } from '@/lib/date'
import { lunarFullLabel } from '@/lib/lunar'
import type { CreateDiaryRequest, DiaryEntry, DiaryMood, UpdateDiaryRequest, User } from '@/types'

interface DiaryScreenProps {
  diaries: DiaryEntry[]
  users: User[]
  currentUserID: string
  /** 저장 공간 경고(owner 만 보임) */
  accessToken: string
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
  diaries, users, currentUserID, accessToken, canEdit, hasNav, chips, onAdd, onUpdate, onDeletePhoto, onDelete,
}: DiaryScreenProps) {
  const today = todayKST()
  const [ym, setYm] = useState(today.slice(0, 7)) // "YYYY-MM"
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<DiaryEntry | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

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
      {canEdit && accessToken && <StorageWarning accessToken={accessToken} className="rounded-card bg-white p-4 shadow-warm" />}

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
              <img src={photoSrc(d.photo_urls[0])} alt="" className="h-44 w-full object-cover" />
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
                  <img key={d.photos[k + 1] ?? k} src={photoSrc(ph)} alt="" onClick={() => setLightbox(photoSrc(ph))} className="h-20 w-20 cursor-pointer rounded-xl object-cover" />
                ))}
              </div>
            )}
            {canEdit && (
              <div className="mt-2 flex justify-end gap-1">
                {confirmDel === d.id ? (
                  <>
                    <button type="button" onClick={() => remove(d.id)} className="rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-medium text-white">삭제</button>
                    <button type="button" onClick={() => setConfirmDel(null)} className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">취소</button>
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
