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
