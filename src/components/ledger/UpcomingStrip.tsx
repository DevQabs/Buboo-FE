// 곧 나갈 돈(고정비)·들어올 돈(배당) 가로 타임라인 (시안 ledger-a 둘째 카드)
import { Card } from '@/components/ui/Card'
import { formatMan } from '@/lib/formatNumber'
import type { CalendarEvent } from '@/types'

export default function UpcomingStrip({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null
  const out = events.filter(e => e.type === 'fixed_expense')
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-stone-800">곧 나갈 돈 · 들어올 돈</p>
        {out.length > 0 && (
          <p className="text-xs text-stone-400">고정비 {out.length}건 · {formatMan(out.reduce((s, e) => s + e.amount, 0))}</p>
        )}
      </div>
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
        {events.map((e, i) => {
          const income = e.type === 'dividend'
          return (
            <div key={`${e.date}-${e.title}-${i}`} className={`shrink-0 rounded-2xl px-3 py-2 text-xs ${income ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <p className="font-bold text-stone-700">{Number(e.date.slice(8))}일</p>
              <p className="max-w-[6rem] truncate text-stone-600">{e.title}</p>
              <p className={`font-semibold tabular-nums ${income ? 'text-emerald-600' : 'text-stone-700'}`}>
                {income ? '+' : ''}{formatMan(e.amount)}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
