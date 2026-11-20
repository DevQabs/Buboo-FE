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

const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

/** 날짜·시각 칸 상태. 하루 종일이면 날짜~종료일, 아니면 날짜 + 시작(필수)·끝 시각(같은 날) */
interface When { allDay: boolean; startDate: string; endDate: string; startTime: string; endTime: string }

/** 저장 전 검사(오류 문구) 와 요청 필드. 시간 지정은 끝 날짜를 보내지 않는다("" = 끝 지움, 백엔드가 시작 날짜로 본다) */
function whenRequest(w: When): { error?: string; req: Pick<UpdateScheduleRequest, 'all_day' | 'start_date' | 'start_time' | 'end_date' | 'end_time'> } {
  if (!w.allDay && !w.startTime) return { error: '시작 시각을 입력해주세요', req: {} }
  if (!w.allDay && w.endTime && w.endTime < w.startTime) return { error: '끝 시각이 시작 시각보다 빨라요', req: {} }
  return {
    req: w.allDay
      ? { all_day: true, start_date: w.startDate, start_time: '', end_date: w.endDate, end_time: '' }
      : { all_day: false, start_date: w.startDate, start_time: w.startTime, end_date: '', end_time: w.endTime },
  }
}

function WhenFields({ w, onChange }: { w: When; onChange: (w: When) => void }) {
  const set = (p: Partial<When>) => onChange({ ...w, ...p })
  return (
    <>
      <button type="button" role="switch" aria-checked={w.allDay} onClick={() => set({ allDay: !w.allDay })} className="flex min-h-11 items-center gap-2">
        <span className={`relative h-5 w-10 rounded-full transition-colors ${w.allDay ? 'bg-brand-500' : 'bg-slate-200'}`}>
          <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${w.allDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
        <span className="text-sm text-slate-700">하루 종일</span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        <div className={w.allDay ? '' : 'col-span-2'}>
          <label className="text-xs font-medium text-slate-500 mb-1 block">날짜 *</label>
          <input type="date" value={w.startDate} onChange={e => set({ startDate: e.target.value })} className={INPUT} />
        </div>
        {w.allDay ? (
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">종료일</label>
            <input type="date" value={w.endDate} onChange={e => set({ endDate: e.target.value })} className={INPUT} />
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">시작 시각 *</label>
              <input type="time" value={w.startTime} onChange={e => set({ startTime: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">끝 시각</label>
              <input type="time" value={w.endTime} onChange={e => set({ endTime: e.target.value })} className={INPUT} />
            </div>
          </>
        )}
      </div>
    </>
  )
}

function ReminderChips({ allDay, value, onChange }: { allDay: boolean; value: ReminderCode[]; onChange: (v: ReminderCode[]) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-2 block">알림</label>
      <div className="flex flex-wrap gap-2">
        {reminderOptions(allDay).map(c => (
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
  const [when, setWhen] = useState<When>({ allDay: true, startDate: initialDate ?? todayKST(), endDate: '', startTime: '', endTime: '' })
  const [isDDay, setIsDDay]     = useState(false)
  const [ddayLabel, setLabel]   = useState('')
  const [isAnniv, setIsAnniv] = useState(false)
  const [color, setColor]       = useState<ScheduleColor>('indigo')
  const [reminders, setReminders] = useState<ReminderCode[]>([])
  // 하루 종일을 바꾸면 맞지 않는 알림은 뺀다
  const changeWhen = (w: When) => { setWhen(w); setReminders(r => fitReminders(r, w.allDay)) }
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const handleSave = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    const { error: whenError, req: whenReq } = whenRequest(when)
    if (whenError) { setError(whenError); return }
    setSaving(true); setError('')
    try {
      await onSave({
        user_id: currentUserID, title, description: desc,
        ...whenReq, start_date: when.startDate, end_date: whenReq.end_date || undefined,
        is_dday: isDDay, is_anniversary: isAnniv, dday_label: ddayLabel, color, reminders,
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
          <WhenFields w={when} onChange={changeWhen} />

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
          <ReminderChips allDay={when.allDay} value={reminders} onChange={setReminders} />

          {/* D-Day */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setIsDDay(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors ${isDDay ? 'bg-brand-500' : 'bg-slate-200'} relative`}
              >
                <div className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isDDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
              <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isAnniv ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
  const [when, setWhen] = useState<When>({
    allDay: schedule.all_day, startDate: schedule.start_date.slice(0, 10),
    endDate: schedule.all_day ? schedule.end_date?.slice(0, 10) ?? '' : '',
    startTime: schedule.start_time ?? '', endTime: schedule.end_time ?? '',
  })
  const [isDDay, setIsDDay]   = useState(schedule.is_dday)
  const [ddayLabel, setLabel] = useState(schedule.dday_label)
  const [isAnniv, setIsAnniv] = useState(schedule.is_anniversary ?? false)
  const [color, setColor]     = useState<ScheduleColor>(schedule.color)
  const [reminders, setReminders] = useState<ReminderCode[]>(fitReminders(schedule.reminders ?? [], schedule.all_day))
  // 하루 종일을 바꾸면 맞지 않는 알림은 뺀다
  const changeWhen = (w: When) => { setWhen(w); setReminders(r => fitReminders(r, w.allDay)) }
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const handleSave = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    const { error: whenError, req: whenReq } = whenRequest(when)
    if (whenError) { setError(whenError); return }
    setSaving(true); setError('')
    try {
      await onSave(schedule.id, {
        title, description: desc,
        ...whenReq, is_dday: isDDay, is_anniversary: isAnniv, dday_label: ddayLabel, color, reminders,
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
          <WhenFields w={when} onChange={changeWhen} />
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">색상</label>
            <div className="flex gap-2">
              {(Object.keys(COLOR_MAP) as ScheduleColor[]).map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`relative before:absolute before:content-[''] before:-inset-2 w-7 h-7 rounded-full transition-all ${COLOR_MAP[c].dot} ${color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`} />
              ))}
            </div>
          </div>
          <ReminderChips allDay={when.allDay} value={reminders} onChange={setReminders} />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setIsDDay(v => !v)}
                className={`w-10 h-5 rounded-full transition-colors ${isDDay ? 'bg-brand-500' : 'bg-slate-200'} relative`}
              >
                <div className={`absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isDDay ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
              <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isAnniv ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
