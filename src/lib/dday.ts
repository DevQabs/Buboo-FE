// 일정 D 표시와 아젠다 묶기(설계서 7절 일정 A, D-day 규칙). 런타임 import 없음.
import type { Schedule } from '@/types'

const DAY_MS = 86_400_000
// date.ts 의 dayNum 과 같은 식. lib 파일끼리 런타임 import 를 하지 않으려고 둔다.
const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS
const ymd = (iso: string) => iso.slice(0, 10)

export function fmtDDay(days: number): string {
  if (days === 0) return 'D-Day'
  return days > 0 ? `D-${days}` : `D+${-days}`
}

type DDayFields = Pick<Schedule, 'start_date' | 'is_dday' | 'is_anniversary'>

/** D-day 는 당일까지만 D-n/D-Day, 지나면 숨김. 기념일은 지나도 D+N. 둘 다 아니면 null. */
export function ddayBadge(s: DDayFields, today: string): string | null {
  const days = Math.round(dayNum(ymd(s.start_date)) - dayNum(today))
  if (s.is_anniversary) return fmtDDay(days)
  if (s.is_dday && days >= 0) return fmtDDay(days)
  return null
}

type AgendaFields = DDayFields & Partial<Pick<Schedule, 'end_date'>>

/** 오늘~이번 주 토요일 / 그 뒤 / 지난 기념일(최근 것 먼저). 여러 날 일정은 끝나는 날까지 남는다. */
export function buildAgenda<T extends AgendaFields>(list: T[], today: string): { thisWeek: T[]; later: T[]; anniversaries: T[] } {
  const t = dayNum(today)
  const weekEnd = t + (6 - new Date(t * DAY_MS).getUTCDay())
  const start = (s: T) => dayNum(ymd(s.start_date))
  const end = (s: T) => dayNum(ymd(s.end_date ?? s.start_date))
  const upcoming = list.filter(s => end(s) >= t).sort((a, b) => start(a) - start(b))
  return {
    thisWeek: upcoming.filter(s => start(s) <= weekEnd),
    later: upcoming.filter(s => start(s) > weekEnd),
    anniversaries: list.filter(s => s.is_anniversary && start(s) < t).sort((a, b) => start(b) - start(a)),
  }
}
