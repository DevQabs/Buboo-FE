// 날짜별 내역 (시안 ledger-a "오늘 · -50,400" 아래 카드). 행을 누르면 그날 달력 상세로 간다(수정·삭제).
import { Card, SectionLabel } from '@/components/ui/Card'
import { addDays, todayKST, weekdayOf } from '@/lib/date'
import { categoryColor, feedGroups } from '@/lib/ledger'
import { CAT_CLASS } from './QuickEntryBar'
import type { Transaction, User } from '@/types'

const WD = ['일', '월', '화', '수', '목', '금', '토']

function dayLabel(date: string, today: string): string {
  if (date === today) return '오늘'
  if (date === addDays(today, -1)) return '어제'
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일 (${WD[weekdayOf(date)]})`
}

export default function LedgerFeed({ transactions, users, onSelectDate }: {
  transactions: Transaction[]
  users: User[]
  onSelectDate: (date: string) => void
}) {
  const today = todayKST()
  const groups = feedGroups(transactions, today)
  const userMap = Object.fromEntries(users.map(u => [u.id, u]))

  if (groups.length === 0) {
    return <Card className="px-4 py-8 text-center text-sm text-stone-400">이 기간 내역이 아직 없어요</Card>
  }
  return (
    <div className="space-y-2">
      {groups.map(g => (
        <section key={g.date} className="space-y-1">
          <SectionLabel>{dayLabel(g.date, today)} · {g.net > 0 ? '+' : ''}{g.net.toLocaleString('ko-KR')}</SectionLabel>
          <Card className="px-3 py-1">
            {g.items.map(tx => (
              <button key={tx.id} type="button" onClick={() => onSelectDate(g.date)} className="flex w-full items-center gap-2.5 py-2 text-left">
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${CAT_CLASS[categoryColor(tx.category || '기타')].dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-stone-800">{tx.title || tx.category}</span>
                  <span className="block truncate text-xs text-stone-400">
                    {[tx.category || '기타', tx.type === 'expense' && tx.payment_method].filter(Boolean).join(' · ')}{userMap[tx.user_id] ? ` · ${userMap[tx.user_id].name}` : ''}{tx.fixed_expense_id ? ' · 고정비' : ''}
                  </span>
                </span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${
                  tx.type === 'income' ? 'text-emerald-600' : tx.type === 'expense' ? 'text-rose-500' : 'text-brand-500'
                }`}>
                  {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{tx.amount.toLocaleString('ko-KR')}
                </span>
              </button>
            ))}
          </Card>
        </section>
      ))}
    </div>
  )
}
