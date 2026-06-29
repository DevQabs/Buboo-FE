'use client'

import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatAmountInput } from '@/lib/formatNumber'
import {
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import type {
  DividendEvent,
  DividendYearlySummary,
  CreateDividendRequest,
  StockAssetWithPrice,
  PortfolioSummary,
  User,
} from '@/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtUSD(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function fmtKRW(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 100_000_000) return `${(v / 100_000_000).toFixed(2)}억원`
  if (abs >= 10_000) return `${(v / 10_000).toFixed(1)}만원`
  return `${Math.round(v).toLocaleString()}원`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ─── Add modal ───────────────────────────────────────────────────────────────

interface AddDividendModalProps {
  portfolio: StockAssetWithPrice[]
  portfolioSummary: PortfolioSummary | null
  users: User[]
  onClose: () => void
  onSave: (data: CreateDividendRequest) => Promise<void>
}

function AddDividendModal({ portfolio, portfolioSummary, users, onClose, onSave }: AddDividendModalProps) {
  // Step 1: stock selection
  const [selectedId, setSelectedId] = useState('')
  // Step 2: input
  const [amountPerShare, setAmountPerShare] = useState('')
  const [paymentDate, setPaymentDate]       = useState('')
  const [memo, setMemo]                     = useState('')
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState('')

  // Selected stock details
  const selected = useMemo(
    () => portfolio.find(s => s.id === selectedId) ?? null,
    [portfolio, selectedId]
  )

  const usdKRW = portfolioSummary?.usd_krw ?? 1380

  // Real-time calculation
  const calc = useMemo(() => {
    const aps   = parseFloat(amountPerShare.replace(/,/g, '')) || 0
    const qty   = selected?.quantity ?? 0
    const tr    = 0.15
    const total = aps * qty
    const afterTax = total * (1 - tr)
    const krw   = afterTax * usdKRW
    return { aps, qty, total, afterTax, krw, tr }
  }, [amountPerShare, selected, usdKRW])

  // Per-holder breakdown: all portfolio entries with same symbol
  const holders = useMemo(() => {
    if (!selected || calc.aps <= 0) return []
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))
    return portfolio
      .filter(s => s.symbol === selected.symbol)
      .map(s => {
        const afterTax = calc.aps * s.quantity * (1 - calc.tr)
        return { stock: s, user: userMap[s.user_id], afterTax, krw: afterTax * usdKRW }
      })
  }, [selected, calc, portfolio, users, usdKRW])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected)           { setError('종목을 선택해주세요'); return }
    if (calc.aps <= 0)       { setError('주당 배당금을 입력해주세요'); return }
    if (!paymentDate)        { setError('지급일을 선택해주세요'); return }
    setSaving(true); setError('')
    try {
      await onSave({
        user_id:         selected.user_id,
        stock_asset_id:  selected.id,
        symbol:          selected.symbol,
        exchange:        selected.exchange,
        name:            selected.name,
        quantity:        selected.quantity,
        amount_per_share: calc.aps,
        currency:        selected.currency,
        tax_rate:        calc.tr,
        usd_krw_rate:    usdKRW,
        payment_date:    paymentDate,
        memo,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      />
      <motion.div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-800">💰 배당 이벤트 등록</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* ── Step 1: 종목 선택 ── */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
              1. 보유 종목 선택
            </label>
            <div className="relative">
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 pr-8"
              >
                <option value="">-- 종목 선택 --</option>
                {portfolio.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.symbol}) · {s.quantity}주
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Auto-filled stock info */}
            {selected && (
              <div className="mt-2 bg-brand-50 rounded-xl px-3 py-2.5 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-brand-500 font-medium">통화</p>
                  <p className="text-sm font-bold text-brand-700">{selected.currency}</p>
                </div>
                <div>
                  <p className="text-[10px] text-brand-500 font-medium">보유 수량</p>
                  <p className="text-sm font-bold text-brand-700">{selected.quantity}주</p>
                </div>
                <div>
                  <p className="text-[10px] text-brand-500 font-medium">현재가</p>
                  <p className="text-sm font-bold text-brand-700">${selected.current_price.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Step 2: 배당 정보 입력 ── */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
              2. 배당 정보 입력
            </label>
            <div className="space-y-3">

              {/* 주당 배당금 */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  주당 배당금 ({selected?.currency ?? 'USD'}) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountPerShare}
                  onChange={e => setAmountPerShare(formatAmountInput(e.target.value, true))}
                  placeholder="예: 0.4750"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* 지급일 */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">지급일 *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* 메모 */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">메모</label>
                <input
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="분기 배당, 특별 배당 등"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* ── Step 3: 실시간 계산 미리보기 ── */}
          {selected && calc.aps > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                3. 예상 수령액 확인
              </label>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 space-y-3 border border-emerald-100">

                {/* 계산식 breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                      총 배당금 (세전)
                    </span>
                    <span className="font-mono text-slate-600">
                      {fmtUSD(calc.aps)} × {calc.qty}주 ={' '}
                      <span className="font-semibold">${fmtUSD(calc.total)}</span>
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />
                      배당소득세 ({(calc.tr * 100).toFixed(1)}%)
                    </span>
                    <span className="font-mono text-amber-600">
                      −${fmtUSD(calc.total * calc.tr)}
                    </span>
                  </div>

                  <div className="h-px bg-emerald-200" />

                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1 text-emerald-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      세후 배당금 (USD)
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      ${fmtUSD(calc.afterTax)}
                    </span>
                  </div>
                </div>

                {/* KRW big number */}
                <div className="bg-white/70 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-400 mb-0.5">
                    원화 환산 (USD/KRW {usdKRW.toFixed(0)})
                  </p>
                  <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                    {fmtKRW(calc.krw)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    가계부 '수입' 내역으로 등록됩니다
                  </p>
                </div>

                {/* Per-holder breakdown */}
                {holders.length > 0 && (
                  <div className="bg-white/70 rounded-xl p-3 space-y-1.5">
                    <p className="text-[10px] text-slate-400 font-medium mb-1">담당자별 수령액</p>
                    {holders.map(h => (
                      <div key={h.stock.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {h.user && (
                            <span
                              className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: h.user.avatar_color }}
                            >
                              {h.user.name[0]}
                            </span>
                          )}
                          <span className="text-xs text-slate-600">{h.user?.name ?? h.stock.user_id}</span>
                          <span className="text-[10px] text-slate-400">{h.stock.quantity}주</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-emerald-700">{fmtKRW(h.krw)}</span>
                          <span className="text-[10px] text-slate-400 ml-1">(${fmtUSD(h.afterTax)})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </form>

        {/* Footer buttons */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            취소
          </button>
          <button
            form="div-form"
            onClick={handleSubmit}
            disabled={saving || !selected || !amountPerShare || !paymentDate}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-40"
          >
            {saving ? '저장 중...' : '배당 등록'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

interface DividendCardProps {
  summary: DividendYearlySummary | null
  portfolio: StockAssetWithPrice[]
  portfolioSummary: PortfolioSummary | null
  users: User[]
  year: number
  month: number
  onAdd: (data: CreateDividendRequest) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function DividendCard({
  summary,
  portfolio,
  portfolioSummary,
  users,
  year,
  month,
  onAdd,
  onDelete,
}: DividendCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [showAll, setShowAll]     = useState(false)
  const [isOpen, setIsOpen]       = useState(false)

  const events  = summary?.events ?? []
  const visible = showAll ? events : events.slice(0, 5)

  // Per-user yearly totals from events
  const userTotals = useMemo(() => {
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))
    const totals: Record<string, { user: User; krw: number; usd: number }> = {}
    for (const e of events) {
      if (!totals[e.user_id]) totals[e.user_id] = { user: userMap[e.user_id], krw: 0, usd: 0 }
      totals[e.user_id].krw += e.amount_krw
      totals[e.user_id].usd += e.after_tax_amount
    }
    return Object.values(totals).filter(t => t.user)
  }, [events, users])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

      {/* ── YTD Summary banner ── */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3 border-b border-emerald-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium text-emerald-600 mb-0.5">💰 {year}년 {month}월 배당 수익 (세후)</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-extrabold text-slate-900 tabular-nums">
                {fmtKRW(summary?.total_krw ?? 0)}
              </p>
              <p className="text-[10px] text-slate-400">
                세후 ${fmtUSD(summary?.total_after_tax_usd ?? 0)}
                {portfolioSummary?.usd_krw && (
                  <span className="ml-1 text-slate-300">· {portfolioSummary.usd_krw.toFixed(0)}</span>
                )}
              </p>
            </div>
            {/* Per-user totals */}
            {userTotals.length > 0 && (
              <div className="flex items-center gap-3 mt-1.5">
                {userTotals.map(t => (
                  <div key={t.user.id} className="flex items-center gap-1">
                    <span
                      className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: t.user.avatar_color }}
                    >
                      {t.user.name[0]}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-600 tabular-nums">{fmtKRW(t.krw)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="w-8 h-8 rounded-xl bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors"
              aria-label="배당 등록"
            >
              <PlusIcon className="h-4 w-4 text-brand-600" />
            </button>
            <button
              onClick={() => setIsOpen(v => !v)}
              className="w-8 h-8 rounded-xl bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center transition-colors"
              aria-label={isOpen ? '접기' : '펼치기'}
            >
              <ChevronDownIcon className={`h-4 w-4 text-emerald-700 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Event list ── */}
      {isOpen && <div className="divide-y divide-slate-50">
        {events.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-slate-400">등록된 배당 이벤트가 없어요</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 text-xs text-emerald-500 hover:underline"
            >
              첫 배당 등록하기 →
            </button>
          </div>
        ) : (
          <>
            {visible.map(d => (
              <DividendRow key={d.id} event={d} portfolio={portfolio} users={users} onDelete={onDelete} />
            ))}

            {events.length > 5 && (
              <button
                onClick={() => setShowAll(v => !v)}
                className="w-full py-3 text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition-colors"
              >
                <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                {showAll ? '접기' : `${events.length - 5}건 더 보기`}
              </button>
            )}
          </>
        )}
      </div>}

      {/* ── Modal ── */}
      <AnimatePresence>
        {showModal && (
          <AddDividendModal
            portfolio={portfolio}
            portfolioSummary={portfolioSummary}
            users={users}
            onClose={() => setShowModal(false)}
            onSave={onAdd}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Individual event row ─────────────────────────────────────────────────────

function DividendRow({
  event: d,
  portfolio,
  users,
  onDelete,
}: {
  event: DividendEvent
  portfolio: StockAssetWithPrice[]
  users: User[]
  onDelete: (id: string) => void
}) {
  const holders = useMemo(() => {
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))
    return portfolio
      .filter(s => s.symbol === d.symbol)
      .map(s => {
        const afterTax = d.amount_per_share * s.quantity * (1 - d.tax_rate)
        const krw = afterTax * d.usd_krw_rate
        return { stock: s, user: userMap[s.user_id], afterTax, krw }
      })
      .filter(h => h.user)
  }, [d, portfolio, users])

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-800">{d.symbol}</span>
            <span className="text-[10px] text-slate-400 truncate">{d.name}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-slate-400">{fmtDate(d.payment_date)}</span>
            <span className="text-[10px] text-slate-300">·</span>
            <span className="text-[10px] text-slate-400">${fmtUSD(d.amount_per_share)}×{d.quantity}주</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs font-bold text-emerald-700 tabular-nums">{fmtKRW(d.amount_krw)}</p>
          <p className="text-[10px] text-slate-400">${fmtUSD(d.after_tax_amount)}</p>
        </div>

        <button onClick={() => onDelete(d.id)} title="삭제" className="p-1 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-colors">
          <TrashIcon className="h-3 w-3" />
        </button>
      </div>

      {/* Per-holder breakdown */}
      {holders.length > 0 && (
        <div className="ml-4 mt-1.5 flex items-center gap-3 flex-wrap">
          {holders.map(h => (
            <div key={h.stock.id} className="flex items-center gap-1">
              <span
                className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: h.user.avatar_color }}
              >
                {h.user.name[0]}
              </span>
              <span className="text-[10px] text-slate-500">{h.stock.quantity}주</span>
              <span className="text-[10px] font-semibold text-emerald-700 tabular-nums">{fmtKRW(h.krw)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
