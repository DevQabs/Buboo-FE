'use client'

import { useState } from 'react'
import {
  ArrowUpIcon,
  ArrowDownIcon,
  ScaleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { MonthlySummary } from '@/types'

interface SummaryCardProps {
  summary: MonthlySummary
  year: number
  month: number
  startDay: number               // 1–28: which day of month the period starts
  onPeriodChange: (params: { year: number; month: number; startDay: number }) => void
  budgetLimit?: number
  onUpdateBudget?: (amount: number) => Promise<void>
}

function formatKRW(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억원`
  if (abs >= 10_000)      return `${sign}${(abs / 10_000).toFixed(abs % 10_000 === 0 ? 0 : 1)}만원`
  return `${sign}${abs.toLocaleString()}원`
}

/** Returns a compact "MM.dd ~ MM.dd" label for the actual period window. */
function getPeriodLabel(year: number, month: number, startDay: number): string {
  if (startDay === 1) return ''
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear  = month === 1 ? year - 1 : year
  const endDay    = startDay - 1
  return (
    `${prevYear}.${String(prevMonth).padStart(2, '0')}.${String(startDay).padStart(2, '0')}` +
    ` ~ ${year}.${String(month).padStart(2, '0')}.${String(endDay).padStart(2, '0')}`
  )
}

// ── Budget gauge colours ──────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

export default function SummaryCard({
  summary,
  year,
  month,
  startDay,
  onPeriodChange,
  budgetLimit = 0,
  onUpdateBudget,
}: SummaryCardProps) {

  // ── Budget edit state ──
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput]     = useState('')
  const [saving, setSaving]              = useState(false)

  const budgetUsedPct = budgetLimit > 0
    ? (summary.total_expense / budgetLimit) * 100
    : 0
  const remaining     = budgetLimit - summary.total_expense
  const tier          = getBudgetTier(budgetUsedPct)
  const styles        = TIER_STYLES[tier]
  const barWidth      = Math.min(budgetUsedPct, 100)

  // ── Period navigation ──
  const goPrev = () => {
    if (month === 1) onPeriodChange({ year: year - 1, month: 12, startDay })
    else             onPeriodChange({ year, month: month - 1, startDay })
  }
  const goNext = () => {
    if (month === 12) onPeriodChange({ year: year + 1, month: 1, startDay })
    else              onPeriodChange({ year, month: month + 1, startDay })
  }

  // ── Budget save ──
  const handleSaveBudget = async () => {
    const raw   = budgetInput.replace(/,/g, '').trim()
    const value = Number(raw)
    if (!onUpdateBudget || isNaN(value) || value < 0) return
    setSaving(true)
    try {
      await onUpdateBudget(value)
      setEditingBudget(false)
    } finally {
      setSaving(false)
    }
  }

  const periodLabel = getPeriodLabel(year, month, startDay)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

      {/* ── Budget status banner (full-width, above everything) ── */}
      {budgetLimit > 0 && (
        <div className={`px-5 pt-4 pb-3 ${
          tier === 'safe'   ? 'bg-emerald-50/60' :
          tier === 'warn'   ? 'bg-amber-50/60'   :
          'bg-rose-50/60'
        }`}>
          {/* Top row: label + pct badge + edit */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">이번 달 예산</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${styles.badge}`}>
                {styles.label} {budgetUsedPct.toFixed(0)}%
              </span>
            </div>
            {onUpdateBudget && !editingBudget && (
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
          <div className="w-full bg-white/70 rounded-full h-2.5 overflow-hidden mb-2">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ${styles.bar}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>

          {/* Spent / Remaining */}
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">
              사용 <span className="font-semibold text-slate-700">{formatKRW(summary.total_expense)}</span>
              <span className="text-slate-300 mx-1">/</span>
              <span className="text-slate-500">{formatKRW(budgetLimit)}</span>
            </span>
            <span className={`font-semibold ${remaining >= 0 ? styles.text : 'text-rose-700'}`}>
              {remaining >= 0 ? `남은 ${formatKRW(remaining)}` : `${formatKRW(-remaining)} 초과`}
            </span>
          </div>
        </div>
      )}

      {/* ── Budget edit row (shown only when editing) ── */}
      {editingBudget && (
        <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
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
            className="p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 transition-colors"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── No-budget call-to-action ── */}
      {budgetLimit === 0 && onUpdateBudget && !editingBudget && (
        <div className="px-5 pt-4 pb-1 flex items-center justify-between">
          <p className="text-xs text-slate-400">월 예산을 설정하면 소비 현황을 추적할 수 있어요.</p>
          <button
            onClick={() => { setBudgetInput(''); setEditingBudget(true) }}
            className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 shrink-0 ml-3 transition-colors"
          >
            + 설정
          </button>
        </div>
      )}

      <div className="p-5 space-y-4">

        {/* ── Month navigator ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="이전 달"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800">{year}년 {month}월</p>
            {periodLabel && (
              <p className="text-[10px] text-slate-400 mt-0.5">{periodLabel}</p>
            )}
          </div>

          <button
            onClick={goNext}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="다음 달"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        {/* ── Start-day selector ── */}
        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
          <span className="text-xs font-medium text-slate-500 shrink-0 mr-3">시작일</span>
          <select
            value={startDay}
            onChange={e => {
              const v = Number(e.target.value)
              if (v) onPeriodChange({ year, month, startDay: v })
            }}
            className="flex-1 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}일</option>
            ))}
          </select>
        </div>

        {/* ── Three metric tiles ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Income */}
          <div className="flex flex-col gap-1 rounded-xl bg-emerald-50 p-3">
            <div className="flex items-center gap-1 text-emerald-600">
              <ArrowUpIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">수입</span>
            </div>
            <span className="text-base font-bold text-emerald-700 leading-tight tabular-nums">
              {formatKRW(summary.total_income)}
            </span>
          </div>

          {/* Expense */}
          <div className="flex flex-col gap-1 rounded-xl bg-rose-50 p-3">
            <div className="flex items-center gap-1 text-rose-500">
              <ArrowDownIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">지출</span>
            </div>
            <span className="text-base font-bold text-rose-600 leading-tight tabular-nums">
              {formatKRW(summary.total_expense)}
            </span>
          </div>

          {/* Balance */}
          <div className={`flex flex-col gap-1 rounded-xl p-3 ${
            summary.balance >= 0 ? 'bg-indigo-50' : 'bg-orange-50'
          }`}>
            <div className={`flex items-center gap-1 ${
              summary.balance >= 0 ? 'text-indigo-600' : 'text-orange-500'
            }`}>
              <ScaleIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">잔액</span>
            </div>
            <span className={`text-base font-bold leading-tight tabular-nums ${
              summary.balance >= 0 ? 'text-indigo-700' : 'text-orange-600'
            }`}>
              {formatKRW(summary.balance)}
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
