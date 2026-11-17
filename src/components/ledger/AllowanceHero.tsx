'use client'

// 가계부 맨 위: "오늘부터 하루에 N원 쓸 수 있어요" + 고정/변동 막대 + 예산·시작일 (시안 ledger-a 첫 카드)
import { useState } from 'react'
import { CheckIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Card } from '@/components/ui/Card'
import { formatAmountInput, formatMan } from '@/lib/formatNumber'
import { dailyAllowance } from '@/lib/ledger'

interface AllowanceHeroProps {
  budget: number
  /** 변동 지출(요약의 total_expense) */
  variable: number
  /** 활성 지출 고정비 합계 */
  fixed: number
  daysLeft: number
  year: number
  month: number
  startDay: number
  onPeriodChange: (p: { year: number; month: number; startDay: number }) => void
  /** 없으면 보기 전용 — 예산 수정 버튼을 숨긴다 */
  onUpdateBudget?: (amount: number) => Promise<void>
}

export default function AllowanceHero({
  budget, variable, fixed, daysLeft, year, month, startDay, onPeriodChange, onUpdateBudget,
}: AllowanceHeroProps) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const spent = variable + fixed
  const { remaining, perDay } = dailyAllowance(budget, spent, daysLeft)
  const barPct = (v: number) => (budget > 0 ? Math.min(100, (v / budget) * 100) : 0)
  const fixedPct = barPct(fixed)
  const variablePct = Math.min(100 - fixedPct, barPct(variable))

  const startEditing = () => {
    setInput(budget > 0 ? formatAmountInput(String(budget)) : '')
    setEditing(true)
  }

  const save = async () => {
    const v = Number(input.replace(/,/g, ''))
    if (!onUpdateBudget || !Number.isFinite(v) || v < 0) return
    setSaving(true)
    try {
      await onUpdateBudget(v)
      setEditing(false)
    } catch {
      // 실패 문구는 대시보드 핸들러가 토스트로 띄운다. 입력은 그대로 둔다.
    } finally {
      setSaving(false)
    }
  }

  // SummaryCard 에서 옮김: 가계부 시작일(1~28)
  const startDaySelect = (
    <select
      value={startDay}
      onChange={e => { const v = Number(e.target.value); if (v) onPeriodChange({ year, month, startDay: v }) }}
      aria-label="가계부 시작일"
      className="bg-transparent text-xs text-stone-400 focus:outline-none"
    >
      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
        <option key={d} value={d}>{d}일 시작</option>
      ))}
    </select>
  )

  if (editing) {
    return (
      <Card className="flex items-center gap-2 px-4 py-3">
        <span className="shrink-0 text-xs font-medium text-brand-700">월 예산</span>
        <input
          autoFocus
          inputMode="numeric"
          value={input}
          onChange={e => setInput(formatAmountInput(e.target.value))}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          placeholder="예: 2,000,000"
          className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <span className="shrink-0 text-xs text-stone-400">원</span>
        <button onClick={save} disabled={saving} aria-label="저장" className="relative before:absolute before:-inset-2 before:content-[''] rounded-lg bg-brand-500 p-1.5 text-white disabled:opacity-50">
          <CheckIcon className="h-4 w-4" />
        </button>
        <button onClick={() => setEditing(false)} aria-label="취소" className="relative before:absolute before:-inset-2 before:content-[''] rounded-lg p-1.5 text-stone-400">
          <XMarkIcon className="h-4 w-4" />
        </button>
      </Card>
    )
  }

  if (budget === 0) {
    return (
      <Card className="px-4 py-5 text-center">
        <p className="text-sm font-semibold text-stone-700">월 예산을 정하면 하루에 쓸 돈을 알려 드려요</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          {startDaySelect}
          {onUpdateBudget && (
            <button onClick={startEditing} className="text-xs font-semibold text-brand-500">예산 정하기</button>
          )}
        </div>
      </Card>
    )
  }

  const over = remaining < 0
  return (
    <Card className="relative px-4 pb-4 pt-5 text-center">
      {onUpdateBudget && (
        <button onClick={startEditing} aria-label="예산 수정" className="absolute right-3 top-3 rounded-lg before:absolute before:-inset-2 before:content-[''] p-1.5 text-stone-400 hover:bg-stone-100">
          <PencilSquareIcon className="h-4 w-4" />
        </button>
      )}
      <p className="text-xs text-stone-400">
        {over ? '이번 기간 예산을' : daysLeft > 0 ? '오늘부터 하루에' : '이번 기간이 끝났어요'}
      </p>
      <p className={`mt-0.5 text-3xl font-black tabular-nums tracking-tight ${over ? 'text-rose-500' : 'text-brand-500'}`}>
        {over ? `${formatMan(-remaining)} 넘었어요` : <>{perDay.toLocaleString('ko-KR')}<span className="text-sm font-bold">원</span></>}
      </p>
      <p className="mt-0.5 text-xs text-stone-400">
        {over
          ? `예산 ${formatMan(budget)} · 쓴 돈 ${formatMan(spent)}`
          : `${daysLeft > 0 ? '쓸 수 있어요 · ' : ''}남은 예산 ${formatMan(remaining)}${daysLeft > 0 ? ` / ${daysLeft}일` : ''}`}
      </p>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-sand">
        <span className="h-full bg-amber-500" style={{ width: `${fixedPct}%` }} />
        <span className="h-full bg-rose-400" style={{ width: `${variablePct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-3 text-xs text-stone-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />고정 {formatMan(fixed)}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />변동 {formatMan(variable)}</span>
        {startDaySelect}
      </div>
    </Card>
  )
}
