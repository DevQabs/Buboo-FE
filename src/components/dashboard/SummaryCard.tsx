'use client'

import { useState } from 'react'
import {
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import type { MonthlySummary } from '@/types'

interface CategoryItem {
  category: string
  amount: number
  isFixed?: boolean
}

interface SummaryCardProps {
  summary: MonthlySummary
  year: number
  month: number
  startDay: number
  onPeriodChange: (params: { year: number; month: number; startDay: number }) => void
  budgetLimit?: number
  onUpdateBudget?: (amount: number) => Promise<void>
  fixedExpenseTotal?: number
  categoryBreakdown?: CategoryItem[]
}

function formatKRW(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억원`
  if (abs >= 10_000)      return `${sign}${(abs / 10_000).toFixed(abs % 10_000 === 0 ? 0 : 1)}만원`
  return `${sign}${abs.toLocaleString()}원`
}

function getBudgetTier(pct: number): 'safe' | 'warn' | 'danger' | 'over' {
  if (pct > 100) return 'over'
  if (pct >= 90) return 'danger'
  if (pct >= 70) return 'warn'
  return 'safe'
}

const TIER_STYLES = {
  safe:   { bar: 'bg-emerald-400', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', label: '양호' },
  warn:   { bar: 'bg-rose-400',    text: 'text-rose-500',    badge: 'bg-rose-50  text-rose-700',      label: '주의' },
  danger: { bar: 'bg-rose-500',    text: 'text-rose-600',    badge: 'bg-rose-50   text-rose-700',     label: '위험' },
  over:   { bar: 'bg-rose-700',    text: 'text-rose-700',    badge: 'bg-rose-100  text-rose-800',     label: '초과' },
}

export default function SummaryCard({
  summary,
  year,
  month,
  startDay,
  onPeriodChange,
  budgetLimit = 0,
  onUpdateBudget,
  fixedExpenseTotal = 0,
  categoryBreakdown = [],
}: SummaryCardProps) {
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput]     = useState('')
  const [saving, setSaving]               = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [tooltip, setTooltip]             = useState<'variable' | 'fixed' | null>(null)

  const variableExpense  = summary.total_expense
  const committedExpense = variableExpense + fixedExpenseTotal
  const budgetUsedPct    = budgetLimit > 0 ? (committedExpense / budgetLimit) * 100 : 0
  const remaining        = budgetLimit - committedExpense
  const tier             = getBudgetTier(budgetUsedPct)
  const styles           = TIER_STYLES[tier]

  const totalBarPct    = Math.min(budgetUsedPct, 100)
  const variableBarPct = budgetLimit > 0 ? Math.min((variableExpense / budgetLimit) * 100, totalBarPct) : 0
  const fixedBarPct    = totalBarPct - variableBarPct

  const totalForBreakdown = committedExpense || 1

  const handleSaveBudget = async () => {
    const value = Number(budgetInput.replace(/,/g, '').trim())
    if (!onUpdateBudget || isNaN(value) || value < 0) return
    setSaving(true)
    try { await onUpdateBudget(value); setEditingBudget(false) }
    finally { setSaving(false) }
  }

  const startDaySelect = (
    <select
      value={startDay}
      onChange={e => { const v = Number(e.target.value); if (v) onPeriodChange({ year, month, startDay: v }) }}
      className="text-[10px] text-slate-400 bg-transparent border-none cursor-pointer focus:outline-none"
    >
      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
        <option key={d} value={d}>{d}일 시작</option>
      ))}
    </select>
  )

  if (budgetLimit === 0 && onUpdateBudget && !editingBudget) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-400">월 예산을 설정하면 소비 현황을 추적할 수 있어요.</p>
          {startDaySelect}
        </div>
        <button
          onClick={() => { setBudgetInput(''); setEditingBudget(true) }}
          className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 shrink-0 ml-3 transition-colors"
        >
          + 설정
        </button>
      </div>
    )
  }

  if (editingBudget) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 flex items-center gap-2">
        <span className="text-xs font-medium text-indigo-700 shrink-0">예산 설정</span>
        <input
          type="number" min={0} step={10000} value={budgetInput}
          onChange={e => setBudgetInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSaveBudget(); if (e.key === 'Escape') setEditingBudget(false) }}
          autoFocus
          className="flex-1 text-sm border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-right tabular-nums"
          placeholder="월 예산 (원)"
        />
        <span className="text-xs text-slate-400 shrink-0">원</span>
        <button onClick={handleSaveBudget} disabled={saving}
          className="p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors">
          <CheckIcon className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setEditingBudget(false)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${
        tier === 'safe' ? 'bg-emerald-50/60' :
        tier === 'warn' ? 'bg-amber-50/60'   :
        'bg-rose-50/60'
      }`}
      onClick={() => tooltip && setTooltip(null)}
    >
      <div className="px-4 pt-3 pb-0">
        {/* Top row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {startDaySelect}
            <span className="text-[11px] tabular-nums whitespace-nowrap">
              <span className="font-semibold text-slate-700">{formatKRW(committedExpense)}</span>
              <span className="text-slate-300 mx-0.5">/</span>
              <span className="text-slate-400">{formatKRW(budgetLimit)}</span>
            </span>
          </div>
          {onUpdateBudget && (
            <button
              onClick={e => { e.stopPropagation(); setBudgetInput(String(budgetLimit)); setEditingBudget(true) }}
              className="p-1 rounded-lg hover:bg-white/70 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <PencilSquareIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Stacked progress bar */}
        <div className="relative mb-0">
          <div className="w-full h-3 bg-white/70 rounded-full overflow-hidden flex">
            {/* 고정비 — amber (좌측) */}
            {fixedBarPct > 0 && (
              <div
                className="h-full bg-amber-400 transition-all duration-700 cursor-pointer"
                style={{ width: `${fixedBarPct}%` }}
                onClick={e => { e.stopPropagation(); setTooltip(t => t === 'fixed' ? null : 'fixed') }}
              />
            )}
            {/* 변동 지출 — rose (우측) */}
            <div
              className="h-full bg-rose-400 transition-all duration-700 cursor-pointer"
              style={{ width: `${variableBarPct}%` }}
              onClick={e => { e.stopPropagation(); setTooltip(t => t === 'variable' ? null : 'variable') }}
            />
          </div>

          {tooltip === 'fixed' && (
            <div
              className="absolute top-5 z-20 bg-amber-500 text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg pointer-events-none"
              style={{ left: `max(0%, calc(${fixedBarPct / 2}% - 2.5rem))` }}
            >
              고정비 {formatKRW(fixedExpenseTotal)}
            </div>
          )}
          {tooltip === 'variable' && (
            <div
              className="absolute top-5 z-20 bg-rose-600 text-white text-[10px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg pointer-events-none"
              style={{ left: `min(calc(100% - 5rem), calc(${fixedBarPct + variableBarPct / 2}% - 2.5rem))` }}
            >
              변동 지출 {formatKRW(variableExpense)}
            </div>
          )}
        </div>
      </div>

      {/* Category breakdown - collapsible */}
      {categoryBreakdown.length > 0 && (
        <div className="border-t border-white/50">
          <button
            onClick={e => { e.stopPropagation(); setShowBreakdown(v => !v) }}
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-slate-500 hover:bg-white/30 transition-colors"
          >
            <span className="font-medium">카테고리별 지출</span>
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${showBreakdown ? 'rotate-180' : ''}`} />
          </button>

          {showBreakdown && (
            <div className="px-4 pb-3 space-y-2">
              {categoryBreakdown.map(item => {
                const pct = (item.amount / totalForBreakdown) * 100
                return (
                  <div key={item.category}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <div className="flex items-center gap-1">
                        {item.isFixed && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                        <span className="text-slate-600 font-medium">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{pct.toFixed(0)}%</span>
                        <span className="font-semibold text-slate-700 tabular-nums">{formatKRW(item.amount)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-white/60 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full transition-all duration-500 ${item.isFixed ? 'bg-amber-400' : 'bg-indigo-300'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
