'use client'

import { useState } from 'react'
import {
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { MonthlySummary } from '@/types'

interface SummaryCardProps {
  summary: MonthlySummary
  year: number
  month: number
  startDay: number
  onPeriodChange: (params: { year: number; month: number; startDay: number }) => void
  budgetLimit?: number
  onUpdateBudget?: (amount: number) => Promise<void>
  unappliedFixedTotal?: number
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
  safe:   { bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700', label: '양호' },
  warn:   { bar: 'bg-amber-400',   text: 'text-amber-600',   badge: 'bg-amber-50  text-amber-700',   label: '주의' },
  danger: { bar: 'bg-rose-500',    text: 'text-rose-600',    badge: 'bg-rose-50   text-rose-700',    label: '위험' },
  over:   { bar: 'bg-rose-700',    text: 'text-rose-700',    badge: 'bg-rose-100  text-rose-800',    label: '초과' },
}

export default function SummaryCard({
  summary,
  year,
  month,
  startDay,
  onPeriodChange,
  budgetLimit = 0,
  onUpdateBudget,
  unappliedFixedTotal = 0,
}: SummaryCardProps) {
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput]     = useState('')
  const [saving, setSaving]              = useState(false)

  const committedExpense = summary.total_expense + unappliedFixedTotal
  const budgetUsedPct = budgetLimit > 0 ? (committedExpense / budgetLimit) * 100 : 0
  const remaining     = budgetLimit - committedExpense
  const tier          = getBudgetTier(budgetUsedPct)
  const styles        = TIER_STYLES[tier]
  const barWidth      = Math.min(budgetUsedPct, 100)

  const handleSaveBudget = async () => {
    const value = Number(budgetInput.replace(/,/g, '').trim())
    if (!onUpdateBudget || isNaN(value) || value < 0) return
    setSaving(true)
    try {
      await onUpdateBudget(value)
      setEditingBudget(false)
    } finally {
      setSaving(false)
    }
  }

  const startDaySelect = (
    <select
      value={startDay}
      onChange={e => {
        const v = Number(e.target.value)
        if (v) onPeriodChange({ year, month, startDay: v })
      }}
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
          type="number"
          min={0}
          step={10000}
          value={budgetInput}
          onChange={e => setBudgetInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSaveBudget(); if (e.key === 'Escape') setEditingBudget(false) }}
          autoFocus
          className="flex-1 text-sm border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-right tabular-nums"
          placeholder="월 예산 (원)"
        />
        <span className="text-xs text-slate-400 shrink-0">원</span>
        <button
          onClick={handleSaveBudget}
          disabled={saving}
          className="p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
        >
          <CheckIcon className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setEditingBudget(false)}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
        >
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${
      tier === 'safe' ? 'bg-emerald-50/60' :
      tier === 'warn' ? 'bg-amber-50/60'   :
      'bg-rose-50/60'
    }`}>
      <div className="px-4 pt-3 pb-2">
        {/* Top row: 이번 달 예산 + badge + 시작일 + edit */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">이번 달 예산</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${styles.badge}`}>
              {styles.label} {budgetUsedPct.toFixed(0)}%
            </span>
            <span className="text-slate-200">·</span>
            {startDaySelect}
          </div>
          {onUpdateBudget && (
            <button
              onClick={() => { setBudgetInput(String(budgetLimit)); setEditingBudget(true) }}
              className="p-1 rounded-lg hover:bg-white/70 text-slate-400 hover:text-slate-600 transition-colors"
              title="예산 수정"
            >
              <PencilSquareIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden mb-2">
          <div
            className={`h-1.5 rounded-full transition-all duration-700 ${styles.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        {/* Spent / Remaining */}
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">
            사용 <span className="font-semibold text-slate-700">{formatKRW(committedExpense)}</span>
            {unappliedFixedTotal > 0 && (
              <span className="ml-1 text-amber-500 text-[10px]">(고정비 {formatKRW(unappliedFixedTotal)} 예정 포함)</span>
            )}
            <span className="text-slate-300 mx-1">/</span>
            <span className="text-slate-500">{formatKRW(budgetLimit)}</span>
          </span>
          <span className={`font-semibold ${remaining >= 0 ? styles.text : 'text-rose-700'}`}>
            {remaining >= 0 ? `남은 ${formatKRW(remaining)}` : `${formatKRW(-remaining)} 초과`}
          </span>
        </div>
      </div>
    </div>
  )
}
