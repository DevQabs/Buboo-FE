'use client'
import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'

interface CategoryManagerProps {
  expenseCategories: string[]
  incomeCategories: string[]
  onAdd: (type: 'expense' | 'income', name: string) => void
  onRemove: (type: 'expense' | 'income', name: string) => void
  onClose: () => void
}

export default function CategoryManager({
  expenseCategories, incomeCategories, onAdd, onRemove, onClose,
}: CategoryManagerProps) {
  const [newExpense, setNewExpense] = useState('')
  const [newIncome, setNewIncome]   = useState('')

  const handleAdd = (type: 'expense' | 'income', val: string, reset: () => void) => {
    if (!val.trim()) return
    onAdd(type, val)
    reset()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-5 z-10 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">카테고리 관리</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* 지출 */}
        <section>
          <p className="text-xs font-semibold text-rose-500 mb-2">지출 카테고리</p>
          <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
            {expenseCategories.map(c => (
              <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-xs font-medium">
                {c}
                <button type="button" onClick={() => onRemove('expense', c)} className="text-rose-300 hover:text-rose-500 leading-none">
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newExpense}
              onChange={e => setNewExpense(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd('expense', newExpense, () => setNewExpense(''))}
              placeholder="새 카테고리 추가"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <button
              type="button"
              onClick={() => handleAdd('expense', newExpense, () => setNewExpense(''))}
              className="px-3 py-2 bg-rose-500 text-white rounded-xl text-xs font-semibold hover:bg-rose-600 transition-colors"
            >
              추가
            </button>
          </div>
        </section>

        {/* 수입 */}
        <section>
          <p className="text-xs font-semibold text-emerald-600 mb-2">수입 카테고리</p>
          <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
            {incomeCategories.map(c => (
              <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                {c}
                <button type="button" onClick={() => onRemove('income', c)} className="text-emerald-300 hover:text-emerald-500 leading-none">
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newIncome}
              onChange={e => setNewIncome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd('income', newIncome, () => setNewIncome(''))}
              placeholder="새 카테고리 추가"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
            <button
              type="button"
              onClick={() => handleAdd('income', newIncome, () => setNewIncome(''))}
              className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:bg-emerald-600 transition-colors"
            >
              추가
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
