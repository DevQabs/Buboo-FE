// 순수 함수 검사 (설계서 11절). 실행: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { levelOf, permissionSummary, visibleTabs } from './menus.ts'
import {
  clampTrimStart, daysSinceBirth, fitWithin, formatBytes, formatClock, usageLevel,
} from './mediaRules.ts'

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
