import KoreanLunarCalendar from 'korean-lunar-calendar'

export interface LunarDate {
  month: number
  day: number
  intercalation: boolean
}

const cal = new KoreanLunarCalendar()

export function solarToLunar(year: number, month: number, day: number): LunarDate | null {
  try {
    cal.setSolarDate(year, month, day)
    return cal.getLunarCalendar() as LunarDate
  } catch {
    return null
  }
}

export function lunarDayLabel(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  if (parts.length < 3) return ''
  const lunar = solarToLunar(parts[0], parts[1], parts[2])
  if (!lunar) return ''
  return `${lunar.month}/${lunar.day}${lunar.intercalation ? '(윤)' : ''}`
}

export function lunarFullLabel(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  if (parts.length < 3) return ''
  const lunar = solarToLunar(parts[0], parts[1], parts[2])
  if (!lunar) return ''
  return `음력 ${lunar.month}월 ${lunar.day}일${lunar.intercalation ? ' (윤달)' : ''}`
}

// For calendar cell: show just the day number; on the 1st of a lunar month show "M/1"
export function lunarCellDay(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  if (parts.length < 3) return ''
  const lunar = solarToLunar(parts[0], parts[1], parts[2])
  if (!lunar) return ''
  if (lunar.day === 1) return `${lunar.intercalation ? '윤' : ''}${lunar.month}/1`
  return String(lunar.day)
}
