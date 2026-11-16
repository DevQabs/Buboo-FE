'use client'

/**
 * DashboardClient — all interactive state lives here.
 * Data is fetched client-side from the Go API (localhost:8090 in dev).
 *
 * Tab 1 (자산 현황): 통합 순자산 요약 + 주식 포트폴리오 + 기타 자산
 * Tab 2 (가계부):    기간 선택 가능한 월별 요약 + 거래 내역
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import dynamic from 'next/dynamic'
import Lottie from 'lottie-react'
import loadingAnimation from '@/assets/loading.json'
import { ChartPieIcon, BookOpenIcon, CalendarDaysIcon, FaceSmileIcon, UserGroupIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

// ─── 가계부 탭 (초기 탭) — 정적 import ────────────────────────────────────────
import LedgerScreen from '@/components/ledger/LedgerScreen'
import type { AddTransactionPayload } from '@/components/dashboard/CalendarView'

// ─── ChunkSkeleton: dynamic 청크 다운로드 중 표시되는 placeholder ──────────────
// loading 옵션이 없으면 청크 로드 전까지 아무것도 안 보여 레이아웃이 깜빡임(CLS).
function ChunkSkeleton({ h = 100 }: { h?: number }) {
  return <div className="bg-white rounded-3xl animate-pulse w-full" style={{ height: h }} />
}

// ─── 자산 현황 탭 — 첫 방문 시 로드 + Phase2 .preload() ─────────────────────────
const NetWorthSummaryCard = dynamic(() => import('@/components/dashboard/NetWorthSummaryCard'), { ssr: false, loading: () => <ChunkSkeleton h={88}  /> })
const StockPortfolioCard  = dynamic(() => import('@/components/dashboard/StockPortfolioCard'),  { ssr: false, loading: () => <ChunkSkeleton h={260} /> })
const OtherAssetCard      = dynamic(() => import('@/components/dashboard/OtherAssetCard'),      { ssr: false, loading: () => <ChunkSkeleton h={140} /> })

// ─── 라이프 / 로드맵 탭 — 첫 방문 시 로드 ──────────────────────────────────────
const ScheduleTab = dynamic(() => import('@/components/dashboard/ScheduleTab'), { ssr: false, loading: () => <ChunkSkeleton h={400} /> })
const RoadmapTab  = dynamic(() => import('@/components/dashboard/RoadmapTab'),  { ssr: false, loading: () => <ChunkSkeleton h={400} /> })
type RoadmapPrefetch = import('@/components/dashboard/RoadmapTab').RoadmapPrefetch

// ─── 모달 — 열릴 때만 로드, Phase2 .preload() 로 청크 미리 다운로드 ──────────────
// loading 스켈레톤 없음: 모달은 열리기 전까지 DOM에 없으므로 CLS 무관.
const AddStockModal     = dynamic(() => import('@/components/dashboard/AddStockModal'),     { ssr: false })
const EditStockModal    = dynamic(() => import('@/components/dashboard/EditStockModal'),    { ssr: false })
const BuySellModal      = dynamic(() => import('@/components/dashboard/BuySellModal'),      { ssr: false })
const TradeHistoryModal = dynamic(() => import('@/components/dashboard/TradeHistoryModal'), { ssr: false })
const FamilySettings    = dynamic(() => import('@/components/dashboard/FamilySettings'),    { ssr: false })
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
  UpdateScheduleRequest,
  CreateDiaryRequest,
  StockTransaction,
  RoadmapProjection,
  RoadmapAssumptionsResponse,
  MenuKey,
  MyPermissions,
} from '@/types'
import { levelOf, visibleTabs, type TabKey } from '@/lib/menus'
import { ledgerPeriod, ledgerMonthOf, todayKST } from '@/lib/date'
import { apiFetch as callApi, latestOnly, ignoreAbort } from '@/lib/api'
import { Chip } from '@/components/ui/Card'
import { Toaster, toastError } from '@/components/ui/Toast'

// 개발: NEXT_PUBLIC_API_URL=http://localhost:8090 으로 직접 호출
// 프로덕션: 빈 문자열 → /api/* 경로로 → next.config.mjs rewrite가 백엔드로 프록시
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

type ActiveTab = TabKey

const TAB_ICONS: Record<TabKey, typeof BookOpenIcon> = {
  baby: FaceSmileIcon,
  ledger: BookOpenIcon,
  life: CalendarDaysIcon,
  wealth: ChartPieIcon,
}

const AVATAR_COLORS: Record<string, string> = { husband: '#0F4C81', wife: '#FDA4AF' }
function withAvatarColors(list: User[] | null): User[] {
  return (Array.isArray(list) ? list : []).map(u => ({ ...u, avatar_color: AVATAR_COLORS[u.role] ?? u.avatar_color }))
}



// ─── fetch helpers ────────────────────────────────────────────────────────────

// Module-level token set by DashboardClient once session is ready
let _accessToken = ''

// 모든 백엔드 호출은 공용 함수를 거친다: 토큰을 붙이고 실패면 서버 문구로 ApiError(설계서 9.C-11).
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return callApi<T>(path, _accessToken, options)
}

// Module-level permissions set by fetchAll, read by the fetch callbacks below
// (same pattern as _accessToken). Never request a menu the user cannot see.
let _perms: MyPermissions | null = null
const canSee = (m: MenuKey) => levelOf(_perms, m) !== 'hidden'
// 가계부(저축 연동·배당·고정비)도 종목·자산 목록을 쓴다
const canSeeHoldings = () => canSee('assets') || canSee('ledger')

function fetchLife(): Promise<[Schedule[], DiaryEntry[]]> {
  return Promise.all([
    canSee('schedule') ? apiFetch<Schedule[]>('/api/schedules') : Promise.resolve([]),
    canSee('diary') ? apiFetch<DiaryEntry[]>('/api/diaries') : Promise.resolve([]),
  ])
}


// ─── 탭 로딩 스켈레톤 ─────────────────────────────────────────────────────────
function TabSkeleton() {
  return (
    <div className="space-y-3 pt-1">
      {[80, 140, 100].map((h, i) => (
        <div
          key={i}
          className="bg-white rounded-3xl animate-pulse"
          style={{ height: h }}
        />
      ))}
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export default function DashboardClient() {
  const { data: session, status } = useSession()

  // Set token synchronously so apiFetch picks it up before any fetch runs
  if (session?.user?.accessToken) {
    _accessToken = session.user.accessToken
  }

  // ── core data ──
  const [users, setUsers]             = useState<User[]>([])
  const [perms, setPerms]             = useState<MyPermissions | null>(null)
  const [couple, setCouple]           = useState<Couple | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [calendarTransactions, setCalendarTransactions] = useState<Transaction[]>([])
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
  const [tabLoading, setTabLoading]   = useState<ActiveTab | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const loadedTabs = useRef<Set<ActiveTab>>(new Set<ActiveTab>())
  const [roadmap, setRoadmap] = useState<RoadmapPrefetch | null>(null)

  // ── UI state ──
  const [activeTab, setActiveTab]     = useState<ActiveTab>('ledger')
  const [activeSub, setActiveSub]     = useState<MenuKey | null>(null)

  // ── profile menu ──
  const [showMenu, setShowMenu]       = useState(false)
  const [showFamily, setShowFamily]   = useState(false)
  const menuRef                       = useRef<HTMLDivElement>(null)


  // close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
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
  const [showTradeHistory, setShowTradeHistory] = useState(false)
  const [tradeTransactions, setTradeTransactions] = useState<StockTransaction[]>([])

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
  const fetchSummary = useCallback(async (y: number, m: number, sd: number, signal?: AbortSignal) => {
    const { startDate, endDate } = ledgerPeriod(y, m, sd)
    const data = await apiFetch<MonthlySummary>(
      `/api/summary?start_date=${startDate}&end_date=${endDate}`, { signal, cache: 'no-store' }
    )
    setSummary(data)
  }, [])

  // ── fetch calendar summary ────────────────────────────────────────────────
  const fetchCalendarTransactions = useCallback(async (y: number, m: number, signal?: AbortSignal) => {
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    const [d1, d2] = await Promise.all([
      apiFetch<Transaction[]>(`/api/transactions?year=${y}&month=${m}`, { signal, cache: 'no-store' }),
      apiFetch<Transaction[]>(`/api/transactions?year=${nextY}&month=${nextM}`, { signal, cache: 'no-store' }),
    ])
    const all = [...(Array.isArray(d1) ? d1 : []), ...(Array.isArray(d2) ? d2 : [])]
    const seen = new Set<string>()
    setCalendarTransactions(all.filter(tx => { if (seen.has(tx.id)) return false; seen.add(tx.id); return true }))
  }, [])

  const fetchCalendar = useCallback(async (y: number, m: number, signal?: AbortSignal) => {
    const data = await apiFetch<CalendarSummaryResponse>(
      `/api/transactions/calendar-summary?year=${y}&month=${m}`, { signal, cache: 'no-store' }
    )
    setCalendarData(data)
  }, [])

  // 요약·카테고리 집계와 같은 가계부 기간의 거래
  const fetchTransactions = useCallback(async (y: number, m: number, sd: number, signal?: AbortSignal) => {
    const { startDate, endDate } = ledgerPeriod(y, m, sd)
    const data = await apiFetch<Transaction[]>(
      `/api/transactions?start_date=${startDate}&end_date=${endDate}`, { signal, cache: 'no-store' }
    )
    setTransactions(Array.isArray(data) ? data : [])
  }, [])

  // ── initial load ─────────────────────────────────────────────────────────
  // Step 1: couple (tiny JSON) → ledger_start_day 확정
  // Step 2: 가계부 탭 + users 만 (8개) — wealth/life/roadmap 탭은 첫 방문 시 로드
  const fetchAll = useCallback(async () => {
    try {
      const y = now.getFullYear()
      const m = now.getMonth() + 1

      // ── Step 1: couple + 내 권한 ──
      const [coupleData, permData] = await Promise.all([
        apiFetch<Couple>('/api/couple'),
        apiFetch<MyPermissions>('/api/me/permissions'),
      ])
      _perms = permData
      setPerms(permData)
      setActiveTab(visibleTabs(permData)[0]?.key ?? 'ledger')
      const dbStartDay = (coupleData?.ledger_start_day >= 1 && coupleData?.ledger_start_day <= 28)
        ? coupleData.ledger_start_day
        : 1
      setCouple(coupleData)
      setStartDay(dbStartDay)
      setCalendarYear(y)
      setCalendarMonth(m)

      const { year: periodYear, month: adjMonth } = ledgerMonthOf(todayKST(), dbStartDay)
      setSummaryYear(periodYear)
      setSummaryMonth(adjMonth)

      const { startDate, endDate } = ledgerPeriod(periodYear, adjMonth, dbStartDay)

      // 가계부를 못 보는 사람(예: 조부모)은 구성원 목록만 받는다
      if (!canSee('ledger')) {
        setUsers(withAvatarColors(await apiFetch<User[]>('/api/users')))
        return
      }

      // ── Step 2: 가계부 탭 + users (9개 병렬) ──
      const nextCalM = m === 12 ? 1 : m + 1
      const nextCalY = m === 12 ? y + 1 : y
      const [usersData, txData, summaryData, feData, feSummaryData, divData, calData, calTxCur, calTxNext] = await Promise.all([
        apiFetch<User[]>('/api/users'),
        apiFetch<Transaction[]>(`/api/transactions?start_date=${startDate}&end_date=${endDate}`),
        apiFetch<MonthlySummary>(`/api/summary?start_date=${startDate}&end_date=${endDate}`),
        apiFetch<FixedExpense[]>('/api/fixed-expenses'),
        apiFetch<FixedExpenseSummary>(`/api/fixed-expenses/summary?year=${periodYear}&month=${adjMonth}`),
        apiFetch<DividendYearlySummary>(`/api/dividends/summary?year=${y}&month=${m}`),
        apiFetch<CalendarSummaryResponse>(`/api/transactions/calendar-summary?year=${y}&month=${m}`),
        apiFetch<Transaction[]>(`/api/transactions?year=${y}&month=${m}`),
        apiFetch<Transaction[]>(`/api/transactions?year=${nextCalY}&month=${nextCalM}`),
      ])

      setUsers(withAvatarColors(usersData))
      const txList = Array.isArray(txData) ? txData : []
      setTransactions(txList)
      const calTxAll = [...(Array.isArray(calTxCur) ? calTxCur : []), ...(Array.isArray(calTxNext) ? calTxNext : [])]
      const calTxSeen = new Set<string>()
      setCalendarTransactions(calTxAll.filter(tx => { if (calTxSeen.has(tx.id)) return false; calTxSeen.add(tx.id); return true }))
      setSummary(summaryData)
      setFixedExpenses(Array.isArray(feData) ? feData : [])
      setFeSummary(feSummaryData)
      setDivSummary(divData)
      setCalendarData(calData)

      // 가계부 탭은 이미 로드됨
      loadedTabs.current.add('ledger')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === 'authenticated') fetchAll()
  }, [fetchAll, status])

  // ── Phase 2: UI 표시 직후 나머지 탭 데이터 백그라운드 프리패치 ─────────────────
  // loading=false 가 되는 순간 wealth/life/roadmap 를 조용히 병렬 로드.
  // 사용자가 탭을 누를 때 이미 데이터가 준비돼 있으면 스켈레톤 없이 즉시 표시.
  //
  // ★ .preload() 란?
  //   next/dynamic 으로 만든 컴포넌트는 정적 메서드 .preload()를 가진다.
  //   이를 호출하면 렌더링 없이 해당 JS 청크만 네트워크로 미리 다운로드한다.
  //   → 탭 전환 시 "청크 다운로드 + 렌더링" 에서 "렌더링만" 으로 단축된다.
  const prefetchAll = useCallback(async () => {
    // ── JS 청크 미리 다운로드 (렌더링 없이 네트워크만, 병렬) ──
    ;[
      NetWorthSummaryCard, StockPortfolioCard, OtherAssetCard,
      ScheduleTab, RoadmapTab,
      AddStockModal, EditStockModal, BuySellModal, TradeHistoryModal,
    ].forEach(c => (c as any).preload?.())

    await Promise.allSettled([
      // ── 종목·자산 (자산 탭, 가계부 공용) ──
      canSeeHoldings() && (async () => {
        try {
          const [port, assets, stockTx] = await Promise.all([
            apiFetch<PortfolioResponse>('/api/stocks/portfolio'),
            apiFetch<OtherAsset[]>('/api/assets'),
            apiFetch<StockTransaction[]>('/api/stocks/transactions'),
          ])
          if (Array.isArray(port)) { setPortfolio(port); setPortfolioSummary(null) }
          else { setPortfolio(port?.items ?? []); setPortfolioSummary(port?.summary ?? null) }
          setOtherAssets(Array.isArray(assets) ? assets : [])
          setTradeTransactions(Array.isArray(stockTx) ? stockTx : [])
          loadedTabs.current.add('wealth')
        } catch { /* 실패해도 탭 진입 시 fetchTabData 가 다시 시도 */ }
      })(),
      // ── 일상 탭 ──
      (canSee('schedule') || canSee('diary')) && (async () => {
        try {
          const [sch, dia] = await fetchLife()
          setSchedules(Array.isArray(sch) ? sch : [])
          setDiaries(Array.isArray(dia) ? dia : [])
          loadedTabs.current.add('life')
        } catch {}
      })(),
      // ── 로드맵 ──
      canSee('roadmap') && (async () => {
        try {
          const [projection, assumptions] = await Promise.all([
            apiFetch<RoadmapProjection>('/api/roadmap/projection'),
            apiFetch<RoadmapAssumptionsResponse>('/api/roadmap/assumptions'),
          ])
          if (projection && assumptions?.assumptions) {
            setRoadmap({
              projection,
              assumptions: assumptions.assumptions,
              candidates: assumptions.dividend_candidates ?? [],
            })
          }
        } catch {}
      })(),
    ])
  }, [])

  // loading 이 false 로 바뀌는 순간(Phase 1 완료) → Phase 2 백그라운드 시작
  useEffect(() => {
    if (!loading) prefetchAll()
  }, [loading, prefetchAll])

  // ── 탭 최초 진입 시 데이터 로드 (프리패치 미완료 시 폴백) ──────────────────────
  const fetchTabData = useCallback(async (tab: ActiveTab) => {
    setTabLoading(tab)
    try {
      if (tab === 'wealth' && canSeeHoldings()) {
        const [port, assets, stockTx] = await Promise.all([
          apiFetch<PortfolioResponse>('/api/stocks/portfolio'),
          apiFetch<OtherAsset[]>('/api/assets'),
          apiFetch<StockTransaction[]>('/api/stocks/transactions'),
        ])
        if (Array.isArray(port)) { setPortfolio(port); setPortfolioSummary(null) }
        else { setPortfolio(port?.items ?? []); setPortfolioSummary(port?.summary ?? null) }
        setOtherAssets(Array.isArray(assets) ? assets : [])
        setTradeTransactions(Array.isArray(stockTx) ? stockTx : [])
      } else if (tab === 'life') {
        const [sch, dia] = await fetchLife()
        setSchedules(Array.isArray(sch) ? sch : [])
        setDiaries(Array.isArray(dia) ? dia : [])
      }
    } catch {
      // 탭 데이터 실패 → 빈 상태 유지
    } finally {
      setTabLoading(null)
    }
  }, [])

  // ── 탭 전환: 첫 방문이면 fetch, 재방문이면 refresh ─���─────────────────────────
  useEffect(() => {
    if (loading) return // 초기 로딩 완료 전 무시
    if (!loadedTabs.current.has(activeTab)) {
      // 첫 방문 → 데이터 로드 후 등록
      loadedTabs.current.add(activeTab)
      fetchTabData(activeTab)
      return
    }
    // 재방문 → 가벼운 refresh
    if (activeTab === 'life') {
      fetchLife().then(([sch, dia]) => {
        setSchedules(Array.isArray(sch) ? sch : [])
        setDiaries(Array.isArray(dia) ? dia : [])
      }).catch(() => {})
    } else if (activeTab === 'ledger') {
      const { startDate, endDate } = ledgerPeriod(summaryYear, summaryMonth, startDay)
      Promise.all([
        apiFetch<Transaction[]>(`/api/transactions?start_date=${startDate}&end_date=${endDate}`),
        apiFetch<MonthlySummary>(`/api/summary?start_date=${startDate}&end_date=${endDate}`),
        apiFetch<CalendarSummaryResponse>(`/api/transactions/calendar-summary?year=${calendarYear}&month=${calendarMonth}`),
        apiFetch<FixedExpense[]>('/api/fixed-expenses'),
      ]).then(([tx, sum, cal, fe]) => {
        setTransactions(Array.isArray(tx) ? tx : [])
        setSummary(sum as MonthlySummary)
        setCalendarData(cal as CalendarSummaryResponse)
        setFixedExpenses(Array.isArray(fe) ? fe : [])
      }).catch(() => {})
    } else if (activeTab === 'wealth' && canSeeHoldings()) {
      Promise.all([
        apiFetch<PortfolioResponse>('/api/stocks/portfolio'),
        apiFetch<OtherAsset[]>('/api/assets'),
        apiFetch<StockTransaction[]>('/api/stocks/transactions'),
      ]).then(([port, assets, stockTx]) => {
        const p = port as PortfolioResponse
        if (Array.isArray(p)) { setPortfolio(p); setPortfolioSummary(null) }
        else { setPortfolio(p?.items ?? []); setPortfolioSummary(p?.summary ?? null) }
        setOtherAssets(Array.isArray(assets) ? assets : [])
        setTradeTransactions(Array.isArray(stockTx) ? stockTx : [])
      }).catch(() => {})
    }
  }, [activeTab, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // 월을 빠르게 넘기면 늦게 온 옛 달 응답이 새 달 화면을 덮는다. 직전 요청을 취소한다.
  const nextMonthSignal = useMemo(() => latestOnly(), [])

  // ── period change handler ─────────────────────────────────────────────────
  const handlePeriodChange = useCallback(
    ({ year, month, startDay: sd }: { year: number; month: number; startDay: number }) => {
      setSummaryYear(year)
      setSummaryMonth(month)
      setStartDay(sd)
      // Persist startDay to DB so all users share the same setting.
      // Fire-and-forget: UI responds immediately, DB update runs in background.
      if (levelOf(_perms, 'ledger') === 'edit') {
        apiFetch<Couple>('/api/couple', {
          method: 'PUT',
          body: JSON.stringify({ monthly_budget: couple?.monthly_budget ?? 0, ledger_start_day: sd }),
        })
          .then(updated => { if (updated) setCouple(updated) })
          .catch(e => toastError('시작일 저장', e))
      }
      const signal = nextMonthSignal()
      fetchSummary(year, month, sd, signal).catch(ignoreAbort)
      fetchCalendar(year, month, signal).catch(ignoreAbort)
      fetchTransactions(year, month, sd, signal).catch(ignoreAbort)
      refetchDividends(year, month)
      refetchFixedExpenses(year, month)
    },
    [fetchSummary, fetchCalendar, fetchTransactions, couple, nextMonthSignal] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ── calendar month change — calendar display + summary period both update ──
  const handleCalendarMonthChange = useCallback((year: number, month: number) => {
    setCalendarYear(year)
    setCalendarMonth(month)
    setSummaryYear(year)
    setSummaryMonth(month)
    const signal = nextMonthSignal()
    fetchCalendar(year, month, signal).catch(ignoreAbort)
    fetchSummary(year, month, startDay, signal).catch(ignoreAbort)
    fetchTransactions(year, month, startDay, signal).catch(ignoreAbort)
    fetchCalendarTransactions(year, month, signal).catch(ignoreAbort)
    refetchDividends(year, month)
    refetchFixedExpenses(year, month)
  }, [fetchCalendar, fetchSummary, fetchTransactions, fetchCalendarTransactions, startDay, nextMonthSignal]) // eslint-disable-line react-hooks/exhaustive-deps

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
      apiFetch<Transaction[]>(`/api/transactions?year=${y}&month=${m}`),
    ])
    setFixedExpenses(Array.isArray(feData) ? feData : [])
    setFeSummary(feSummaryData)
    setTransactions(Array.isArray(txData) ? txData : [])
  }, [summaryYear, summaryMonth])

  // ── transaction handlers ──────────────────────────────────────────────────
  // ── 거래 추가: 입력 시트·달력 공용 ─────────────────────────────────────────
  // 지출·수입은 화면에 먼저 넣고, 저장이 실패하면 되돌린 뒤 토스트를 띄우고 던진다(설계서 9.C-12).
  // 저축은 자산이 같이 바뀌어 서버 결과로만 그린다.
  const handleAddTransaction = async (p: AddTransactionPayload) => {
    const date = `${p.date}T12:00:00+09:00` // 한국 정오 — UTC 로 넘어가 전날이 되지 않게
    const body = {
      user_id: p.user_id, type: p.type, amount: p.amount, currency: 'KRW',
      category: p.category, title: p.title, payment_method: p.payment_method ?? 'card',
      date, saving_link: p.saving_link,
    }
    const tempID = `temp-${Date.now()}`
    const optimistic = p.type !== 'saving'
    const prevSummary = summary
    if (optimistic) {
      const temp: Transaction = {
        id: tempID, couple_id: session?.user?.backendUser?.couple_id ?? '', user_id: p.user_id,
        type: p.type, amount: p.amount, currency: 'KRW', category: p.category, subcategory: '',
        title: p.title, memo: '', date, payment_method: body.payment_method, is_fixed: false,
        tags: [], location: null, created_at: date, updated_at: date,
      }
      setTransactions(prev => [temp, ...prev])
      setSummary(prev => prev && {
        ...prev,
        total_income:  p.type === 'income'  ? prev.total_income  + p.amount : prev.total_income,
        total_expense: p.type === 'expense' ? prev.total_expense + p.amount : prev.total_expense,
        balance: prev.balance + (p.type === 'income' ? p.amount : -p.amount),
      })
    }
    try {
      await apiFetch<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(body) })
    } catch (e) {
      if (optimistic) {
        setTransactions(prev => prev.filter(tx => tx.id !== tempID))
        setSummary(prevSummary)
      }
      toastError('거래 저장', e)
      throw e
    }
    const refetches: Promise<unknown>[] = [
      fetchTransactions(summaryYear, summaryMonth, startDay),
      fetchSummary(summaryYear, summaryMonth, startDay),
      fetchCalendar(calendarYear, calendarMonth),
      fetchCalendarTransactions(calendarYear, calendarMonth),
    ]
    if (p.type === 'saving') refetches.push(refetchPortfolio(), refetchAssets())
    await Promise.allSettled(refetches)
  }

  // ── update/delete transaction ─────────────────────────────────────────────────
  const handleUpdateTransaction = useCallback(async (id: string, data: { title: string; amount: number; category: string; user_id: string }) => {
    const existing = transactions.find(tx => tx.id === id) ?? calendarTransactions.find(tx => tx.id === id)
    if (!existing) return
    await apiFetch(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify({ ...existing, ...data }) })
    await Promise.all([
      fetchTransactions(summaryYear, summaryMonth, startDay),
      fetchSummary(summaryYear, summaryMonth, startDay),
      apiFetch<CalendarSummaryResponse>(`/api/transactions/calendar-summary?year=${calendarYear}&month=${calendarMonth}`).then(d => setCalendarData(d)),
      fetchCalendarTransactions(calendarYear, calendarMonth),
    ])
  }, [transactions, summaryYear, summaryMonth, startDay, calendarYear, calendarMonth, fetchSummary, fetchTransactions, fetchCalendarTransactions]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteTransaction = useCallback(async (id: string) => {
    await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setTransactions(prev => prev.filter(tx => tx.id !== id))
    await Promise.all([
      fetchSummary(summaryYear, summaryMonth, startDay),
      apiFetch<CalendarSummaryResponse>(`/api/transactions/calendar-summary?year=${calendarYear}&month=${calendarMonth}`).then(d => setCalendarData(d)),
      fetchCalendarTransactions(calendarYear, calendarMonth),
    ])
  }, [summaryYear, summaryMonth, startDay, calendarYear, calendarMonth, fetchSummary, fetchCalendarTransactions]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── stock handlers ────────────────────────────────────────────────────────
  const handleAddStock = async (data: Parameters<React.ComponentProps<typeof AddStockModal>['onAdd']>[0]) => {
    const res = await fetch(`${API_BASE}/api/stocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
      body: JSON.stringify({ ...data }),
    })
    if (!res.ok) throw new Error(`주식 추가 실패: ${res.status}`)
    await refetchPortfolio()
  }

  const handleEditStock = async (id: string, data: {
    user_id?: string; name?: string; quantity?: number
    average_price?: number; avg_krw_price?: number; memo?: string
  }) => {
    const res = await fetch(`${API_BASE}/api/stocks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error ?? `주식 수정 실패: ${res.status}`)
    }
    await refetchPortfolio()
  }

  const handleBuySellStock = async (
    mode: 'buy' | 'sell',
    data: { quantity: number; price: number; exchange_rate: number; memo: string }
  ) => {
    if (!buySellTarget) return
    const res = await fetch(`${API_BASE}/api/stocks/${buySellTarget.asset.id}/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error ?? `${mode === 'buy' ? '매수' : '매도'} 실패: ${res.status}`)
    }
    await refetchPortfolio()
  }

  const handleDeleteStock = async (asset: StockAssetWithPrice) => {
    const res = await fetch(`${API_BASE}/api/stocks/${asset.id}?force=true`, { method: 'DELETE', headers: { Authorization: `Bearer ${_accessToken}` } })
    if (!res.ok) throw new Error(`주식 삭제 실패: ${res.status}`)
    setPortfolio(prev => prev.filter(a => a.id !== asset.id))
    await refetchPortfolio()
  }

  // ── other-asset handlers ──────────────────────────────────────────────────
  const handleAddAsset = async (data: CreateOtherAssetRequest) => {
    const res = await fetch(`${API_BASE}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
      body: JSON.stringify({ ...data }),
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`자산 수정 실패: ${res.status}`)
    await refetchAssets()
  }

  const handleDeleteAsset = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/assets/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${_accessToken}` } })
    if (!res.ok) throw new Error(`자산 삭제 실패: ${res.status}`)
    setOtherAssets(prev => prev.filter(a => a.id !== id))
  }

  // ── reorder handlers ──────────────────────────────────────────────────────
  // Both take the complete id list in the new display order. The list is applied
  // locally first so the row lands where it was dropped without waiting on the
  // network, and rolled back if the request fails.
  const reorderByIDs = <T extends { id: string }>(items: T[], ids: string[]): T[] => {
    const rank = new Map(ids.map((id, i) => [id, i]))
    return [...items].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
  }

  const handleReorderStocks = async (ids: string[]) => {
    const previous = portfolio
    setPortfolio(prev => reorderByIDs(prev, ids))
    const res = await fetch(`${API_BASE}/api/stocks/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      setPortfolio(previous)
      throw new Error(`주식 순서 저장 실패: ${res.status}`)
    }
  }

  const handleReorderAssets = async (ids: string[]) => {
    const previous = otherAssets
    setOtherAssets(prev => reorderByIDs(prev, ids))
    const res = await fetch(`${API_BASE}/api/assets/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
      body: JSON.stringify({ ids }),
    })
    if (!res.ok) {
      setOtherAssets(previous)
      throw new Error(`자산 순서 저장 실패: ${res.status}`)
    }
  }

  const handleCreateLoanExpense = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/assets/${id}/loan-expense`, { method: 'POST', headers: { Authorization: `Bearer ${_accessToken}` } })
    if (!res.ok) throw new Error(`고정비 생성 실패: ${res.status}`)
    await refetchFixedExpenses()
    await fetchCalendar(calendarYear, calendarMonth)
  }

  // ── fixed expense handlers ────────────────────────────────────────────────
  const handleAddFixedExpense = async (data: CreateFixedExpenseRequest) => {
    await apiFetch('/api/fixed-expenses', { method: 'POST', body: JSON.stringify(data) })
    await refetchFixedExpenses()
  }

  const handleEditFixedExpense = async (id: string, data: UpdateFixedExpenseRequest) => {
    await apiFetch(`/api/fixed-expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    await refetchFixedExpenses()
  }

  const handleDeleteFixedExpense = async (id: string) => {
    await apiFetch(`/api/fixed-expenses/${id}`, { method: 'DELETE' })
    await refetchFixedExpenses()
  }

  // ── budget update ─────────────────────────────────────────────────────────
  const handleUpdateBudget = useCallback(async (amount: number) => {
    try {
      // ledger_start_day 를 같이 보내야 서버가 시작일을 1로 되돌리지 않는다
      const updated = await apiFetch<Couple>('/api/couple', {
        method: 'PUT',
        body: JSON.stringify({ monthly_budget: amount, ledger_start_day: startDay }),
      })
      setCouple(updated)
    } catch (e) {
      toastError('예산 저장', e)
      throw e
    }
  }, [startDay])

  // ── dividend handlers ─────────────────────────────────────────────────────
  const refetchDividends = useCallback(async (y = now.getFullYear(), m = now.getMonth() + 1) => {
    const data = await apiFetch<DividendYearlySummary>(`/api/dividends/summary?year=${y}&month=${m}`)
    setDivSummary(data)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddDividend = async (data: CreateDividendRequest) => {
    await apiFetch('/api/dividends', {
      method: 'POST',
      body: JSON.stringify({ ...data, payment_date: `${data.payment_date}T00:00:00Z` }),
    })
    await Promise.all([
      refetchDividends(calendarYear, calendarMonth),
      fetchTransactions(summaryYear, summaryMonth, startDay),
      fetchSummary(summaryYear, summaryMonth, startDay),
    ])
  }

  const handleDeleteDividend = async (id: string) => {
    await apiFetch(`/api/dividends/${id}`, { method: 'DELETE' })
    // 5단계: 배당을 지우면 서버가 연결된 수입 거래도 지운다
    await Promise.all([
      refetchDividends(calendarYear, calendarMonth),
      fetchTransactions(summaryYear, summaryMonth, startDay),
      fetchSummary(summaryYear, summaryMonth, startDay),
    ])
  }

  // ── schedule handlers ─────────────────────────────────────────────────────
  const handleAddSchedule = async (req: CreateScheduleRequest) => {
    const res = await fetch(`${API_BASE}/api/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error(`일정 저장 실패: ${res.status}`)
    const created: Schedule = await res.json()
    setSchedules(s => [...s, created])
  }

  const handleEditSchedule = async (id: string, req: UpdateScheduleRequest) => {
    const res = await fetch(`${API_BASE}/api/schedules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error(`일정 수정 실패: ${res.status}`)
    const updated: Schedule = await res.json()
    setSchedules(s => s.map(x => x.id === id ? updated : x))
  }

  const handleDeleteSchedule = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/schedules/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${_accessToken}` } })
    if (!res.ok) throw new Error(`일정 삭제 실패: ${res.status}`)
    setSchedules(s => s.filter(x => x.id !== id))
  }

  // ── diary handlers ────────────────────────────────────────────────────────
  const handleAddDiary = async (req: CreateDiaryRequest, photos: File[]) => {
    const res = await fetch(`${API_BASE}/api/diaries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_accessToken}` },
      body: JSON.stringify(req),
    })
    if (!res.ok) throw new Error(`일기 저장 실패: ${res.status}`)
    const created: DiaryEntry = await res.json()
    // Upload photos one by one
    for (const photo of photos) {
      const form = new FormData()
      form.append('photo', photo)
      await fetch(`${API_BASE}/api/diaries/${created.id}/photos`, { method: 'POST', body: form, headers: { Authorization: `Bearer ${_accessToken}` } })
    }
    // Refetch diary to get updated photos
    const updated = await apiFetch<DiaryEntry[]>('/api/diaries')
    setDiaries(Array.isArray(updated) ? updated : [])
  }

  const handleDiaryEdited = async () => {
    const updated = await apiFetch<DiaryEntry[]>('/api/diaries')
    setDiaries(Array.isArray(updated) ? updated : [])
  }

  const handleDeleteDiary = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/diaries/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${_accessToken}` } })
    if (!res.ok) throw new Error(`일기 삭제 실패: ${res.status}`)
    setDiaries(d => d.filter(x => x.id !== id))
  }

  // ── loading / error screens ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-2">
        <Lottie animationData={loadingAnimation} loop style={{ width: 180, height: 180 }} />
        <p className="text-sm text-slate-400">불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-7 shadow-sm text-center space-y-2 w-full max-w-sm">
          <p className="font-bold text-slate-800">서버 연결 실패</p>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
          <p className="text-xs text-slate-300">Go 서버({API_BASE})가 실행 중인지 확인하세요.</p>
        </div>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────
  const currentUserID = session?.user?.backendUser?.id ?? users[0]?.id ?? ''
  const tabs = visibleTabs(perms)
  const currentTab = tabs.find(t => t.key === activeTab) ?? tabs[0]
  const currentSub = currentTab?.subs.find(s => s.key === activeSub) ?? currentTab?.subs[0]
  const canEdit = (m: MenuKey) => levelOf(perms, m) === 'edit'
  // 2단 메뉴 칩 줄. 하나뿐이면 숨김. 시안처럼 화면 제목 아래에 두려고 화면에 prop 으로 넘긴다.
  const chipRow = currentTab && currentTab.subs.length > 1 ? (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
      {currentTab.subs.map(s => (
        <Chip key={s.key} on={currentSub?.key === s.key} onClick={() => setActiveSub(s.key)}>{s.label}</Chip>
      ))}
    </div>
  ) : null

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Header ── */}
      <header className="bg-cream/90 backdrop-blur-md px-5 py-3 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <span className="text-white text-sm font-black">우</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                {couple?.name ?? '우리집'}
              </h1>
              <p className="text-[10px] text-slate-400">
                {now.getFullYear()}.{String(now.getMonth() + 1).padStart(2,'0')}.{String(now.getDate()).padStart(2,'0')}
              </p>
            </div>
          </div>

          {/* Avatar group + dropdown menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(v => !v)}
              className="flex -space-x-2 focus:outline-none"
            >
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
            </button>

            {showMenu && (
              <div className="absolute right-0 top-10 w-56 bg-white rounded-2xl shadow-lg border border-slate-100 py-1.5 z-60">
                {perms?.is_owner && (
                  <button
                    onClick={() => { setShowMenu(false); setShowFamily(true) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <UserGroupIcon className="w-4 h-4 text-brand-500" />
                    가족 구성원
                  </button>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50 transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main
        className={`max-w-2xl mx-auto px-3 pt-4 space-y-3 ${
          tabs.length > 1
            ? 'pb-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+1rem)]'
            : 'pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]'
        }`}
      >

        {!currentTab && (
          <div className="bg-white rounded-[22px] p-8 text-center shadow-[0_4px_14px_rgba(120,90,60,.07)]">
            <p className="text-sm font-semibold text-stone-700">아직 볼 수 있는 메뉴가 없어요</p>
            <p className="mt-1 text-xs text-stone-400">가족 관리자에게 권한을 요청해 주세요</p>
          </div>
        )}

        {/* 2단 메뉴 칩 — 화면이 직접 그리면 여기서는 뺀다(Task 3·5·6) */}
        {chipRow}

        {/* ══ 아기 (3단계에서 채움) ══ */}
        {currentTab?.key === 'baby' && (
          <div className="bg-white rounded-[22px] p-8 text-center shadow-[0_4px_14px_rgba(120,90,60,.07)]">
            <p className="text-sm font-semibold text-stone-700">{currentSub?.label}</p>
            <p className="mt-1 text-xs text-stone-400">곧 열려요. 조금만 기다려 주세요.</p>
          </div>
        )}

        {/* ══ Tab 1: 자산 현황 ══ */}
        {currentSub?.key === 'assets' && (
          <div className="space-y-3">
            {tabLoading === 'wealth' ? <TabSkeleton /> : <>
            {/* 통합 순자산 요약 */}
            <NetWorthSummaryCard
              netWorth={netWorth}
              portfolioSummary={portfolioSummary}
            />

            {/* 주식 포트폴리오 */}
            <StockPortfolioCard
              canEdit={canEdit('assets')}
              assets={portfolio}
              users={users}
              summary={portfolioSummary}
              onAddClick={() => setShowAddStock(true)}
              onHistoryClick={() => setShowTradeHistory(true)}
              onEditClick={setEditingStock}
              onBuySellClick={(asset, mode) => setBuySellTarget({ asset, mode })}
              onDeleteClick={handleDeleteStock}
              onReorder={handleReorderStocks}
            />

            {/* 기타 자산 */}
            <OtherAssetCard
              canEdit={canEdit('assets')}
              assets={otherAssets}
              users={users}
              currentUserID={currentUserID}
              fixedExpenseTitles={fixedExpenses.map(fe => fe.title)}
              onAdd={handleAddAsset}
              onEdit={handleEditAsset}
              onDelete={handleDeleteAsset}
              onCreateLoanExpense={handleCreateLoanExpense}
              onReorder={handleReorderAssets}
            />
            </>}
          </div>
        )}

        {/* ══ 가계부 ══ */}
        {currentSub?.key === 'ledger' && (
          <LedgerScreen
            canEdit={canEdit('ledger')}
            hasNav={tabs.length > 1}
            currentUserID={currentUserID}
            accessToken={session?.user?.accessToken}
            users={users}
            couple={couple}
            summary={summary}
            summaryYear={summaryYear}
            summaryMonth={summaryMonth}
            startDay={startDay}
            calendarYear={calendarYear}
            calendarMonth={calendarMonth}
            transactions={transactions}
            calendarTransactions={calendarTransactions}
            calendarData={calendarData}
            fixedExpenses={fixedExpenses}
            feSummary={feSummary}
            divSummary={divSummary}
            portfolio={portfolio}
            portfolioSummary={portfolioSummary}
            otherAssets={otherAssets}
            onPeriodChange={handlePeriodChange}
            onMonthChange={handleCalendarMonthChange}
            onUpdateBudget={handleUpdateBudget}
            onAddTransaction={handleAddTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onAddDividend={handleAddDividend}
            onDeleteDividend={handleDeleteDividend}
            onAddFixedExpense={handleAddFixedExpense}
            onEditFixedExpense={handleEditFixedExpense}
            onDeleteFixedExpense={handleDeleteFixedExpense}
          />
        )}

        {/* ══ Tab 3: 일정/일기 ══ */}
        {currentTab?.key === 'life' && (
          <div>
            {tabLoading === 'life' ? <TabSkeleton /> : (
              <ScheduleTab
                canEdit={canEdit(currentSub?.key === 'diary' ? 'diary' : 'schedule')}
                schedules={schedules}
                diaries={diaries}
                currentUserID={currentUserID}
                section={currentSub?.key === 'diary' ? 'diary' : 'schedule'}
                onAddSchedule={handleAddSchedule}
                onEditSchedule={handleEditSchedule}
                onDeleteSchedule={handleDeleteSchedule}
                onAddDiary={handleAddDiary}
                onDiaryEdited={handleDiaryEdited}
                onDeleteDiary={handleDeleteDiary}
              />
            )}
          </div>
        )}

        {/* ══ Tab 4: 로드맵 ══ */}
        {currentSub?.key === 'roadmap' && (
          <RoadmapTab accessToken={session?.user?.accessToken} prefetched={roadmap} canEdit={canEdit('roadmap')} />
        )}

      </main>

      {/* ── Modals ── */}
      {showFamily && (
        <FamilySettings
          accessToken={session?.user?.accessToken ?? ''}
          onClose={() => {
            setShowFamily(false)
            // 내보내기·이름 변경이 헤더 아바타에 반영되도록
            apiFetch<User[]>('/api/users').then(u => setUsers(withAvatarColors(u))).catch(() => {})
          }}
        />
      )}
      {showAddStock && (
        <AddStockModal
          currentUserID={currentUserID}
          exchangeRate={portfolioSummary?.usd_krw}
          onClose={() => setShowAddStock(false)}
          onAdd={handleAddStock}
        />
      )}

      {editingStock && (
        <EditStockModal
          asset={editingStock}
          onClose={() => setEditingStock(null)}
          onEdit={handleEditStock}
        />
      )}

      {buySellTarget && (
        <BuySellModal
          asset={buySellTarget.asset}
          mode={buySellTarget.mode}
          exchangeRate={portfolioSummary?.usd_krw}
          onClose={() => setBuySellTarget(null)}
          onSubmit={handleBuySellStock}
        />
      )}

      {showTradeHistory && (
        <TradeHistoryModal
          transactions={tradeTransactions}
          users={users}
          exchangeRate={portfolioSummary?.usd_krw ?? 1350}
          onClose={() => setShowTradeHistory(false)}
        />
      )}

      {/* ── Bottom navigation bar ── */}
      {tabs.length > 1 && (
        <nav className="fixed bottom-0 inset-x-0 z-50 rounded-t-card bg-white shadow-warm-up">
          <div className="max-w-2xl mx-auto flex pb-safe">
            {tabs.map(t => {
              const Icon = TAB_ICONS[t.key]
              const on = currentTab?.key === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => { setActiveTab(t.key); setActiveSub(null) }}
                  className={`flex-1 flex flex-col items-center pt-2.5 pb-4 gap-1 transition-colors ${on ? 'text-brand-500' : 'text-stone-400'}`}
                >
                  <div className={`p-1.5 rounded-xl transition-colors ${on ? 'bg-brand-500 text-white' : ''}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-semibold tracking-tight">{t.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
      <Toaster />
    </div>
  )
}
