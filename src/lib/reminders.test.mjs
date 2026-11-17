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
