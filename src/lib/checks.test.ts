// 순수 함수 검사 (설계서 11절). 실행: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { levelOf, permissionSummary, visibleTabs } from './menus.ts'

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
