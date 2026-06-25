'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import type { User } from '@/types'
import { useCategories } from '@/hooks/useCategories'
import CategoryManager from '@/components/dashboard/CategoryManager'
import { formatAmountInput } from '@/lib/formatNumber'

type AddData = {
  user_id: string
  type: 'expense'
  amount: number
  category: string
  title: string
  payment_method: string
}

interface QuickAddButtonProps {
  users: User[]
  onAdd: (data: AddData) => Promise<void>
  open?: boolean
  onClose?: () => void
}

export default function QuickAddButton({ users, onAdd, open: controlledOpen, onClose }: QuickAddButtonProps) {
  const isControlled = controlledOpen !== undefined

  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = isControlled ? controlledOpen : internalOpen

  const safeUsers = Array.isArray(users) ? users : []
  const [userID, setUserID] = useState(safeUsers[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('식비')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCatManager, setShowCatManager] = useState(false)
  const { expenseCategories, incomeCategories, addCategory, removeCategory } = useCategories()

  useEffect(() => {
    if (isOpen) {
      setCategory('식비')
      setAmount('')
      setTitle('')
      setUserID(safeUsers[0]?.id ?? '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const close = () => {
    if (isControlled) onClose?.()
    else setInternalOpen(false)
  }

  const buildPayload = (paymentMethod: string): AddData => ({
    user_id: userID,
    type: 'expense',
    amount: parseInt(amount.replace(/,/g, ''), 10),
    category,
    title,
    payment_method: paymentMethod,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !title) return
    setLoading(true)
    await onAdd(buildPayload('신용카드'))
    setLoading(false)
    close()
  }

  const handleNaverPay = async () => {
    if (!amount || !title) return
    setLoading(true)
    await onAdd(buildPayload('네이버페이'))
    setLoading(false)
    close()
    const a = document.createElement('a')
    a.href = 'naverpayapp://showservicemenu?idNo=1lvRp&menuName=payment'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <>
      {!isControlled && (
        <button
          onClick={() => setInternalOpen(true)}
          className="fixed bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+1rem)] right-4 z-50 w-14 h-14 bg-brand-600 text-white rounded-2xl shadow-lg shadow-brand-100 flex items-center justify-center hover:bg-brand-700 active:scale-95 transition-all"
          aria-label="지출 추가"
        >
          <PlusIcon className="h-7 w-7" />
        </button>
      )}

      <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-5 z-10 max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">지출 추가</h3>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {safeUsers.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setUserID(u.id)}
                      title={u.name}
                      className={`w-7 h-7 rounded-full text-white text-xs font-bold transition-all ${userID === u.id ? 'ring-2 ring-offset-1 ring-brand-500 scale-110' : 'opacity-40'}`}
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
                    autoFocus
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-300"
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
                  placeholder="어디서 사용했나요?"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-300"
                />
              </div>

              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-500">카테고리</label>
                  <button type="button" onClick={() => setShowCatManager(true)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <Cog6ToothIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {expenseCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        category === cat ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {loading ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleNaverPay}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  네이버페이
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {showCatManager && (
          <CategoryManager
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            onAdd={addCategory}
            onRemove={removeCategory}
            onClose={() => setShowCatManager(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
