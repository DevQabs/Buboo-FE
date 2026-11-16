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
  // --nav-h 는 safe area 를 이미 포함한 실제 탭 높이다(DashboardClient 가 재서 넣는다) — 더하면 두 번 센다
  ['--nav-h 에 safe area 이중 합산', /var\(--nav-h\)\s*\+\s*env\(safe-area/],
  // pointerdown 을 막고 onClick 에 동작을 걸면 누르는 사이 바가 움직일 때 click 이 사라진다 — keepFocusTap(QuickEntryBar) 꼴로
  ['onPointerDown 에서 preventDefault/keepFocus', /onPointerDown=\{[^}]*(?:keepFocus\b|preventDefault)/],
]

// 백엔드 호출은 apiFetch 를 거친다(토큰·res.ok·서버 오류 문구). 직접 fetch 는 아래 파일만:
// api.ts(apiFetch 자체), backendAuth.ts·auth.ts(서버 쪽 로그인), app/api/**(Next 라우트 핸들러),
// media.ts(R2 presigned PUT/GET — 우리 토큰을 붙이면 안 된다, XHR 업로드 포함).
const RAW_FETCH = /(?<![\w.])fetch\(/
const FETCH_ALLOWED = [/^lib\/api\.ts$/, /^lib\/backendAuth\.ts$/, /^auth\.ts$/, /^app\/api\//, /^lib\/media\.ts$/]
// 같은 출처 Next 라우트(app/api/account/*)는 세션 쿠키로 가서 백엔드 apiFetch 대상이 아니다
const SAME_ORIGIN_ROUTE = /fetch\('\/api\/account\//

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

test('백엔드 호출에 직접 fetch 를 쓰지 않는다', () => {
  const hits = []
  for (const f of files) {
    if (FETCH_ALLOWED.some(re => re.test(f))) continue
    readFileSync(join(SRC, f), 'utf8').split('\n').forEach((line, i) => {
      if (RAW_FETCH.test(line) && !SAME_ORIGIN_ROUTE.test(line)) hits.push(`${f}:${i + 1}`)
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
  assert.ok(RULES[4][1].test("pb-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+1rem)]"))
  assert.ok(!RULES[4][1].test("bottom-[calc(var(--nav-h)+0.75rem)]"))
  assert.ok(RULES[5][1].test('<button onPointerDown={keepFocus} onClick={f}>'))
  assert.ok(RULES[5][1].test('onPointerDown={e => e.preventDefault()}'))
  assert.ok(!RULES[5][1].test('{...keepFocusTap(() => f())}'))
  assert.ok(RAW_FETCH.test("fetch(`${API_BASE}/x`)"))
  assert.ok(!RAW_FETCH.test("apiFetch('/x', t)"))
  assert.ok(!RAW_FETCH.test('refetch()'))
  assert.ok(SAME_ORIGIN_ROUTE.test("await fetch('/api/account/join', {"))
})
