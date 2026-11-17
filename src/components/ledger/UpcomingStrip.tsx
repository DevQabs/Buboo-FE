'use client'

// 곧 나갈 돈(고정비)·들어올 돈(배당): 처음엔 접어 합계만, 펼치면 날짜별 묶음 목록(시안 upcoming-money A)
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Card } from '@/components/ui/Card'
import { formatMan } from '@/lib/formatNumber'
import { daysBetween, todayKST, weekdayOf } from '@/lib/date'
import { eventDays } from '@/lib/ledger'
import type { CalendarEvent } from '@/types'

const WD = ['일', '월', '화', '수', '목', '금', '토']

function DayHead({ date, out, inc }: { date: string; out: number; inc: number }) {
  const n = daysBetween(todayKST(), date)
  return (
    <div className="mb-1 mt-3 flex items-center justify-between text-xs font-bold text-stone-800">
      <span className="flex items-center gap-1.5">
        {Number(date.slice(5, 7))}월 {Number(date.slice(8))}일 ({WD[weekdayOf(date)]})
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${n <= 3 ? 'bg-rose-50 text-rose-500' : 'bg-brand-50 text-brand-500'}`}>
          {n === 0 ? '오늘' : `D-${n}`}
        </span>
      </span>
      <span className="tabular-nums">
        {out > 0 && <span className="text-rose-500">-{formatMan(out)}</span>}
        {out > 0 && inc > 0 && <span className="text-stone-300"> · </span>}
        {inc > 0 && <span className="text-emerald-600">+{formatMan(inc)}</span>}
      </span>
    </div>
  )
}

export default function UpcomingStrip({ events }: { events: CalendarEvent[] }) {
  const [open, setOpen] = useState(false)
  if (events.length === 0) return null
  const days = eventDays(events)
  const out = days.reduce((s, d) => s + d.out, 0)
  const inc = days.reduce((s, d) => s + d.in, 0)
  return (
    <Card className="overflow-hidden">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-bold text-stone-800">곧 나갈 돈 · 들어올 돈</span>
        <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums">
          {out > 0 && <span className="text-rose-500">-{formatMan(out)}</span>}
          {inc > 0 && <span className="text-emerald-600">+{formatMan(inc)}</span>}
          <span className="text-stone-400">{events.length}건</span>
          <ChevronDownIcon className={`h-4 w-4 text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
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
            <div className="px-4 pb-4 [&>div:first-child>div:first-child]:mt-0">
              {days.map(d => (
                <div key={d.date}>
                  <DayHead date={d.date} out={d.out} inc={d.in} />
                  {d.items.map((e, i) => {
                    const income = e.type === 'dividend'
                    return (
                      <div key={`${e.title}-${i}`} className={`ml-0.5 flex justify-between gap-3 border-l-[3px] py-1 pl-2.5 text-xs ${income ? 'border-emerald-500' : 'border-amber-300'}`}>
                        <span className="min-w-0 truncate text-stone-600">{e.title}</span>
                        <span className={`shrink-0 font-semibold tabular-nums ${income ? 'text-emerald-600' : 'text-stone-800'}`}>{income ? '+' : ''}{formatMan(e.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
