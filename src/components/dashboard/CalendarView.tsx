'use client'

import { useState, useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon, PlusIcon, Cog6ToothIcon, PencilIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline'
import { formatAmountInput } from '@/lib/formatNumber'
import { useCategories } from '@/hooks/useCategories'
import CategoryManager from '@/components/dashboard/CategoryManager'
import { getHolidaysForMonth } from '@/lib/koreanHolidays'
import type {
  CalendarSummaryResponse,
  CalendarDay,
  CalendarEvent,
  Transaction,
  User,
  SavingLink,
  SavingKind,
  StockAssetWithPrice,
  OtherAsset,
  OtherAssetType,
} from '@/types'

// ─── AddTransaction form types ─────────────────────────────────────────────────

export interface AddTransactionPayload {
  user_id: string
  type: 'income' | 'expense' | 'saving'
  amount: number
  category: string
  title: string
  date: string   // YYYY-MM-DD
  saving_link?: SavingLink
}

const OTHER_ASSET_TYPES: OtherAssetType[] = ['부동산', '예/적금', '현금', '기타']

// ─── helpers ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getNowKST(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
}

function todayKey(): string {
  return toDateKey(getNowKST())
}

function fmtCell(v: number): string {
  if (v === 0) return ''
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 1_000_000)   return `${(v / 10_000).toFixed(0)}만`
  if (v >= 10_000)      return `${(v / 10_000).toFixed(1)}만`
  if (v >= 1_000)       return `${(v / 1_000).toFixed(0)}천`
  return `${v}`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtDateLabel(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${parseInt(m)}월 ${parseInt(d)}일`
}

// ─── SavingLink inline form ───────────────────────────────────────────────────

interface SavingLinkInlineProps {
  stocks: StockAssetWithPrice[]
  otherAssets: OtherAsset[]
  onChange: (link: SavingLink | null) => void
}

function SavingLinkInline({ stocks, otherAssets, onChange }: SavingLinkInlineProps) {
  const [kind, setKind] = useState<SavingKind>('stock')
  const [isNew, setIsNew] = useState(false)

  const [stockId, setStockId] = useState(stocks[0]?.id ?? '')
  const [addQty, setAddQty] = useState('')
  const [addPrice, setAddPrice] = useState('')

  const [newSymbol, setNewSymbol] = useState('')
  const [newExchange, setNewExchange] = useState('NYSE')
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCurrency, setNewCurrency] = useState<'USD' | 'KRW'>('USD')

  const [assetId, setAssetId] = useState(otherAssets[0]?.id ?? '')
  const [newAssetName, setNewAssetName] = useState('')
  const [newAssetType, setNewAssetType] = useState<OtherAssetType>('예/적금')

  const inputCls = 'w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500'

  const notify = (overrides?: Partial<{
    kind: SavingKind; isNew: boolean; stockId: string; addQty: string; addPrice: string
    newSymbol: string; newExchange: string; newName: string; newQty: string; newPrice: string
    newCurrency: 'USD'|'KRW'; assetId: string; newAssetName: string; newAssetType: OtherAssetType
  }>) => {
    const k = overrides?.kind ?? kind
    const n = overrides?.isNew ?? isNew
    const sId = overrides?.stockId ?? stockId
    const aq = overrides?.addQty ?? addQty
    const ap = overrides?.addPrice ?? addPrice
    const ns = overrides?.newSymbol ?? newSymbol
    const ne = overrides?.newExchange ?? newExchange
    const nn = overrides?.newName ?? newName
    const nq = overrides?.newQty ?? newQty
    const np = overrides?.newPrice ?? newPrice
    const nc = overrides?.newCurrency ?? newCurrency
    const aId = overrides?.assetId ?? assetId
    const nan = overrides?.newAssetName ?? newAssetName
    const nat = overrides?.newAssetType ?? newAssetType

    let link: SavingLink | null = null
    if (k === 'stock') {
      if (!n) {
        const qty = parseFloat(aq); const price = parseFloat(ap)
        if (sId && qty > 0 && price > 0) link = { kind: 'stock', link_asset_id: sId, add_stock_qty: qty, add_stock_price: price }
      } else {
        const qty = parseFloat(nq); const price = parseFloat(np)
        if (ns && ne && nn && qty > 0 && price > 0)
          link = { kind: 'stock', new_stock_symbol: ns.toUpperCase(), new_stock_exchange: ne.toUpperCase(), new_stock_name: nn, new_stock_qty: qty, new_stock_price: price, new_stock_currency: nc }
      }
    } else {
      const sk = k === 'deposit' ? 'deposit' : 'general' as SavingKind
      if (!n) { if (aId) link = { kind: sk, link_asset_id: aId } }
      else { if (nan) link = { kind: sk, new_asset_name: nan, new_asset_type: nat } }
    }
    onChange(link)
  }

  const setKindAndNotify = (k: SavingKind) => { setKind(k); setIsNew(false); notify({ kind: k, isNew: false }) }
  const setIsNewAndNotify = (v: boolean) => { setIsNew(v); notify({ isNew: v }) }

  return (
    <div className="space-y-2 bg-brand-50/70 rounded-xl p-3 border border-brand-100">
      {/* Kind chips */}
      <div className="flex gap-1.5">
        {(['stock', 'deposit', 'general'] as SavingKind[]).map(k => (
          <button key={k} type="button" onClick={() => setKindAndNotify(k)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${kind === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
            {{ stock: '주식/크립토', deposit: '예적금', general: '기타저축' }[k]}
          </button>
        ))}
      </div>

      {/* Existing vs New */}
      <div className="flex gap-1.5 bg-white rounded-lg p-0.5 border border-slate-100">
        {[false, true].map(v => (
          <button key={String(v)} type="button" onClick={() => setIsNewAndNotify(v)}
            className={`flex-1 py-1 rounded-md text-xs font-medium transition-all ${isNew === v ? 'bg-brand-500 text-white' : 'text-slate-500'}`}>
            {v ? '신규 등록' : '기존 추가'}
          </button>
        ))}
      </div>

      {kind === 'stock' && !isNew && (
        <div className="space-y-1.5">
          <select value={stockId} onChange={e => { setStockId(e.target.value); notify({ stockId: e.target.value }) }} className={inputCls}>
            {stocks.length === 0 ? <option value="">등록된 주식 없음</option>
              : stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} — {s.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-1.5">
            <input type="number" value={addQty} onChange={e => { setAddQty(e.target.value); notify({ addQty: e.target.value }) }}
              placeholder="수량" className={inputCls} />
            <input type="number" value={addPrice} onChange={e => { setAddPrice(e.target.value); notify({ addPrice: e.target.value }) }}
              placeholder="단가" className={inputCls} />
          </div>
        </div>
      )}

      {kind === 'stock' && isNew && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <input value={newSymbol} onChange={e => { setNewSymbol(e.target.value); notify({ newSymbol: e.target.value }) }}
              placeholder="종목코드 *" className={inputCls} />
            <select value={newExchange} onChange={e => { setNewExchange(e.target.value); notify({ newExchange: e.target.value }) }} className={inputCls}>
              {['NYSE', 'NASDAQ', 'KRX', 'KOSDAQ', 'BINANCE', 'UPBIT'].map(x => <option key={x}>{x}</option>)}
            </select>
          </div>
          <input value={newName} onChange={e => { setNewName(e.target.value); notify({ newName: e.target.value }) }}
            placeholder="종목명 *" className={inputCls} />
          <div className="grid grid-cols-2 gap-1.5">
            <input type="number" value={newQty} onChange={e => { setNewQty(e.target.value); notify({ newQty: e.target.value }) }}
              placeholder="수량 *" className={inputCls} />
            <input type="number" value={newPrice} onChange={e => { setNewPrice(e.target.value); notify({ newPrice: e.target.value }) }}
              placeholder="단가 *" className={inputCls} />
          </div>
          <select value={newCurrency} onChange={e => { setNewCurrency(e.target.value as 'USD'|'KRW'); notify({ newCurrency: e.target.value as 'USD'|'KRW' }) }} className={inputCls}>
            <option value="USD">USD</option><option value="KRW">KRW</option>
          </select>
        </div>
      )}

      {(kind === 'deposit' || kind === 'general') && !isNew && (
        <select value={assetId} onChange={e => { setAssetId(e.target.value); notify({ assetId: e.target.value }) }} className={inputCls}>
          {otherAssets.length === 0 ? <option value="">등록된 기타 자산 없음</option>
            : otherAssets.map(a => <option key={a.id} value={a.id}>{a.name} ({(a.value_krw / 10000).toFixed(0)}만원)</option>)}
        </select>
      )}

      {(kind === 'deposit' || kind === 'general') && isNew && (
        <div className="space-y-1.5">
          <input value={newAssetName} onChange={e => { setNewAssetName(e.target.value); notify({ newAssetName: e.target.value }) }}
            placeholder="자산명 *" className={inputCls} />
          <div className="flex gap-1.5">
            {OTHER_ASSET_TYPES.map(t => (
              <button key={t} type="button" onClick={() => { setNewAssetType(t); notify({ newAssetType: t }) }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${newAssetType === t ? 'bg-brand-600 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CalendarCell ─────────────────────────────────────────────────────────────

interface CellProps {
  day: number
  dateKey: string
  dayData: CalendarDay | undefined
  events: CalendarEvent[]
  isToday: boolean
  isSelected: boolean
  isOtherMonth: boolean
  dailyBudget: number
  holiday?: string
  col: number
  onClick: () => void
}

function CalendarCell({ day, dateKey, dayData, events, isToday, isSelected, isOtherMonth, dailyBudget, holiday, col, onClick }: CellProps) {
  const feEvents   = events.filter(e => e.type === 'fixed_expense')
  const divEvents  = events.filter(e => e.type === 'dividend')
  const hasExpense = (dayData?.total_expense ?? 0) > 0
  const hasIncome  = (dayData?.total_income ?? 0) > 0

  const expense     = dayData?.total_expense ?? 0
  const budgetRatio = dailyBudget > 0 && expense > 0 ? expense / dailyBudget : 0
  const budgetTint  =
    isSelected || isToday ? ''
    : budgetRatio > 1    ? 'bg-rose-50'
    : budgetRatio >= 0.8 ? 'bg-amber-50'
    : ''

  if (day === 0) return <div className="h-10 sm:h-12" />

  return (
    <button
      onClick={onClick}
      className={`
        h-12 sm:h-14 rounded-lg p-0.5 flex flex-col items-center
        text-left transition-all duration-150 relative
        ${isSelected
          ? 'bg-brand-500 shadow-md ring-2 ring-brand-100'
          : isToday
            ? 'bg-brand-50 ring-1 ring-brand-100'
            : budgetTint
              ? `${budgetTint} hover:brightness-95`
              : 'hover:bg-slate-50'
        }
        ${isOtherMonth ? 'opacity-25' : ''}
      `}
    >
      <span className={`text-xs font-semibold self-center leading-none mt-0.5 ${
        isSelected ? 'text-white'
        : isToday   ? 'text-brand-600'
        : col === 0 || (col !== 6 && holiday) ? 'text-rose-500'
        : col === 6 ? 'text-blue-500'
        : 'text-slate-600'
      }`}>
        {day}
      </span>

      {hasExpense && (
        <span className={`text-[9px] font-bold tabular-nums leading-none ${
          isSelected ? 'text-red-200' : budgetRatio > 1 ? 'text-rose-600' : 'text-rose-500'
        }`}>
          {fmtCell(dayData!.total_expense)}
        </span>
      )}

      {hasIncome && (
        <span className={`text-[8px] tabular-nums leading-none ${
          isSelected ? 'text-green-200' : 'text-emerald-500'
        }`}>
          +{fmtCell(dayData!.total_income)}
        </span>
      )}

      {budgetRatio > 1 && !isSelected && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-rose-400 rounded-full" />
      )}

      {feEvents.length > 0 && (
        <span
          title={feEvents.map(e => e.title).join(', ')}
          className={`text-[8px] font-semibold tabular-nums leading-none ${isSelected ? 'text-violet-200' : 'text-violet-400'}`}
        >
          📌{fmtCell(feEvents.reduce((s, e) => s + e.amount, 0))}
        </span>
      )}
      {divEvents.length > 0 && (
        <span
          title={divEvents.map(e => e.title).join(', ')}
          className={`text-[8px] font-semibold tabular-nums leading-none ${isSelected ? 'text-teal-200' : 'text-teal-500'}`}
        >
          💰{fmtCell(divEvents.reduce((s, e) => s + e.amount, 0))}
        </span>
      )}
    </button>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  dateKey: string
  transactions: Transaction[]
  calendarEvents: CalendarEvent[]
  users: User[]
  stocks: StockAssetWithPrice[]
  otherAssets: OtherAsset[]
  onClose: () => void
  onAddTransaction?: (payload: AddTransactionPayload) => Promise<void>
  onUpdateTransaction?: (id: string, data: { title: string; amount: number; category: string; user_id: string }) => Promise<void>
  onDeleteTransaction?: (id: string) => Promise<void>
}

function DetailPanel({ dateKey, transactions, calendarEvents, users, stocks, otherAssets, onClose, onAddTransaction, onUpdateTransaction, onDeleteTransaction }: DetailPanelProps) {
  const dayTxns = useMemo(() =>
    transactions
      .filter(tx => toDateKey(new Date(tx.date)) === dateKey)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [transactions, dateKey]
  )
  const dayEvents = calendarEvents.filter(e => e.date === dateKey)
  const userMap   = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users])

  const totalExpense = dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalIncome  = dayTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)

  const [showForm, setShowForm]     = useState(false)
  const [txType, setTxType]         = useState<'expense' | 'income' | 'saving'>('expense')
  const [userId, setUserId]         = useState(users[0]?.id ?? '')
  const [amount, setAmount]         = useState('')
  const [category, setCategory]     = useState('')
  const [title, setTitle]           = useState('')
  const [savingLink, setSavingLink] = useState<SavingLink | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showCatManager, setShowCatManager] = useState(false)
  const [editingTxId, setEditingTxId]       = useState<string | null>(null)
  const [editTitle, setEditTitle]           = useState('')
  const [editAmount, setEditAmount]         = useState('')
  const [editCategory, setEditCategory]     = useState('')
  const [editUserId, setEditUserId]         = useState('')
  const [editSaving, setEditSaving]         = useState(false)
  const [formError, setFormError]           = useState('')
  const { expenseCategories, incomeCategories, addCategory, removeCategory } = useCategories()

  const categories = txType === 'expense' ? expenseCategories : incomeCategories

  const resetForm = () => {
    setShowForm(false); setAmount(''); setCategory(''); setTitle('')
    setTxType('expense'); setUserId(users[0]?.id ?? ''); setSavingLink(null)
  }

  const handleSubmit = async () => {
    const amt = Number(amount.replace(/,/g, ''))
    if (!amt || amt <= 0) { setFormError('금액을 입력해주세요'); return }
    if (txType === 'saving' && !savingLink) { setFormError('저축 자산 정보를 입력해주세요'); return }
    if (!onAddTransaction) return
    setFormError('')
    setSubmitting(true)
    try {
      await onAddTransaction({
        user_id: userId,
        type: txType,
        amount: amt,
        category: txType === 'saving' ? '저축/투자' : (category || '기타'),
        title: title.trim(),
        date: dateKey,
        saving_link: savingLink ?? undefined,
      })
      resetForm()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '저장 실패. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitColor =
    txType === 'expense' ? 'bg-rose-500 hover:bg-rose-600'
    : txType === 'income' ? 'bg-emerald-500 hover:bg-emerald-600'
    : 'bg-brand-500 hover:bg-brand-600'

  const submitLabel =
    txType === 'expense' ? '지출 저장'
    : txType === 'income' ? '수입 저장'
    : '저축 저장'

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-2">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{fmtDateLabel(dateKey)}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {totalExpense > 0 && (
              <span className="text-xs text-rose-500 font-medium">지출 {totalExpense.toLocaleString()}원</span>
            )}
            {totalIncome > 0 && (
              <span className="text-xs text-emerald-600 font-medium">수입 {totalIncome.toLocaleString()}원</span>
            )}
            {dayTxns.length === 0 && dayEvents.length === 0 && (
              <span className="text-xs text-slate-400">거래 내역 없음</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onAddTransaction && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-semibold hover:bg-brand-600 transition-colors"
            >
              <PlusIcon className="h-3 w-3" />추가
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors ml-1">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Inline add-transaction form ── */}
      {showForm && (
        <div className="px-4 py-3 bg-brand-50/60 border-b border-brand-100 space-y-3">

          {/* Row 1: type toggle + user selector */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => { setTxType('expense'); setCategory(''); setSavingLink(null) }}
                className={`px-3 py-1.5 transition-colors ${txType === 'expense' ? 'bg-rose-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >지출</button>
              <button
                onClick={() => { setTxType('income'); setCategory(''); setSavingLink(null) }}
                className={`px-3 py-1.5 transition-colors ${txType === 'income' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >수입</button>
              <button
                onClick={() => { setTxType('saving'); setCategory('저축/투자'); setSavingLink(null) }}
                className={`px-3 py-1.5 transition-colors ${txType === 'saving' ? 'bg-brand-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              >저축</button>
            </div>

            <div className="flex gap-1 ml-auto">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => setUserId(u.id)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold transition-all ${
                    userId === u.id ? 'ring-2 ring-offset-1 ring-brand-500 scale-110' : 'opacity-50'
                  }`}
                  style={{ backgroundColor: u.avatar_color }}
                  title={u.name}
                >
                  {u.name[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: amount */}
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(formatAmountInput(e.target.value))}
              placeholder="금액"
              className="w-full text-right text-lg font-bold border border-slate-200 rounded-xl px-3 py-2.5 pr-10 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 tabular-nums"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">원</span>
          </div>

          {/* Row 3: title */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && txType !== 'saving') handleSubmit() }}
            placeholder={txType === 'saving' ? '내용 (예: 적금 납입, 삼성전자 매수)' : '내용 (예: 스타벅스, 편의점)'}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          {/* Row 4: category chips (income/expense only) */}
          {txType !== 'saving' && (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(prev => prev === c ? '' : c)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                      category === c
                        ? txType === 'expense' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                        : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCatManager(true)}
                  className="text-xs px-2 py-1 rounded-full text-slate-400 border border-dashed border-slate-200 hover:border-slate-300 hover:text-slate-500 transition-colors"
                  title="카테고리 관리"
                >
                  <Cog6ToothIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Row 5: SavingLink form (saving only) */}
          {txType === 'saving' && (
            <SavingLinkInline
              stocks={Array.isArray(stocks) ? stocks : []}
              otherAssets={Array.isArray(otherAssets) ? otherAssets : []}
              onChange={setSavingLink}
            />
          )}

          {formError && (
            <p className="text-xs text-rose-600 font-medium">{formError}</p>
          )}

          {/* Row 6: actions */}
          <div className="flex gap-2">
            <button
              onClick={resetForm}
              className="flex-1 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || (txType === 'saving' && !savingLink)}
              className={`flex-1 py-2 text-sm font-bold text-white rounded-xl transition-colors disabled:opacity-40 ${submitColor}`}
            >
              {submitting ? '저장 중...' : submitLabel}
            </button>
          </div>
        </div>
      )}

      {/* Events */}
      {dayEvents.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
          <div className="flex flex-wrap gap-2">
            {dayEvents.map((ev, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg font-medium ${
                ev.type === 'fixed_expense' ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
              }`}>
                <span>{ev.type === 'fixed_expense' ? '📌' : '💰'}</span>
                <span>{ev.title}</span>
                <span className="opacity-60">
                  {ev.type === 'fixed_expense' ? '-' : '+'}{(ev.amount / 10000).toFixed(0)}만원
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction timeline */}
      <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
        {dayTxns.length === 0 ? (
          <div className="px-4 py-5 text-center text-xs text-slate-400">
            {dayEvents.length > 0 ? '직접 등록된 거래 내역은 없어요' : '이 날은 조용했어요 🌿'}
          </div>
        ) : (
          dayTxns.map(tx => {
            const user = userMap[tx.user_id]
            const isSaving = tx.type === 'saving'
            const isExpense = tx.type === 'expense'
            const amtColor = isSaving ? 'text-brand-600' : isExpense ? 'text-rose-500' : 'text-emerald-600'
            const amtPrefix = isExpense ? '-' : '+'
            const isEditing = editingTxId === tx.id
            const editCats = isExpense ? expenseCategories : incomeCategories

            if (isEditing) {
              return (
                <div key={tx.id} className="px-4 py-3 bg-slate-50 space-y-2">
                  <input
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="내용"
                  />
                  <input
                    type="number"
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    placeholder="금액"
                  />
                  {!isSaving && (
                    <div className="flex flex-wrap gap-1">
                      {editCats.map(c => (
                        <button key={c} onClick={() => setEditCategory(c)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${editCategory === c ? 'bg-brand-500 text-white border-brand-500' : 'border-slate-200 text-slate-500'}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  <select
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                    value={editUserId}
                    onChange={e => setEditUserId(e.target.value)}
                  >
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const amt = Number(editAmount)
                        if (!onUpdateTransaction || isNaN(amt) || amt <= 0 || !editTitle.trim()) return
                        await onUpdateTransaction(tx.id, { title: editTitle.trim(), amount: amt, category: editCategory || tx.category, user_id: editUserId || tx.user_id })
                        setEditingTxId(null)
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600"
                    >
                      <CheckIcon className="h-3 w-3" /> 저장
                    </button>
                    <button onClick={() => setEditingTxId(null)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs hover:bg-slate-200">
                      취소
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 group">
                {user && (
                  <div
                    className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-white text-[8px] font-bold"
                    style={{ backgroundColor: user.avatar_color }}
                  >
                    {user.name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-700 truncate">{tx.title}</span>
                    {tx.is_fixed && <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full shrink-0">고정</span>}
                    {isSaving && <span className="text-[9px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full shrink-0">저축</span>}
                    {tx.fixed_expense_id && <span className="text-[9px]">📌</span>}
                    {tx.tags?.includes('배당') && <span className="text-[9px]">💰</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-slate-400">{fmtTime(tx.date)}</span>
                    {tx.category && (
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{tx.category}</span>
                    )}
                  </div>
                </div>
                <span className={`text-sm font-bold tabular-nums shrink-0 ${amtColor}`}>
                  {amtPrefix}{tx.amount.toLocaleString()}원
                </span>
                {(onUpdateTransaction || onDeleteTransaction) && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {onUpdateTransaction && (
                      <button
                        onClick={() => {
                          setEditingTxId(tx.id)
                          setEditTitle(tx.title)
                          setEditAmount(String(tx.amount))
                          setEditCategory(tx.category)
                          setEditUserId(tx.user_id)
                          setEditSaving(isSaving)
                        }}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-500"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onDeleteTransaction && (
                      <button
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-500"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {showCatManager && (
        <CategoryManager
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onAdd={addCategory}
          onRemove={removeCategory}
          onClose={() => setShowCatManager(false)}
        />
      )}
    </div>
  )
}

// ─── Main CalendarView ────────────────────────────────────────────────────────

interface CalendarViewProps {
  year: number
  month: number
  calendarData: CalendarSummaryResponse | null
  transactions: Transaction[]
  users: User[]
  stocks: StockAssetWithPrice[]
  otherAssets: OtherAsset[]
  budgetLimit?: number
  onMonthChange: (year: number, month: number) => void
  onAddTransaction?: (payload: AddTransactionPayload) => Promise<void>
  onUpdateTransaction?: (id: string, data: { title: string; amount: number; category: string; user_id: string }) => Promise<void>
  onDeleteTransaction?: (id: string) => Promise<void>
}

export default function CalendarView({
  year,
  month,
  calendarData,
  transactions,
  users,
  stocks,
  otherAssets,
  budgetLimit = 0,
  onMonthChange,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const today = todayKey()

  const dayMap = useMemo((): Record<string, CalendarDay> => {
    const m: Record<string, CalendarDay> = {}
    calendarData?.days.forEach(d => { m[d.date] = d })
    return m
  }, [calendarData])

  const eventMap = useMemo((): Record<string, CalendarEvent[]> => {
    const m: Record<string, CalendarEvent[]> = {}
    calendarData?.events.forEach(e => {
      if (!m[e.date]) m[e.date] = []
      m[e.date].push(e)
    })
    return m
  }, [calendarData])

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const daysInMonth    = new Date(year, month, 0).getDate()
  const dailyBudget    = budgetLimit > 0 ? Math.round(budgetLimit / daysInMonth) : 0
  const holidayMap     = useMemo(() => getHolidaysForMonth(year, month), [year, month])

  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - firstDayOfWeek + 1
    return dayNum >= 1 && dayNum <= daysInMonth ? dayNum : 0
  })

  const goPrev = () => month === 1 ? onMonthChange(year - 1, 12) : onMonthChange(year, month - 1)
  const goNext = () => month === 12 ? onMonthChange(year + 1, 1) : onMonthChange(year, month + 1)

  const handleCellClick = (dayNum: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    setSelectedDate(prev => prev === key ? null : key)
  }

  const monthTotal = calendarData?.days.reduce((s, d) => ({
    expense: s.expense + d.total_expense,
    income:  s.income  + d.total_income,
  }), { expense: 0, income: 0 }) ?? { expense: 0, income: 0 }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

      {/* ── Month navigator + stats ── */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <button onClick={goPrev} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-sm font-bold text-slate-800">{year}년 {month}월</span>
            <span className="text-rose-500 font-medium">↓ {fmtCell(monthTotal.expense)}</span>
            <span className="text-emerald-600 font-medium">↑ {fmtCell(monthTotal.income)}</span>
            {budgetLimit > 0 && (
              <span className={`font-semibold ${
                monthTotal.expense > budgetLimit ? 'text-rose-600' :
                monthTotal.expense / budgetLimit >= 0.9 ? 'text-amber-500' :
                'text-brand-500'
              }`}>
                {Math.round(monthTotal.expense / budgetLimit * 100)}%
              </span>
            )}
          </div>
          <button onClick={goNext} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Weekday header ── */}
      <div className="grid grid-cols-7 border-t border-slate-100">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`text-center py-1 text-xs font-semibold ${
            i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'
          }`}>
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div className="grid grid-cols-7 gap-px px-1 pb-1 border-t border-slate-50">
        {cells.map((dayNum, i) => {
          const dateKey = dayNum > 0
            ? `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
            : ''
          return (
            <CalendarCell
              key={i}
              day={dayNum}
              dateKey={dateKey}
              dayData={dayMap[dateKey]}
              events={eventMap[dateKey] ?? []}
              isToday={dateKey === today}
              isSelected={dateKey === selectedDate}
              isOtherMonth={false}
              dailyBudget={dailyBudget}
              holiday={holidayMap[dateKey]}
              col={i % 7}
              onClick={() => dayNum > 0 && handleCellClick(dayNum)}
            />
          )
        })}
      </div>

      {/* ── Detail panel ── */}
      {selectedDate && (
        <div className="px-1.5 pb-1.5">
          <DetailPanel
            dateKey={selectedDate}
            transactions={transactions}
            calendarEvents={calendarData?.events ?? []}
            users={users}
            stocks={stocks}
            otherAssets={otherAssets}
            onClose={() => setSelectedDate(null)}
            onAddTransaction={onAddTransaction}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
          />
        </div>
      )}
    </div>
  )
}
