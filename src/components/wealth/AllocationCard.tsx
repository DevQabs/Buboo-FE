'use client'

// 구성비 도넛 + 대출 (시안 wealth-b 첫 카드). 순자산은 눌러야 보인다(옛 NetWorthSummaryCard 동작).
// 도넛은 recharts 대신 CSS conic-gradient — 조각 셋이면 충분하다.
import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { formatMan } from '@/lib/formatNumber'
import { allocation } from '@/lib/wealth'
import type { OtherAsset, PortfolioSummary } from '@/types'

export default function AllocationCard({ portfolioSummary, otherAssets }: {
  portfolioSummary: PortfolioSummary | null
  otherAssets: OtherAsset[]
}) {
  const [show, setShow] = useState(false)
  const a = allocation(portfolioSummary?.total_value_krw ?? 0, otherAssets)
  const visible = a.slices.filter(s => s.value > 0)
  let acc = 0
  const stops = visible.map(s => {
    const from = acc
    acc += s.pct
    return `${s.color} ${from}% ${acc}%`
  })
  const background = visible.length > 0 ? `conic-gradient(${stops.join(', ')})` : '#F5EFE6'

  return (
    <Card className="flex items-center gap-4 p-4">
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        aria-label={show ? '순자산 가리기' : '순자산 보기'}
        className="relative h-24 w-24 shrink-0 rounded-full"
        style={{ background }}
      >
        <span className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-[10px] text-stone-400">순자산</span>
          <span className={`text-sm font-black tabular-nums ${a.net < 0 ? 'text-rose-500' : 'text-stone-800'}`}>
            {show ? formatMan(a.net) : '••••'}
          </span>
        </span>
      </button>
      <div className="min-w-0 flex-1 space-y-1 text-xs">
        {visible.map(s => (
          <div key={s.key} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-stone-600">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-bold tabular-nums text-stone-800">{Math.round(s.pct)}%</span>
          </div>
        ))}
        {a.liability > 0 && (
          <div className="flex items-center justify-between text-rose-500">
            <span>대출</span>
            <span className="font-bold tabular-nums">-{formatMan(a.liability)}</span>
          </div>
        )}
        {portfolioSummary?.usd_krw ? (
          <p className="pt-0.5 text-[10px] text-stone-400">USD/KRW {Math.round(portfolioSummary.usd_krw).toLocaleString('ko-KR')}</p>
        ) : null}
      </div>
    </Card>
  )
}
