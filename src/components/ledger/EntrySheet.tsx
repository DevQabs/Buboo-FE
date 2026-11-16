'use client'

// 하단 입력 바를 누르면 뜨는 입력 시트(시안 ledger-a). 지출/수입/저축, 저축 자산 연동, 날짜, 카테고리 관리.
// 네이버페이 앱은 저장이 성공한 뒤에만 연다(설계서 9.C-12).
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Cog6ToothIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useCategories } from '@/hooks/useCategories'
import CategoryManager from '@/components/dashboard/CategoryManager'
import { SavingLinkInline, type AddTransactionPayload } from '@/components/dashboard/CalendarView'
import { Chip } from '@/components/ui/Card'
import { formatAmountInput } from '@/lib/formatNumber'
import { todayKST } from '@/lib/date'
import { sortCategoriesByUse } from '@/lib/ledger'
import type { OtherAsset, SavingLink, StockAssetWithPrice, Transaction } from '@/types'

type TxType = AddTransactionPayload['type']
const TYPES: { key: TxType; label: string }[] = [
  { key: 'expense', label: '지출' },
  { key: 'income', label: '수입' },
  { key: 'saving', label: '저축' },
]

// NaverPayCard 에서 옮김
function openNaverPay() {
  const a = document.createElement('a')
  a.href = 'naverpayapp://showservicemenu?idNo=1lvRp&menuName=payment'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

interface EntrySheetProps {
  currentUserID: string
  accessToken?: string
  /** 카테고리 정렬용(이 기간 거래) */
  transactions: Transaction[]
  stocks: StockAssetWithPrice[]
  otherAssets: OtherAsset[]
  onClose: () => void
  /** 실패하면 던진다(대시보드가 낙관적 반영을 되돌리고 토스트를 띄운다) */
  onSubmit: (p: AddTransactionPayload) => Promise<void>
}

export default function EntrySheet({ currentUserID, accessToken, transactions, stocks, otherAssets, onClose, onSubmit }: EntrySheetProps) {
  const [type, setType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(todayKST())
  const [savingLink, setSavingLink] = useState<SavingLink | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCats, setShowCats] = useState(false)
  const { expenseCategories, incomeCategories, addCategory, removeCategory } = useCategories(accessToken)

  const cats = useMemo(
    () => type === 'income'
      ? sortCategoriesByUse(incomeCategories, transactions, 'income')
      : sortCategoriesByUse(expenseCategories, transactions, 'expense'),
    [type, incomeCategories, expenseCategories, transactions],
  )
  const activeCategory = category || cats[0] || '기타'

  const changeType = (t: TxType) => {
    setType(t)
    setCategory('')
    setSavingLink(null)
    setError('')
  }

  const submit = async (thenPay: boolean) => {
    const amt = Number(amount.replace(/,/g, ''))
    if (!amt || amt <= 0) { setError('금액을 입력해 주세요'); return }
    if (type === 'saving' && !savingLink) { setError('저축할 자산을 골라 주세요'); return }
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        user_id: currentUserID,
        type,
        amount: amt,
        category: type === 'saving' ? '저축/투자' : activeCategory,
        title: title.trim() || (thenPay ? '네이버페이 결제' : ''),
        date,
        payment_method: '카드',
        saving_link: savingLink ?? undefined,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요')
      setBusy(false)
      return // 저장 실패면 네이버페이를 열지 않는다
    }
    setBusy(false)
    onClose()
    if (thenPay) openNaverPay()
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-[24px] bg-white px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] shadow-2xl"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-stone-200" />
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {TYPES.map(t => <Chip key={t.key} on={type === t.key} onClick={() => changeType(t.key)}>{t.label}</Chip>)}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-lg p-1.5 text-stone-400">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex items-baseline gap-1.5">
          <input
            autoFocus
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(formatAmountInput(e.target.value))}
            className="min-w-0 flex-1 bg-transparent text-right text-3xl font-black tabular-nums text-stone-900 placeholder:text-stone-200 focus:outline-none"
          />
          <span className="text-base font-semibold text-stone-400">원</span>
        </div>
        <input
          placeholder={type === 'expense' ? '어디서 썼나요?' : '내용'}
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="mt-2 w-full border-b border-line bg-transparent pb-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-brand-500 focus:outline-none"
        />

        {type === 'saving' ? (
          <div className="mt-3">
            <SavingLinkInline stocks={stocks} otherAssets={otherAssets} onChange={setSavingLink} />
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5">
            <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
              {cats.map(c => <Chip key={c} on={activeCategory === c} onClick={() => setCategory(c)}>{c}</Chip>)}
            </div>
            <button type="button" onClick={() => setShowCats(true)} aria-label="카테고리 관리" className="shrink-0 rounded-lg p-1.5 text-stone-400">
              <Cog6ToothIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <label className="mt-3 flex items-center justify-between text-xs text-stone-500">
          날짜
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-lg border border-line px-2 py-1 text-xs text-stone-700" />
        </label>

        {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(false)}
            className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            {busy ? '저장 중...' : '저장'}
          </button>
          {type === 'expense' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => submit(true)}
              className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #03c75a 0%, #018a3c 100%)' }}
            >
              저장하고 네이버페이 열기
            </button>
          )}
        </div>
      </motion.div>

      {showCats && (
        <CategoryManager
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onAdd={addCategory}
          onRemove={removeCategory}
          onClose={() => setShowCats(false)}
        />
      )}
    </div>
  )
}
