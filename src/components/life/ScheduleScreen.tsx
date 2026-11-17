'use client'

// 일정 A (시안 sched-a): 주간 스트립 + 이번 주/이후 아젠다(옆에 D-n) + 기념일 칸(D+) + 월 달력 펼침.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CalendarDaysIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Card, IconButton, PageTitle, SectionLabel } from '@/components/ui/Card'
import { toastError } from '@/components/ui/Toast'
import { Section } from '@/components/ui/Loading'
import type { SectionState } from '@/lib/loadState'
import MiniCalendar from './MiniCalendar'
import { AddScheduleModal, COLOR_MAP, EditScheduleModal } from './ScheduleModals'
import { addDays, daysBetween, stripDays, todayKST, weekdayOf } from '@/lib/date'
import { buildAgenda, ddayBadge, fmtDDay, schedulesOn, weekBuckets } from '@/lib/dday'
import { getHolidaysForMonth } from '@/lib/koreanHolidays'
import { lunarFullLabel } from '@/lib/lunar'
import type { CreateScheduleRequest, DiaryEntry, Schedule, UpdateScheduleRequest } from '@/types'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const ymd = (iso: string) => iso.slice(0, 10)

function AgendaRow({ s, today, canEdit, onOpen, onRemove }: {
  s: Schedule
  today: string
  canEdit: boolean
  onOpen: () => void
  onRemove: () => void
}) {
  const c = COLOR_MAP[s.color] ?? COLOR_MAP.indigo
  const badge = ddayBadge(s, today)
  const start = ymd(s.start_date)
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className={`w-1 self-stretch rounded-full ${c.dot}`} />
      <button type="button" disabled={!canEdit} onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-stone-800">
          {s.title}
          {s.dday_label && <span className="font-normal text-stone-400"> · {s.dday_label}</span>}
        </p>
        <p className="text-xs text-stone-400">
          <FullDate d={start} />
          {s.end_date && <> ~ <FullDate d={ymd(s.end_date)} /></>}
          <span className="whitespace-nowrap"> · {lunarFullLabel(start)}</span>
        </p>
        {s.description && <p className="truncate text-xs text-stone-500">{s.description}</p>}
      </button>
      {badge && <span className={`shrink-0 text-xs font-extrabold tabular-nums ${c.text}`}>{badge}</span>}
      {canEdit && (
        <button type="button" aria-label="삭제" onClick={onRemove} className="relative before:absolute before:content-[''] before:-inset-2 shrink-0 rounded-lg p-1.5 text-stone-300 hover:bg-rose-50 hover:text-rose-400">
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// "12월 6일 (토)" — 토 brand, 일 rose. 같은 달 끝날은 "8일 (월)".
function FullDate({ d, withMonth = true }: { d: string; withMonth?: boolean }) {
  const w = weekdayOf(d)
  const tone = w === 6 ? 'text-brand-500' : w === 0 ? 'text-rose-500' : ''
  return <>{withMonth ? `${Number(d.slice(5, 7))}월 ` : ''}{Number(d.slice(8))}일 <span className={tone}>({WD[w]})</span></>
}

// 다음 주 이후 타임라인 한 줄: 제목, 전체 날짜(여러 날이면 끝날까지), 음력·메모, 오른쪽 D-n.
function LaterRow({ s, today, canEdit, onOpen, onRemove }: {
  s: Schedule
  today: string
  canEdit: boolean
  onOpen: () => void
  onRemove: () => void
}) {
  const c = COLOR_MAP[s.color] ?? COLOR_MAP.indigo
  const start = ymd(s.start_date)
  const end = s.end_date ? ymd(s.end_date) : ''
  return (
    <div className="relative">
      <span className={`absolute -left-5 top-4 h-2.5 w-2.5 rounded-full ring-2 ring-white ${c.dot}`} />
      <Card className="flex min-h-11 items-center gap-2 px-3 py-2">
        <button type="button" disabled={!canEdit} onClick={onOpen} className="min-w-0 flex-1 self-stretch text-left">
          <p className="truncate text-sm font-semibold text-stone-800">
            {s.title}
            {s.dday_label && <span className="font-normal text-stone-400"> · {s.dday_label}</span>}
          </p>
          <p className="text-xs text-stone-500">
            <FullDate d={start} />
            {end && end !== start && <> – <FullDate d={end} withMonth={end.slice(0, 7) !== start.slice(0, 7)} /></>}
            <span className="whitespace-nowrap text-stone-400"> · {lunarFullLabel(start)}</span>
          </p>
          {s.description && <p className="truncate text-xs text-stone-400">{s.description}</p>}
        </button>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${c.bg} ${c.text}`}>
          {fmtDDay(daysBetween(today, start))}
        </span>
        {canEdit && (
          <button type="button" aria-label="삭제" onClick={onRemove} className="relative before:absolute before:content-[''] before:-inset-2 shrink-0 rounded-lg p-1.5 text-stone-300 hover:bg-rose-50 hover:text-rose-400">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </Card>
    </div>
  )
}

interface ScheduleScreenProps {
  /** 일정 목록 불러오기 상태(주간 스트립 아래 목록) */
  section: SectionState
  schedules: Schedule[]
  /** 월 달력의 일기 점 */
  diaries: DiaryEntry[]
  currentUserID: string
  canEdit: boolean
  /** 2단 메뉴 칩 줄(제목 아래) */
  chips: ReactNode
  onAdd: (req: CreateScheduleRequest) => Promise<void>
  onEdit: (id: string, req: UpdateScheduleRequest) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function ScheduleScreen({ section, schedules, diaries, currentUserID, canEdit, chips, onAdd, onEdit, onDelete }: ScheduleScreenProps) {
  const today = todayKST()
  const [selected, setSelected] = useState(today)
  const [showMonth, setShowMonth] = useState(false)
  const [cal, setCal] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) })
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Schedule | null>(null)

  // 주간 스트립: 처음엔 다음 주까지, 오른쪽 끝에 닿으면 2주씩 더 붙인다
  const [moreWeeks, setMoreWeeks] = useState(0)
  const strip = stripDays(today, selected, moreWeeks)
  const first = strip[0]
  const last = strip[strip.length - 1]
  const stripRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = stripRef.current, end = endRef.current
    if (!root || !end) return
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) setMoreWeeks(w => w + 2) }, { root, rootMargin: '0px 200px 0px 0px' })
    io.observe(end)
    return () => io.disconnect()
  }, [])
  // 고른 날이 보이게(달력에서 고르거나 오늘로)
  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>(`[data-day="${selected}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [selected])
  // 스트립이 여러 달에 걸쳐 그 달들의 공휴일을 합친다
  const holidays = useMemo(() => {
    const out: Record<string, string> = {}
    for (let y = Number(first.slice(0, 4)), m = Number(first.slice(5, 7)); y * 12 + m <= Number(last.slice(0, 4)) * 12 + Number(last.slice(5, 7)); m === 12 ? (y++, m = 1) : m++) {
      Object.assign(out, getHolidaysForMonth(y, m))
    }
    return out
  }, [first, last])
  const scheduleDays = new Set(schedules.map(s => ymd(s.start_date)))
  const agenda = buildAgenda(schedules, today)
  const dayList = schedulesOn(schedules, selected)
  const monthKey = `${cal.year}-${String(cal.month).padStart(2, '0')}`
  const monthSchedules = schedules.filter(s => s.start_date.startsWith(monthKey))
  const monthDiaries = diaries.filter(d => d.date.startsWith(monthKey))

  const moveMonth = (d: number) => setCal(c => {
    const m = c.month + d
    if (m < 1) return { year: c.year - 1, month: 12 }
    if (m > 12) return { year: c.year + 1, month: 1 }
    return { year: c.year, month: m }
  })
  const remove = (id: string) => { onDelete(id).catch(e => toastError('일정 삭제', e)) }
  const rows = (list: Schedule[]) => list.map(s => (
    <AgendaRow key={s.id} s={s} today={today} canEdit={canEdit} onOpen={() => setEditing(s)} onRemove={() => remove(s.id)} />
  ))
  const empty = (text: string) => <p className="py-4 text-center text-xs text-stone-400">{text}</p>

  return (
    <div className="space-y-3">
      <PageTitle
        eyebrow="일상"
        title="일정"
        right={<>
          <IconButton label="월 달력" on={showMonth} expanded={showMonth} onClick={() => setShowMonth(v => !v)}>
            <CalendarDaysIcon className="h-4 w-4" />
          </IconButton>
          {canEdit && <IconButton label="일정 추가" onClick={() => setAdding(true)}><PlusIcon className="h-4 w-4" /></IconButton>}
        </>}
      />
      {chips}

      {showMonth && (
        <MiniCalendar
          year={cal.year}
          month={cal.month}
          schedules={monthSchedules}
          diaries={monthDiaries}
          onPrev={() => moveMonth(-1)}
          onNext={() => moveMonth(1)}
          onDayClick={setSelected}
          selectedDate={selected}
        />
      )}

      {/* 주간 스트립 */}
      <div ref={stripRef} className="-mx-3 flex snap-x gap-1.5 overflow-x-auto scroll-px-3 px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {strip.map(d => {
          const i = weekdayOf(d)
          const on = d === selected
          const red = i === 0 || Boolean(holidays[d])
          return (
            <button
              key={d}
              data-day={d}
              type="button"
              onClick={() => setSelected(d)}
              title={holidays[d]}
              className={`flex w-[calc((100vw-1.5rem-2.25rem)/7)] max-w-16 shrink-0 snap-start flex-col items-center rounded-2xl py-1.5 text-xs ${on ? 'bg-brand-500 text-white' : 'bg-white shadow-warm'}`}
            >
              {Number(d.slice(8)) === 1
                ? <span className={`font-bold ${on ? 'text-white' : 'text-brand-500'}`}>{Number(d.slice(5, 7))}월</span>
                : <span className={on ? 'text-white/80' : red ? 'text-rose-500' : i === 6 ? 'text-brand-400' : 'text-stone-400'}>{WD[i]}</span>}
              <span className={`text-sm font-bold ${!on && d === today ? 'text-brand-500' : ''}`}>{Number(d.slice(8))}</span>
              <span className={`mt-0.5 h-1 w-1 rounded-full ${scheduleDays.has(d) ? (on ? 'bg-white' : 'bg-brand-500') : 'bg-transparent'}`} />
            </button>
          )
        })}
        <div ref={endRef} className="w-px shrink-0" aria-hidden />
      </div>

      <Section s={section} minH={160}>
      <div className="space-y-3">
      {selected !== today && (
        <>
          <div className="flex items-center justify-between">
            <SectionLabel>
              {Number(selected.slice(5, 7))}월 {Number(selected.slice(8))}일 · {lunarFullLabel(selected)}
              {holidays[selected] ? ` · ${holidays[selected]}` : ''}
            </SectionLabel>
            <button type="button" onClick={() => setSelected(today)} className="relative before:absolute before:content-[''] before:-inset-y-3 before:-inset-x-2 px-2 text-xs font-medium text-brand-500">오늘로</button>
          </div>
          <Card className="px-3 py-1">{dayList.length > 0 ? rows(dayList) : empty('이 날 일정이 없어요')}</Card>
        </>
      )}

      <SectionLabel>이번 주</SectionLabel>
      <Card className="px-3 py-1">{agenda.thisWeek.length > 0 ? rows(agenda.thisWeek) : empty('이번 주 일정이 없어요')}</Card>

      {agenda.later.length > 0 && (
        <>
          <SectionLabel>다음 주 이후</SectionLabel>
          {/* 주 단위 타임라인: 일정 있는 주만 */}
          <div className="relative space-y-2 pl-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-0.5 before:rounded-full before:bg-stone-200 before:content-['']">
            {weekBuckets(agenda.later, today).map(b => (
              <section key={b.label} className="space-y-1.5">
                <h3 className="pt-1 text-xs font-bold text-stone-500">{b.label}</h3>
                {b.items.map(s => (
                  <LaterRow key={s.id} s={s} today={today} canEdit={canEdit} onOpen={() => setEditing(s)} onRemove={() => remove(s.id)} />
                ))}
              </section>
            ))}
          </div>
        </>
      )}

      {agenda.anniversaries.length > 0 && (
        <>
          <SectionLabel>기념일</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {agenda.anniversaries.map(s => {
              const c = COLOR_MAP[s.color] ?? COLOR_MAP.indigo
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setEditing(s)}
                  className={`relative before:absolute before:content-[''] before:-inset-y-2 rounded-2xl px-3 py-1.5 text-xs font-bold ${c.bg} ${c.text}`}
                >
                  {s.dday_label || s.title} {ddayBadge(s, today)}
                </button>
              )
            })}
          </div>
        </>
      )}
      </div>
      </Section>

      <AnimatePresence>
        {adding && (
          <AddScheduleModal currentUserID={currentUserID} initialDate={selected} onClose={() => setAdding(false)} onSave={onAdd} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editing && <EditScheduleModal schedule={editing} onClose={() => setEditing(null)} onSave={onEdit} />}
      </AnimatePresence>
    </div>
  )
}
