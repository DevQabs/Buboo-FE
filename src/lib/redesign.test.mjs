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

// ── Task 3: 일정 D-day ──
import { buildAgenda, ddayBadge } from './dday.ts'

const sch = (id, start, o = {}) => ({ id, start_date: `${start}T00:00:00Z`, is_dday: false, is_anniversary: false, ...o })

test('D-day 는 당일까지만, 기념일은 지나도 D+', () => {
  assert.equal(ddayBadge(sch('a', '2026-11-18', { is_dday: true }), '2026-11-17'), 'D-1')
  assert.equal(ddayBadge(sch('a', '2026-11-17', { is_dday: true }), '2026-11-17'), 'D-Day')
  assert.equal(ddayBadge(sch('a', '2026-11-16', { is_dday: true }), '2026-11-17'), null)
  assert.equal(ddayBadge(sch('b', '2025-10-01', { is_anniversary: true }), '2026-11-17'), 'D+412')
  assert.equal(ddayBadge(sch('c', '2026-11-20'), '2026-11-17'), null)
})

test('이번 주(토요일까지)·그 뒤·지난 기념일로 나눈다', () => {
  // 2026-11-17 은 화요일 → 이번 주는 11-21(토)까지. 여러 날 일정은 끝나는 날까지 남는다.
  const list = [
    sch('w', '2026-11-18'),
    sch('n', '2026-11-24'),
    sch('old', '2026-11-01'),
    sch('ann', '2025-10-01', { is_anniversary: true }),
    sch('multi', '2026-11-15', { end_date: '2026-11-17T00:00:00Z' }),
  ]
  const a = buildAgenda(list, '2026-11-17')
  assert.deepEqual(a.thisWeek.map(s => s.id), ['multi', 'w'])
  assert.deepEqual(a.later.map(s => s.id), ['n'])
  assert.deepEqual(a.anniversaries.map(s => s.id), ['ann'])
})

// ── Task 5: 자산현황 ──
import { allocation, ownerSplit } from './wealth.ts'

test('구성비: 주식·예적금·묶인 자산, 대출은 따로 빼서 순자산', () => {
  const assets = [
    { asset_type: '예/적금', is_liability: false, is_locked: false, value_krw: 77_000_000 },
    { asset_type: '부동산', is_liability: false, is_locked: true, value_krw: 63_000_000 },
    { asset_type: '대출', is_liability: true, is_locked: false, value_krw: 83_400_000 },
  ]
  const a = allocation(94_000_000, assets)
  assert.equal(a.gross, 234_000_000)
  assert.equal(a.liability, 83_400_000)
  assert.equal(a.net, 150_600_000)
  assert.deepEqual(a.slices.map(s => [s.key, Math.round(s.pct)]), [['stock', 40], ['liquid', 33], ['locked', 27]])
})

test('명의 분할은 둘 이상일 때만', () => {
  const names = { u1: { name: '남편' }, u2: { name: '아내' } }
  assert.equal(ownerSplit([{ user_id: 'u1', quantity: 300 }, { user_id: 'u2', quantity: 112 }], names), '412주 · 남편 300 아내 112')
  assert.equal(ownerSplit([{ user_id: 'u1', quantity: 98 }], names), '98주')
  assert.equal(ownerSplit([{ user_id: 'u1', quantity: 0.5 }, { user_id: 'u1', quantity: 1.25 }], names), '1.75주')
})

// ── Task 6: 로드맵 ──
import { aheadOfPlan, contributionFor, monthsBetween, nextMilestone, previewReachMonth, shiftContributions } from './roadmap.ts'

const pt = (month, v) => ({ month, projected_net_worth_krw: v })

test('다음 마일스톤은 지금 위 1억 단위, 계획선이 처음 닿는 달', () => {
  const months = [pt('2026-11', 235e6), pt('2027-02', 295e6), pt('2027-03', 301e6)]
  assert.deepEqual(nextMilestone(235e6, 500e6, months), { amount: 300e6, month: '2027-03' })
  assert.deepEqual(nextMilestone(480e6, 500e6, months), { amount: 500e6, month: null })
  assert.equal(nextMilestone(500e6, 500e6, months), null)
})

test('계획 대비 앞/뒤는 이번 달 계획선과 비교', () => {
  assert.equal(aheadOfPlan(238_200_000, [pt('2026-11', 235e6)], '2026-11'), 3_200_000)
  assert.equal(aheadOfPlan(1, [pt('2026-10', 1)], '2026-11'), null)
})

test('적립을 늘리면 도달 달이 당겨진다', () => {
  const base = {
    startMonth: '2026-10', netWorth: 0, target: 300, annualReturn: 0,
    contributions: [{ year: 2026, monthly_krw: 100 }, { year: 2027, monthly_krw: 100 }],
  }
  assert.equal(previewReachMonth({ ...base, delta: 0 }), '2027-01')
  assert.equal(previewReachMonth({ ...base, delta: 100 }), '2026-12')
  assert.equal(previewReachMonth({ ...base, contributions: [], delta: 0, maxMonths: 24 }), null)
  assert.equal(monthsBetween('2026-12', '2027-01'), 1)
  assert.deepEqual(shiftContributions([{ year: 2026, monthly_krw: 50 }], -100), [{ year: 2026, monthly_krw: 0 }])
  assert.equal(contributionFor([{ year: 2026, monthly_krw: 7 }, { year: 2027, monthly_krw: 9 }], 2027), 9)
  assert.equal(contributionFor([{ year: 2026, monthly_krw: 7 }], 2030), 7) // 그 해가 없으면 첫 해
})

test('이미 목표 이상이면 시작 달(달성), 마이너스 수익률은 못 닿을 수 있다', () => {
  const o = { startMonth: '2026-11', target: 300, contributions: [], delta: 0, maxMonths: 24 }
  assert.equal(previewReachMonth({ ...o, netWorth: 300, annualReturn: 0 }), '2026-11')
  assert.equal(previewReachMonth({ ...o, netWorth: 200, annualReturn: -0.1 }), null)
  assert.equal(previewReachMonth({ ...o, netWorth: 0, annualReturn: -0.1, contributions: [{ year: 2026, monthly_krw: 400 }] }), '2026-12')
})
