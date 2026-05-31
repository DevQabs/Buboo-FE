'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'
import type { StockAssetWithPrice, User } from '@/types'

interface EditStockModalProps {
  asset: StockAssetWithPrice
  users: User[]
  onClose: () => void
  onEdit: (id: string, data: {
    user_id?: string
    name?: string
    quantity?: number
    average_price?: number
    memo?: string
  }) => Promise<void>
}

export default function EditStockModal({ asset, users, onClose, onEdit }: EditStockModalProps) {
  const safeUsers = Array.isArray(users) ? users : []
  const [userID, setUserID] = useState(asset.user_id)
  const [name, setName] = useState(asset.name)
  const [quantity, setQuantity] = useState(String(asset.quantity))
  const [avgPrice, setAvgPrice] = useState(String(asset.average_price))
  const [memo, setMemo] = useState(asset.memo ?? '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !quantity || !avgPrice) return
    setLoading(true)
    try {
      await onEdit(asset.id, {
        user_id: userID,
        name: name.trim(),
        quantity: parseFloat(quantity),
        average_price: parseFloat(avgPrice.replace(/,/g, '')),
        memo,
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-5 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">주식 수정</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{asset.symbol} · {asset.exchange}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 누가? */}
          {safeUsers.length > 1 && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">누가?</label>
              <select
                value={userID}
                onChange={e => setUserID(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                {safeUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 종목명 (심볼/거래소는 변경 불가) */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">종목명</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* 수량 + 평균단가 (inline) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">보유 수량</label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="0"
                min="0"
                step="0.0001"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                평균 매입가 ({asset.currency === 'KRW' ? '원' : '$'})
              </label>
              <input
                type="number"
                value={avgPrice}
                onChange={e => setAvgPrice(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>
          </div>

          {/* 총 매입금액 미리보기 */}
          {quantity && avgPrice && (
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500">총 매입금액</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">
                {asset.currency === 'KRW'
                  ? `₩${(parseFloat(quantity) * parseFloat(avgPrice.replace(/,/g, ''))).toLocaleString()}원`
                  : `$${(parseFloat(quantity) * parseFloat(avgPrice.replace(/,/g, ''))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="장기 보유, 배당주..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {loading ? '저장 중...' : '수정 저장하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
