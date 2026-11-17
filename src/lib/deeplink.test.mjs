// 알림 딥링크(?tab=&menu=) 검사. 실행: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickDeepLink, visibleTabs } from './menus.ts'

const q = (s) => new URLSearchParams(s)
const owner = { is_owner: true, menus: {} }
const grand = { is_owner: false, menus: { baby_photo: 'edit', baby_growth: 'edit' } }

test('알림 딥링크는 보이는 탭과 메뉴를 고른다', () => {
  assert.deepEqual(pickDeepLink(visibleTabs(owner), q('?tab=life&menu=schedule')), { tab: 'life', sub: 'schedule' })
  assert.deepEqual(pickDeepLink(visibleTabs(grand), q('?tab=baby&menu=baby_photo')), { tab: 'baby', sub: 'baby_photo' })
})

test('볼 수 없는 탭이나 쿼리 없음은 null, 모르는 메뉴는 그 탭 첫 메뉴', () => {
  assert.equal(pickDeepLink(visibleTabs(grand), q('?tab=life&menu=schedule')), null)
  assert.equal(pickDeepLink(visibleTabs(owner), q('?screen=ledger')), null)
  assert.deepEqual(pickDeepLink(visibleTabs(owner), q('?tab=life&menu=nope')), { tab: 'life', sub: 'schedule' })
})
