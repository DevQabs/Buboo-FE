// 일정 주간 스트립 범위 검사. 실행: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripDays } from './date.ts'

test('처음엔 이번 주 일요일부터 다음 주 토요일까지 14일', () => {
  const d = stripDays('2026-11-17', '2026-11-17', 0) // 화요일
  assert.equal(d.length, 14)
  assert.equal(d[0], '2026-11-15')
  assert.equal(d[13], '2026-11-28')
})

test('더 불러오면 한 번에 2주씩 늘어난다', () => {
  const d = stripDays('2026-11-17', '2026-11-17', 2)
  assert.equal(d.length, 28)
  assert.equal(d.at(-1), '2026-12-12')
})

test('고른 날이 범위 밖이면 그 주까지 포함한다', () => {
  assert.equal(stripDays('2026-11-17', '2027-01-15', 0).at(-1), '2027-01-16')
  assert.equal(stripDays('2026-11-17', '2026-10-01', 0)[0], '2026-09-27')
})
