'use client'

import { useState, useMemo } from 'react'
import type { User, Transaction } from '@/types'
import { useCategories } from '@/hooks/useCategories'

interface NaverPayCardProps {
  users: User[]
  transactions?: Transaction[]
  onAdd: (data: {
    user_id: string
    type: 'expense'
    amount: number
    category: string
    title: string
    payment_method: string
  }) => Promise<void>
}

function openNaverPay() {
  const a = document.createElement('a')
  a.href = 'naverpayapp://showservicemenu?idNo=1lvRp&menuName=payment'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export default function NaverPayCard({ users, transactions = [], onAdd }: NaverPayCardProps) {
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [userID, setUserID] = useState(users[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const { expenseCategories } = useCategories()

  const sortedCategories = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tx of transactions) {
      if (tx.type === 'expense' && tx.category) {
        counts[tx.category] = (counts[tx.category] ?? 0) + 1
      }
    }
    const others = expenseCategories.filter(c => c !== '기타')
    others.sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    return expenseCategories.includes('기타') ? ['기타', ...others] : others
  }, [transactions, expenseCategories])

  const activeCategory = category || sortedCategories[0] || '식비'

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setAmount(raw ? parseInt(raw, 10).toLocaleString() : '')
  }

  async function handleSubmit() {
    const num = parseInt(amount.replace(/,/g, ''), 10)
    if (!num) return
    setLoading(true)
    try {
      await onAdd({
        user_id: userID,
        type: 'expense',
        amount: num,
        category: activeCategory,
        title: title || '네이버페이 결제',
        payment_method: '카드',
      })
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
    setAmount('')
    setTitle('')
    setCategory('')
    openNaverPay()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <span className="bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide">
          N Pay
        </span>
        <div className="flex gap-1">
          {users.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => setUserID(u.id)}
              className={`w-6 h-6 rounded-full text-white text-[10px] font-bold transition-all ${
                userID === u.id ? 'ring-2 ring-offset-1 ring-brand-500 scale-110' : 'opacity-40'
              }`}
              style={{ backgroundColor: u.avatar_color }}
            >
              {u.name[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-baseline gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={handleAmountChange}
            className="flex-1 min-w-0 text-3xl font-black tabular-nums text-slate-900 placeholder:text-slate-200 focus:outline-none bg-transparent text-right"
          />
          <span className="text-base font-semibold text-slate-400 shrink-0">원</span>
        </div>
        {/* Title */}
        <input
          type="text"
          placeholder="어디서 결제했나요?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full mt-2 pb-2 border-b border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-emerald-400 bg-transparent transition-colors"
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-5 py-3">
        {sortedCategories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeCategory === cat
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-600 active:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Submit */}
      <button
        type="button"
        disabled={!amount || loading}
        onClick={handleSubmit}
        className="w-full py-3.5 font-bold text-sm text-white active:opacity-90 transition-all disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #03c75a 0%, #018a3c 100%)' }}
      >
        {loading ? '등록 중...' : '결제하기 → 네이버페이'}
      </button>
    </div>
  )
}
