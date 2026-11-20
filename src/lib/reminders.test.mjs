// 일정 알림 칩 순수 함수 검사(push 설계서 3·7절). 실행: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { REMINDER_LABELS, fitReminders, reminderOptions, toggleReminder } from './reminders.ts'

test('알림 선택지는 하루 종일 여부로 갈린다', () => {
  assert.deepEqual(reminderOptions(true), ['d0_9', 'd1_9'])
  assert.deepEqual(reminderOptions(false), ['at', 'm10', 'h1', 'd1_9'])
  assert.deepEqual(reminderOptions(true).map(c => REMINDER_LABELS[c]), ['당일 오전 9시', '하루 전 오전 9시'])
  assert.deepEqual(reminderOptions(false).map(c => REMINDER_LABELS[c]), ['정시', '10분 전', '1시간 전', '하루 전 오전 9시'])
})

test('하루 종일 여부가 바뀌면 맞지 않는 코드를 뺀다', () => {
  assert.deepEqual(fitReminders(['at', 'd1_9', 'm10'], true), ['d1_9'])
  assert.deepEqual(fitReminders(['d0_9', 'd1_9'], false), ['d1_9'])
  assert.deepEqual(fitReminders(['x'], true), [])
})

test('칩을 누르면 넣고 다시 누르면 뺀다', () => {
  assert.deepEqual(toggleReminder([], 'd0_9'), ['d0_9'])
  assert.deepEqual(toggleReminder(['d0_9', 'd1_9'], 'd0_9'), ['d1_9'])
})

// 시간 지정 일정 표시·묶기
import { fmtTime } from './date.ts'
import { buildAgenda, schedulesOn } from './dday.ts'

test('시각은 오전/오후 12시간제로 보인다', () => {
  assert.equal(fmtTime('14:00'), '오후 2:00')
  assert.equal(fmtTime('00:30'), '오전 12:30')
  assert.equal(fmtTime('12:05'), '오후 12:05')
  assert.equal(fmtTime('23:50'), '오후 11:50')
  assert.equal(fmtTime(''), '')
  assert.equal(fmtTime(undefined), '')
})

test('00:30 KST 일정은 응답의 KST 날짜(+09:00) 로 그 날에 묶인다', () => {
  const s = { start_date: '2026-11-21T00:30:00+09:00', start_time: '00:30', is_dday: false, is_anniversary: false }
  assert.deepEqual(schedulesOn([s], '2026-11-21'), [s])
  assert.deepEqual(schedulesOn([s], '2026-11-20'), [])
  assert.deepEqual(buildAgenda([s], '2026-11-21').thisWeek, [s])
})
