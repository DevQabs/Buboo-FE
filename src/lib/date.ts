const pad = (n: number) => String(n).padStart(2, '0')

// 한국 날짜 "YYYY-MM-DD". toISOString() 은 UTC 라 한국 오전 9시 전에는 어제가 된다.
export function todayKST(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

// 가계부 한 달의 기간 [startDate, endDate). 요약·거래 목록·카테고리 집계가 모두 이 기간을 쓴다.
// startDay=1 → 그 달 1일 ~ 다음 달 1일, startDay=25, 1월 → 12-25 ~ 01-25.
export function ledgerPeriod(year: number, month: number, startDay: number): { startDate: string; endDate: string } {
  const [sy, sm] = startDay === 1 ? [year, month] : month === 1 ? [year - 1, 12] : [year, month - 1]
  const [ey, em] = startDay === 1 ? (month === 12 ? [year + 1, 1] : [year, month + 1]) : [year, month]
  return {
    startDate: `${sy}-${pad(sm)}-${pad(startDay)}`,
    endDate: `${ey}-${pad(em)}-${pad(startDay)}`,
  }
}

// 오늘("YYYY-MM-DD")이 속한 가계부 달. 시작일이 지났으면 다음 달 기간이다.
export function ledgerMonthOf(today: string, startDay: number): { year: number; month: number } {
  const [y, m, d] = today.split('-').map(Number)
  if (startDay === 1 || d < startDay) return { year: y, month: m }
  return m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 }
}

const DAY_MS = 86_400_000
const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS

// b − a 일수. 둘 다 "YYYY-MM-DD".
export function daysBetween(a: string, b: string): number {
  return Math.round(dayNum(b) - dayNum(a))
}

// "YYYY-MM-DD"에 n일을 더한다(음수면 뺀다).
export function addDays(d: string, n: number): string {
  return new Date((dayNum(d) + n) * DAY_MS).toISOString().slice(0, 10)
}

// 요일 0(일)~6(토).
export function weekdayOf(d: string): number {
  return new Date(dayNum(d) * DAY_MS).getUTCDay()
}

// 가계부 기간 [start, end)에서 오늘을 포함해 남은 일수. 기간 전이면 기간 전체, 끝났으면 0.
export function daysLeftInPeriod(today: string, start: string, end: string): number {
  if (today < start) return daysBetween(start, end)
  if (today >= end) return 0
  return daysBetween(today, end)
}

/** 일정 주간 스트립 날짜들: 오늘(또는 고른 날) 주의 일요일부터 다음 주 토요일 + 더 불러온 주까지. 고른 날이 밖이면 그 주까지 늘린다. */
export function stripDays(today: string, selected: string, moreWeeks: number): string[] {
  const sunday = (d: string) => addDays(d, -weekdayOf(d))
  const from = sunday(selected < today ? selected : today)
  let to = addDays(sunday(today), 13 + 7 * moreWeeks)
  const selEnd = addDays(sunday(selected), 6)
  if (selEnd > to) to = selEnd
  return Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i))
}
