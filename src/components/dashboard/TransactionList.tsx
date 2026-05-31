'use client'

import { useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/solid'
import QuickAddButton from '@/components/dashboard/QuickAddButton'
import type { Transaction, User, StockAssetWithPrice, OtherAsset, SavingLink } from '@/types'

interface TransactionListProps {
  transactions: Transaction[]
  users: User[]
  stocks: StockAssetWithPrice[]
  otherAssets: OtherAsset[]
  onAdd?: (data: {
    user_id: string
    type: 'income' | 'expense' | 'saving'
    amount: number
    category: string
    title: string
    payment_method: string
    saving_link?: SavingLink
  }) => Promise<void>
}

const CATEGORY_EMOJI: Record<string, string> = {
  식비: '🍽️',
  카페: '☕',
  장보기: '🛒',
  주거: '🏠',
  교통: '🚌',
  의료: '💊',
  문화: '🎬',
  쇼핑: '👗',
  급여: '💰',
  용돈: '💵',
  '저축/투자': '🏦',
  기타: '📦',
}

function formatAmount(amount: number, type: string): string {
  const formatted = amount.toLocaleString()
  if (type === 'income') return `+${formatted}원`
  if (type === 'saving') return `+${formatted}원`
  return `-${formatted}원`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

type FilterType = 'all' | 'income' | 'expense' | 'saving'

export default function TransactionList({ transactions = [], users = [], stocks = [], otherAssets = [], onAdd }: TransactionListProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [showAdd, setShowAdd] = useState(false)

  const safeTransactions = Array.isArray(transactions) ? transactions : []
  const safeUsers = Array.isArray(users) ? users : []
  const userMap = Object.fromEntries(safeUsers.map(u => [u.id, u]))

  const filtered = safeTransactions.filter(tx =>
    filter === 'all' ? true : tx.type === filter
  )

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h2 className="text-sm font-semibold text-slate-700">가계부</h2>

          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              {(['all', 'income', 'expense', 'saving'] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                    filter === f
                      ? 'bg-white shadow text-slate-800'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {{ all: '전체', income: '수입', expense: '지출', saving: '저축' }[f]}
                </button>
              ))}
            </div>

            {onAdd && (
              <button
                onClick={() => setShowAdd(true)}
                className="w-8 h-8 rounded-xl bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center transition-colors"
                aria-label="내역 추가"
              >
                <PlusIcon className="h-4 w-4 text-indigo-600" />
              </button>
            )}
          </div>
        </div>

        {/* Transaction rows */}
        <ul className="divide-y divide-slate-50">
          {filtered.length === 0 && (
            <li className="py-10 flex flex-col items-center gap-1 text-center">
              <p className="text-sm font-medium text-slate-400">내역이 없습니다</p>
              {onAdd && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="mt-1 text-xs text-indigo-500 hover:underline"
                >
                  + 첫 내역 추가하기
                </button>
              )}
            </li>
          )}
          {filtered.map(tx => {
            const user = userMap[tx.user_id]
            const emoji = CATEGORY_EMOJI[tx.category] ?? '📦'
            const amountColor =
              tx.type === 'income' ? 'text-emerald-600'
              : tx.type === 'saving' ? 'text-indigo-600'
              : 'text-slate-700'
            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl">
                  {emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{tx.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {user && (
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: user.avatar_color }}
                      />
                    )}
                    <span className="text-xs text-slate-400 truncate">
                      {user?.name} · {formatDate(tx.date)}
                      {tx.is_fixed && (
                        <span className="ml-1 text-xs text-indigo-400 font-medium">고정</span>
                      )}
                      {tx.type === 'saving' && (
                        <span className="ml-1 text-xs text-indigo-500 font-medium">저축</span>
                      )}
                    </span>
                  </div>
                </div>

                <span className={`flex-shrink-0 text-sm font-semibold tabular-nums ${amountColor}`}>
                  {formatAmount(tx.amount, tx.type)}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {onAdd && (
        <QuickAddButton
          users={safeUsers}
          stocks={stocks}
          otherAssets={otherAssets}
          onAdd={onAdd}
          open={showAdd}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  )
}
