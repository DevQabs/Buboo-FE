'use client'

// 가계부 A (시안 ledger-a): 하루 예산 → 곧 나갈/들어올 돈 → 날짜별 내역 → 카테고리 분석·배당·고정비.
// 달력은 머리 아이콘으로 펼친다. 입력은 하단 바에 금액을 바로 넣는다(저축만 입력 시트).
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { IconButton, PageTitle, SectionLabel } from '@/components/ui/Card'
import { Section } from '@/components/ui/Loading'
import CalendarView, { type AddTransactionPayload } from '@/components/dashboard/CalendarView'
import AllowanceHero from './AllowanceHero'
import UpcomingStrip from './UpcomingStrip'
import LedgerFeed from './LedgerFeed'
import CategoryBreakdownCard from './CategoryBreakdownCard'
import EntrySheet from './EntrySheet'
import QuickEntryBar from './QuickEntryBar'
import { apiFetch } from '@/lib/api'
import { daysLeftInPeriod, ledgerPeriod, todayKST } from '@/lib/date'
import { categoryBreakdown, fixedSpendingTotal, upcomingEvents } from '@/lib/ledger'
import type { SectionState } from '@/lib/loadState'
import type {
  CalendarEvent, CalendarSummaryResponse, Couple, CreateDividendRequest, CreateFixedExpenseRequest, DividendYearlySummary,
  FixedExpense, FixedExpenseSummary, MonthlySummary, OtherAsset, PortfolioSummary, StockAssetWithPrice,
  Transaction, UpdateFixedExpenseRequest, User,
} from '@/types'

// 청크 받는 동안은 데이터 스피너가 아니라 빈 카드 자리만(카드 데이터 상태는 Section 이 보인다)
const loadingCard = () => <div className="h-24 w-full animate-pulse rounded-card bg-white" />
const DividendCard = dynamic(() => import('@/components/dashboard/DividendCard'), { ssr: false, loading: loadingCard })
const FixedExpenseCard = dynamic(() => import('@/components/dashboard/FixedExpenseCard'), { ssr: false, loading: loadingCard })

type TxEdit = { title: string; amount: number; category: string; user_id: string }

export interface LedgerScreenProps {
  canEdit: boolean
  /** 하단 탭바가 보이는지(입력 바 위치) */
  hasNav: boolean
  currentUserID: string
  accessToken?: string
  users: User[]
  couple: Couple | null
  summary: MonthlySummary | null
  summaryYear: number
  summaryMonth: number
  startDay: number
  calendarYear: number
  calendarMonth: number
  /** 가계부 기간 거래(5단계: start_date~end_date) */
  transactions: Transaction[]
  calendarTransactions: Transaction[]
  calendarData: CalendarSummaryResponse | null
  fixedExpenses: FixedExpense[]
  feSummary: FixedExpenseSummary | null
  divSummary: DividendYearlySummary | null
  /** 카드별 불러오기 상태(처음엔 스피너·실패면 다시 시도, 새로고침은 작은 스피너) */
  sections: Record<'summary' | 'feed' | 'breakdown' | 'dividends' | 'fixed' | 'calendar', SectionState>
  portfolio: StockAssetWithPrice[]
  portfolioSummary: PortfolioSummary | null
  otherAssets: OtherAsset[]
  onPeriodChange: (p: { year: number; month: number; startDay: number }) => void
  onMonthChange: (year: number, month: number) => void
  onUpdateBudget: (amount: number) => Promise<void>
  /** 만든 거래 id 를 돌려준다(빠른 입력의 되돌리기) */
  onAddTransaction: (p: AddTransactionPayload) => Promise<string>
  onUpdateTransaction: (id: string, data: TxEdit) => Promise<void>
  onDeleteTransaction: (id: string) => Promise<void>
  onAddDividend: (d: CreateDividendRequest) => Promise<void>
  onDeleteDividend: (id: string) => Promise<void>
  onAddFixedExpense: (d: CreateFixedExpenseRequest) => Promise<void>
  onEditFixedExpense: (id: string, d: UpdateFixedExpenseRequest) => Promise<void>
  onDeleteFixedExpense: (id: string) => Promise<void>
}

export default function LedgerScreen(p: LedgerScreenProps) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [focusDate, setFocusDate] = useState<string | null>(null)
  /** 저축 입력 시트에 넘길 금액. null 이면 닫힘 */
  const [savingSheet, setSavingSheet] = useState<string | null>(null)

  const today = todayKST()
  const { startDate, endDate } = ledgerPeriod(p.summaryYear, p.summaryMonth, p.startDay)
  const budget = p.couple?.monthly_budget ?? 0
  const fixed = fixedSpendingTotal(p.fixedExpenses)
  const variable = p.summary?.total_expense ?? 0
  const breakdown = useMemo(() => categoryBreakdown(p.transactions, p.fixedExpenses), [p.transactions, p.fixedExpenses])
  // 곧 나갈/들어올 돈은 달력 달이 아니라 가계부 기간 기준. 시작일이 1일이 아니면 기간이 두 달에 걸친다.
  // 달력 요약이 다시 불리면(고정비·배당 변경) 같이 다시 읽는다.
  // null: 아직 못 받음. 다시 받을 땐 있던 목록을 두고 머리에 작은 스피너만 띄운다.
  const [periodEvents, setPeriodEvents] = useState<CalendarEvent[] | null>(null)
  const [upLoad, setUpLoad] = useState<'loading' | 'error' | 'ok'>('loading')
  const [upRetry, setUpRetry] = useState(0)
  useEffect(() => {
    if (!p.accessToken) return
    const months = p.startDay === 1 ? [startDate] : [startDate, endDate]
    let alive = true
    setUpLoad('loading')
    Promise.all(months.map(d => apiFetch<CalendarSummaryResponse>(
      `/api/transactions/calendar-summary?year=${Number(d.slice(0, 4))}&month=${Number(d.slice(5, 7))}`, p.accessToken!,
    )))
      .then(rs => { if (alive) { setPeriodEvents(rs.flatMap(r => r?.events ?? [])); setUpLoad('ok') } })
      .catch(() => { if (alive) setUpLoad('error') })
    return () => { alive = false }
  }, [startDate, endDate, p.startDay, p.accessToken, p.calendarData, upRetry])
  const upcoming = upcomingEvents(periodEvents ?? [], today, startDate, endDate)
  const upcomingSection: SectionState = {
    view: periodEvents ? (upLoad === 'loading' ? 'refreshing' : 'content') : upLoad === 'error' ? 'error' : 'spinner',
    onRetry: () => setUpRetry(n => n + 1),
  }

  const goMonth = (d: number) => {
    const m = p.calendarMonth + d
    if (m < 1) p.onMonthChange(p.calendarYear - 1, 12)
    else if (m > 12) p.onMonthChange(p.calendarYear + 1, 1)
    else p.onMonthChange(p.calendarYear, m)
  }

  // 내역 행을 누르면 그날 달력 상세를 연다(거래 수정·삭제는 거기서).
  const openDay = (date: string) => {
    setFocusDate(date)
    setShowCalendar(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={`space-y-3 ${p.canEdit ? '' : 'pb-20'}`}>{/* 편집 가능하면 빠른 입력 바가 제 높이만큼 빈 칸을 둔다 */}
      <PageTitle
        eyebrow={`${p.summaryMonth}월 · ${p.startDay}일 시작`}
        title="가계부"
        right={<>
          <IconButton label="이전 달" onClick={() => goMonth(-1)}><ChevronLeftIcon className="h-4 w-4" /></IconButton>
          <IconButton label="다음 달" onClick={() => goMonth(1)}><ChevronRightIcon className="h-4 w-4" /></IconButton>
          <IconButton label="달력" on={showCalendar} onClick={() => { setShowCalendar(v => !v); setFocusDate(null) }}>
            <CalendarDaysIcon className="h-4 w-4" />
          </IconButton>
        </>}
      />

      <Section s={p.sections.summary} minH={168}>
        <AllowanceHero
          budget={budget}
          variable={variable}
          fixed={fixed}
          daysLeft={daysLeftInPeriod(today, startDate, endDate)}
          year={p.summaryYear}
          month={p.summaryMonth}
          startDay={p.startDay}
          onPeriodChange={p.onPeriodChange}
          onUpdateBudget={p.canEdit ? p.onUpdateBudget : undefined}
        />
      </Section>

      {showCalendar && (
        <Section s={p.sections.calendar} minH={320}>
        <CalendarView
          key={focusDate ?? 'month'}
          initialSelectedDate={focusDate ?? undefined}
          year={p.calendarYear}
          month={p.calendarMonth}
          calendarData={p.calendarData}
          transactions={p.calendarTransactions}
          users={p.users}
          currentUserID={p.currentUserID}
          stocks={p.portfolio}
          otherAssets={p.otherAssets}
          budgetLimit={budget}
          accessToken={p.accessToken}
          onMonthChange={p.onMonthChange}
          onAddTransaction={p.canEdit ? async q => { await p.onAddTransaction(q) } : undefined}
          onUpdateTransaction={p.canEdit ? p.onUpdateTransaction : undefined}
          onDeleteTransaction={p.canEdit ? p.onDeleteTransaction : undefined}
        />
        </Section>
      )}

      <Section s={upcomingSection} minH={112}>
        <UpcomingStrip events={upcoming} />
      </Section>

      <SectionLabel>{p.canEdit ? '내역 · 누르면 그날 달력에서 고칠 수 있어요' : '내역'}</SectionLabel>
      <Section s={p.sections.feed} minH={160}>
        <LedgerFeed transactions={p.transactions} users={p.users} onSelectDate={openDay} />
      </Section>

      <Section s={p.sections.breakdown} minH={160}>
        <CategoryBreakdownCard items={breakdown} total={variable + fixed} />
      </Section>

      <Section s={p.sections.dividends}>
      <DividendCard
        summary={p.divSummary}
        portfolio={p.portfolio}
        portfolioSummary={p.portfolioSummary}
        users={p.users}
        year={p.calendarYear}
        month={p.calendarMonth}
        onAdd={p.onAddDividend}
        onDelete={p.onDeleteDividend}
        canEdit={p.canEdit}
      />
      </Section>

      <Section s={p.sections.fixed}>
      <FixedExpenseCard
        fixedExpenses={p.fixedExpenses}
        summary={p.feSummary}
        users={p.users}
        stocks={p.portfolio}
        otherAssets={p.otherAssets}
        year={p.summaryYear}
        month={p.summaryMonth}
        onAdd={p.onAddFixedExpense}
        onEdit={p.onEditFixedExpense}
        onDelete={p.onDeleteFixedExpense}
        canEdit={p.canEdit}
      />
      </Section>

      {p.canEdit && (
        <QuickEntryBar
          hasNav={p.hasNav}
          currentUserID={p.currentUserID}
          accessToken={p.accessToken}
          transactions={p.transactions}
          onSubmit={p.onAddTransaction}
          onDelete={p.onDeleteTransaction}
          onOpenSaving={setSavingSheet}
        />
      )}

      {p.canEdit && savingSheet !== null && (
        <EntrySheet
          initialType="saving"
          initialAmount={savingSheet}
          currentUserID={p.currentUserID}
          accessToken={p.accessToken}
          transactions={p.transactions}
          stocks={p.portfolio}
          otherAssets={p.otherAssets}
          onClose={() => setSavingSheet(null)}
          onSubmit={p.onAddTransaction}
        />
      )}
    </div>
  )
}
