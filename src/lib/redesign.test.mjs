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

// ── Task 2: 가계부 ──
import { categoryBreakdown, dailyAllowance, fixedSpendingTotal, groupByDate, sortCategoriesByUse, upcomingEvents } from './ledger.ts'

test('하루 쓸 돈 = 남은 예산 ÷ 남은 일수, 100원 아래 버림', () => {
  assert.deepEqual(dailyAllowance(2_000_000, 970_000, 14), { remaining: 1_030_000, perDay: 73_500 })
  assert.deepEqual(dailyAllowance(1_000_000, 1_200_000, 10), { remaining: -200_000, perDay: 0 })
  assert.deepEqual(dailyAllowance(1_000_000, 0, 0), { remaining: 1_000_000, perDay: 0 })
})

test('곧 나갈 돈은 오늘 포함 이후만, 날짜순', () => {
  const ev = [
    { date: '2026-11-25', type: 'fixed_expense', title: '대출이자', amount: 280_000 },
    { date: '2026-11-10', type: 'fixed_expense', title: '통신', amount: 50_000 },
    { date: '2026-11-18', type: 'dividend', title: 'SCHD', amount: 41_000 },
  ]
  assert.deepEqual(upcomingEvents(ev, '2026-11-18').map(e => e.title), ['SCHD', '대출이자'])
})

test('내역은 한국 날짜로 묶고 최근 날짜·최근 거래가 먼저', () => {
  const tx = (id, date, type, amount) => ({ id, date, type, amount })
  const g = groupByDate([
    tx('a', '2026-11-16T03:00:00Z', 'expense', 1000),
    tx('b', '2026-11-16T15:30:00Z', 'expense', 500), // 한국 11-17 00:30
    tx('c', '2026-11-16T05:00:00Z', 'income', 3000),
  ])
  assert.deepEqual(g.map(d => d.date), ['2026-11-17', '2026-11-16'])
  assert.equal(g[1].net, 2000)
  assert.deepEqual(g[1].items.map(t => t.id), ['c', 'a'])
})

test('카테고리는 많이 쓴 순, 기타는 맨 뒤', () => {
  const txs = [{ type: 'expense', category: '카페' }, { type: 'expense', category: '카페' }, { type: 'expense', category: '식비' }]
  assert.deepEqual(sortCategoriesByUse(['식비', '카페', '기타', '교통'], txs, 'expense'), ['카페', '식비', '교통', '기타'])
})

test('고정비 합계와 카테고리 집계는 SummaryCard 식 그대로', () => {
  const fe = [
    { is_active: true, kind: 'spending', amount: 210_000, category: '주거' },
    { is_active: false, kind: 'spending', amount: 9, category: 'x' },
    { is_active: true, kind: 'saving', amount: 7, category: 'y' },
  ]
  assert.equal(fixedSpendingTotal(fe), 210_000)
  const txs = [
    { type: 'expense', category: '식비', amount: 5000 },
    { type: 'expense', category: '주거', amount: 1000, fixed_expense_id: 'f' }, // 고정비로 생긴 거래는 뺀다
  ]
  assert.deepEqual(categoryBreakdown(txs, fe), [
    { category: '주거', amount: 210_000, isFixed: true },
    { category: '식비', amount: 5000, isFixed: false },
  ])
})
