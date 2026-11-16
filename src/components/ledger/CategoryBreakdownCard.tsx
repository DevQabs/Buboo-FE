'use client'

// 카테고리 분석 — 옛 SummaryCard 의 "카테고리별 지출" 도넛을 옮기고 목록을 붙였다(휴대폰은 툴팁을 띄우기 어렵다).
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Card } from '@/components/ui/Card'
import { formatMan } from '@/lib/formatNumber'
import type { CategoryItem } from '@/lib/ledger'

// SummaryCard 의 CHART_COLORS 그대로
const CHART_COLORS = ['#0F4C81', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#14B8A6', '#6366F1', '#A78BFA']

function CategoryChartTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ payload: CategoryItem & { pct: number } }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="min-w-[140px] rounded-2xl border border-line bg-white px-4 py-3 shadow-warm">
      <p className="mb-2 text-xs font-bold text-stone-800">
        {d.category}
        {d.isFixed && <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-600">고정</span>}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4"><span className="text-stone-400">비중</span><span className="font-semibold tabular-nums text-stone-700">{d.pct.toFixed(1)}%</span></div>
        <div className="flex justify-between gap-4"><span className="text-stone-400">금액</span><span className="font-semibold tabular-nums text-stone-700">{formatMan(d.amount)}</span></div>
      </div>
    </div>
  )
}

export default function CategoryBreakdownCard({ items, total }: { items: CategoryItem[]; total: number }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  const sum = total || 1
  const color = (i: number) => CHART_COLORS[i % CHART_COLORS.length]

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between px-4 py-3">
        <span className="text-sm font-bold text-stone-800">카테고리 분석</span>
        <ChevronDownIcon className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col items-center gap-3 px-4 pb-4">
              <div className="relative">
                <PieChart width={160} height={160} style={{ outline: 'none' }}>
                  <Pie
                    data={items.map(i => ({ ...i, pct: (i.amount / sum) * 100 }))}
                    dataKey="amount"
                    cx={80}
                    cy={80}
                    innerRadius={48}
                    outerRadius={72}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={2}
                    strokeWidth={0}
                    focusable={false}
                  >
                    {items.map((_, i) => <Cell key={i} fill={color(i)} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<CategoryChartTooltip />} wrapperStyle={{ zIndex: 20 }} />
                </PieChart>
                <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-medium text-stone-400">총 지출</span>
                  <span className="text-sm font-black tabular-nums text-stone-800">{formatMan(total)}</span>
                </div>
              </div>
              <ul className="w-full space-y-1 text-xs">
                {items.map((it, i) => (
                  <li key={it.category} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-stone-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: color(i) }} />
                      {it.category}
                      {it.isFixed && <span className="rounded bg-amber-50 px-1 text-[10px] text-amber-600">고정</span>}
                    </span>
                    <span className="tabular-nums text-stone-700">{formatMan(it.amount)} · {((it.amount / sum) * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
