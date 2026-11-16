'use client'

// 가계부 빠른 입력: 하단 바가 곧 금액 입력 칸이다. 누르면 바로 숫자 키패드가 뜨고,
// 금액이 들어가면 바로 위에 카테고리·저장 패널이 올라온다. 저장 뒤에도 키패드를 그대로 두어 다음 건을 잇는다.
// 바 둘째 줄은 내용(거래 title) 칸: 금액 뒤 "다음"으로 넘어가 엔터로 저장한다. 바로 위 칩으로 자주 쓴 내용을 채운다.
// 저축은 자산 연동 양식이 필요해 입력 시트(EntrySheet)로 넘긴다.
import { useEffect, useMemo, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import { motion, useReducedMotion } from 'framer-motion'
import { SPRING, NO_MOTION, tapHaptic } from '@/components/ui/Card'
import { useCategories } from '@/hooks/useCategories'
import CategoryManager from '@/components/dashboard/CategoryManager'
import type { AddTransactionPayload } from '@/components/dashboard/CalendarView'
import { toastError } from '@/components/ui/Toast'
import { openNaverPay } from './EntrySheet'
import { formatAmountInput, parseAmount } from '@/lib/formatNumber'
import { todayKST } from '@/lib/date'
import { sortCategoriesByUse, readPayMethod, categoryColor, recentTitles, NAVER_PAY_TITLE, PAY_METHOD_KEY, type PayMethod, type CategoryColor } from '@/lib/ledger'
import type { Transaction } from '@/types'

type QuickType = 'expense' | 'income'

// 카테고리 색 → 클래스. Tailwind JIT 가 찾도록 완성된 문자열로 둔다.
// dot: 칩 점 / soft: 안 고른 칩 / solid: 고른 칩 / pill: 금액 옆 알약(브랜드 바 위)
const CAT_CLASS: Record<CategoryColor, { dot: string; soft: string; solid: string; pill: string }> = {
  rose: { dot: 'bg-rose-500', soft: 'border-rose-200 bg-rose-50 text-rose-700', solid: 'border-rose-500 bg-rose-500 text-white ring-2 ring-rose-200', pill: 'bg-rose-100 text-rose-800' },
  amber: { dot: 'bg-amber-500', soft: 'border-amber-200 bg-amber-50 text-amber-800', solid: 'border-amber-600 bg-amber-600 text-white ring-2 ring-amber-200', pill: 'bg-amber-100 text-amber-800' },
  emerald: { dot: 'bg-emerald-500', soft: 'border-emerald-200 bg-emerald-50 text-emerald-700', solid: 'border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-200', pill: 'bg-emerald-100 text-emerald-800' },
  teal: { dot: 'bg-teal-500', soft: 'border-teal-200 bg-teal-50 text-teal-700', solid: 'border-teal-600 bg-teal-600 text-white ring-2 ring-teal-200', pill: 'bg-teal-100 text-teal-800' },
  violet: { dot: 'bg-violet-500', soft: 'border-violet-200 bg-violet-50 text-violet-700', solid: 'border-violet-500 bg-violet-500 text-white ring-2 ring-violet-200', pill: 'bg-violet-100 text-violet-800' },
  orange: { dot: 'bg-orange-500', soft: 'border-orange-200 bg-orange-50 text-orange-700', solid: 'border-orange-600 bg-orange-600 text-white ring-2 ring-orange-200', pill: 'bg-orange-100 text-orange-800' },
  lime: { dot: 'bg-lime-500', soft: 'border-lime-200 bg-lime-50 text-lime-800', solid: 'border-lime-700 bg-lime-700 text-white ring-2 ring-lime-200', pill: 'bg-lime-100 text-lime-800' },
  stone: { dot: 'bg-stone-400', soft: 'border-stone-200 bg-stone-50 text-stone-600', solid: 'border-stone-500 bg-stone-500 text-white ring-2 ring-stone-200', pill: 'bg-stone-100 text-stone-700' },
  brand: { dot: 'bg-brand-500', soft: 'border-brand-100 bg-brand-50 text-brand-700', solid: 'border-brand-500 bg-brand-500 text-white ring-2 ring-brand-200', pill: 'bg-brand-100 text-brand-700' },
}

interface QuickEntryBarProps {
  hasNav: boolean
  currentUserID: string
  accessToken?: string
  /** 카테고리 정렬·자주 쓴 내용용(이 기간 거래) */
  transactions: Transaction[]
  /** 만든 거래 id 를 돌려준다. 실패하면 던진다(대시보드가 낙관적 반영을 되돌리고 토스트를 띄운다) */
  onSubmit: (p: AddTransactionPayload) => Promise<string>
  onDelete: (id: string) => Promise<void>
  /** 저축을 고르면 입력 시트를 연다(넣던 금액을 넘긴다) */
  onOpenSaving: (amount: string) => void
}

// 패널 버튼: 눌러도 금액 칸 포커스(키패드)가 빠지지 않게 pointerdown 기본 동작을 막고,
// 동작은 click 이 아니라 pointerup 에서 한다. 누르는 사이 바가 움직이면(바 bottom 이 키보드 높이를 따른다)
// 떼는 자리가 다른 요소라 click 이 오지 않는다. 터치 pointerup 은 누른 버튼으로 온다(암묵 포인터 캡처).
// Enter/Space 로 누르면 포인터가 없어 click(detail 0)으로 받는다.
function keepFocusTap(fn: () => void) {
  return {
    onPointerDown: (e: PointerEvent) => e.preventDefault(),
    onPointerUp: (e: PointerEvent) => { if (e.button === 0) fn() },
    onClick: (e: MouseEvent) => { if (e.detail === 0) fn() },
  }
}

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
    <button type="button" {...(keep ? keepFocusTap(onClick) : { onClick })} className="h-11 shrink-0 px-0.5">
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
  const [title, setTitle] = useState('')
  const [focused, setFocused] = useState(false) // 금액·내용 칸 중 하나에 포커스
  const [undoID, setUndoID] = useState<string | null>(null)
  const [showCats, setShowCats] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pillPop, setPillPop] = useState(0) // 같은 카테고리를 다시 골라도 알약이 다시 부풀게
  const [method, setMethod] = useState<PayMethod>('카드')
  const inputRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [barH, setBarH] = useState(0)
  const saveSeq = useRef(0) // 마지막으로 시작한 저장 번호 — 되돌리기는 이 저장만 가리킨다
  const keyboard = useKeyboardInset()
  const reduceMotion = useReducedMotion()
  const { expenseCategories, incomeCategories, addCategory, removeCategory } = useCategories(accessToken)

  const cats = useMemo(
    () => sortCategoriesByUse(type === 'income' ? incomeCategories : expenseCategories, transactions, type),
    [type, incomeCategories, expenseCategories, transactions],
  )
  const titles = useMemo(() => recentTitles(transactions, { limit: 8, type }), [transactions, type])
  const activeCategory = category || cats[0] || '기타'
  const amt = parseAmount(amount)
  const today = todayKST()

  useEffect(() => {
    try { setMethod(readPayMethod(localStorage.getItem(PAY_METHOD_KEY))) } catch { /* 저장소 막힘: 기본 카드 */ }
  }, [])

  // 떠 있는 바 높이만큼 본문 끝에 빈 칸을 둬 마지막 카드가 바 밑에 숨지 않게 한다(패널이 열리면 같이 늘어난다)
  useEffect(() => {
    const el = formRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBarH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 바 오른쪽 카테고리 알약을 누르면 선택판이 열리고 닫힌다. 칩을 고르면 접히고 알약이 다시 부푼다.
  const togglePicker = () => {
    tapHaptic()
    setPickerOpen(v => !v)
  }
  const pickCategory = (c: string) => {
    setCategory(c)
    tapHaptic()
    setPickerOpen(false)
    setPillPop(n => n + 1)
  }

  const pickMethod = (m: PayMethod) => {
    if (m !== method) tapHaptic()
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
    const pay = type === 'expense' ? method : '카드' // 결제수단 버튼은 지출에만 있다
    const thenPay = pay === 'N페이'
    const typed = amount
    const payload: AddTransactionPayload = {
      user_id: currentUserID,
      type,
      amount: amt,
      category: activeCategory,
      title: title.trim() || (thenPay ? NAVER_PAY_TITLE : ''),
      date,
      payment_method: pay,
    }
    // 다음 건을 바로 넣게 먼저 비우고 포커스를 지킨다. 실패하면 금액을 되살린다.
    setAmount('')
    setTitle('')
    setCategory('')
    setPickerOpen(false)
    setUndoID(null)
    inputRef.current?.focus()
    const seq = ++saveSeq.current
    try {
      const id = await onSubmit(payload)
      if (seq === saveSeq.current) setUndoID(id) // 늦게 끝난 옛 저장은 되돌리기 대상이 아니다
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

  const pickTitle = (t: { title: string; category: string }) => {
    tapHaptic()
    setTitle(t.title)
    setCategory(t.category)
    setPillPop(n => n + 1)
  }

  // 한글 조합 중 엔터는 글자 확정이라 넘긴다
  const onAmountKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (amt > 0) titleRef.current?.focus()
  }
  const onTitleKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    save()
  }
  // 바 안에서 금액 ↔ 내용으로 옮길 때는 포커스가 빠진 것이 아니다
  const onBarBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false)
  }

  const openDate = () => {
    try { dateRef.current?.showPicker() } catch { dateRef.current?.focus() }
  }

  const position = hasNav
    ? 'bottom-[calc(var(--nav-h)+0.75rem)]'
    : 'bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]'

  return (
    <>
      <div aria-hidden style={{ height: barH }} />
      <form
        ref={formRef}
        onSubmit={onFormSubmit}
        className={`fixed inset-x-0 z-50 px-3 ${position}`}
        style={keyboard ? { bottom: keyboard + 8 } : undefined}
      >
        <div className="mx-auto flex w-full max-w-[calc(42rem-1.5rem)] flex-col gap-2">
          {undoID && (
            <div role="status" className="flex items-center justify-between self-center rounded-full bg-stone-800 py-1 pl-4 pr-1 text-sm text-white shadow-warm">
              <span>저장됨</span>
              <button type="button" {...keepFocusTap(undo)} className="ml-3 h-11 rounded-full px-3 font-semibold text-white/90">
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
              </div>

              <button
                type="button"
                {...keepFocusTap(() => save())}
                className="h-12 w-full rounded-xl bg-brand-500 text-base font-bold text-white transition-colors hover:bg-brand-600"
              >
                저장
              </button>
            </div>
          )}

          {pickerOpen && (
            <>
              <div id="quick-cat-picker" className="rounded-card border border-line bg-white p-3 shadow-warm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-stone-800">카테고리</span>
                  <button type="button" onClick={() => setShowCats(true)} aria-label="카테고리 관리" className="-my-2 flex h-11 w-11 items-center justify-center rounded-full text-stone-400">
                    <Cog6ToothIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cats.map((c, i) => {
                    const cc = CAT_CLASS[categoryColor(c)]
                    const on = activeCategory === c
                    return (
                      <motion.button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        {...keepFocusTap(() => pickCategory(c))}
                        initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={reduceMotion ? NO_MOTION : { ...SPRING, delay: i * 0.025 }}
                        className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${on ? cc.solid : cc.soft}`}
                      >
                        <span aria-hidden className={`h-2 w-2 rounded-full ${on ? 'bg-white' : cc.dot}`} />
                        {c}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
              <div role="separator" className="mx-4 h-px bg-line" />
            </>
          )}

          {(focused || amt > 0) && titles.length > 0 && (
            // 자주 쓴 내용: 누르면 내용과 그 내용에 마지막으로 고른 카테고리를 채운다
            <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
              {titles.map(t => {
                const on = title === t.title
                return (
                  <button
                    key={t.title}
                    type="button"
                    aria-pressed={on}
                    aria-label={`내용 ${t.title}, 카테고리 ${t.category}`}
                    {...keepFocusTap(() => pickTitle(t))}
                    className={`flex min-h-10 max-w-[10rem] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold shadow-warm transition-colors ${on ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white text-stone-700'}`}
                  >
                    <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${on ? 'bg-white' : CAT_CLASS[categoryColor(t.category)].dot}`} />
                    <span className="truncate">{t.title}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* 바 오른쪽 카테고리·결제수단은 금액 전에도 누를 수 있는 버튼이다. label 밖에 두어 누름이 금액 칸 포커스로 먹히지 않게 한다 */}
          <div
            onFocus={() => setFocused(true)}
            onBlur={onBarBlur}
            className="w-full rounded-[18px] bg-brand-500 text-white shadow-bar"
          >
          <div className="flex w-full items-center gap-1 pl-4 pr-1.5">
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <span className="text-lg font-bold text-white/70">+</span>
              <input
                ref={inputRef}
                inputMode="numeric"
                enterKeyHint="next"
                placeholder="금액 입력"
                aria-label="금액"
                value={amount}
                onChange={e => setAmount(formatAmountInput(e.target.value))}
                onKeyDown={onAmountKey}
                className={`h-12 min-w-0 flex-1 bg-transparent font-bold ${amount.length > 9 ? 'text-base' : 'text-lg'} tabular-nums text-white placeholder:text-white/70 focus:outline-none`}
              />
              {amt > 0 && <span className="text-sm font-medium text-white/60">원</span>}
            </label>
            <button
              type="button"
              aria-label={`카테고리 ${activeCategory}, 바꾸기`}
              aria-expanded={pickerOpen}
              aria-controls="quick-cat-picker"
              {...keepFocusTap(togglePicker)}
              className="flex h-11 min-w-11 max-w-[6.5rem] shrink-0 items-center justify-center px-0.5"
            >
              <motion.span
                key={`${activeCategory}-${pillPop}`}
                initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduceMotion ? NO_MOTION : SPRING}
                className={`flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold ring-2 ring-white/50 ${CAT_CLASS[categoryColor(activeCategory)].pill}`}
              >
                <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${CAT_CLASS[categoryColor(activeCategory)].dot}`} />
                <span className="truncate">{activeCategory}</span>
                <span aria-hidden className={`text-[10px] transition-transform ${pickerOpen ? 'rotate-180' : ''}`}>▾</span>
              </motion.span>
            </button>
            {type === 'expense' && (
              // 누를 때마다 카드 ↔ N페이. 수입은 결제수단이 카드로 고정이라 보이지 않는다
              <button
                type="button"
                aria-label={`결제수단 ${method}, 바꾸기`}
                {...keepFocusTap(() => pickMethod(method === '카드' ? 'N페이' : '카드'))}
                className="flex h-11 min-w-11 shrink-0 items-center justify-center px-0.5"
              >
                <motion.span
                  key={method}
                  initial={reduceMotion ? false : { scale: 0.7 }}
                  animate={{ scale: 1 }}
                  transition={reduceMotion ? NO_MOTION : SPRING}
                  className={`block rounded-full px-2.5 py-1.5 text-xs font-semibold text-white ring-2 ring-white/50 ${method === 'N페이' ? 'bg-emerald-600' : 'bg-stone-700'}`}
                >
                  {method}
                </motion.span>
              </button>
            )}
          </div>
          <div className="mx-4 border-t border-white/20" />
          <input
            ref={titleRef}
            enterKeyHint="done"
            placeholder={type === 'expense' ? '어디에 썼나요?' : '어디서 받았나요?'}
            aria-label="내용"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={onTitleKey}
            className="h-11 w-full bg-transparent px-4 text-base text-white placeholder:text-white/60 focus:outline-none"
          />
          </div>
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
