// 소스 규칙 기계 검사: 금지 클래스(text-[11px], indigo-/blue- 색)와 이모지가 src 에 들어오면 실패한다. 실행: npm test
// 'indigo' 같은 저장된 색 키(데이터)는 클래스 꼴이 아니라 걸리지 않는다.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('..', import.meta.url).pathname
const RULES = [
  ['text-[11px]', /text-\[11px\]/],
  ['indigo/blue 색 클래스', /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|accent|shadow|decoration)-(?:indigo|blue)-/],
  ['작은 버튼(h-5~8 w-5~8)에 before:-inset 없음', /^(?!.*before:-inset).*<button[^>]*\b(?:h-[5-8] w-[5-8]|w-[5-8] h-[5-8])\b/],
  ['이모지', /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u],
]

const files = readdirSync(SRC, { recursive: true }).filter(f => /\.(ts|tsx)$/.test(f))

test('src 에 금지 클래스·이모지가 없다', () => {
  const hits = []
  for (const f of files) {
    readFileSync(join(SRC, f), 'utf8').split('\n').forEach((line, i) => {
      for (const [name, re] of RULES) if (re.test(line)) hits.push(`${f}:${i + 1} ${name}`)
    })
  }
  assert.deepEqual(hits, [])
})

test('검사 패턴은 클래스는 잡고 색 키 데이터는 통과시킨다', () => {
  assert.ok(RULES[1][1].test('className="bg-indigo-500"'))
  assert.ok(RULES[1][1].test('hover:text-blue-600'))
  assert.ok(RULES[2][1].test('<button className="w-6 h-6 rounded">'))
  assert.ok(!RULES[2][1].test("<button className=\"before:-inset-2 w-6 h-6\">"))
  assert.ok(!RULES[1][1].test("const c = 'indigo'"))
  assert.ok(RULES[3][1].test('★'))
})
