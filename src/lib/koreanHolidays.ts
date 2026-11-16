// 대한민국 공휴일. 음력 공휴일은 korean-lunar-calendar 로 계산하고
// 대체공휴일은 「관공서의 공휴일에 관한 규정」 제3조 규칙으로 붙인다.
import KoreanLunarCalendar from 'korean-lunar-calendar'

type HolidayMap = Record<string, string> // "YYYY-MM-DD" → 공휴일명

// [MM-DD, 이름, 토·일·다른 공휴일과 겹치면 대체공휴일이 생기는가]
const FIXED: [string, string, boolean][] = [
  ['01-01', '신정', false],
  ['03-01', '삼일절', true],
  ['05-05', '어린이날', true],
  ['06-06', '현충일', false],
  ['08-15', '광복절', true],
  ['10-03', '개천절', true],
  ['10-09', '한글날', true],
  ['12-25', '성탄절', true],
]

// 규칙으로 구할 수 없는 날(선거일, 임시공휴일). 발표되면 여기에 더한다.
const EXTRA: Record<string, string> = {
  '2026-05-01': '근로자의날',
  '2026-06-03': '지방선거',
}

const pad = (n: number) => String(n).padStart(2, '0')
const key = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)

const cal = new KoreanLunarCalendar()

function lunarToSolar(year: number, month: number, day: number): Date {
  cal.setLunarDate(year, month, day, false)
  const s = cal.getSolarCalendar()
  return new Date(Date.UTC(s.year, s.month - 1, s.day))
}

export function getHolidaysForYear(year: number): HolidayMap {
  const names: Record<string, string[]> = {}
  const add = (d: Date, name: string) => (names[key(d)] ??= []).push(name)

  const seol = lunarToSolar(year, 1, 1)
  const chuseok = lunarToSolar(year, 8, 15)
  const seolDays = [addDays(seol, -1), seol, addDays(seol, 1)]
  const chuseokDays = [addDays(chuseok, -1), chuseok, addDays(chuseok, 1)]
  ;['설날 전날', '설날', '설날 다음날'].forEach((n, i) => add(seolDays[i], n))
  ;['추석 전날', '추석', '추석 다음날'].forEach((n, i) => add(chuseokDays[i], n))
  const buddha = lunarToSolar(year, 4, 8)
  add(buddha, '부처님오신날')
  const weekendRule: Date[] = [buddha]
  for (const [mmdd, name, sub] of FIXED) {
    const d = new Date(`${year}-${mmdd}T00:00:00Z`)
    add(d, name)
    if (sub) weekendRule.push(d)
  }
  for (const [k, name] of Object.entries(EXTRA)) {
    if (k.startsWith(`${year}-`)) add(new Date(`${k}T00:00:00Z`), name)
  }

  const taken = new Set(Object.keys(names))
  const nextFree = (from: Date, skipSaturday: boolean) => {
    let d = addDays(from, 1)
    while (taken.has(key(d)) || d.getUTCDay() === 0 || (skipSaturday && d.getUTCDay() === 6)) d = addDays(d, 1)
    taken.add(key(d))
    names[key(d)] = ['대체공휴일']
  }

  // 설·추석 연휴: 일요일이나 다른 공휴일과 겹치면 연휴 다음 첫 비공휴일 (토요일은 해당 없음)
  for (const block of [seolDays, chuseokDays]) {
    if (block.some(d => d.getUTCDay() === 0 || names[key(d)].length > 1)) nextFree(block[2], false)
  }
  // 어린이날·부처님오신날·국경일·성탄절: 토·일이나 다른 공휴일과 겹치면 다음 평일 비공휴일.
  // 같은 날 둘이 겹쳐도 대체는 하루(2025-05-05 → 05-06 하루).
  const done = new Set<string>()
  for (const d of weekendRule.sort((a, b) => a.getTime() - b.getTime())) {
    const k = key(d)
    if (done.has(k)) continue
    done.add(k)
    const wd = d.getUTCDay()
    if (wd === 0 || wd === 6 || names[k].length > 1) nextFree(d, true)
  }

  const result: HolidayMap = {}
  for (const [k, v] of Object.entries(names)) result[k] = v.join('·')
  return result
}

export function getHolidaysForMonth(year: number, month: number): HolidayMap {
  const prefix = `${year}-${pad(month)}-`
  const result: HolidayMap = {}
  for (const [k, v] of Object.entries(getHolidaysForYear(year))) {
    if (k.startsWith(prefix)) result[k] = v
  }
  return result
}
