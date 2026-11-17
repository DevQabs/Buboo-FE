'use client'

// 일정 추가·수정 모달(ScheduleTab 에서 옮김) + 기념일 토글.
import { useState } from 'react'
import { motion } from 'framer-motion'
import { todayKST } from '@/lib/date'
import type { CreateScheduleRequest, Schedule, ScheduleColor, UpdateScheduleRequest } from '@/types'
import { Chip } from '@/components/ui/Card'
import { REMINDER_LABELS, fitReminders, reminderOptions, toggleReminder, type ReminderCode } from '@/lib/reminders'

export const COLOR_MAP: Record<ScheduleColor, { bg: string; text: string; dot: string }> = {
  indigo:  { bg: 'bg-brand-50',  text: 'text-brand-700',  dot: 'bg-brand-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-400' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400' },
}

// 모달은 시각 입력 없이 항상 하루 종일(all_day: true)로 저장한다 — 선택지도 하루 종일 것만
const ALL_DAY = true

function ReminderChips({ value, onChange }: { value: ReminderCode[]; onChange: (v: ReminderCode[]) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-2 block">알림</label>
      <div className="flex flex-wrap gap-2">
        {reminderOptions(ALL_DAY).map(c => (
          <Chip key={c} on={value.includes(c)} onClick={() => onChange(toggleReminder(value, c))}>
            {REMINDER_LABELS[c]}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export function AddScheduleModal({ currentUserID, initialDate, onClose, onSave }: {
  currentUserID: string
  initialDate?: string
  onClose: () => void
  onSave: (req: CreateScheduleRequest) => Promise<void>
}) {
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [startDate, setStart]   = useState(initialDate ?? todayKST())
  const [endDate, setEnd]       = useState('')
  const [isDDay, setIsDDay]     = useState(false)
  const [ddayLabel, setLabel]   = useState('')
  const [isAnniv, setIsAnniv] = useState(false)
  const [color, setColor]       = useState<ScheduleColor>('indigo')
  const [reminders, setReminders] = useState<ReminderCode[]>([])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSave = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      await onSave({
        user_id: currentUserID, title, description: desc,
        start_date: startDate, end_date: endDate || undefined,
        all_day: ALL_DAY, is_dday: isDDay, is_anniversary: isAnniv, dday_label: ddayLabel, color, reminders,
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
          <button onClick={onClose} className="relative before:absolute before:content-[''] before:-inset-y-3 before:-inset-x-2 text-slate-400 hover:text-slate-600 text-xl">×</button>
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
                  className={`relative before:absolute before:content-[''] before:-inset-2 w-7 h-7 rounded-full transition-all ${COLOR_MAP[c].dot} ${color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`} />
              ))}
            </div>
          </div>
          <ReminderChips value={reminders} onChange={setReminders} />

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
          {/* 기념일 — 지나도 D+N 으로 계속 센다(설계서 7절) */}
          <button
            type="button"
            role="switch"
            aria-checked={isAnniv}
            onClick={() => setIsAnniv(v => !v)}
            className="flex items-center gap-2"
          >
            <span className={`relative h-5 w-10 rounded-full transition-colors ${isAnniv ? 'bg-brand-500' : 'bg-slate-200'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isAnniv ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span>
            <span className="text-sm text-slate-700">기념일 (지나도 D+로 계속 세기)</span>
          </button>
          {(isDDay || isAnniv) && (
            <input value={ddayLabel} onChange={e => setLabel(e.target.value)}
              placeholder="표시 이름 (예: 결혼기념일)"
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

export function EditScheduleModal({ schedule, onClose, onSave }: {
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
  const [isAnniv, setIsAnniv] = useState(schedule.is_anniversary ?? false)
  const [color, setColor]     = useState<ScheduleColor>(schedule.color)
  const [reminders, setReminders] = useState<ReminderCode[]>(fitReminders(schedule.reminders ?? [], ALL_DAY))
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const handleSave = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    setSaving(true); setError('')
    try {
      await onSave(schedule.id, {
        title, description: desc,
        start_date: startDate, end_date: endDate || undefined,
        all_day: ALL_DAY, is_dday: isDDay, is_anniversary: isAnniv, dday_label: ddayLabel, color, reminders,
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
          <button onClick={onClose} className="relative before:absolute before:content-[''] before:-inset-y-3 before:-inset-x-2 text-slate-400 hover:text-slate-600 text-xl">×</button>
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
                  className={`relative before:absolute before:content-[''] before:-inset-2 w-7 h-7 rounded-full transition-all ${COLOR_MAP[c].dot} ${color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`} />
              ))}
            </div>
          </div>
          <ReminderChips value={reminders} onChange={setReminders} />
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
          {/* 기념일 — 지나도 D+N 으로 계속 센다(설계서 7절) */}
          <button
            type="button"
            role="switch"
            aria-checked={isAnniv}
            onClick={() => setIsAnniv(v => !v)}
            className="flex items-center gap-2"
          >
            <span className={`relative h-5 w-10 rounded-full transition-colors ${isAnniv ? 'bg-brand-500' : 'bg-slate-200'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isAnniv ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span>
            <span className="text-sm text-slate-700">기념일 (지나도 D+로 계속 세기)</span>
          </button>
          {(isDDay || isAnniv) && (
            <input value={ddayLabel} onChange={e => setLabel(e.target.value)}
              placeholder="표시 이름 (예: 결혼기념일)"
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
