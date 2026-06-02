'use client'

import { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import type { NetWorthSummary, PortfolioSummary } from '@/types'

interface NetWorthSummaryCardProps {
  netWorth: NetWorthSummary | null
  portfolioSummary: PortfolioSummary | null
}

function fmt(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2)}억`
  if (abs >= 10_000)      return `${sign}${Math.round(abs / 10_000).toLocaleString()}만`
  return `${sign}${abs.toLocaleString()}`
}

function fmtUnit(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 100_000_000) return '억원'
  if (abs >= 10_000)      return '만원'
  return '원'
}

function fmtFull(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2)}억원`
  if (abs >= 10_000)      return `${sign}${Math.round(abs / 10_000).toLocaleString()}만원`
  return `${sign}${abs.toLocaleString()}원`
}

export default function NetWorthSummaryCard({ netWorth, portfolioSummary }: NetWorthSummaryCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (!netWorth) {
    return (
      <div className="rounded-3xl bg-slate-200 animate-pulse h-20" />
    )
  }

  const totalAssets = netWorth.stock_value_krw + netWorth.asset_value_krw
  const isPositive  = netWorth.net_worth_krw >= 0
  const stockPct    = totalAssets > 0 ? (netWorth.stock_value_krw / totalAssets) * 100 : 0
  const otherPct    = totalAssets > 0 ? (netWorth.asset_value_krw / totalAssets) * 100 : 0
  const liabPct     = totalAssets > 0 ? (netWorth.liability_krw / totalAssets) * 100 : 0

  return (
    <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 shadow-xl">
      {/* ── Header (always visible) ── */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">총 자산 현황</p>
        <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Expandable detail ── */}
      {expanded && (
        <div className="px-6 pb-5">
          {/* 순자산 */}
          <div className="flex items-end justify-between mb-4">
            <div className="flex items-end gap-1.5">
              <span className={`text-4xl font-black tabular-nums leading-none ${isPositive ? 'text-white' : 'text-rose-400'}`}>
                {fmt(netWorth.net_worth_krw)}
              </span>
              <span className={`text-lg font-semibold mb-0.5 ${isPositive ? 'text-slate-300' : 'text-rose-400'}`}>
                {fmtUnit(netWorth.net_worth_krw)}
              </span>
              <span className="text-[10px] text-slate-500 mb-1 ml-1">순자산</span>
            </div>
            {portfolioSummary?.usd_krw && (
              <div className="text-right">
                <p className="text-[10px] text-slate-500 font-medium">USD/KRW</p>
                <p className="text-xs font-bold text-slate-300">
                  {portfolioSummary.usd_krw.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
          </div>

          {/* 4-stat row */}
          <div className="grid grid-cols-4 gap-1.5 mb-4">
            {[
              { label: '주식', value: netWorth.stock_value_krw, color: 'text-indigo-300', bg: 'bg-indigo-900/40' },
              { label: '기타', value: netWorth.asset_value_krw, color: 'text-emerald-300', bg: 'bg-emerald-900/40' },
              { label: '부채', value: netWorth.liability_krw,   color: 'text-rose-300',   bg: 'bg-rose-900/40'   },
              { label: '총자산', value: totalAssets,             color: 'text-slate-200',  bg: 'bg-white/5'       },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-2xl p-2.5 flex flex-col gap-0.5`}>
                <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
                <span className={`text-xs font-bold tabular-nums leading-tight ${color}`}>
                  {fmtFull(value)}
                </span>
              </div>
            ))}
          </div>

          {/* Composition bar */}
          {totalAssets > 0 && (
            <>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />주식 {stockPct.toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />기타 {otherPct.toFixed(0)}%
                  </span>
                </div>
                <span className={liabPct > 50 ? 'text-rose-400 font-semibold' : ''}>
                  부채 {liabPct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                <div className="h-full bg-indigo-400 transition-all duration-700" style={{ width: `${stockPct}%` }} />
                <div className="h-full bg-emerald-400 transition-all duration-700" style={{ width: `${otherPct}%` }} />
              </div>
              <p className="text-right text-[9px] text-slate-600 mt-1.5">
                {new Date(netWorth.calculated_at).toLocaleString('ko-KR', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })} 기준
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
