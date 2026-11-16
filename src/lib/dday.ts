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
    // 아직 안 끝난 기념일은 위(이번 주·그 뒤)에 이미 있으니 지난 기념일 칸에는 끝난 것만.
    anniversaries: list.filter(s => s.is_anniversary && end(s) < t).sort((a, b) => start(b) - start(a)),
  }
}

/** 그 날에 걸친 일정(여러 날 일정은 시작~끝 사이 모든 날). */
export function schedulesOn<T extends Pick<Schedule, 'start_date'> & Partial<Pick<Schedule, 'end_date'>>>(list: T[], day: string): T[] {
  return list.filter(s => ymd(s.start_date) <= day && day <= ymd(s.end_date ?? s.start_date))
}

const ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째']
const md = (n: number) => { const d = new Date(n * DAY_MS); return `${d.getUTCMonth() + 1}.${d.getUTCDate()}` }

/**
 * "다음 주 이후" 일정을 시작일이 든 주(일~토, 주간 스트립·buildAgenda 와 같은 기준)로 묶는다.
 * 일정이 없는 주는 만들지 않는다. 1~3주 뒤는 "다음 주 (11.22 – 11.28)" 식, 그 뒤는 "12월 넷째 주",
 * 해가 바뀌면 "내년 1월 둘째 주". 주가 두 달에 걸치면 수요일이 든 달로 센다.
 */
export function weekBuckets<T extends AgendaFields>(list: T[], today: string): { label: string; items: T[] }[] {
  const t = dayNum(today)
  const thisWeek = t - new Date(t * DAY_MS).getUTCDay()
  const start = (s: T) => dayNum(ymd(s.start_date))
  const end = (s: T) => dayNum(ymd(s.end_date ?? s.start_date))
  const sorted = [...list].sort((a, b) => start(a) - start(b) || end(a) - end(b))
  const out: { label: string; items: T[] }[] = []
  let cur = -1
  for (const s of sorted) {
    const k = Math.floor((start(s) - thisWeek) / 7)
    if (k !== cur) {
      cur = k
      const ws = thisWeek + k * 7
      const range = `(${md(ws)} – ${md(ws + 6)})`
      let label: string
      if (k === 1) label = `다음 주 ${range}`
      else if (k >= 2 && k <= 3) label = `${k}주 뒤 ${range}`
      else {
        const mid = new Date((ws + 3) * DAY_MS)
        const dy = mid.getUTCFullYear() - Number(today.slice(0, 4))
        const year = dy === 1 ? '내년 ' : dy > 1 ? `${mid.getUTCFullYear()}년 ` : ''
        label = `${year}${mid.getUTCMonth() + 1}월 ${ORD[Math.ceil(mid.getUTCDate() / 7) - 1]} 주`
      }
      out.push({ label, items: [] })
    }
    out[out.length - 1].items.push(s)
  }
  return out
}
