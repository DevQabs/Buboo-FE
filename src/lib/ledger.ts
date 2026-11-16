// 가계부 화면 계산(설계서 7절 가계부 A). 런타임 import 없음 — node --test 가 바로 읽는다.
import type { CalendarEvent, FixedExpense, Transaction } from '@/types'

/** 하루 쓸 수 있는 돈 = 남은 예산 ÷ 남은 일수, 100원 아래 버림. 예산이 바닥이거나 남은 날이 없으면 0. */
export function dailyAllowance(budget: number, spent: number, daysLeft: number): { remaining: number; perDay: number } {
  const remaining = budget - spent
  const perDay = daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft / 100) * 100 : 0
  return { remaining, perDay }
}

/** 활성 지출 고정비 합계. 옛 SummaryCard 의 fixedExpenseTotal 과 같은 식. */
export function fixedSpendingTotal(list: Pick<FixedExpense, 'is_active' | 'kind' | 'amount'>[]): number {
  return list.filter(fe => fe.is_active && fe.kind === 'spending').reduce((s, fe) => s + fe.amount, 0)
}

/** 가계부 기간 [startDate, endDate) 안에서 오늘(포함) 이후의 고정비·배당 일정, 날짜순. */
export function upcomingEvents(events: CalendarEvent[], today: string, startDate: string, endDate: string): CalendarEvent[] {
  const from = today > startDate ? today : startDate
  return events.filter(e => e.date >= from && e.date < endDate).sort((a, b) => a.date.localeCompare(b.date))
}

export interface DayGroup { date: string; items: Transaction[]; net: number }

// 거래 시각을 한국 날짜로. date.ts 의 todayKST 와 같은 식(런타임 import 를 피하려고 한 줄 둔다).
const kstDate = (iso: string) => new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10)

/** 내역 피드용: 오늘 이전(오늘 포함) 거래만 날짜별로. 미래 예정 거래는 "곧 나갈/들어올 돈"에서 보이므로 뺀다. */
export function feedGroups(txs: Transaction[], today: string): DayGroup[] {
  return groupByDate(txs.filter(tx => kstDate(tx.date) <= today))
}

/** 한국 날짜별로 묶는다. 최근 날짜가 먼저, 하루 안에서도 최근 거래가 먼저. net = 수입 − 지출(저축 제외). */
export function groupByDate(txs: Transaction[]): DayGroup[] {
  const map = new Map<string, Transaction[]>()
  for (const tx of txs) {
    const d = kstDate(tx.date)
    map.set(d, [...(map.get(d) ?? []), tx])
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
      net: items.reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0),
    }))
}

/** 그 종류 거래에서 많이 쓴 카테고리부터. 기타는 맨 뒤(NaverPayCard 정렬에서 옮김). */
export function sortCategoriesByUse(
  categories: string[],
  txs: Pick<Transaction, 'type' | 'category'>[],
  type: 'expense' | 'income',
): string[] {
  const counts: Record<string, number> = {}
  for (const tx of txs) if (tx.type === type && tx.category) counts[tx.category] = (counts[tx.category] ?? 0) + 1
  const others = categories.filter(c => c !== '기타').sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
  return categories.includes('기타') ? [...others, '기타'] : others
}

export interface CategoryItem { category: string; amount: number; isFixed: boolean }

/** 카테고리별 지출. 옛 DashboardClient 의 categoryBreakdown 식을 그대로 옮겼다. */
export function categoryBreakdown(txs: Transaction[], fixed: FixedExpense[]): CategoryItem[] {
  const map = new Map<string, { amount: number; isFixed: boolean }>()
  for (const tx of txs) {
    if (tx.type === 'expense' && !tx.fixed_expense_id) {
      const cat = tx.category || '기타'
      const prev = map.get(cat)
      map.set(cat, { amount: (prev?.amount ?? 0) + tx.amount, isFixed: false })
    }
  }
  for (const fe of fixed) {
    if (fe.is_active && fe.kind === 'spending') {
      const cat = fe.category || '고정비'
      const prev = map.get(cat)
      map.set(cat, { amount: (prev?.amount ?? 0) + fe.amount, isFixed: prev?.isFixed ?? true })
    }
  }
  return Array.from(map.entries())
    .map(([category, v]) => ({ category, amount: v.amount, isFixed: v.isFixed }))
    .sort((a, b) => b.amount - a.amount)
}

export type PayMethod = '카드' | 'N페이'
export const PAY_METHOD_KEY = 'uri-jip.quickEntry.payment'
/** 저장된 결제수단 값을 읽는다. 없거나 모르는 값이면 카드 */
export function readPayMethod(raw: string | null | undefined): PayMethod {
  return raw === 'N페이' ? 'N페이' : '카드'
}

type SummaryTotals = { total_income: number; total_expense: number; balance: number }

/** 요약에 거래 하나의 금액을 더한다(되돌릴 때는 음수). 실패한 거래만 빼야 다른 저장의 반영이 살아남는다. */
export function applySummaryDelta<S extends SummaryTotals>(s: S | null, type: 'expense' | 'income', amount: number): S | null {
  if (!s) return s
  return {
    ...s,
    total_income: type === 'income' ? s.total_income + amount : s.total_income,
    total_expense: type === 'expense' ? s.total_expense + amount : s.total_expense,
    balance: s.balance + (type === 'income' ? amount : -amount),
  }
}

// 카테고리 색: 정해진 이름은 고정 색, 나머지는 이름을 해시해 팔레트 안에서 늘 같은 색
export const CATEGORY_PALETTE = ['rose', 'amber', 'emerald', 'teal', 'violet', 'orange', 'lime', 'stone', 'brand'] as const
export type CategoryColor = (typeof CATEGORY_PALETTE)[number]
const KNOWN_CATEGORY_COLOR: Record<string, CategoryColor> = {
  식비: 'rose', 카페: 'amber', 생활: 'emerald', 교통: 'teal', 쇼핑: 'violet', 육아: 'orange', 의료: 'lime', 기타: 'stone',
}

export function categoryColor(name: string): CategoryColor {
  if (Object.hasOwn(KNOWN_CATEGORY_COLOR, name)) return KNOWN_CATEGORY_COLOR[name]
  let h = 0
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length]
}

/** 내용을 비우고 저장할 때 넣는 기본 내용(N페이 결제). 자주 쓴 내용에서는 뺀다. */
export const NAVER_PAY_TITLE = '네이버페이 결제'

/**
 * 자주 쓴 내용(거래 title). 많이 쓴 것부터, 같으면 최근에 쓴 것부터.
 * 빈 내용·기본 내용은 뺀다. category 는 그 내용으로 가장 최근에 고른 카테고리.
 */
export function recentTitles(
  txs: Pick<Transaction, 'type' | 'title' | 'category' | 'date'>[],
  { limit = 8, type = 'expense' }: { limit?: number; type?: 'expense' | 'income' } = {},
): { title: string; category: string }[] {
  const map = new Map<string, { count: number; last: number; category: string }>()
  for (const tx of txs) {
    const title = tx.title?.trim()
    if (tx.type !== type || !title || title === NAVER_PAY_TITLE) continue
    const at = Date.parse(tx.date) || 0
    const prev = map.get(title)
    if (!prev) map.set(title, { count: 1, last: at, category: tx.category })
    else {
      prev.count++
      if (at >= prev.last) { prev.last = at; prev.category = tx.category }
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)
    .slice(0, limit)
    .map(([title, v]) => ({ title, category: v.category }))
}
