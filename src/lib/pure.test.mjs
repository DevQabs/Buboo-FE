// 순수 함수 검사. 실행: npm test
// node --test 가 .ts 를 타입만 지우고 바로 불러온다(Node 22.18+ / 23.6+).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getHolidaysForYear, getHolidaysForMonth } from './koreanHolidays.ts'
import { todayKST, ledgerPeriod, ledgerMonthOf } from './date.ts'
import { apiFetch, ApiError, latestOnly, ignoreAbort } from './api.ts'

// 2024~2026: 정부 발표 공휴일(임시공휴일·선거일 중 EXTRA 에 없는 날은 제외).
// 2027~2030: korean-lunar-calendar + 대체공휴일 규칙으로 낸 값. 발표가 나면 대조해 고친다.
const EXPECTED = {
  2024: ['01-01', '02-09', '02-10', '02-11', '02-12', '03-01', '05-05', '05-06', '05-15', '06-06', '08-15',
    '09-16', '09-17', '09-18', '10-03', '10-09', '12-25'],
  2025: ['01-01', '01-28', '01-29', '01-30', '03-01', '03-03', '05-05', '05-06', '06-06', '08-15',
    '10-03', '10-05', '10-06', '10-07', '10-08', '10-09', '12-25'],
  2026: ['01-01', '02-16', '02-17', '02-18', '03-01', '03-02', '05-01', '05-05', '05-24', '05-25', '06-03', '06-06',
    '08-15', '08-17', '09-24', '09-25', '09-26', '10-03', '10-05', '10-09', '12-25'],
  2027: ['01-01', '02-06', '02-07', '02-08', '02-09', '03-01', '05-05', '05-13', '06-06', '08-15', '08-16',
    '09-14', '09-15', '09-16', '10-03', '10-04', '10-09', '10-11', '12-25', '12-27'],
  2028: ['01-01', '01-26', '01-27', '01-28', '03-01', '05-02', '05-05', '06-06', '08-15',
    '10-02', '10-03', '10-04', '10-05', '10-06', '10-09', '12-25'],
  2029: ['01-01', '02-12', '02-13', '02-14', '03-01', '05-05', '05-07', '05-20', '05-21', '06-06', '08-15',
    '09-21', '09-22', '09-23', '09-24', '10-03', '10-09', '12-25'],
  2030: ['01-01', '02-02', '02-03', '02-04', '02-05', '03-01', '05-05', '05-06', '05-09', '06-06', '08-15',
    '09-11', '09-12', '09-13', '10-03', '10-09', '12-25'],
}

test('공휴일: 2024~2030 날짜 목록', () => {
  for (const [year, days] of Object.entries(EXPECTED)) {
    const got = Object.keys(getHolidaysForYear(Number(year))).sort()
    assert.deepEqual(got, days.map(d => `${year}-${d}`), `${year}년`)
  }
})

test('공휴일: 대체공휴일 규칙', () => {
  assert.equal(getHolidaysForYear(2027)['2027-02-09'], '대체공휴일') // 설날 2/7 일요일
  assert.equal(getHolidaysForYear(2026)['2026-09-28'], undefined)    // 추석 연휴 토요일은 대체 없음
  const y2025 = getHolidaysForYear(2025)
  assert.equal(y2025['2025-05-06'], '대체공휴일')                     // 어린이날·부처님오신날 같은 날 → 하루
  assert.equal(y2025['2025-05-07'], undefined)
  assert.equal(getHolidaysForYear(2027)['2027-12-27'], '대체공휴일') // 성탄절 토요일
})

test('공휴일: 월 조회는 그 달만', () => {
  assert.deepEqual(Object.keys(getHolidaysForMonth(2026, 3)), ['2026-03-01', '2026-03-02'])
})

test('todayKST: 한국 자정이 지나면 다음 날', () => {
  assert.equal(todayKST(new Date('2026-11-15T15:30:00Z')), '2026-11-16')
  assert.equal(todayKST(new Date('2026-11-15T14:59:00Z')), '2026-11-15')
})

test('ledgerPeriod: 시작일 1은 달력 월, 25는 전달 25일부터', () => {
  assert.deepEqual(ledgerPeriod(2026, 12, 1), { startDate: '2026-12-01', endDate: '2027-01-01' })
  assert.deepEqual(ledgerPeriod(2026, 1, 25), { startDate: '2025-12-25', endDate: '2026-01-25' })
  assert.deepEqual(ledgerPeriod(2026, 11, 25), { startDate: '2026-10-25', endDate: '2026-11-25' })
})

test('ledgerMonthOf: 시작일이 지나면 다음 달 기간, 오늘은 항상 그 기간 안', () => {
  assert.deepEqual(ledgerMonthOf('2026-11-16', 1), { year: 2026, month: 11 })
  assert.deepEqual(ledgerMonthOf('2026-11-24', 25), { year: 2026, month: 11 })
  assert.deepEqual(ledgerMonthOf('2026-11-25', 25), { year: 2026, month: 12 })
  assert.deepEqual(ledgerMonthOf('2026-12-25', 25), { year: 2027, month: 1 })
  for (const today of ['2026-01-01', '2026-01-24', '2026-01-25', '2026-12-31']) {
    const { year, month } = ledgerMonthOf(today, 25)
    const p = ledgerPeriod(year, month, 25)
    assert.ok(p.startDate <= today && today < p.endDate, today)
  }
})

test('apiFetch: 토큰을 붙이고 실패면 서버 문구로 ApiError', async (t) => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push([url, init])
    if (url.endsWith('/bad')) return new Response(JSON.stringify({ error: '매수 환율이 필요합니다' }), { status: 400 })
    if (url.endsWith('/empty')) return new Response(null, { status: 204 })
    return new Response(JSON.stringify({ ok: 1 }), { status: 200 })
  })
  assert.deepEqual(await apiFetch('/api/good', 'tok'), { ok: 1 })
  assert.equal(new Headers(calls[0][1].headers).get('Authorization'), 'Bearer tok')
  assert.equal(await apiFetch('/api/empty', 'tok'), undefined)
  await assert.rejects(apiFetch('/api/bad', 'tok'),
    (e) => e instanceof ApiError && e.status === 400 && e.message === '매수 환율이 필요합니다')
})

test('latestOnly: 새 요청이 직전 요청을 취소', () => {
  const next = latestOnly()
  const a = next()
  const b = next()
  assert.equal(a.aborted, true)
  assert.equal(b.aborted, false)
  assert.doesNotThrow(() => ignoreAbort(new DOMException('x', 'AbortError')))
  assert.throws(() => ignoreAbort(new Error('boom')))
})
