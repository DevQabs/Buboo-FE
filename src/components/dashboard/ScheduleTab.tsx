'use client'

import { useState, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getHolidaysForMonth } from '@/lib/koreanHolidays'
import { lunarCellDay, lunarFullLabel } from '@/lib/lunar'
import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon,
  PhotoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import type { Schedule, DiaryEntry, CreateScheduleRequest, CreateDiaryRequest, UpdateScheduleRequest, UpdateDiaryRequest, DiaryMood, ScheduleColor, User } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

// ─── helpers ─────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10)
}

function calcDDay(dateStr: string): number {
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86400000)
}

function fmtDDay(days: number): string {
  if (days === 0) return 'D-Day!'
  if (days > 0) return `D-${days}`
  return `D+${Math.abs(days)}`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const COLOR_MAP: Record<ScheduleColor, { bg: string; text: string; dot: string }> = {
  indigo:  { bg: 'bg-brand-50',  text: 'text-brand-700',  dot: 'bg-brand-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-400' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400' },
}

const MOOD_EMOJI: Record<DiaryMood, string> = {
  happy:  '😊',
  good:   '🙂',
  normal: '😐',
  sad:    '😢',
  tired:  '😴',
}

const MOOD_LABEL: Record<DiaryMood, string> = {
  happy:  '행복',
  good:   '좋음',
  normal: '보통',
  sad:    '슬픔',
  tired:  '피곤',
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({
  year, month, schedules, diaries,
  onPrev, onNext, onDayClick, selectedDate,
}: {
  year: number
  month: number
  schedules: Schedule[]
  diaries: DiaryEntry[]
  onPrev: () => void
  onNext: () => void
  onDayClick: (date: string) => void
  selectedDate: string
}) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onNext()
      else onPrev()
    }
  }

  const scheduleDays = new Set(
    schedules.map(s => s.start_date.slice(0, 10))
  )
  const diaryDays = new Set(diaries.map(d => d.date))

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const holidayMap = useMemo(() => getHolidaysForMonth(year, month), [year, month])
  const todayStr = today()

  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronLeftIcon className="h-4 w-4 text-slate-400" />
        </button>
        <span className="text-sm font-bold text-slate-800">
          {year}년 {month}월
        </span>
        <button onClick={onNext} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronRightIcon className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-semibold py-1 ${
            i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'
          }`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const hasSchedule = scheduleDays.has(dateStr)
          const hasDiary = diaryDays.has(dateStr)
          const holiday = holidayMap[dateStr]
          const col = i % 7

          return (
            <button
              key={i}
              onClick={() => onDayClick(dateStr)}
              className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
                isSelected ? 'bg-brand-500' : isToday ? 'bg-brand-50' : 'hover:bg-slate-50'
              }`}
            >
              <span className={`text-xs font-medium ${
                isSelected ? 'text-white'
                : isToday   ? 'text-brand-600'
                : col === 0 || (col !== 6 && holiday) ? 'text-rose-500'
                : col === 6 ? 'text-blue-500'
                : 'text-slate-700'
              }`}>{day}</span>
              <span className={`text-[8px] leading-none ${isSelected ? 'text-brand-100' : 'text-slate-300'}`}>
                {lunarCellDay(dateStr)}
              </span>
              <div className="flex gap-0.5 mt-0.5 h-1">
                {hasSchedule && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-500'}`} />}
                {hasDiary    && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-400'}`} />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-brand-500" />
          <span className="text-[10px] text-slate-400">일정</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[10px] text-slate-400">일기</span>
        </div>
      </div>
    </div>
  )
}

// ─── D-Day Banner ─────────────────────────────────────────────────────────────

function DDayBanner({ schedules }: { schedules: Schedule[] }) {
  const ddayItems = schedules
    .filter(s => s.is_dday)
    .map(s => ({ ...s, days: calcDDay(s.start_date) }))
    .sort((a, b) => Math.abs(a.days) - Math.abs(b.days))

  if (ddayItems.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {ddayItems.map(item => {
        const c = COLOR_MAP[item.color] ?? COLOR_MAP.indigo
        return (
          <div key={item.id} className={`flex-shrink-0 rounded-2xl px-4 py-3 ${c.bg} min-w-[120px]`}>
            <p className={`text-xs font-medium ${c.text} mb-0.5`}>{item.dday_label || item.title}</p>
            <p className={`text-xl font-black ${c.text} tabular-nums`}>{fmtDDay(item.days)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(item.start_date)} · {lunarFullLabel(item.start_date.slice(0, 10))}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Schedule row ─────────────────────────────────────────────────────────────

function ScheduleRow({ s, onEdit, onDelete }: { s: Schedule; onEdit: () => void; onDelete: () => void }) {
  const c = COLOR_MAP[s.color] ?? COLOR_MAP.indigo
  const dday = s.is_dday ? calcDDay(s.start_date) : null
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800 truncate">{s.title}</p>
          {dday !== null && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.bg} ${c.text}`}>
              {fmtDDay(dday)}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">{fmtDate(s.start_date)}{s.end_date ? ` ~ ${fmtDate(s.end_date)}` : ''} · {lunarFullLabel(s.start_date.slice(0, 10))}</p>
        {s.description && <p className="text-xs text-slate-500 truncate">{s.description}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-slate-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-colors"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Add Schedule Modal ───────────────────────────────────────────────────────

function AddScheduleModal({ currentUserID, onClose, onSave }: {
  currentUserID: string
  onClose: () => void
  onSave: (req: CreateScheduleRequest) => Promise<void>
}) {
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [startDate, setStart]   = useState(today())
  const [endDate, setEnd]       = useState('')
  const [isDDay, setIsDDay]     = useState(false)
  const [ddayLabel, setLabel]   = useState('')
  const [color, setColor]       = useState<ScheduleColor>('indigo')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSave = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      await onSave({
        user_id: currentUserID, title, description: desc,
        start_date: startDate, end_date: endDate || undefined,
        all_day: true, is_dday: isDDay, dday_label: ddayLabel, color,
      })
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
      <motion.div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-800">일정 추가</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">제목 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="일정 제목" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">메모</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="선택 사항" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">날짜 *</label>
              <input type="date" value={startDate} onChange={e => setStart(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">종료일</label>
              <input type="date" value={endDate} onChange={e => setEnd(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">색상</label>
            <div className="flex gap-2">
              {(Object.keys(COLOR_MAP) as ScheduleColor[]).map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${COLOR_MAP[c].dot} ${color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`} />
              ))}
            </div>
          </div>

          {/* D-Day */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setIsDDay(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors ${isDDay ? 'bg-brand-500' : 'bg-slate-200'} relative`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isDDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-slate-700">D-Day 카운터</span>
            </label>
          </div>
          {isDDay && (
            <input value={ddayLabel} onChange={e => setLabel(e.target.value)}
              placeholder="D-Day 라벨 (예: 결혼기념일)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          )}

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-40">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Edit Schedule Modal ──────────────────────────────────────────────────────

function EditScheduleModal({ schedule, onClose, onSave }: {
  schedule: Schedule
  onClose: () => void
  onSave: (id: string, req: UpdateScheduleRequest) => Promise<void>
}) {
  const [title, setTitle]     = useState(schedule.title)
  const [desc, setDesc]       = useState(schedule.description)
  const [startDate, setStart] = useState(schedule.start_date.slice(0, 10))
  const [endDate, setEnd]     = useState(schedule.end_date?.slice(0, 10) ?? '')
  const [isDDay, setIsDDay]   = useState(schedule.is_dday)
  const [ddayLabel, setLabel] = useState(schedule.dday_label)
  const [color, setColor]     = useState<ScheduleColor>(schedule.color)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const handleSave = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      await onSave(schedule.id, {
        title, description: desc,
        start_date: startDate, end_date: endDate || undefined,
        all_day: true, is_dday: isDDay, dday_label: ddayLabel, color,
      })
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
      <motion.div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-800">일정 수정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">제목 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="일정 제목" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">메모</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="선택 사항" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">날짜 *</label>
              <input type="date" value={startDate} onChange={e => setStart(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">종료일</label>
              <input type="date" value={endDate} onChange={e => setEnd(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">색상</label>
            <div className="flex gap-2">
              {(Object.keys(COLOR_MAP) as ScheduleColor[]).map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${COLOR_MAP[c].dot} ${color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setIsDDay(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors ${isDDay ? 'bg-brand-500' : 'bg-slate-200'} relative`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isDDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-slate-700">D-Day 카운터</span>
            </label>
          </div>
          {isDDay && (
            <input value={ddayLabel} onChange={e => setLabel(e.target.value)}
              placeholder="D-Day 라벨 (예: 결혼기념일)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          )}
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-40">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Diary row ────────────────────────────────────────────────────────────────

function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
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

function DiaryRow({ d, apiBase, onEdit, onDelete }: { d: DiaryEntry; apiBase: string; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  return (
    <div className="px-4 py-3 border-b border-slate-50 last:border-0">
      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <button className="w-full text-left" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{MOOD_EMOJI[d.mood] ?? '📝'}</span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{d.date}</p>
              <p className="text-xs text-slate-400">{lunarFullLabel(d.date)} · {MOOD_LABEL[d.mood] ?? d.mood} · {d.photos.length > 0 ? `📷 ${d.photos.length}` : '텍스트'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={e => { e.stopPropagation(); onEdit() }}
              className="p-1.5 rounded-lg text-slate-300 hover:text-amber-400 hover:bg-amber-50 transition-colors">
              <PencilSquareIcon className="h-3.5 w-3.5" />
            </button>
            {confirmingDelete ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => { onDelete(); setConfirmingDelete(false) }}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-rose-500 text-white hover:bg-rose-600 transition-colors">
                  삭제
                </button>
                <button onClick={() => setConfirmingDelete(false)}
                  className="px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                  취소
                </button>
              </div>
            ) : (
              <button onClick={e => { e.stopPropagation(); setConfirmingDelete(true) }}
                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-colors">
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="mt-2 pl-8">
          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{d.content}</p>
          {d.photos.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {d.photos.map(p => {
                const src = p.startsWith('http') ? p : `${apiBase}${p}`
                return (
                  <img key={p} src={src} alt=""
                    className="w-20 h-20 object-cover rounded-xl border border-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxSrc(src)} />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add Diary Modal ──────────────────────────────────────────────────────────

function AddDiaryModal({ currentUserID, initialDate, onClose, onSave }: {
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
                {(Object.keys(MOOD_EMOJI) as DiaryMood[]).map(m => (
                  <option key={m} value={m}>{MOOD_EMOJI[m]} {MOOD_LABEL[m]}</option>
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

function EditDiaryModal({ diary, onClose, onSaved }: {
  diary: DiaryEntry
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [content, setContent]     = useState(diary.content)
  const [mood, setMood]           = useState<DiaryMood>(diary.mood)
  const [existingPhotos, setExistingPhotos] = useState<string[]>(diary.photos)
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const photoSrc = (p: string) => p.startsWith('http') ? p : `${API_BASE}${p}`
  const photoFilename = (p: string) => p.split('/').pop() ?? p

  const handleDeleteExisting = async (photoURL: string) => {
    const filename = photoFilename(photoURL)
    try {
      await fetch(`${API_BASE}/api/diaries/${diary.id}/photos/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      setExistingPhotos(ps => ps.filter(p => p !== photoURL))
    } catch {
      setError('사진 삭제 실패')
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
      const res = await fetch(`${API_BASE}/api/diaries/${diary.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mood } satisfies UpdateDiaryRequest),
      })
      if (!res.ok) throw new Error(`수정 실패: ${res.status}`)
      for (const photo of newPhotos) {
        const form = new FormData()
        form.append('photo', photo)
        await fetch(`${API_BASE}/api/diaries/${diary.id}/photos`, { method: 'POST', body: form })
      }
      await onSaved()
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
              {(Object.keys(MOOD_EMOJI) as DiaryMood[]).map(m => (
                <option key={m} value={m}>{MOOD_EMOJI[m]} {MOOD_LABEL[m]}</option>
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
                  <img src={photoSrc(p)} alt="" className="w-full h-full object-cover rounded-xl border border-slate-100" />
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

// ─── Main ScheduleTab ─────────────────────────────────────────────────────────

interface ScheduleTabProps {
  schedules: Schedule[]
  diaries: DiaryEntry[]
  currentUserID: string
  onAddSchedule: (req: CreateScheduleRequest) => Promise<void>
  onEditSchedule: (id: string, req: UpdateScheduleRequest) => Promise<void>
  onDeleteSchedule: (id: string) => Promise<void>
  onAddDiary: (req: CreateDiaryRequest, photos: File[]) => Promise<void>
  onDiaryEdited: () => Promise<void>
  onDeleteDiary: (id: string) => Promise<void>
}

export default function ScheduleTab({
  schedules, diaries, currentUserID,
  onAddSchedule, onEditSchedule, onDeleteSchedule,
  onAddDiary, onDiaryEdited, onDeleteDiary,
}: ScheduleTabProps) {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(today())
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [showAddDiary, setShowAddDiary]       = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [editingDiary, setEditingDiary]       = useState<DiaryEntry | null>(null)
  const [activeSection, setActiveSection]     = useState<'schedule' | 'diary'>('schedule')

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // Filter by selected month for calendar, all for D-Day banner
  const monthSchedules = schedules.filter(s => {
    const d = new Date(s.start_date)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
  const monthDiaries = diaries.filter(d => d.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))

  // Filter by selected date for lists
  const dateSchedules = schedules.filter(s => s.start_date.slice(0, 10) === selectedDate)
  const dateDiaries   = diaries.filter(d => d.date === selectedDate)

  const ddaySchedules = schedules.filter(s => s.is_dday)

  return (
    <div className="space-y-4">
      {/* D-Day Banner */}
      {ddaySchedules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">D-Day</p>
          <DDayBanner schedules={ddaySchedules} />
        </div>
      )}

      {/* Mini Calendar */}
      <MiniCalendar
        year={year} month={month}
        schedules={monthSchedules} diaries={monthDiaries}
        onPrev={prevMonth} onNext={nextMonth}
        onDayClick={setSelectedDate} selectedDate={selectedDate}
      />

      {/* Section tabs + add buttons */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setActiveSection('schedule')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeSection === 'schedule' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}
            >
              일정
            </button>
            <button
              onClick={() => setActiveSection('diary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeSection === 'diary' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'}`}
            >
              일기
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">{selectedDate} · {lunarFullLabel(selectedDate)}</span>
            <button
              onClick={() => activeSection === 'schedule' ? setShowAddSchedule(true) : setShowAddDiary(true)}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                activeSection === 'schedule' ? 'bg-brand-50 hover:bg-brand-100 text-brand-600' : 'bg-amber-50 hover:bg-amber-100 text-amber-600'
              }`}
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {activeSection === 'schedule' ? (
          <div>
            {dateSchedules.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-400">이 날 일정이 없어요</p>
                <button onClick={() => setShowAddSchedule(true)} className="mt-1 text-xs text-brand-500 hover:underline">일정 추가 →</button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {dateSchedules.map(s => (
                  <ScheduleRow key={s.id} s={s} onEdit={() => setEditingSchedule(s)} onDelete={() => onDeleteSchedule(s.id)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {dateDiaries.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-400">이 날 일기가 없어요</p>
                <button onClick={() => setShowAddDiary(true)} className="mt-1 text-xs text-amber-500 hover:underline">일기 쓰기 →</button>
              </div>
            ) : (
              dateDiaries.map(d => (
                <DiaryRow key={d.id} d={d} apiBase={API_BASE} onEdit={() => setEditingDiary(d)} onDelete={() => onDeleteDiary(d.id)} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddSchedule && (
          <AddScheduleModal
            currentUserID={currentUserID}
            onClose={() => setShowAddSchedule(false)}
            onSave={onAddSchedule}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editingSchedule && (
          <EditScheduleModal
            schedule={editingSchedule}
            onClose={() => setEditingSchedule(null)}
            onSave={onEditSchedule}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddDiary && (
          <AddDiaryModal
            currentUserID={currentUserID}
            initialDate={selectedDate}
            onClose={() => setShowAddDiary(false)}
            onSave={onAddDiary}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editingDiary && (
          <EditDiaryModal
            diary={editingDiary}
            onClose={() => setEditingDiary(null)}
            onSaved={onDiaryEdited}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
