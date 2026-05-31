'use client'

import { useState, useEffect } from 'react'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import type { User, SavingLink, SavingKind, StockAssetWithPrice, OtherAsset, OtherAssetType } from '@/types'
import { useCategories } from '@/hooks/useCategories'
import CategoryManager from '@/components/dashboard/CategoryManager'
import { formatAmountInput } from '@/lib/formatNumber'

type TxType = 'income' | 'expense' | 'saving'

type AddData = {
  user_id: string
  type: TxType
  amount: number
  category: string
  title: string
  payment_method: string
  saving_link?: SavingLink
}

interface QuickAddButtonProps {
  users: User[]
  stocks: StockAssetWithPrice[]
  otherAssets: OtherAsset[]
  onAdd: (data: AddData) => Promise<void>
  open?: boolean
  onClose?: () => void
}

const PAYMENT_METHODS = ['신용카드', '체크카드', '현금', '모바일페이', '계좌이체']
const OTHER_ASSET_TYPES: OtherAssetType[] = ['부동산', '예/적금', '현금', '기타']

// ─── SavingLink sub-form ──────────────────────────────────────────────────────

interface SavingLinkFormProps {
  stocks: StockAssetWithPrice[]
  otherAssets: OtherAsset[]
  onChange: (link: SavingLink | null) => void
}

function SavingLinkForm({ stocks, otherAssets, onChange }: SavingLinkFormProps) {
  const [kind, setKind] = useState<SavingKind>('stock')
  const [isNew, setIsNew] = useState(false)

  // stock existing
  const [stockId, setStockId] = useState(stocks[0]?.id ?? '')
  const [addQty, setAddQty] = useState('')
  const [addPrice, setAddPrice] = useState('')

  // stock new
  const [newSymbol, setNewSymbol] = useState('')
  const [newExchange, setNewExchange] = useState('NYSE')
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newCurrency, setNewCurrency] = useState<'USD' | 'KRW'>('USD')

  // deposit/general existing
  const [assetId, setAssetId] = useState(otherAssets[0]?.id ?? '')

  // deposit/general new
  const [newAssetName, setNewAssetName] = useState('')
  const [newAssetType, setNewAssetType] = useState<OtherAssetType>('예/적금')

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
        if (assetId) {
          link = { kind: k as SavingKind, link_asset_id: assetId }
        }
      } else {
        if (newAssetName) {
          link = { kind: k as SavingKind, new_asset_name: newAssetName, new_asset_type: newAssetType }
        }
      }
    }

    onChange(link)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, isNew, stockId, addQty, addPrice, newSymbol, newExchange, newName, newQty, newPrice, newCurrency, assetId, newAssetName, newAssetType])

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'
  const chipCls = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-medium transition-all ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`

  return (
    <div className="space-y-3 bg-indigo-50/50 rounded-xl p-3 border border-indigo-100">
      {/* Kind */}
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1.5 block">저축 종류</label>
        <div className="flex gap-1.5">
          {(['stock', 'deposit', 'general'] as SavingKind[]).map(k => (
            <button key={k} type="button" onClick={() => { setKind(k); setIsNew(false) }}
              className={chipCls(kind === k)}>
              {{ stock: '주식/크립토', deposit: '예적금', general: '기타저축' }[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Existing vs New */}
      <div className="flex gap-2 bg-white rounded-lg p-0.5 border border-slate-100">
        <button type="button" onClick={() => setIsNew(false)}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${!isNew ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500'}`}>
          기존 자산에 추가
        </button>
        <button type="button" onClick={() => setIsNew(true)}
          className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${isNew ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500'}`}>
          신규 자산 등록
        </button>
      </div>

      {/* ── Stock fields ── */}
      {kind === 'stock' && !isNew && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">종목 선택</label>
            {stocks.length === 0 ? (
              <p className="text-xs text-slate-400">등록된 주식이 없습니다. 신규 등록을 사용하세요.</p>
            ) : (
              <select value={stockId} onChange={e => setStockId(e.target.value)} className={inputCls}>
                {stocks.map(s => (
                  <option key={s.id} value={s.id}>{s.symbol} — {s.name} ({s.quantity}주 보유)</option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">추가 수량</label>
              <input type="number" value={addQty} onChange={e => setAddQty(e.target.value)}
                placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">매수 단가</label>
              <input type="text" inputMode="decimal" value={addPrice} onChange={e => setAddPrice(formatAmountInput(e.target.value, true))}
                placeholder="0" className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {kind === 'stock' && isNew && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">종목 코드 *</label>
              <input value={newSymbol} onChange={e => setNewSymbol(e.target.value)}
                placeholder="예: AAPL" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">거래소 *</label>
              <select value={newExchange} onChange={e => setNewExchange(e.target.value)} className={inputCls}>
                {['NYSE', 'NASDAQ', 'KRX', 'KOSDAQ', 'BINANCE', 'UPBIT'].map(x => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">종목명 *</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="예: Apple Inc." className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">수량 *</label>
              <input type="number" value={newQty} onChange={e => setNewQty(e.target.value)}
                placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">단가 *</label>
              <input type="text" inputMode="decimal" value={newPrice} onChange={e => setNewPrice(formatAmountInput(e.target.value, true))}
                placeholder="0" className={inputCls} />
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

      {/* ── Deposit/General fields ── */}
      {(kind === 'deposit' || kind === 'general') && !isNew && (
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">자산 선택</label>
          {otherAssets.length === 0 ? (
            <p className="text-xs text-slate-400">등록된 기타 자산이 없습니다. 신규 등록을 사용하세요.</p>
          ) : (
            <select value={assetId} onChange={e => setAssetId(e.target.value)} className={inputCls}>
              {otherAssets.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({(a.value_krw / 10000).toFixed(0)}만원)</option>
              ))}
            </select>
          )}
        </div>
      )}

      {(kind === 'deposit' || kind === 'general') && isNew && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">자산명 *</label>
            <input value={newAssetName} onChange={e => setNewAssetName(e.target.value)}
              placeholder="예: 국민은행 정기적금" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">자산 종류</label>
            <div className="flex flex-wrap gap-1.5">
              {OTHER_ASSET_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setNewAssetType(t)}
                  className={chipCls(newAssetType === t)}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QuickAddButton({ users, stocks, otherAssets, onAdd, open: controlledOpen, onClose }: QuickAddButtonProps) {
  const isControlled = controlledOpen !== undefined

  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = isControlled ? controlledOpen : internalOpen

  const [type, setType] = useState<TxType>('expense')
  const safeUsers = Array.isArray(users) ? users : []
  const [userID, setUserID] = useState(safeUsers[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('식비')
  const [title, setTitle] = useState('')
  const [payment, setPayment] = useState('신용카드')
  const [savingLink, setSavingLink] = useState<SavingLink | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCatManager, setShowCatManager] = useState(false)
  const { expenseCategories, incomeCategories, addCategory, removeCategory } = useCategories()

  useEffect(() => {
    if (isOpen) {
      setType('expense')
      setCategory('식비')
      setAmount('')
      setTitle('')
      setPayment('신용카드')
      setUserID(safeUsers[0]?.id ?? '')
      setSavingLink(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const categories = type === 'expense' ? expenseCategories : incomeCategories

  const close = () => {
    if (isControlled) onClose?.()
    else setInternalOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !title) return
    if (type === 'saving' && !savingLink) return
    setLoading(true)
    await onAdd({
      user_id: userID,
      type,
      amount: parseInt(amount.replace(/,/g, ''), 10),
      category: type === 'saving' ? '저축/투자' : category,
      title,
      payment_method: payment,
      saving_link: savingLink ?? undefined,
    })
    setLoading(false)
    close()
  }

  return (
    <>
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200 flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all"
          aria-label="내역 추가"
        >
          <PlusIcon className="h-7 w-7" />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={close} />

          <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-5 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">내역 추가</h3>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {safeUsers.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setUserID(u.id)}
                      title={u.name}
                      className={`w-7 h-7 rounded-full text-white text-xs font-bold transition-all ${userID === u.id ? 'ring-2 ring-offset-1 ring-indigo-400 scale-110' : 'opacity-40'}`}
                      style={{ backgroundColor: u.avatar_color }}
                    >
                      {u.name[0]}
                    </button>
                  ))}
                </div>
                <button onClick={close} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type toggle */}
              <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1">
                {(['expense', 'income', 'saving'] as TxType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setType(t)
                      setCategory(t === 'expense' ? '식비' : t === 'income' ? '급여' : '저축/투자')
                      setSavingLink(null)
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                      type === t
                        ? t === 'expense' ? 'bg-rose-500 text-white shadow'
                          : t === 'income' ? 'bg-emerald-500 text-white shadow'
                          : 'bg-indigo-500 text-white shadow'
                        : 'text-slate-500'
                    }`}
                  >
                    {{ expense: '지출', income: '수입', saving: '저축/투자' }[t]}
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">금액 (KRW)</label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={e => setAmount(formatAmountInput(e.target.value))}
                    placeholder="0"
                    required
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">원</span>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">내용</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={type === 'saving' ? '예: 삼성전자 추가 매수, 적금 납입' : '어디서 사용했나요?'}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
                />
              </div>

              {/* Category (income/expense only) */}
              {type !== 'saving' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-500">카테고리</label>
                    <button type="button" onClick={() => setShowCatManager(true)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <Cog6ToothIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          category === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* SavingLink form */}
              {type === 'saving' && (
                <SavingLinkForm
                  stocks={Array.isArray(stocks) ? stocks : []}
                  otherAssets={Array.isArray(otherAssets) ? otherAssets : []}
                  onChange={setSavingLink}
                />
              )}

              {/* Payment */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">결제수단</label>
                <select
                  value={payment}
                  onChange={e => setPayment(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {type === 'saving' && !savingLink && (
                <p className="text-xs text-amber-600">저축 자산 정보를 입력해주세요.</p>
              )}

              <button
                type="submit"
                disabled={loading || (type === 'saving' && !savingLink)}
                className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {loading ? '저장 중...' : '저장하기'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showCatManager && (
        <CategoryManager
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onAdd={addCategory}
          onRemove={removeCategory}
          onClose={() => setShowCatManager(false)}
        />
      )}
    </>
  )
}
