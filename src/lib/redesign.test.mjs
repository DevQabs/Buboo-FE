// 4단계 화면 재설계 순수 함수 검사. 실행: npm test
// Task 2~6 이 이 파일 아래에 블록을 이어 붙인다(import 는 블록마다 둔다 — ESM 은 최상위 어디서든 허용).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, daysBetween, daysLeftInPeriod, weekdayOf } from './date.ts'
import { formatMan } from './formatNumber.ts'

test('날짜 더하기·빼기는 달과 해를 넘는다', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01')
  assert.equal(addDays('2027-01-01', -1), '2026-12-31')
  assert.equal(daysBetween('2026-11-17', '2026-12-01'), 14)
  assert.equal(weekdayOf('2026-11-16'), 1) // 월요일
  assert.equal(weekdayOf('2026-11-22'), 0) // 일요일
})

test('가계부 기간에서 오늘 포함 남은 일수', () => {
  assert.equal(daysLeftInPeriod('2026-11-17', '2026-11-01', '2026-12-01'), 14)
  assert.equal(daysLeftInPeriod('2026-10-20', '2026-11-01', '2026-12-01'), 30) // 기간 전
  assert.equal(daysLeftInPeriod('2026-12-01', '2026-11-01', '2026-12-01'), 0)  // 기간 끝
})

test('금액 짧게 쓰기', () => {
  assert.equal(formatMan(235_000_000), '2.35억')
  assert.equal(formatMan(300_000_000), '3억')
  assert.equal(formatMan(1_030_000), '103만')
  assert.equal(formatMan(-83_400_000), '-8,340만')
  assert.equal(formatMan(9_800), '9,800원')
})
