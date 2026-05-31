'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline'
import type { StockAssetWithPrice } from '@/types'

interface BuySellModalProps {
  asset: StockAssetWithPrice
  mode: 'buy' | 'sell'
  onClose: () => void
  onSubmit: (mode: 'buy' | 'sell', data: { quantity: number; price: number; memo: string }) => Promise<void>
}

function formatNum(v: number, currency: string) {
  if (currency === 'KRW') return `₩${v.toLocaleString()}`
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function BuySellModal({ asset, mode, onClose, onSubmit }: BuySellModalProps) {
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState(String(asset.current_price))
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const qty = parseFloat(quantity) || 0
  const prc = parseFloat(price) || 0
  const totalCost = qty * prc
  const realizedPnL = mode === 'sell' ? (prc - asset.average_price) * qty : null
  const isBuy = mode === 'buy'

  // For sell: quantity cap = current holdings
  const maxQty = mode === 'sell' ? asset.quantity : undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (qty <= 0 || prc <= 0) { setError('수량과 가격을 입력하세요.'); return }
    if (mode === 'sell' && qty > asset.quantity) {
      setError(`매도 수량(${qty})이 보유 수량(${asset.quantity})을 초과합니다.`)
      return
    }
    setLoading(true)
    try {
      await onSubmit(mode, { quantity: qty, price: prc, memo })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-5 z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isBuy ? 'bg-emerald-50' : 'bg-rose-50'
            }`}>
              {isBuy
                ? <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-600" />
                : <ArrowTrendingDownIcon className="h-4 w-4 text-rose-500" />
              }
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {asset.symbol} {isBuy ? '매수' : '매도'}
              </h3>
              <p className="text-xs text-slate-400">{asset.name} · 보유 {asset.quantity}주</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* 현재 평균단가 참고 */}
        <div className="bg-slate-50 rounded-xl px-4 py-3 grid grid-cols-2 gap-2 text-center">
          <div>
            <p className="text-[10px] text-slate-400">현재가</p>
            <p className="text-sm font-bold text-slate-800">{formatNum(asset.current_price, asset.currency)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">평균 매입가</p>
            <p className="text-sm font-bold text-slate-800">{formatNum(asset.average_price, asset.currency)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 수량 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              {isBuy ? '매수' : '매도'} 수량
              {maxQty !== undefined && (
                <button
                  type="button"
                  onClick={() => setQuantity(String(maxQty))}
                  className="ml-2 text-indigo-500 hover:underline"
                >
                  전량 ({maxQty})
                </button>
              )}
            </label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="0"
              min="0.0001"
              max={maxQty}
              step="0.0001"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
            />
          </div>

          {/* 단가 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              {isBuy ? '매수' : '매도'} 단가 ({asset.currency === 'KRW' ? '원' : '$'})
            </label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
            />
          </div>

          {/* 예상 금액 + 실현손익(매도시) */}
          {qty > 0 && prc > 0 && (
            <div className={`rounded-xl px-4 py-3 space-y-1 ${isBuy ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">총 {isBuy ? '매수' : '매도'}금액</span>
                <span className="font-bold text-slate-800">{formatNum(totalCost, asset.currency)}</span>
              </div>
              {realizedPnL !== null && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">실현 손익</span>
                    <span className={`font-bold ${realizedPnL >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {realizedPnL >= 0 ? '+' : ''}{formatNum(realizedPnL, asset.currency)}
                    </span>
                  </div>
                  {realizedPnL > 0 && (
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>예상 양도세 (22%)</span>
                      <span className="text-rose-400 font-medium">
                        -{formatNum(realizedPnL * 0.22, asset.currency)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="거래 메모..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-500 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-60 ${
              isBuy
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-rose-500 hover:bg-rose-600'
            }`}
          >
            {loading ? '처리 중...' : isBuy ? '매수 확정' : '매도 확정'}
          </button>
        </form>
      </div>
    </div>
  )
}
