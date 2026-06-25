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
    return [...expenseCategories].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
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
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #03c75a 0%, #018a3c 100%)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-6 rounded bg-white/20 grid grid-cols-2 gap-0.5 p-1">
            <div className="bg-white/50 rounded-sm" />
            <div className="bg-white/50 rounded-sm" />
            <div className="bg-white/50 rounded-sm" />
            <div className="bg-white/50 rounded-sm" />
          </div>
          <span className="text-sm font-bold text-white tracking-wide">Naver Pay</span>
        </div>
        <div className="flex gap-1">
          {users.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => setUserID(u.id)}
              className={`w-7 h-7 rounded-full text-white text-xs font-bold transition-all ${
                userID === u.id ? 'ring-2 ring-offset-1 ring-white/60 scale-110' : 'opacity-50'
              }`}
              style={{ backgroundColor: u.avatar_color }}
            >
              {u.name[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="px-4 py-3 space-y-3">
        {/* Amount + Title row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              inputMode="numeric"
              placeholder="금액"
              value={amount}
              onChange={handleAmountChange}
              className="w-full px-3 py-2.5 pr-6 rounded-xl border border-slate-200 text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
          </div>
          <input
            type="text"
            placeholder="어디서?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-slate-300"
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {sortedCategories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
          className="w-full py-3 rounded-xl font-bold text-sm text-white active:scale-[0.98] transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #03c75a 0%, #018a3c 100%)' }}
        >
          {loading ? '등록 중...' : '결제하기 → 네이버페이'}
        </button>
      </div>
    </div>
  )
}
