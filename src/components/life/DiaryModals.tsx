'use client'

// 일기 쓰기·수정 모달과 사진 크게 보기(ScheduleTab 에서 옮김). 백엔드 호출은 대시보드 핸들러가 한다.
import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { lunarFullLabel } from '@/lib/lunar'
import type { CreateDiaryRequest, DiaryEntry, DiaryMood, UpdateDiaryRequest } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

/** 표시용 주소(photo_urls 한 칸): '/' 로 시작하면 API 주소를 붙인다(presigned URL 은 그대로) */
export const photoSrc = (u: string) => (u.startsWith('/') ? `${API_BASE}${u}` : u)

/** 기분 색: 한 달 띠(strip)와 카드 배지(badge). blue 계열 금지라 슬픔은 brand. */
export const MOOD_TONE: Record<DiaryMood, { strip: string; badge: string }> = {
  happy:  { strip: 'bg-amber-300',   badge: 'bg-amber-100 text-amber-700' },
  good:   { strip: 'bg-emerald-300', badge: 'bg-emerald-100 text-emerald-700' },
  normal: { strip: 'bg-stone-300',   badge: 'bg-stone-100 text-stone-600' },
  sad:    { strip: 'bg-brand-200',   badge: 'bg-brand-50 text-brand-600' },
  tired:  { strip: 'bg-slate-300',   badge: 'bg-slate-100 text-slate-600' },
}

export const MOOD_LABEL: Record<DiaryMood, string> = {
  happy:  '행복',
  good:   '좋음',
  normal: '보통',
  sad:    '슬픔',
  tired:  '피곤',
}

export function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}

// ─── Add Diary Modal ──────────────────────────────────────────────────────────

export function AddDiaryModal({ currentUserID, initialDate, onClose, onSave }: {
  currentUserID: string
  initialDate: string
  onClose: () => void
  onSave: (req: CreateDiaryRequest, photos: File[]) => Promise<void>
}) {
  const [date, setDate]       = useState(initialDate)
  const [content, setContent] = useState('')
  const [mood, setMood]       = useState<DiaryMood>('normal')
  const [photos, setPhotos]   = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    setPhotos(p => [...p, ...arr])
    arr.forEach(f => {
      const reader = new FileReader()
      reader.onload = e => setPreviews(p => [...p, e.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  const removePhoto = (i: number) => {
    setPhotos(p => p.filter((_, idx) => idx !== i))
    setPreviews(p => p.filter((_, idx) => idx !== i))
  }

  const handleSave = async () => {
    if (!content.trim()) { setError('내용을 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      await onSave({ user_id: currentUserID, date, content, mood }, photos)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      />
      <motion.div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-800">일기 쓰기</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">날짜</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">기분</label>
              <select value={mood} onChange={e => setMood(e.target.value as DiaryMood)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                {(Object.keys(MOOD_LABEL) as DiaryMood[]).map(m => (
                  <option key={m} value={m}>{MOOD_LABEL[m]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">내용 *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={5}
              placeholder="오늘 하루를 기록해보세요..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>

          {/* Photos */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">사진</label>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative w-20 h-20">
                  <img src={src} alt="" className="w-full h-full object-cover rounded-xl border border-slate-100" />
                  <button onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center">
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-amber-400 hover:text-amber-500 transition-colors">
                <PhotoIcon className="h-5 w-5 mb-0.5" />
                <span className="text-[10px]">추가</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => handleFiles(e.target.files)} />
            </div>
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-40">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Edit Diary Modal ─────────────────────────────────────────────────────────

export function EditDiaryModal({ diary, onClose, onSave, onDeletePhoto }: {
  diary: DiaryEntry
  onClose: () => void
  onSave: (id: string, req: UpdateDiaryRequest, newPhotos: File[]) => Promise<void>
  /** photo 는 저장소 키(diary.photos 한 칸) */
  onDeletePhoto: (id: string, photo: string) => Promise<void>
}) {
  const [content, setContent]     = useState(diary.content)
  const [mood, setMood]           = useState<DiaryMood>(diary.mood)
  const [existingPhotos, setExistingPhotos] = useState<string[]>(diary.photos)
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const keySrc = (key: string) => photoSrc(diary.photo_urls[diary.photos.indexOf(key)] ?? '')

  const handleDeleteExisting = async (key: string) => {
    try {
      await onDeletePhoto(diary.id, key)
      setExistingPhotos(ps => ps.filter(p => p !== key))
    } catch (e) {
      setError(e instanceof Error ? `사진 삭제 실패: ${e.message}` : '사진 삭제 실패')
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    setNewPhotos(p => [...p, ...arr])
    arr.forEach(f => {
      const reader = new FileReader()
      reader.onload = e => setNewPreviews(p => [...p, e.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  const removeNewPhoto = (i: number) => {
    setNewPhotos(p => p.filter((_, idx) => idx !== i))
    setNewPreviews(p => p.filter((_, idx) => idx !== i))
  }

  const handleSave = async () => {
    if (!content.trim()) { setError('내용을 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      await onSave(diary.id, { content, mood }, newPhotos)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      />
      <motion.div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-800">일기 수정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
            <span className="text-xs text-slate-400">날짜</span>
            <span className="text-sm font-semibold text-slate-700">{diary.date}</span>
            <span className="text-xs text-slate-400 ml-1">({lunarFullLabel(diary.date)})</span>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">기분</label>
            <select value={mood} onChange={e => setMood(e.target.value as DiaryMood)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
              {(Object.keys(MOOD_LABEL) as DiaryMood[]).map(m => (
                <option key={m} value={m}>{MOOD_LABEL[m]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">내용 *</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={5}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">사진</label>
            <div className="flex flex-wrap gap-2">
              {existingPhotos.map(p => (
                <div key={p} className="relative w-20 h-20">
                  <img src={keySrc(p)} alt="" className="w-full h-full object-cover rounded-xl border border-slate-100" />
                  <button onClick={() => handleDeleteExisting(p)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center">
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {newPreviews.map((src, i) => (
                <div key={i} className="relative w-20 h-20">
                  <img src={src} alt="" className="w-full h-full object-cover rounded-xl border border-amber-100" />
                  <button onClick={() => removeNewPhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center">
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-amber-400 hover:text-amber-500 transition-colors">
                <PhotoIcon className="h-5 w-5 mb-0.5" />
                <span className="text-[10px]">추가</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => handleFiles(e.target.files)} />
            </div>
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-40">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
