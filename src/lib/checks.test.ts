// 순수 함수 검사 (설계서 11절). 실행: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { levelOf, permissionSummary, visibleTabs } from './menus.ts'
import {
  clampTrimStart, daysSinceBirth, fitWithin, formatBytes, formatClock, usageLevel,
} from './mediaRules.ts'
import { GROWTH_STANDARD, ageInMonths, bandLabel, latestDelta, standardAt } from './growthStandard.ts'

test('권한을 못 받았으면 아무 탭도 없다', () => {
  assert.deepEqual(visibleTabs(null), [])
  assert.equal(levelOf(null, 'ledger'), 'hidden')
})

test('owner 는 4탭 전부, 칩도 전부', () => {
  const tabs = visibleTabs({ is_owner: true, menus: {} })
  assert.deepEqual(tabs.map(t => t.key), ['baby', 'ledger', 'life', 'wealth'])
  assert.equal(tabs[2].subs.length, 2)
  assert.equal(levelOf({ is_owner: true, menus: {} }, 'roadmap'), 'edit')
})

test('조부모 묶음은 아기 탭 하나 → 탭바를 숨길 수 있다', () => {
  const tabs = visibleTabs({ is_owner: false, menus: { baby_photo: 'edit', baby_growth: 'edit' } })
  assert.deepEqual(tabs.map(t => t.key), ['baby'])
  assert.deepEqual(tabs[0].subs.map(s => s.key), ['baby_photo', 'baby_growth'])
})

test('일정만 보기면 일상 탭에 칩 하나 → 칩 줄을 숨길 수 있다', () => {
  const tabs = visibleTabs({ is_owner: false, menus: { schedule: 'view', diary: 'hidden' } })
  assert.deepEqual(tabs.map(t => t.key), ['life'])
  assert.deepEqual(tabs[0].subs.map(s => s.key), ['schedule'])
})

test('권한 요약 문구', () => {
  assert.equal(permissionSummary({ is_owner: true, menus: {} }), '관리자 · 전체')
  const all = { baby_photo: 'edit', baby_growth: 'edit', ledger: 'edit', schedule: 'edit', diary: 'edit', assets: 'edit', roadmap: 'edit' } as const
  assert.equal(permissionSummary({ is_owner: false, menus: all }), '전체 편집')
  assert.equal(permissionSummary({ is_owner: false, menus: {} }), '권한 없음')
  assert.equal(
    permissionSummary({ is_owner: false, menus: { baby_photo: 'edit', baby_growth: 'edit', schedule: 'view' } }),
    '사진일기·성장 편집, 일정 보기',
  )
})

test('사진은 긴 변 2048px 로 줄이고 작은 건 그대로', () => {
  assert.deepEqual(fitWithin(4032, 3024, 2048), { width: 2048, height: 1536 })
  assert.deepEqual(fitWithin(3024, 4032, 2048), { width: 1536, height: 2048 })
  assert.deepEqual(fitWithin(800, 600, 2048), { width: 800, height: 600 })
})

test('자르기 시작점은 0 ~ (길이-30초)', () => {
  assert.equal(clampTrimStart(-5, 50), 0)
  assert.equal(clampTrimStart(25, 50), 20)
  assert.equal(clampTrimStart(10, 50), 10)
  assert.equal(clampTrimStart(10, 20), 0)
})

test('생후 일수 — 시안: 10월 5일생, 11월 16일은 생후 42일', () => {
  assert.equal(daysSinceBirth('2026-10-05', '2026-11-16'), 42)
  assert.equal(daysSinceBirth('2026-10-05', '2026-10-05'), 0)
})

test('용량·시간 표시', () => {
  assert.equal(formatBytes(8_100_000_000), '8.1GB')
  assert.equal(formatBytes(52_400_000), '52.4MB')
  assert.equal(formatClock(65.4), '1:05')
  assert.equal(formatClock(0), '0:00')
})

test('저장 공간 단계', () => {
  assert.equal(usageLevel(7_000_000_000, 8_000_000_000, 9_500_000_000), 'ok')
  assert.equal(usageLevel(8_000_000_000, 8_000_000_000, 9_500_000_000), 'warn')
  assert.equal(usageLevel(9_500_000_000, 8_000_000_000, 9_500_000_000), 'full')
})

test('성장 표준표: 0개월부터 1개월 간격, 3 < 50 < 97, 50백분위는 줄지 않는다', () => {
  for (const sex of ['male', 'female'] as const) {
    for (const metric of ['height', 'weight', 'head'] as const) {
      const rows = GROWTH_STANDARD[sex][metric]
      assert.ok(rows.length >= 36, `${sex} ${metric}: 0~35개월 이상`)
      rows.forEach(([m, p3, p50, p97], i) => {
        assert.equal(m, i, `${sex} ${metric}: ${i}번째 행은 ${i}개월`)
        assert.ok(p3 < p50 && p50 < p97, `${sex} ${metric} ${m}개월: 백분위 순서`)
        if (i > 0) assert.ok(p50 >= rows[i - 1][2], `${sex} ${metric} ${m}개월: 50백분위 감소`)
      })
    }
  }
})

test('월령과 표준값 보간', () => {
  assert.ok(Math.abs(ageInMonths('2026-10-05', '2026-11-16') - 42 / 30.4375) < 1e-9)
  const rows = GROWTH_STANDARD.male.weight
  const a = rows[2]
  const b = rows[3]
  assert.deepEqual(standardAt('male', 'weight', 2), { p3: a[1], p50: a[2], p97: a[3] })
  const mid = standardAt('male', 'weight', 2.5)
  assert.ok(mid && Math.abs(mid.p50 - (a[2] + b[2]) / 2) < 1e-9)
  assert.equal(standardAt('male', 'weight', -1), null)
  assert.equal(standardAt('male', 'weight', rows[rows.length - 1][0] + 1), null)
})

test('백분위 구간 표시', () => {
  const s = { p3: 3, p50: 5, p97: 7 }
  assert.equal(bandLabel(2.9, s), '3% 미만')
  assert.equal(bandLabel(4, s), '3~50%')
  assert.equal(bandLabel(5, s), '50~97%')
  assert.equal(bandLabel(7, s), '50~97%')
  assert.equal(bandLabel(7.1, s), '97% 초과')
})

test('최근 값과 직전 대비 증감(빈 값은 건너뜀)', () => {
  const rows = [
    { measured_on: '2026-10-05', w: 3.2 as number | null },
    { measured_on: '2026-11-01', w: null },
    { measured_on: '2026-11-16', w: 4.8 },
  ]
  assert.deepEqual(latestDelta(rows, r => r.w), { value: 4.8, delta: 4.8 - 3.2 })
  assert.deepEqual(latestDelta(rows.slice(0, 1), r => r.w), { value: 3.2, delta: null })
  assert.equal(latestDelta([] as typeof rows, r => r.w), null)
})
