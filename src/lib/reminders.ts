// 일정 알림 시점 코드(push 설계서 3절). 백엔드 models/reminders.go 와 같은 표.
export type ReminderCode = 'at' | 'm10' | 'h1' | 'd0_9' | 'd1_9'

export const REMINDER_LABELS: Record<ReminderCode, string> = {
  at: '정시',
  m10: '10분 전',
  h1: '1시간 전',
  d0_9: '당일 오전 9시',
  d1_9: '하루 전 오전 9시',
}

/** 고를 수 있는 코드(칩 순서). 하루 종일이면 오전 9시 둘, 아니면 정시·10분·1시간·하루 전 */
export function reminderOptions(allDay: boolean): ReminderCode[] {
  return allDay ? ['d0_9', 'd1_9'] : ['at', 'm10', 'h1', 'd1_9']
}

/** 일정 종류에 맞지 않는 코드를 뺀다(하루 종일 전환, 옛 값 정리) */
export function fitReminders(codes: string[], allDay: boolean): ReminderCode[] {
  const ok: string[] = reminderOptions(allDay)
  return codes.filter((c): c is ReminderCode => ok.includes(c))
}

export function toggleReminder(codes: ReminderCode[], c: ReminderCode): ReminderCode[] {
  return codes.includes(c) ? codes.filter(x => x !== c) : [...codes, c]
}
