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
