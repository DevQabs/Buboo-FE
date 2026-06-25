'use client'

import { useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import type { NetWorthSummary, PortfolioSummary } from '@/types'

interface NetWorthSummaryCardProps {
  netWorth: NetWorthSummary | null
  portfolioSummary: PortfolioSummary | null
}

function fmt(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2)}억원`
  if (abs >= 10_000)      return `${sign}${Math.round(abs / 10_000).toLocaleString()}만원`
  return `${sign}${abs.toLocaleString()}원`
}

export default function NetWorthSummaryCard({ netWorth, portfolioSummary }: NetWorthSummaryCardProps) {
  const [open, setOpen] = useState(false)

  if (!netWorth) {
    return <div className="rounded-3xl bg-slate-200 animate-pulse h-20" />
  }

  const isPositive = netWorth.net_worth_krw >= 0

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-brand-700 shadow-xl px-6 py-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">총 자산 현황</p>
        <div className="flex items-center gap-2">
          {portfolioSummary?.usd_krw && (
            <span className="text-[10px] font-medium text-slate-500">
              USD/KRW <span className="text-slate-300 font-bold">{portfolioSummary.usd_krw.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span>
            </span>
          )}
          <button onClick={() => setOpen(o => !o)} className="text-slate-400 hover:text-white transition-colors">
            {open ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        {open ? (
          <span className={`text-4xl font-black tabular-nums leading-none ${isPositive ? 'text-white' : 'text-rose-400'}`}>
            {fmt(netWorth.net_worth_krw)}
          </span>
        ) : (
          <span className="text-4xl font-black leading-none tracking-widest text-slate-600 select-none">
            ••••••
          </span>
        )}
      </div>
    </div>
  )
}
