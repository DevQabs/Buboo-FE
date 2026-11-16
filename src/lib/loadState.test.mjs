// 카드별 불러오기 상태 검사. 실행: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepLoad, sectionView, mergeViews } from './loadState.ts'

const run = evs => evs.reduce(stepLoad, undefined)

test('처음 받는 중이면 spinner, 받으면 content', () => {
  assert.equal(sectionView(undefined), 'spinner')
  assert.equal(sectionView(run(['start'])), 'spinner')
  assert.equal(sectionView(run(['start', 'ok'])), 'content')
})

test('처음 받기에 실패하면 error, 다시 시도 중엔 spinner', () => {
  assert.equal(sectionView(run(['start', 'error'])), 'error')
  assert.equal(sectionView(run(['start', 'error', 'start'])), 'spinner')
})

test('받은 뒤 새로고침은 화면을 가리지 않는다(실패해도 데이터를 둔다)', () => {
  assert.equal(sectionView(run(['start', 'ok', 'start'])), 'refreshing')
  assert.equal(sectionView(run(['start', 'ok', 'start', 'error'])), 'content')
})

test('겹친 요청은 모두 끝나야 끝난다. 취소는 오류가 아니다', () => {
  assert.equal(sectionView(run(['start', 'ok', 'start', 'start', 'ok'])), 'refreshing')
  assert.equal(sectionView(run(['start', 'start', 'abort', 'ok'])), 'content')
  assert.equal(sectionView(run(['start', 'abort'])), 'spinner')
  assert.equal(run(['ok', 'ok']).pending, 0)
})

test('여러 데이터를 쓰는 카드는 가장 나쁜 상태', () => {
  assert.equal(mergeViews('content', 'refreshing'), 'refreshing')
  assert.equal(mergeViews('refreshing', 'spinner'), 'spinner')
  assert.equal(mergeViews('spinner', 'error', 'content'), 'error')
  assert.equal(mergeViews(), 'content')
})
