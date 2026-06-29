'use client'

import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  PlusIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  BoltIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { formatAmountInput } from '@/lib/formatNumber'
import type {
  FixedExpense,
  FixedExpenseOwner,
  FixedExpenseKind,
  FixedExpenseSummary,
  CreateFixedExpenseRequest,
  UpdateFixedExpenseRequest,
  User,
  SavingLink,
  SavingKind,
  StockAssetWithPrice,
  OtherAsset,
  OtherAssetType,
} from '@/types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatKRW(v: number): string {
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(2)}억원`
  if (Math.abs(v) >= 10_000) return `${(v / 10_000).toFixed(1)}만원`
  return `${v.toLocaleString()}원`
}

const OWNER_LABEL: Record<FixedExpenseOwner, string> = {
  husband: '남편',
  wife: '아내',
  joint: '공동',
}

const OWNER_COLOR: Record<FixedExpenseOwner, string> = {
  husband: 'bg-blue-100 text-blue-700',
  wife: 'bg-pink-100 text-pink-700',
  joint: 'bg-violet-100 text-violet-700',
}

const CATEGORIES = [
  '주거비', '대출', '보험', '통신비', '구독서비스',
  '교육비', '교통비', '의료비', '저축/투자', '기타',
]

const OTHER_ASSET_TYPES: OtherAssetType[] = ['부동산', '예/적금', '현금', '기타']

// ─── sub-components ───────────────────────────────────────────────────────────

function OwnerBadge({ owner }: { owner: FixedExpenseOwner }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${OWNER_COLOR[owner]}`}>
      {OWNER_LABEL[owner]}
    </span>
  )
}

function KindBadge({ kind }: { kind: FixedExpenseKind }) {
  return kind === 'saving' ? (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700">저축</span>
  ) : null
}

// ─── SavingLink sub-form ──────────────────────────────────────────────────────

interface SavingLinkFormProps {
  stocks: StockAssetWithPrice[]
  otherAssets: OtherAsset[]
  initial?: SavingLink
  onChange: (link: SavingLink | null) => void
}

function SavingLinkForm({ stocks, otherAssets, initial, onChange }: SavingLinkFormProps) {
  const [kind, setKind] = useState<SavingKind>(initial?.kind ?? 'stock')
  const [isNew, setIsNew] = useState(initial ? !initial.link_asset_id : false)

  // stock existing
  const [stockId, setStockId] = useState(initial?.link_asset_id ?? (stocks[0]?.id ?? ''))
  const [addQty, setAddQty] = useState(initial?.add_stock_qty?.toString() ?? '')
  const [addPrice, setAddPrice] = useState(initial?.add_stock_price?.toString() ?? '')

  // stock new
  const [newSymbol, setNewSymbol] = useState(initial?.new_stock_symbol ?? '')
  const [newExchange, setNewExchange] = useState(initial?.new_stock_exchange ?? 'NYSE')
  const [newName, setNewName] = useState(initial?.new_stock_name ?? '')
  const [newQty, setNewQty] = useState(initial?.new_stock_qty?.toString() ?? '')
  const [newPrice, setNewPrice] = useState(initial?.new_stock_price?.toString() ?? '')
  const [newCurrency, setNewCurrency] = useState<'USD' | 'KRW'>((initial?.new_stock_currency as 'USD' | 'KRW') ?? 'USD')

  // deposit/general existing
  const [assetId, setAssetId] = useState(
    (initial?.kind !== 'stock' && initial?.link_asset_id) ? initial.link_asset_id : (otherAssets[0]?.id ?? '')
  )

  // deposit/general new
  const [newAssetName, setNewAssetName] = useState(initial?.new_asset_name ?? '')
  const [newAssetType, setNewAssetType] = useState<OtherAssetType>((initial?.new_asset_type as OtherAssetType) ?? '예/적금')

  useEffect(() => {
    let link: SavingLink | null = null

    if (kind === 'stock') {
      if (!isNew) {
        const qty = parseFloat(addQty)
        const price = parseFloat(addPrice.replace(/,/g, ''))
        if (stockId && qty > 0 && price > 0) {
          link = { kind: 'stock', link_asset_id: stockId, add_stock_qty: qty, add_stock_price: price }
        }
      } else {
        const qty = parseFloat(newQty)
        const price = parseFloat(newPrice.replace(/,/g, ''))
        if (newSymbol && newExchange && newName && qty > 0 && price > 0) {
          link = {
            kind: 'stock',
            new_stock_symbol: newSymbol.toUpperCase(),
            new_stock_exchange: newExchange.toUpperCase(),
            new_stock_name: newName,
            new_stock_qty: qty,
            new_stock_price: price,
            new_stock_currency: newCurrency,
          }
        }
      }
    } else {
      const k = kind === 'deposit' ? 'deposit' : 'general'
      if (!isNew) {
        if (assetId) link = { kind: k as SavingKind, link_asset_id: assetId }
      } else {
        if (newAssetName) link = { kind: k as SavingKind, new_asset_name: newAssetName, new_asset_type: newAssetType }
      }
    }

    onChange(link)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, isNew, stockId, addQty, addPrice, newSymbol, newExchange, newName, newQty, newPrice, newCurrency, assetId, newAssetName, newAssetType])

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
  const chipCls = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium transition-all ${active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`

  return (
    <div className="space-y-3 bg-brand-50/50 rounded-xl p-3 border border-brand-100">
      <label className="text-xs font-medium text-slate-600 block">저축 연동 설정</label>

      {/* Kind */}
      <div className="flex flex-wrap gap-1.5">
        {(['stock', 'deposit', 'general'] as SavingKind[]).map(k => (
          <button key={k} type="button" onClick={() => { setKind(k); setIsNew(false) }}
            className={chipCls(kind === k)}>
            {{ stock: '주식/크립토', deposit: '예적금', general: '기타저축' }[k]}
          </button>
        ))}
      </div>

      {/* Existing vs New */}
      <div className="flex gap-2 bg-white rounded-lg p-0.5 border border-slate-100">
        <button type="button" onClick={() => setIsNew(false)}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${!isNew ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500'}`}>
          기존 자산에 추가
        </button>
        <button type="button" onClick={() => setIsNew(true)}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${isNew ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500'}`}>
          신규 자산 등록
        </button>
      </div>

      {kind === 'stock' && !isNew && (
        <div className="space-y-2">
          <select value={stockId} onChange={e => setStockId(e.target.value)} className={inputCls}>
            {stocks.length === 0
              ? <option value="">등록된 주식 없음</option>
              : stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} — {s.name}</option>)
            }
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">수량</label>
              <input type="number" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">단가</label>
              <input type="text" inputMode="decimal" value={addPrice} onChange={e => setAddPrice(formatAmountInput(e.target.value, true))} placeholder="0" className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {kind === 'stock' && isNew && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">종목 코드 *</label>
              <input value={newSymbol} onChange={e => setNewSymbol(e.target.value)} placeholder="AAPL" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">거래소 *</label>
              <select value={newExchange} onChange={e => setNewExchange(e.target.value)} className={inputCls}>
                {['NYSE', 'NASDAQ', 'KRX', 'KOSDAQ', 'BINANCE', 'UPBIT'].map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
          </div>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="종목명 *" className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">수량 *</label>
              <input type="number" value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">단가 *</label>
              <input type="text" inputMode="decimal" value={newPrice} onChange={e => setNewPrice(formatAmountInput(e.target.value, true))} placeholder="0" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">통화</label>
            <select value={newCurrency} onChange={e => setNewCurrency(e.target.value as 'USD' | 'KRW')} className={inputCls}>
              <option value="USD">USD</option>
              <option value="KRW">KRW</option>
            </select>
          </div>
        </div>
      )}

      {(kind === 'deposit' || kind === 'general') && !isNew && (
        <select value={assetId} onChange={e => setAssetId(e.target.value)} className={inputCls}>
          {otherAssets.length === 0
            ? <option value="">등록된 기타 자산 없음</option>
            : otherAssets.map(a => <option key={a.id} value={a.id}>{a.name} ({formatKRW(a.value_krw)})</option>)
          }
        </select>
      )}

      {(kind === 'deposit' || kind === 'general') && isNew && (
        <div className="space-y-2">
          <input value={newAssetName} onChange={e => setNewAssetName(e.target.value)}
            placeholder="자산명 *" className={inputCls} />
          <div className="flex flex-wrap gap-1.5">
            {OTHER_ASSET_TYPES.map(t => (
              <button key={t} type="button" onClick={() => setNewAssetType(t)} className={chipCls(newAssetType === t)}>{t}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

interface FeModalProps {
  users: User[]
  stocks: StockAssetWithPrice[]
  otherAssets: OtherAsset[]
  editing: FixedExpense | null
  onClose: () => void
  onSave: (data: CreateFixedExpenseRequest | UpdateFixedExpenseRequest) => Promise<void>
}

function FeModal({ users, stocks, otherAssets, editing, onClose, onSave }: FeModalProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [category, setCategory] = useState(editing?.category ?? '')
  const [amount, setAmount] = useState(editing ? formatAmountInput(String(editing.amount)) : '')
  const [owner, setOwner] = useState<FixedExpenseOwner>(editing?.owner ?? 'joint')
  const [kind, setKind] = useState<FixedExpenseKind>(editing?.kind ?? 'spending')
  const [dayOfMonth, setDayOfMonth] = useState(editing?.day_of_month ?? 1)
  const [memo, setMemo] = useState(editing?.memo ?? '')
  const [userId, setUserId] = useState(editing?.user_id ?? (users[0]?.id ?? ''))
  const [savingLink, setSavingLink] = useState<SavingLink | null>(editing?.saving_link ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('명칭을 입력해주세요'); return }
    const amt = parseInt(amount.replace(/,/g, ''), 10)
    if (isNaN(amt) || amt <= 0) { setError('금액을 올바르게 입력해주세요'); return }
    if (kind === 'saving' && !savingLink) { setError('저축 연동 정보를 입력해주세요'); return }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await onSave({
          owner,
          kind,
          title: title.trim(),
          category: category.trim(),
          amount: amt,
          day_of_month: dayOfMonth,
          memo: memo.trim(),
          saving_link: kind === 'saving' ? (savingLink ?? undefined) : undefined,
        } as UpdateFixedExpenseRequest)
      } else {
        await onSave({
          user_id: userId,
          owner,
          kind,
          title: title.trim(),
          category: category.trim() || (kind === 'saving' ? '저축/투자' : ''),
          amount: amt,
          currency: 'KRW',
          cycle: 'monthly',
          day_of_month: dayOfMonth,
          memo: memo.trim(),
          saving_link: kind === 'saving' ? (savingLink ?? undefined) : undefined,
        } as CreateFixedExpenseRequest)
      }
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
      <motion.div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">
            {editing ? '고정비 수정' : '고정비 추가'}
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(kind === 'saving'
                ? ['husband', 'wife'] as FixedExpenseOwner[]
                : ['husband', 'wife', 'joint'] as FixedExpenseOwner[]
              ).map(o => {
                const user = o === 'husband' ? users[0] : o === 'wife' ? users[1] : null
                const bgColor = user?.avatar_color ?? (o === 'joint' ? '#8b5cf6' : o === 'husband' ? '#0F4C81' : '#059669')
                const label = o === 'joint' ? '공' : (user?.name[0] ?? (o === 'husband' ? '남' : '여'))
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOwner(o)}
                    title={OWNER_LABEL[o]}
                    className={`w-7 h-7 rounded-full text-white text-xs font-bold transition-all ${owner === o ? 'ring-2 ring-offset-1 ring-brand-500 scale-110' : 'opacity-40'}`}
                    style={{ backgroundColor: bgColor }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Kind toggle */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">고정비 종류</label>
            <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
              <button
                type="button"
                onClick={() => { setKind('spending'); setSavingLink(null) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${kind === 'spending' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
              >
                💸 지출 고정비
              </button>
              <button
                type="button"
                onClick={() => { setKind('saving'); if (owner === 'joint') setOwner('husband') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${kind === 'saving' ? 'bg-brand-500 text-white shadow' : 'text-slate-500'}`}
              >
                🏦 저축 고정비
              </button>
            </div>
          </div>

          {/* 명칭 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">명칭 *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={kind === 'saving' ? '예: 정기 적금, 삼성전자 자동매수' : '예: 아파트 관리비, 넷플릭스'}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* 카테고리 (spending only) */}
          {kind === 'spending' && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">카테고리</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      category === c
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'border-slate-200 text-slate-500 hover:border-brand-100'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 금액 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">금액 (원) *</label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(formatAmountInput(e.target.value))}
              placeholder="예: 350,000"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {amount && parseInt(amount.replace(/,/g, '')) > 0 && (
              <p className="text-xs text-brand-500 mt-1">= {formatKRW(parseInt(amount.replace(/,/g, '')))}</p>
            )}
          </div>

          {/* SavingLink form (saving only) */}
          {kind === 'saving' && (
            <SavingLinkForm
              stocks={stocks}
              otherAssets={otherAssets}
              initial={editing?.saving_link}
              onChange={setSavingLink}
            />
          )}

          {/* 이체 예정일 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">이체 예정일 (매월)</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">매월</span>
              <select
                value={dayOfMonth}
                onChange={e => setDayOfMonth(Number(e.target.value))}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}일</option>
                ))}
              </select>
              <span className="text-xs text-slate-400">이체</span>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">메모</label>
            <input
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="간단한 메모 (선택)"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : editing ? '수정 완료' : '추가하기'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Row dropdown menu ────────────────────────────────────────────────────────

function FeMenu({
  onEdit,
  onDelete,
  onToggle,
  isActive,
}: {
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  isActive: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <EllipsisVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-36 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
          <button
            onClick={() => { onEdit(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <PencilIcon className="h-3.5 w-3.5" /> 수정
          </button>
          <button
            onClick={() => { onToggle(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <BoltIcon className="h-3.5 w-3.5" />
            {isActive ? '비활성화' : '활성화'}
          </button>
          <button
            onClick={() => { onDelete(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <TrashIcon className="h-3.5 w-3.5" /> 삭제
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

interface FixedExpenseCardProps {
  fixedExpenses: FixedExpense[]
  summary: FixedExpenseSummary | null
  users: User[]
  stocks: StockAssetWithPrice[]
  otherAssets: OtherAsset[]
  year: number
  month: number
  onAdd: (data: CreateFixedExpenseRequest) => Promise<void>
  onEdit: (id: string, data: UpdateFixedExpenseRequest) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function FixedExpenseCard({
  fixedExpenses,
  summary,
  users,
  stocks,
  otherAssets,
  year,
  month,
  onAdd,
  onEdit,
  onDelete,
}: FixedExpenseCardProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingFe, setEditingFe] = useState<FixedExpense | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const activeItems = fixedExpenses.filter(fe => fe.is_active)
  const inactiveItems = fixedExpenses.filter(fe => !fe.is_active)
  const totalAmount = activeItems.reduce((s, fe) => s + fe.amount, 0)

  const handleSave = async (data: CreateFixedExpenseRequest | UpdateFixedExpenseRequest) => {
    if (editingFe) {
      await onEdit(editingFe.id, data as UpdateFixedExpenseRequest)
    } else {
      await onAdd(data as CreateFixedExpenseRequest)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100">

      {/* ── banner ── */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-100 rounded-t-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium text-amber-600 mb-0.5">😮‍💨 {year}년 {month}월 고정비</p>
            <p className="text-xl font-black text-slate-900 tabular-nums">{formatKRW(totalAmount)}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditingFe(null); setShowModal(true) }}
              className="w-8 h-8 rounded-xl bg-white/60 hover:bg-white/90 flex items-center justify-center transition-colors"
              aria-label="고정비 추가"
            >
              <PlusIcon className="h-4 w-4 text-amber-700" />
            </button>
            <button
              onClick={() => setIsOpen(v => !v)}
              className="w-8 h-8 rounded-xl bg-amber-100 hover:bg-amber-200 flex items-center justify-center transition-colors"
              aria-label={isOpen ? '접기' : '펼치기'}
            >
              <ChevronDownIcon className={`h-4 w-4 text-amber-700 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Fixed expense list ── */}
      {isOpen && <div className="divide-y divide-slate-50">
        {activeItems.length === 0 && inactiveItems.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-slate-400">등록된 고정비가 없어요</p>
            <button
              onClick={() => { setEditingFe(null); setShowModal(true) }}
              className="mt-2 text-xs text-brand-500 hover:underline"
            >
              첫 고정비 추가하기 →
            </button>
          </div>
        ) : (
          <>
            {activeItems.map(fe => (
              <FeRow key={fe.id} fe={fe}
                onEdit={() => { setEditingFe(fe); setShowModal(true) }}
                onDelete={() => onDelete(fe.id)}
                onToggle={() => onEdit(fe.id, { is_active: false })} />
            ))}
            {inactiveItems.length > 0 && (
              <>
                <div className="px-5 py-2 bg-slate-50">
                  <p className="text-[10px] text-slate-400 font-medium">비활성</p>
                </div>
                {inactiveItems.map(fe => (
                  <FeRow key={fe.id} fe={fe}
                    onEdit={() => { setEditingFe(fe); setShowModal(true) }}
                    onDelete={() => onDelete(fe.id)}
                    onToggle={() => onEdit(fe.id, { is_active: true })} />
                ))}
              </>
            )}
          </>
        )}
      </div>}

      {/* ── Modal ── */}
      <AnimatePresence>
        {showModal && (
          <FeModal
            users={users}
            stocks={stocks}
            otherAssets={otherAssets}
            editing={editingFe}
            onClose={() => { setShowModal(false); setEditingFe(null) }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Individual row ───────────────────────────────────────────────────────────

function FeRow({
  fe,
  onEdit,
  onDelete,
  onToggle,
}: {
  fe: FixedExpense
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 ${!fe.is_active ? 'opacity-40' : ''}`}>
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${fe.is_active ? 'bg-amber-400' : 'bg-slate-200'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs font-medium text-slate-800 truncate">{fe.title}</span>
          <OwnerBadge owner={fe.owner} />
          <KindBadge kind={fe.kind ?? 'spending'} />
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5">
          매월 {fe.day_of_month}일
          {fe.category && <span className="ml-1 text-slate-300">· {fe.category}</span>}
        </p>
      </div>

      <span className="text-xs font-bold text-slate-700 tabular-nums shrink-0">
        {formatKRW(fe.amount)}
      </span>

      <FeMenu onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} isActive={fe.is_active} />
    </div>
  )
}
