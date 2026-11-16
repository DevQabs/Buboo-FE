// 가계부 빠른 입력 바의 순수 함수 검사. 실행: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatAmountInput, parseAmount } from './formatNumber.ts'
import { sortCategoriesByUse, readPayMethod, applySummaryDelta, categoryColor, CATEGORY_PALETTE } from './ledger.ts'

test('금액 입력: 숫자만 남기고 천 단위 쉼표, 다시 읽으면 원 금액', () => {
  assert.equal(formatAmountInput('12000'), '12,000')
  assert.equal(formatAmountInput('1,2a3-4'), '1,234')
  assert.equal(formatAmountInput('0012'), '12')
  assert.equal(formatAmountInput(''), '')
  assert.equal(parseAmount('1,234,567'), 1_234_567)
  assert.equal(parseAmount(''), 0)
  assert.equal(parseAmount('abc'), 0)
})

test('미리 고르는 카테고리는 가장 많이 쓴 지출 카테고리, 기록이 없으면 목록 첫 칸', () => {
  const cats = ['식비', '카페', '교통', '기타']
  const txs = [
    { type: 'expense', category: '교통' }, { type: 'expense', category: '교통' },
    { type: 'expense', category: '카페' }, { type: 'income', category: '식비' },
    { type: 'income', category: '식비' }, { type: 'income', category: '식비' },
  ]
  assert.equal(sortCategoriesByUse(cats, txs, 'expense')[0], '교통')
  assert.equal(sortCategoriesByUse(cats, [], 'expense')[0], '식비')
  assert.equal(sortCategoriesByUse(cats, [{ type: 'expense', category: '기타' }], 'expense')[0], '식비')
})

test('저장된 결제수단: N페이만 인정, 없거나 이상한 값은 카드', () => {
  assert.equal(readPayMethod('N페이'), 'N페이')
  assert.equal(readPayMethod('카드'), '카드')
  assert.equal(readPayMethod(null), '카드')
  assert.equal(readPayMethod(undefined), '카드')
  assert.equal(readPayMethod('현금'), '카드')
})

test('요약 낙관 반영: 그 거래 금액만 더하고 빼며, 다른 거래의 반영은 건드리지 않는다', () => {
  const base = { total_income: 100, total_expense: 50, balance: 50, other: 1 }
  const a = applySummaryDelta(base, 'expense', 30)
  assert.deepEqual(a, { total_income: 100, total_expense: 80, balance: 20, other: 1 })
  const b = applySummaryDelta(a, 'income', 10)
  // a 실패 되돌리기: b 의 수입 반영은 남는다(스냅샷 복원이면 사라진다)
  assert.deepEqual(applySummaryDelta(b, 'expense', -30), { total_income: 110, total_expense: 50, balance: 60, other: 1 })
  assert.equal(applySummaryDelta(null, 'expense', 30), null)
})

test('카테고리 색: 정해진 이름은 고정 색, 모르는 이름은 늘 같은 팔레트 색', () => {
  assert.equal(categoryColor('식비'), 'rose')
  assert.equal(categoryColor('카페'), 'amber')
  assert.equal(categoryColor('생활'), 'emerald')
  assert.equal(categoryColor('교통'), 'teal')
  assert.equal(categoryColor('쇼핑'), 'violet')
  assert.equal(categoryColor('육아'), 'orange')
  assert.equal(categoryColor('의료'), 'lime')
  assert.equal(categoryColor('기타'), 'stone')
  for (const name of ['반려동물', '경조사', '용돈', '', 'abc']) {
    assert.equal(categoryColor(name), categoryColor(name))
    assert.ok(CATEGORY_PALETTE.includes(categoryColor(name)), name)
  }
  assert.ok(!CATEGORY_PALETTE.includes('indigo') && !CATEGORY_PALETTE.includes('blue'))
})
