'use client'

/**
 * DashboardClient — all interactive state lives here.
 * Data is fetched client-side from the Go API (localhost:8090 in dev).
 *
 * Tab 1 (자산 현황): 통합 순자산 요약 + 주식 포트폴리오 + 기타 자산
 * Tab 2 (가계부):    기간 선택 가능한 월별 요약 + 거래 내역
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChartPieIcon, BookOpenIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import SummaryCard from '@/components/dashboard/SummaryCard'
import StockPortfolioCard from '@/components/dashboard/StockPortfolioCard'
import AddStockModal from '@/components/dashboard/AddStockModal'
import EditStockModal from '@/components/dashboard/EditStockModal'
import BuySellModal from '@/components/dashboard/BuySellModal'
import OtherAssetCard from '@/components/dashboard/OtherAssetCard'
import NetWorthSummaryCard from '@/components/dashboard/NetWorthSummaryCard'
import FixedExpenseCard from '@/components/dashboard/FixedExpenseCard'
import DividendCard from '@/components/dashboard/DividendCard'
import CalendarView from '@/components/dashboard/CalendarView'
import ScheduleTab from '@/components/dashboard/ScheduleTab'
import type {
  User,
  Couple,
  Transaction,
  SavingLink,
  StockAssetWithPrice,
  MonthlySummary,
  PortfolioResponse,
  PortfolioSummary,
  OtherAsset,
  CreateOtherAssetRequest,
  UpdateOtherAssetRequest,
  NetWorthSummary,
  FixedExpense,
  FixedExpenseSummary,
  CreateFixedExpenseRequest,
  UpdateFixedExpenseRequest,
  DividendYearlySummary,
  CreateDividendRequest,
  CalendarSummaryResponse,
  Schedule,
  DiaryEntry,
  CreateScheduleRequest,
  CreateDiaryRequest,
} from '@/types'

// 개발: NEXT_PUBLIC_API_URL=http://localhost:8090 으로 직접 호출
// 프로덕션: 빈 문자열 → /api/* 경로로 → next.config.mjs rewrite가 백엔드로 프록시
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

type ActiveTab = 'wealth' | 'ledger' | 'life'

// ─── fetch helpers ────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

/** Build the start/end date strings for a given display-month + startDay. */
function buildDateRange(year: number, month: number, startDay: number): { startDate: string; endDate: string } {
  if (startDay === 1) {
    // calendar month: Jan 1 → Feb 1 (exclusive)
    const endYear  = month === 12 ? year + 1 : year
    const endMonth = month === 12 ? 1 : month + 1
    return {
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate:   `${endYear}-${String(endMonth).padStart(2, '0')}-01`,
    }
  }
  // salary-cycle month: e.g. startDay=25 → Dec 25 ~ Jan 24
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear  = month === 1 ? year - 1 : year
  return {
    startDate: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
    endDate:   `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
  }
}

// ─── component ────────────────────────────────────────────────────────────────

export default function DashboardClient() {
  // ── core data ──
  const [users, setUsers]             = useState<User[]>([])
  const [couple, setCouple]           = useState<Couple | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [portfolio, setPortfolio]     = useState<StockAssetWithPrice[]>([])
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null)
  const [otherAssets, setOtherAssets] = useState<OtherAsset[]>([])
  const [summary, setSummary]         = useState<MonthlySummary | null>(null)
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [feSummary, setFeSummary]     = useState<FixedExpenseSummary | null>(null)
  const [divSummary, setDivSummary]   = useState<DividendYearlySummary | null>(null)
  const [calendarData, setCalendarData] = useState<CalendarSummaryResponse | null>(null)
  const [schedules, setSchedules]     = useState<Schedule[]>([])
  const [diaries, setDiaries]         = useState<DiaryEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  // ── UI state ──
  const [activeTab, setActiveTab]     = useState<ActiveTab>('wealth')
  const now = new Date()
  const [summaryYear, setSummaryYear]   = useState(now.getFullYear())
  const [summaryMonth, setSummaryMonth] = useState(now.getMonth() + 1)
  // calendarYear/calendarMonth: what CalendarView displays (always calendar month)
  const [calendarYear, setCalendarYear]   = useState(now.getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1)
  // startDay는 DB(couple.ledger_start_day)에서 초기화 — localStorage 미사용
  const [startDay, setStartDay] = useState<number>(1)

  // ── stock modals ──
  const [showAddStock, setShowAddStock]   = useState(false)
  const [editingStock, setEditingStock]   = useState<StockAssetWithPrice | null>(null)
  const [buySellTarget, setBuySellTarget] = useState<{ asset: StockAssetWithPrice; mode: 'buy' | 'sell' } | null>(null)

  // ── derived: 통합 순자산 ──────────────────────────────────────────────────
  const netWorth = useMemo<NetWorthSummary>(() => {
    const stockValueKrw  = portfolioSummary?.total_value_krw ?? 0
    const assetValueKrw  = otherAssets
      .filter(a => !a.is_liability)
      .reduce((s, a) => s + a.value_krw, 0)
    const liabilityKrw   = otherAssets
      .filter(a => a.is_liability)
      .reduce((s, a) => s + a.value_krw, 0)
    return {
      stock_value_krw: stockValueKrw,
      asset_value_krw: assetValueKrw,
      liability_krw:   liabilityKrw,
      net_worth_krw:   stockValueKrw + assetValueKrw - liabilityKrw,
      calculated_at:   new Date().toISOString(),
    }
  }, [portfolioSummary, otherAssets])

  // ── fetch summary by period ───────────────────────────────────────────────
  const fetchSummary = useCallback(async (y: number, m: number, sd: number) => {
    const { startDate, endDate } = buildDateRange(y, m, sd)
    const data = await apiFetch<MonthlySummary>(
      `/api/summary?start_date=${startDate}&end_date=${endDate}`
    )
    setSummary(data)
  }, [])

  // ── fetch calendar summary ────────────────────────────────────────────────
  const fetchCalendar = useCallback(async (y: number, m: number) => {
    const data = await apiFetch<CalendarSummaryResponse>(
      `/api/transactions/calendar-summary?year=${y}&month=${m}`
    )
    setCalendarData(data)
  }, [])

  // ── initial load ─────────────────────────────────────────────────────────
  // Step 1: fetch couple first (tiny JSON) to get ledger_start_day from DB.
  // Step 2: fetch everything else in parallel using the correct startDay.
  const fetchAll = useCallback(async () => {
    try {
      const y = now.getFullYear()
      const m = now.getMonth() + 1

      // ── Step 1: couple (determines period boundaries) ──
      const coupleData = await apiFetch<Couple>('/api/couple')
      const dbStartDay = (coupleData?.ledger_start_day >= 1 && coupleData?.ledger_start_day <= 28)
        ? coupleData.ledger_start_day
        : 1
      setCouple(coupleData)
      setStartDay(dbStartDay)

      // calendarYear/calendarMonth always = current calendar month (for the grid)
      setCalendarYear(y)
      setCalendarMonth(m)

      // summaryYear/summaryMonth = period that contains today.
      // If today >= startDay (and startDay > 1), today is in the NEXT month's period.
      // e.g. startDay=25, today=May 31 → period is "June" (May 25–Jun 25).
      const todayDate = now.getDate()
      const periodMonth = (dbStartDay > 1 && todayDate >= dbStartDay) ? m + 1 : m
      const periodYear  = periodMonth > 12 ? y + 1 : y
      const adjMonth    = periodMonth > 12 ? 1 : periodMonth
      setSummaryYear(periodYear)
      setSummaryMonth(adjMonth)

      const { startDate, endDate } = buildDateRange(periodYear, adjMonth, dbStartDay)

      // ── Step 2: everything else in parallel ──
      const [usersData, txData, portfolioData, summaryData, assetsData, feData, feSummaryData, divData, calData, schData, diarData] = await Promise.all([
        apiFetch<User[]>('/api/users'),
        apiFetch<Transaction[]>('/api/transactions'),
        apiFetch<PortfolioResponse>('/api/stocks/portfolio'),
        apiFetch<MonthlySummary>(`/api/summary?start_date=${startDate}&end_date=${endDate}`),
        apiFetch<OtherAsset[]>('/api/assets'),
        apiFetch<FixedExpense[]>('/api/fixed-expenses'),
        apiFetch<FixedExpenseSummary>(`/api/fixed-expenses/summary?year=${y}&month=${m}`),
        apiFetch<DividendYearlySummary>(`/api/dividends/summary?year=${y}`),
        apiFetch<CalendarSummaryResponse>(`/api/transactions/calendar-summary?year=${y}&month=${m}`),
        apiFetch<Schedule[]>('/api/schedules'),
        apiFetch<DiaryEntry[]>('/api/diaries'),
      ])

      setUsers(Array.isArray(usersData) ? usersData : [])
      setTransactions(Array.isArray(txData) ? txData : [])

      if (Array.isArray(portfolioData)) {
        setPortfolio(portfolioData)
        setPortfolioSummary(null)
      } else {
        setPortfolio(portfolioData?.items ?? [])
        setPortfolioSummary(portfolioData?.summary ?? null)
      }

      setSummary(summaryData)
      setOtherAssets(Array.isArray(assetsData) ? assetsData : [])
      setFixedExpenses(Array.isArray(feData) ? feData : [])
      setFeSummary(feSummaryData)
      setDivSummary(divData)
      setCalendarData(calData)
      setSchedules(Array.isArray(schData) ? schData : [])
      setDiaries(Array.isArray(diarData) ? diarData : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── period change handler ─────────────────────────────────────────────────
  const handlePeriodChange = useCallback(
    ({ year, month, startDay: sd }: { year: number; month: number; startDay: number }) => {
      setSummaryYear(year)
      setSummaryMonth(month)
      setStartDay(sd)
      // Persist startDay to DB so all users share the same setting.
      // Fire-and-forget: UI responds immediately, DB update runs in background.
      fetch(`${API_BASE}/api/couple`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthly_budget: couple?.monthly_budget ?? 0,
          ledger_start_day: sd,
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(updated => { if (updated) setCouple(updated) })
        .catch(() => { /* non-critical, UI already updated */ })
      fetchSummary(year, month, sd)
      fetchCalendar(year, month)
    },
    [fetchSummary, fetchCalendar, couple]
  )

  // ── calendar month change — calendar display + summary period both update ──
  const handleCalendarMonthChange = useCallback((year: number, month: number) => {
    setCalendarYear(year)
    setCalendarMonth(month)
    setSummaryYear(year)
    setSummaryMonth(month)
    fetchCalendar(year, month)
    fetchSummary(year, month, startDay)
  }, [fetchCalendar, fetchSummary, startDay])

  // ── portfolio refetch ─────────────────────────────────────────────────────
  const refetchPortfolio = async () => {
    const updated = await apiFetch<PortfolioResponse>('/api/stocks/portfolio')
    if (Array.isArray(updated)) {
      setPortfolio(updated)
      setPortfolioSummary(null)
    } else {
      setPortfolio(updated?.items ?? [])
      setPortfolioSummary(updated?.summary ?? null)
    }
  }

  // ── assets refetch ────────────────────────────────────────────────────────
  const refetchAssets = async () => {
    const updated = await apiFetch<OtherAsset[]>('/api/assets')
    setOtherAssets(Array.isArray(updated) ? updated : [])
  }

  // ── fixed expense refetch ─────────────────────────────────────────────────
  const refetchFixedExpenses = useCallback(async (y = summaryYear, m = summaryMonth) => {
    const [feData, feSummaryData, txData] = await Promise.all([
      apiFetch<FixedExpense[]>('/api/fixed-expenses'),
      apiFetch<FixedExpenseSummary>(`/api/fixed-expenses/summary?year=${y}&month=${m}`),
      apiFetch<Transaction[]>('/api/transactions'),
    ])
    setFixedExpenses(Array.isArray(feData) ? feData : [])
    setFeSummary(feSummaryData)
    setTransactions(Array.isArray(txData) ? txData : [])
  }, [summaryYear, summaryMonth])

  // ── transaction handlers ──────────────────────────────────────────────────
  const handleAddTransaction = async (data: {
    user_id: string
    type: 'income' | 'expense' | 'saving'
    amount: number
    category: string
    title: string
    payment_method: string
    saving_link?: SavingLink
  }) => {
    const ts = new Date().toISOString()

    // Saving transactions have asset side-effects — skip optimistic update,
    // do a real POST then refetch everything that may have changed.
    if (data.type === 'saving') {
      const res = await fetch(`${API_BASE}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, couple_id: 'couple-001', date: ts }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `저축 등록 실패: ${res.status}`)
      }
      await Promise.all([
        (async () => {
          const txData = await apiFetch<Transaction[]>('/api/transactions')
          setTransactions(Array.isArray(txData) ? txData : [])
        })(),
        refetchPortfolio(),
        refetchAssets(),
        fetchSummary(summaryYear, summaryMonth, startDay),
      ])
      return
    }

    const optimistic: Transaction = {
      id: `temp-${Date.now()}`,
      couple_id: 'couple-001',
      user_id: data.user_id,
      type: data.type,
      amount: data.amount,
      currency: 'KRW',
      category: data.category,
      subcategory: '',
      title: data.title,
      memo: '',
      date: ts,
      payment_method: data.payment_method,
      is_fixed: false,
      tags: [],
      location: null,
      created_at: ts,
      updated_at: ts,
    }

    setTransactions(prev => [optimistic, ...prev])
    setSummary(prev => {
      if (!prev) return prev
      const delta = data.type === 'income' ? data.amount : -data.amount
      return {
        ...prev,
        total_income:  data.type === 'income'  ? prev.total_income  + data.amount : prev.total_income,
        total_expense: data.type === 'expense' ? prev.total_expense + data.amount : prev.total_expense,
        balance: prev.balance + delta,
      }
    })

    try {
      const created: Transaction = await fetch(`${API_BASE}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, couple_id: 'couple-001', date: ts }),
      }).then(r => r.json())
      setTransactions(prev => prev.map(tx => tx.id === optimistic.id ? created : tx))
    } catch {
      setTransactions(prev => prev.filter(tx => tx.id !== optimistic.id))
    }
  }

  // ── update/delete transaction ─────────────────────────────────────────────────
  const handleUpdateTransaction = useCallback(async (id: string, data: { title: string; amount: number; category: string; user_id: string }) => {
    const existing = transactions.find(tx => tx.id === id)
    if (!existing) return
    const res = await fetch(`${API_BASE}/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...existing, ...data }),
    })
    if (!res.ok) throw new Error(`거래 수정 실패: ${res.status}`)
    const [txData] = await Promise.all([
      apiFetch<Transaction[]>('/api/transactions'),
      fetchSummary(summaryYear, summaryMonth, startDay),
      apiFetch<CalendarSummaryResponse>(`/api/transactions/calendar-summary?year=${calendarYear}&month=${calendarMonth}`).then(d => setCalendarData(d)),
    ])
    setTransactions(Array.isArray(txData) ? txData : [])
  }, [transactions, summaryYear, summaryMonth, startDay, calendarYear, calendarMonth, fetchSummary]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteTransaction = useCallback(async (id: string) => {
    await fetch(`${API_BASE}/api/transactions/${id}`, { method: 'DELETE' })
    setTransactions(prev => prev.filter(tx => tx.id !== id))
    await Promise.all([
      fetchSummary(summaryYear, summaryMonth, startDay),
      apiFetch<CalendarSummaryResponse>(`/api/transactions/calendar-summary?year=${calendarYear}&month=${calendarMonth}`).then(d => setCalendarData(d)),
    ])
  }, [summaryYear, summaryMonth, startDay, calendarYear, calendarMonth, fetchSummary]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── add transaction from calendar (specific date, refetches calendar + summary) ──
  const handleAddTransactionOnDate = useCallback(async (payload: {
    user_id: string
    type: 'income' | 'expense' | 'saving'
    amount: number
    category: string
    title: string
    date: string  // YYYY-MM-DD
    saving_link?: SavingLink
  }) => {
    const dateISO = `${payload.date}T12:00:00+09:00`
    const res = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        couple_id: 'couple-001',
        user_id: payload.user_id,
        type: payload.type,
        amount: payload.amount,
        currency: 'KRW',
        category: payload.category,
        title: payload.title,
        payment_method: 'card',
        date: dateISO,
        saving_link: payload.saving_link,
      }),
    })
    if (!res.ok) throw new Error(`거래 추가 실패: ${res.status}`)

    const refetches: Promise<unknown>[] = [
      apiFetch<Transaction[]>('/api/transactions').then(d => setTransactions(Array.isArray(d) ? d : [])),
      apiFetch<CalendarSummaryResponse>(`/api/transactions/calendar-summary?year=${calendarYear}&month=${calendarMonth}`).then(d => setCalendarData(d)),
      fetchSummary(summaryYear, summaryMonth, startDay),
    ]
    if (payload.type === 'saving') {
      refetches.push(refetchPortfolio(), refetchAssets())
    }
    await Promise.all(refetches)
  }, [calendarYear, calendarMonth, summaryYear, summaryMonth, startDay, fetchSummary, refetchPortfolio, refetchAssets]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── stock handlers ────────────────────────────────────────────────────────
  const handleAddStock = async (data: Parameters<React.ComponentProps<typeof AddStockModal>['onAdd']>[0]) => {
    const res = await fetch(`${API_BASE}/api/stocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, couple_id: 'couple-001' }),
    })
    if (!res.ok) throw new Error(`주식 추가 실패: ${res.status}`)
    await refetchPortfolio()
  }

  const handleEditStock = async (id: string, data: {
    user_id?: string; name?: string; quantity?: number
    average_price?: number; memo?: string
  }) => {
    const res = await fetch(`${API_BASE}/api/stocks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`주식 수정 실패: ${res.status}`)
    await refetchPortfolio()
  }

  const handleBuySellStock = async (
    mode: 'buy' | 'sell',
    data: { quantity: number; price: number; memo: string }
  ) => {
    if (!buySellTarget) return
    const res = await fetch(`${API_BASE}/api/stocks/${buySellTarget.asset.id}/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`${mode === 'buy' ? '매수' : '매도'} 실패: ${res.status}`)
    await refetchPortfolio()
  }

  const handleDeleteStock = async (asset: StockAssetWithPrice) => {
    const res = await fetch(`${API_BASE}/api/stocks/${asset.id}?force=true`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`주식 삭제 실패: ${res.status}`)
    setPortfolio(prev => prev.filter(a => a.id !== asset.id))
    await refetchPortfolio()
  }

  // ── other-asset handlers ──────────────────────────────────────────────────
  const handleAddAsset = async (data: CreateOtherAssetRequest) => {
    const res = await fetch(`${API_BASE}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, couple_id: 'couple-001' }),
    })
    if (!res.ok) throw new Error(`자산 추가 실패: ${res.status}`)
    await refetchAssets()
    if (data.asset_type === '대출') {
      await refetchFixedExpenses()
      await fetchCalendar(calendarYear, calendarMonth)
    }
  }

  const handleEditAsset = async (id: string, data: UpdateOtherAssetRequest) => {
    const res = await fetch(`${API_BASE}/api/assets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`자산 수정 실패: ${res.status}`)
    await refetchAssets()
  }

  const handleDeleteAsset = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/assets/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`자산 삭제 실패: ${res.status}`)
    setOtherAssets(prev => prev.filter(a => a.id !== id))
  }

  const handleCreateLoanExpense = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/assets/${id}/loan-expense`, { method: 'POST' })
    if (!res.ok) throw new Error(`고정비 생성 실패: ${res.status}`)
    await refetchFixedExpenses()
    await fetchCalendar(calendarYear, calendarMonth)
  }

  // ── fixed expense handlers ────────────────────────────────────────────────
  const handleAddFixedExpense = async (data: CreateFixedExpenseRequest) => {
    const res = await fetch(`${API_BASE}/api/fixed-expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, couple_id: 'couple-001' }),
    })
    if (!res.ok) throw new Error(`고정비 추가 실패: ${res.status}`)
    await refetchFixedExpenses()
  }

  const handleEditFixedExpense = async (id: string, data: UpdateFixedExpenseRequest) => {
    const res = await fetch(`${API_BASE}/api/fixed-expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`고정비 수정 실패: ${res.status}`)
    await refetchFixedExpenses()
  }

  const handleDeleteFixedExpense = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/fixed-expenses/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`고정비 삭제 실패: ${res.status}`)
    await refetchFixedExpenses()
  }

  // ── budget update ─────────────────────────────────────────────────────────
  const handleUpdateBudget = useCallback(async (amount: number) => {
    const res = await fetch(`${API_BASE}/api/couple`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // Always include ledger_start_day so the backend doesn't reset it
      body: JSON.stringify({ monthly_budget: amount, ledger_start_day: startDay }),
    })
    if (!res.ok) throw new Error(`예산 저장 실패: ${res.status}`)
    const updated: Couple = await res.json()
    setCouple(updated)
  }, [startDay])

  // ── dividend handlers ─────────────────────────────────────────────────────
  const refetchDividends = useCallback(async (y = now.getFullYear()) => {
    const data = await apiFetch<DividendYearlySummary>(`/api/dividends/summary?year=${y}`)
    setDivSummary(data)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddDividend = async (data: CreateDividendRequest) => {
    const body = {
      ...data,
      couple_id: 'couple-001',
      payment_date: `${data.payment_date}T00:00:00Z`,
      ex_dividend_date: data.ex_dividend_date ? `${data.ex_dividend_date}T00:00:00Z` : undefined,
    }
    const res = await fetch(`${API_BASE}/api/dividends`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`배당 등록 실패: ${res.status}`)
    await refetchDividends()
  }

  const handleDeleteDividend = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/dividends/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`배당 삭제 실패: ${res.status}`)
    await refetchDividends()
  }

  const handleApplyDividend = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/dividends/${id}/apply`, { method: 'POST' })
    if (!res.ok) throw new Error(`배당 반영 실패: ${res.status}`)
    // Refresh transactions + dividend summary
    await Promise.all([
      refetchDividends(),
      (async () => {
        const txData = await apiFetch<Transaction[]>('/api/transactions')
        setTransactions(Array.isArray(txData) ? txData : [])
      })(),
    ])
  }

  const handleApplyFixedExpenses = async () => {
    const res = await fetch(
      `${API_BASE}/api/fixed-expenses/apply?year=${summaryYear}&month=${summaryMonth}`,
      { method: 'POST' }
    )
    if (!res.ok) throw new Error(`고정비 적용 실패: ${res.status}`)
    // Refresh transactions + summary + fe summary
    await Promise.all([
      refetchFixedExpenses(),
      fetchSummary(summaryYear, summaryMonth, startDay),
    ])
  }

  // ── schedule handlers ─────────────────────────────────────────────────────
  const handleAddSchedule = async (req: CreateScheduleRequest) => {
    const res = await fetch(`${API_BASE}/api/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error(`일정 저장 실패: ${res.status}`)
    const created: Schedule = await res.json()
    setSchedules(s => [...s, created])
  }

  const handleDeleteSchedule = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/schedules/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`일정 삭제 실패: ${res.status}`)
    setSchedules(s => s.filter(x => x.id !== id))
  }

  // ── diary handlers ────────────────────────────────────────────────────────
  const handleAddDiary = async (req: CreateDiaryRequest, photos: File[]) => {
    const res = await fetch(`${API_BASE}/api/diaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error(`일기 저장 실패: ${res.status}`)
    const created: DiaryEntry = await res.json()
    // Upload photos one by one
    for (const photo of photos) {
      const form = new FormData()
      form.append('photo', photo)
      await fetch(`${API_BASE}/api/diaries/${created.id}/photos`, { method: 'POST', body: form })
    }
    // Refetch diary to get updated photos
    const updated = await apiFetch<DiaryEntry[]>('/api/diaries')
    setDiaries(Array.isArray(updated) ? updated : [])
  }

  const handleDeleteDiary = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/diaries/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`일기 삭제 실패: ${res.status}`)
    setDiaries(d => d.filter(x => x.id !== id))
  }

  // ── loading / error screens ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin" />
        <p className="text-sm text-slate-400">불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-7 shadow-sm text-center space-y-2 w-full max-w-sm">
          <div className="text-3xl mb-1">⚠️</div>
          <p className="font-bold text-slate-800">서버 연결 실패</p>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
          <p className="text-xs text-slate-300">Go 서버({API_BASE})가 실행 중인지 확인하세요.</p>
        </div>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-md px-5 py-3 sticky top-0 z-40 border-b border-slate-100/60">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-sm font-black">우</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                {couple?.name ?? '우리 가계부'}
              </h1>
              <p className="text-[10px] text-slate-400">
                {now.getFullYear()}.{String(now.getMonth() + 1).padStart(2,'0')}.{String(now.getDate()).padStart(2,'0')}
              </p>
            </div>
          </div>

          <div className="flex -space-x-2">
            {(users ?? []).map(u => (
              <div
                key={u.id}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white shadow-sm"
                style={{ backgroundColor: u.avatar_color }}
                title={u.name}
              >
                {u.name[0]}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-2xl mx-auto px-3 pt-4 pb-28 space-y-3">

        {/* ══ Tab 1: 자산 현황 ══ */}
        {activeTab === 'wealth' && (
          <>
            {/* 통합 순자산 요약 */}
            <NetWorthSummaryCard
              netWorth={netWorth}
              portfolioSummary={portfolioSummary}
            />

            {/* 주식 포트폴리오 */}
            <StockPortfolioCard
              assets={portfolio}
              users={users}
              summary={portfolioSummary}
              onAddClick={() => setShowAddStock(true)}
              onEditClick={setEditingStock}
              onBuySellClick={(asset, mode) => setBuySellTarget({ asset, mode })}
              onDeleteClick={handleDeleteStock}
            />

            {/* 기타 자산 */}
            <OtherAssetCard
              assets={otherAssets}
              users={users}
              onAdd={handleAddAsset}
              onEdit={handleEditAsset}
              onDelete={handleDeleteAsset}
              onCreateLoanExpense={handleCreateLoanExpense}
            />
          </>
        )}

        {/* ══ Tab 2: 가계부 ══ */}
        {activeTab === 'ledger' && (
          <>
            {/* 예산 현황 + 기간 선택 (맨 위) */}
            {summary && (
              <SummaryCard
                summary={{ ...summary, budget_limit: couple?.monthly_budget ?? 0 }}
                year={summaryYear}
                month={summaryMonth}
                startDay={startDay}
                onPeriodChange={handlePeriodChange}
                budgetLimit={couple?.monthly_budget ?? 0}
                onUpdateBudget={handleUpdateBudget}
              />
            )}

            {/* 월간 캘린더 (날짜 클릭 → 수입/지출 입력) */}
            <CalendarView
              year={calendarYear}
              month={calendarMonth}
              calendarData={calendarData}
              transactions={transactions}
              users={users}
              stocks={portfolio}
              otherAssets={otherAssets}
              budgetLimit={couple?.monthly_budget ?? 0}
              onMonthChange={handleCalendarMonthChange}
              onAddTransaction={handleAddTransactionOnDate}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />

            {/* 배당 수익 */}
            <DividendCard
              summary={divSummary}
              portfolio={portfolio}
              portfolioSummary={portfolioSummary}
              year={summaryYear}
              onAdd={handleAddDividend}
              onDelete={handleDeleteDividend}
              onApply={handleApplyDividend}
            />

            {/* 고정비 관리 + 숨만 쉬어도 나가는 돈 */}
            <FixedExpenseCard
              fixedExpenses={fixedExpenses}
              summary={feSummary}
              users={users}
              stocks={portfolio}
              otherAssets={otherAssets}
              year={summaryYear}
              month={summaryMonth}
              onAdd={handleAddFixedExpense}
              onEdit={handleEditFixedExpense}
              onDelete={handleDeleteFixedExpense}
              onApply={handleApplyFixedExpenses}
            />

          </>
        )}

        {/* ══ Tab 3: 일정/일기 ══ */}
        {activeTab === 'life' && (
          <ScheduleTab
            schedules={schedules}
            diaries={diaries}
            users={users}
            onAddSchedule={handleAddSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onAddDiary={handleAddDiary}
            onDeleteDiary={handleDeleteDiary}
          />
        )}

      </main>

      {/* ── Modals ── */}
      {showAddStock && (
        <AddStockModal
          users={users}
          onClose={() => setShowAddStock(false)}
          onAdd={handleAddStock}
        />
      )}

      {editingStock && (
        <EditStockModal
          asset={editingStock}
          users={users}
          onClose={() => setEditingStock(null)}
          onEdit={handleEditStock}
        />
      )}

      {buySellTarget && (
        <BuySellModal
          asset={buySellTarget.asset}
          mode={buySellTarget.mode}
          onClose={() => setBuySellTarget(null)}
          onSubmit={handleBuySellStock}
        />
      )}

      {/* ── Bottom navigation bar ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-lg border-t border-slate-100 shadow-[0_-1px_12px_rgba(0,0,0,0.06)]">
        <div className="max-w-2xl mx-auto flex">
          <button
            onClick={() => setActiveTab('wealth')}
            className={`flex-1 flex flex-col items-center pt-3 pb-5 gap-1 transition-all duration-200 ${
              activeTab === 'wealth' ? 'text-indigo-600' : 'text-slate-400 active:text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all duration-200 ${
              activeTab === 'wealth' ? 'bg-indigo-50' : ''
            }`}>
              <ChartPieIcon className="h-5 w-5" />
            </div>
            <span className={`text-[10px] font-semibold tracking-tight ${
              activeTab === 'wealth' ? 'text-indigo-600' : 'text-slate-400'
            }`}>자산 현황</span>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex-1 flex flex-col items-center pt-3 pb-5 gap-1 transition-all duration-200 ${
              activeTab === 'ledger' ? 'text-indigo-600' : 'text-slate-400 active:text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all duration-200 ${
              activeTab === 'ledger' ? 'bg-indigo-50' : ''
            }`}>
              <BookOpenIcon className="h-5 w-5" />
            </div>
            <span className={`text-[10px] font-semibold tracking-tight ${
              activeTab === 'ledger' ? 'text-indigo-600' : 'text-slate-400'
            }`}>가계부</span>
          </button>
          <button
            onClick={() => setActiveTab('life')}
            className={`flex-1 flex flex-col items-center pt-3 pb-5 gap-1 transition-all duration-200 ${
              activeTab === 'life' ? 'text-indigo-600' : 'text-slate-400 active:text-slate-600'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all duration-200 ${
              activeTab === 'life' ? 'bg-indigo-50' : ''
            }`}>
              <CalendarDaysIcon className="h-5 w-5" />
            </div>
            <span className={`text-[10px] font-semibold tracking-tight ${
              activeTab === 'life' ? 'text-indigo-600' : 'text-slate-400'
            }`}>일정/일기</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
