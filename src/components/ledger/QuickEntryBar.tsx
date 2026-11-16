'use client'

// 가계부 빠른 입력: 하단 바가 곧 금액 입력 칸이다. 누르면 바로 숫자 키패드가 뜨고,
// 금액이 들어가면 바로 위에 카테고리·저장 패널이 올라온다. 저장 뒤에도 키패드를 그대로 두어 다음 건을 잇는다.
// 저축은 자산 연동 양식이 필요해 입력 시트(EntrySheet)로 넘긴다.
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useCategories } from '@/hooks/useCategories'
import CategoryManager from '@/components/dashboard/CategoryManager'
import type { AddTransactionPayload } from '@/components/dashboard/CalendarView'
import { toastError } from '@/components/ui/Toast'
import { openNaverPay } from './EntrySheet'
import { formatAmountInput, parseAmount } from '@/lib/formatNumber'
import { todayKST } from '@/lib/date'
import { sortCategoriesByUse, readPayMethod, PAY_METHOD_KEY, type PayMethod } from '@/lib/ledger'
import type { Transaction } from '@/types'

type QuickType = 'expense' | 'income'

interface QuickEntryBarProps {
  hasNav: boolean
  currentUserID: string
  accessToken?: string
  /** 카테고리 정렬용(이 기간 거래) */
  transactions: Transaction[]
  /** 만든 거래 id 를 돌려준다. 실패하면 던진다(대시보드가 낙관적 반영을 되돌리고 토스트를 띄운다) */
  onSubmit: (p: AddTransactionPayload) => Promise<string>
  onDelete: (id: string) => Promise<void>
  /** 저축을 고르면 입력 시트를 연다(넣던 금액을 넘긴다) */
  onOpenSaving: (amount: string) => void
}

// 패널 버튼을 눌러도 금액 칸 포커스(키패드)가 빠지지 않게
const keepFocus = (e: PointerEvent) => e.preventDefault()

// 안드로이드 화면 키보드 높이. 키보드가 레이아웃이 아니라 화면(visual viewport)만 줄이므로 직접 띄운다.
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return inset > 80 ? inset : 0 // 주소창 들고남 같은 작은 차이는 무시
}

// 보이는 알약은 작게, 누르는 칸은 44px
function Toggle({ on, onClick, keep = false, children }: { on: boolean; onClick: () => void; keep?: boolean; children: ReactNode }) {
  return (
    <button type="button" onPointerDown={keep ? keepFocus : undefined} onClick={onClick} className="h-11 shrink-0 px-0.5">
      <span className={`block rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${on ? 'bg-brand-500 text-white' : 'bg-sand text-stone-500'}`}>
        {children}
      </span>
    </button>
  )
}

export default function QuickEntryBar({ hasNav, currentUserID, accessToken, transactions, onSubmit, onDelete, onOpenSaving }: QuickEntryBarProps) {
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<QuickType>('expense')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(todayKST())
  const [memoOpen, setMemoOpen] = useState(false)
  const [memo, setMemo] = useState('')
  const [undoID, setUndoID] = useState<string | null>(null)
  const [showCats, setShowCats] = useState(false)
  const [method, setMethod] = useState<PayMethod>('카드')
  const inputRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const keyboard = useKeyboardInset()
  const { expenseCategories, incomeCategories, addCategory, removeCategory } = useCategories(accessToken)

  const cats = useMemo(
    () => sortCategoriesByUse(type === 'income' ? incomeCategories : expenseCategories, transactions, type),
    [type, incomeCategories, expenseCategories, transactions],
  )
  const activeCategory = category || cats[0] || '기타'
  const amt = parseAmount(amount)
  const today = todayKST()

  useEffect(() => {
    try { setMethod(readPayMethod(localStorage.getItem(PAY_METHOD_KEY))) } catch { /* 저장소 막힘: 기본 카드 */ }
  }, [])

  const pickMethod = (m: PayMethod) => {
    setMethod(m)
    try { localStorage.setItem(PAY_METHOD_KEY, m) } catch { /* 저장소 막힘: 이번 화면에서만 유지 */ }
  }

  useEffect(() => {
    if (!undoID) return
    const t = setTimeout(() => setUndoID(null), 5000)
    return () => clearTimeout(t)
  }, [undoID])

  const save = async () => {
    if (amt <= 0) return
    const pay = type === 'expense' ? method : '카드' // N페이 칩은 지출에만 있다
    const thenPay = pay === 'N페이'
    const typed = amount
    const payload: AddTransactionPayload = {
      user_id: currentUserID,
      type,
      amount: amt,
      category: activeCategory,
      title: memo.trim() || (thenPay ? '네이버페이 결제' : ''),
      date,
      payment_method: pay,
    }
    // 다음 건을 바로 넣게 먼저 비우고 포커스를 지킨다. 실패하면 금액을 되살린다.
    setAmount('')
    setMemo('')
    setMemoOpen(false)
    setCategory('')
    setUndoID(null)
    inputRef.current?.focus()
    try {
      const id = await onSubmit(payload)
      setUndoID(id)
    } catch {
      setAmount(prev => prev || typed) // 오류 토스트는 대시보드가 띄운다
      return // 저장 실패면 네이버페이를 열지 않는다
    }
    if (thenPay) openNaverPay()
  }

  const undo = async () => {
    if (!undoID) return
    const id = undoID
    setUndoID(null)
    try {
      await onDelete(id)
    } catch (e) {
      toastError('되돌리기', e)
    }
  }

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    save()
  }

  const openDate = () => {
    try { dateRef.current?.showPicker() } catch { dateRef.current?.focus() }
  }

  const position = hasNav
    ? 'bottom-[calc(var(--nav-h)+0.75rem)]'
    : 'bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]'

  return (
    <>
      <form
        onSubmit={onFormSubmit}
        className={`fixed inset-x-0 z-50 px-3 ${position}`}
        style={keyboard ? { bottom: keyboard + 8 } : undefined}
      >
        <div className="mx-auto flex w-full max-w-[calc(42rem-1.5rem)] flex-col gap-2">
          {undoID && (
            <div role="status" className="flex items-center justify-between self-center rounded-full bg-stone-800 py-1 pl-4 pr-1 text-sm text-white shadow-warm">
              <span>저장됨</span>
              <button type="button" onPointerDown={keepFocus} onClick={undo} className="ml-3 h-11 rounded-full px-3 font-semibold text-white/90">
                되돌리기
              </button>
            </div>
          )}

          {amt > 0 && (
            <div className="space-y-2 rounded-card bg-white p-3 shadow-warm">
              <div className="flex items-center gap-1.5">
                <Toggle keep on={type === 'expense'} onClick={() => { setType('expense'); setCategory('') }}>지출</Toggle>
                <Toggle keep on={type === 'income'} onClick={() => { setType('income'); setCategory('') }}>수입</Toggle>
                <Toggle keep on={false} onClick={() => { onOpenSaving(amount); setAmount('') }}>저축</Toggle>
                <span className="flex-1" />
                <Toggle on={date !== today} onClick={openDate}>
                  {date === today ? '오늘' : `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`}
                </Toggle>
                <input
                  ref={dateRef}
                  type="date"
                  value={date}
                  onChange={e => e.target.value && setDate(e.target.value)}
                  aria-label="날짜"
                  className="sr-only"
                />
                <Toggle on={memoOpen || !!memo} onClick={() => setMemoOpen(v => !v)}>메모</Toggle>
              </div>

              {memoOpen && (
                <input
                  autoFocus
                  enterKeyHint="done"
                  placeholder={type === 'expense' ? '어디서 썼나요?' : '내용'}
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  className="w-full rounded-xl border border-line px-3 py-2.5 text-base text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              )}

              <div className="flex items-center gap-1.5">
                <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
                  {cats.map(c => (
                    <button
                      key={c}
                      type="button"
                      onPointerDown={keepFocus}
                      onClick={() => setCategory(c)}
                      className={`h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${
                        activeCategory === c ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white text-stone-500'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setShowCats(true)} aria-label="카테고리 관리" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-400">
                  <Cog6ToothIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-2">
                {type === 'expense' && (
                  <div className="flex shrink-0 gap-1.5">
                    {(['카드', 'N페이'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onPointerDown={keepFocus}
                        onClick={() => pickMethod(m)}
                        aria-pressed={method === m}
                        className={`h-12 rounded-xl border px-4 text-sm font-semibold transition-colors ${
                          method === m ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white text-stone-500'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onPointerDown={keepFocus}
                  onClick={() => save()}
                  className="h-12 flex-1 rounded-xl bg-brand-500 text-base font-bold text-white transition-colors hover:bg-brand-600"
                >
                  저장
                </button>
              </div>
            </div>
          )}

          <label className="flex w-full items-center gap-2 rounded-[18px] bg-brand-500 px-4 text-white shadow-bar">
            <span className="text-lg font-bold text-white/70">+</span>
            <input
              ref={inputRef}
              inputMode="numeric"
              enterKeyHint="done"
              placeholder="금액 입력"
              aria-label="금액"
              value={amount}
              onChange={e => setAmount(formatAmountInput(e.target.value))}
              className="h-12 min-w-0 flex-1 bg-transparent text-lg font-bold tabular-nums text-white placeholder:text-white/70 focus:outline-none"
            />
            <span className="text-sm font-medium text-white/60">{amt > 0 ? '원' : `${activeCategory} · ${type === 'expense' ? method : '카드'}`}</span>
          </label>
        </div>
      </form>

      {showCats && (
        <CategoryManager
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onAdd={addCategory}
          onRemove={removeCategory}
          onClose={() => setShowCats(false)}
        />
      )}
    </>
  )
}
