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

const WealthScreen = dynamic(() => import('@/components/wealth/WealthScreen'), { ssr: false, loading: () => <ChunkSkeleton h={400} /> })

// ─── 라이프 / 로드맵 탭 — 첫 방문 시 로드 ──────────────────────────────────────
const DiaryScreen = dynamic(() => import('@/components/life/DiaryScreen'), { ssr: false, loading: () => <ChunkSkeleton h={400} /> })
const ScheduleScreen = dynamic(() => import('@/components/life/ScheduleScreen'), { ssr: false, loading: () => <ChunkSkeleton h={400} /> })
const RoadmapTab  = dynamic(() => import('@/components/dashboard/RoadmapTab'),  { ssr: false, loading: () => <ChunkSkeleton h={400} /> })
type RoadmapPrefetch = import('@/components/dashboard/RoadmapTab').RoadmapPrefetch

// ─── 모달 — 열릴 때만 로드, Phase2 .preload() 로 청크 미리 다운로드 ──────────────
// loading 스켈레톤 없음: 모달은 열리기 전까지 DOM에 없으므로 CLS 무관.
const AddStockModal     = dynamic(() => import('@/components/dashboard/AddStockModal'),     { ssr: false })
const EditStockModal    = dynamic(() => import('@/components/dashboard/EditStockModal'),    { ssr: false })
const BuySellModal      = dynamic(() => import('@/components/dashboard/BuySellModal'),      { ssr: false })
const TradeHistoryModal = dynamic(() => import('@/components/dashboard/TradeHistoryModal'), { ssr: false })
const FamilySettings    = dynamic(() => import('@/components/dashboard/FamilySettings'),    { ssr: false })
const BabyPhotoTab      = dynamic(() => import('@/components/dashboard/BabyPhotoTab'),      { ssr: false })
const BabyGrowthTab     = dynamic(() => import('@/components/dashboard/BabyGrowthTab'),     { ssr: false })
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
  UpdateDiaryRequest,
  StockTransaction,
  RoadmapProjection,
  RoadmapAssumptionsResponse,
  MenuKey,
  MyPermissions,
} from '@/types'
import { levelOf, visibleTabs, type TabKey } from '@/lib/menus'
import { ledgerPeriod, ledgerMonthOf, todayKST } from '@/lib/date'
import { apiFetch as callApi, latestOnly, ignoreAbort } from '@/lib/api'
import { attachDiaryPhotos } from '@/lib/media'
import { applySummaryDelta } from '@/lib/ledger'
import { motion, useReducedMotion } from 'framer-motion'
import { NO_MOTION, SPRING, Segmented, tapHaptic } from '@/components/ui/Card'
import { Toaster, showToast, toastError } from '@/components/ui/Toast'
import { TopProgress } from '@/components/ui/Loading'
import { stepLoad, sectionView, mergeViews, type LoadState, type SectionState } from '@/lib/loadState'

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

// 탭 단위 요청(첫 화면·탭 전환)은 이 키도 같이 세어 헤더 아래 진행 막대를 띄운다
const TAB = '_tab'

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
  const [diariesAt, setDiariesAt]     = useState(0) // 일기 목록(사진 presigned 주소)을 받은 시각
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  // 카드별 불러오기 상태(lib/loadState). 키: summary·tx·fe·div·cal·holdings·schedules·diaries·_tab
  const [loads, setLoads]             = useState<Record<string, LoadState>>({})
  /** p 가 끝날 때까지 keys 카드를 불러오는 중으로 센다. p 를 그대로 돌려준다(취소는 오류로 치지 않는다) */
  const track = useCallback(<T,>(keys: string[], p: Promise<T>): Promise<T> => {
    const step = (ev: Parameters<typeof stepLoad>[1]) =>
      setLoads(s => { const n = { ...s }; for (const k of keys) n[k] = stepLoad(s[k], ev); return n })
    step('start')
    p.then(() => step('ok'), e => step((e as Error)?.name === 'AbortError' ? 'abort' : 'error'))
    return p
  }, [])
  const loadedTabs = useRef<Set<ActiveTab>>(new Set<ActiveTab>())
  const [roadmap, setRoadmap] = useState<RoadmapPrefetch | null>(null)

  // ── UI state ──
  const [activeTab, setActiveTab]     = useState<ActiveTab>('ledger')
  const [activeSub, setActiveSub]     = useState<MenuKey | null>(null)
  const reduceMotion = useReducedMotion()

  // ── profile menu ──
  const [showMenu, setShowMenu]       = useState(false)
  const [showFamily, setShowFamily]   = useState(false)
  const menuRef                       = useRef<HTMLDivElement>(null)
  // 하단 탭 실제 높이(safe area 포함)를 --nav-h 로 — 떠 있는 입력 바·본문 여백이 이 값을 쓴다
  const navRoRef                      = useRef<ResizeObserver | null>(null)
  const navRef = useCallback((el: HTMLElement | null) => {
    navRoRef.current?.disconnect()
    navRoRef.current = null
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`)
    set()
    navRoRef.current = new ResizeObserver(set)
    navRoRef.current.observe(el)
  }, [])


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

  // ── fetchers: 각자 맡은 카드의 불러오기 상태를 센다(track) ───────────────────
  const fetchSummary = useCallback((y: number, m: number, sd: number, signal?: AbortSignal) => track(['summary'], (async () => {
    const { startDate, endDate } = ledgerPeriod(y, m, sd)
    const data = await apiFetch<MonthlySummary>(
      `/api/summary?start_date=${startDate}&end_date=${endDate}`, { signal, cache: 'no-store' }
    )
    setSummary(data)
  })()), [track])

  // ── fetch calendar summary ────────────────────────────────────────────────
  const fetchCalendarTransactions = useCallback((y: number, m: number, signal?: AbortSignal) => track(['cal'], (async () => {
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    const [d1, d2] = await Promise.all([
      apiFetch<Transaction[]>(`/api/transactions?year=${y}&month=${m}`, { signal, cache: 'no-store' }),
      apiFetch<Transaction[]>(`/api/transactions?year=${nextY}&month=${nextM}`, { signal, cache: 'no-store' }),
    ])
    const all = [...(Array.isArray(d1) ? d1 : []), ...(Array.isArray(d2) ? d2 : [])]
    const seen = new Set<string>()
    setCalendarTransactions(all.filter(tx => { if (seen.has(tx.id)) return false; seen.add(tx.id); return true }))
  })()), [track])

  const fetchCalendar = useCallback((y: number, m: number, signal?: AbortSignal) => track(['cal'], (async () => {
    const data = await apiFetch<CalendarSummaryResponse>(
      `/api/transactions/calendar-summary?year=${y}&month=${m}`, { signal, cache: 'no-store' }
    )
    setCalendarData(data)
  })()), [track])

  // 요약·카테고리 집계와 같은 가계부 기간의 거래
  const fetchTransactions = useCallback((y: number, m: number, sd: number, signal?: AbortSignal) => track(['tx'], (async () => {
    const { startDate, endDate } = ledgerPeriod(y, m, sd)
    const data = await apiFetch<Transaction[]>(
      `/api/transactions?start_date=${startDate}&end_date=${endDate}`, { signal, cache: 'no-store' }
    )
    setTransactions(Array.isArray(data) ? data : [])
  })()), [track])

  // 고정비 목록 + 그 달 고정비 요약(첫 화면·다시 시도)
  const fetchFixed = useCallback((y: number, m: number) => track(['fe'], (async () => {
    const [feData, feSummaryData] = await Promise.all([
      apiFetch<FixedExpense[]>('/api/fixed-expenses'),
      apiFetch<FixedExpenseSummary>(`/api/fixed-expenses/summary?year=${y}&month=${m}`),
    ])
    setFixedExpenses(Array.isArray(feData) ? feData : [])
    setFeSummary(feSummaryData)
  })()), [track])

  const refetchDividends = useCallback((y = now.getFullYear(), m = now.getMonth() + 1) => track(['div'], (async () => {
    const data = await apiFetch<DividendYearlySummary>(`/api/dividends/summary?year=${y}&month=${m}`)
    setDivSummary(data)
  })()), [track]) // eslint-disable-line react-hooks/exhaustive-deps

  // 종목·자산·매매 내역(자산 탭, 가계부 저축 연동·배당·고정비 공용)
  const fetchHoldings = useCallback(() => track(['holdings'], (async () => {
    const [port, assets, stockTx] = await Promise.all([
      apiFetch<PortfolioResponse>('/api/stocks/portfolio'),
      apiFetch<OtherAsset[]>('/api/assets'),
      apiFetch<StockTransaction[]>('/api/stocks/transactions'),
    ])
    if (Array.isArray(port)) { setPortfolio(port); setPortfolioSummary(null) }
    else { setPortfolio(port?.items ?? []); setPortfolioSummary(port?.summary ?? null) }
    setOtherAssets(Array.isArray(assets) ? assets : [])
    setTradeTransactions(Array.isArray(stockTx) ? stockTx : [])
  })()), [track])

  // 일정·일기는 따로 센다(한쪽이 늦어도 다른 쪽은 먼저 보인다). 못 보는 메뉴는 부르지 않는다
  const fetchSchedules = useCallback(() => track(['schedules'], (async () => {
    if (!canSee('schedule')) return
    const list = await apiFetch<Schedule[]>('/api/schedules')
    setSchedules(Array.isArray(list) ? list : [])
  })()), [track])

  const fetchDiaries = useCallback(() => track(['diaries'], (async () => {
    if (!canSee('diary')) return
    const list = await apiFetch<DiaryEntry[]>('/api/diaries')
    setDiaries(Array.isArray(list) ? list : [])
    setDiariesAt(Date.now())
  })()), [track])

  const fetchUsers = useCallback(async () => {
    setUsers(withAvatarColors(await apiFetch<User[]>('/api/users')))
  }, [])

  // ── 탭 데이터: 카드마다 따로 받아 먼저 온 카드부터 보인다. 실패는 그 카드에 다시 시도로 남는다 ──
  const loadTab = useCallback((tab: ActiveTab, ledger?: { y: number; m: number; sd: number; calY: number; calM: number }) => {
    const jobs: Promise<unknown>[] = []
    if (tab === 'ledger' && ledger && canSee('ledger')) {
      const { y, m, sd, calY, calM } = ledger
      jobs.push(
        fetchTransactions(y, m, sd), fetchSummary(y, m, sd), fetchFixed(y, m),
        refetchDividends(calY, calM), fetchCalendar(calY, calM), fetchCalendarTransactions(calY, calM),
      )
    } else if (tab === 'wealth' && canSeeHoldings()) {
      jobs.push(fetchHoldings())
    } else if (tab === 'life') {
      jobs.push(fetchSchedules(), fetchDiaries())
    }
    return Promise.allSettled(jobs.map(j => track([TAB], j)))
  }, [track, fetchTransactions, fetchSummary, fetchFixed, refetchDividends, fetchCalendar, fetchCalendarTransactions, fetchHoldings, fetchSchedules, fetchDiaries])

  // ── initial load ─────────────────────────────────────────────────────────
  // Step 1: couple + 권한 (화면 전체 로딩) → 어떤 탭을 보일지 정해진다
  // Step 2: 첫 탭 카드들을 카드별로 받는다(화면은 이미 보이고 카드마다 스피너)
  // Step 3: 첫 탭이 끝나면 나머지 보이는 탭을 뒤에서 미리 받는다(prefetchAll)
  const fetchAll = useCallback(async () => {
    const y = now.getFullYear()
    const m = now.getMonth() + 1
    let first: ActiveTab = 'ledger'
    let ledgerArgs: Parameters<typeof loadTab>[1]
    try {
      // ── Step 1: couple + 내 권한 ──
      const [coupleData, permData] = await Promise.all([
        apiFetch<Couple>('/api/couple'),
        apiFetch<MyPermissions>('/api/me/permissions'),
      ])
      _perms = permData
      setPerms(permData)
      first = visibleTabs(permData)[0]?.key ?? 'ledger'
      setActiveTab(first)
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
      ledgerArgs = { y: periodYear, m: adjMonth, sd: dbStartDay, calY: y, calM: m }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setLoading(false)
      return
    }
    setLoading(false)

    // ── Step 2: 첫 탭 + 구성원(헤더 아바타) ──
    loadedTabs.current.add(first)
    await Promise.allSettled([
      track([TAB], fetchUsers()).catch(e => toastError('구성원 불러오기', e)),
      loadTab(first, ledgerArgs),
    ])
    // ── Step 3 ──
    prefetchAll(first, ledgerArgs)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status === 'authenticated') fetchAll()
  }, [fetchAll, status])

  // ── 나머지 탭 백그라운드 프리패치 ─────────────────────────────────────────────
  // 첫 탭이 다 받아지면 다른 보이는 탭을 조용히 병렬 로드(진행 막대 없이, 카드 상태만 센다).
  // 사용자가 탭을 누를 때 이미 데이터가 준비돼 있으면 스피너 없이 즉시 표시.
  //
  // .preload() 란?
  //   next/dynamic 으로 만든 컴포넌트는 정적 메서드 .preload()를 가진다.
  //   이를 호출하면 렌더링 없이 해당 JS 청크만 네트워크로 미리 다운로드한다.
  //   → 탭 전환 시 "청크 다운로드 + 렌더링" 에서 "렌더링만" 으로 단축된다.
  const prefetchAll = useCallback(async (first: ActiveTab, ledgerArgs: Parameters<typeof loadTab>[1]) => {
    // ── JS 청크 미리 다운로드 (렌더링 없이 네트워크만, 병렬) ──
    ;[
      WealthScreen,
      DiaryScreen, ScheduleScreen, RoadmapTab,
      AddStockModal, EditStockModal, BuySellModal, TradeHistoryModal,
    ].forEach(c => (c as any).preload?.())

    const visible = new Set(visibleTabs(_perms).map(t => t.key))
    await Promise.allSettled([
      // ── 가계부(첫 탭이 아니었을 때) ──
      first !== 'ledger' && visible.has('ledger') && ledgerArgs && (async () => {
        const rs = await loadTab('ledger', ledgerArgs)
        if (rs.every(r => r.status === 'fulfilled')) loadedTabs.current.add('ledger')
      })(),
      // ── 종목·자산 (자산 탭, 가계부 공용) ── 실패해도 탭 진입 시 다시 시도
      first !== 'wealth' && canSeeHoldings() && fetchHoldings().then(() => { loadedTabs.current.add('wealth') }),
      // ── 일상 탭 ──
      first !== 'life' && visible.has('life') && Promise.all([fetchSchedules(), fetchDiaries()])
        .then(() => { loadedTabs.current.add('life') }),
      // ── 로드맵 ──
      canSee('roadmap') && (async () => {
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
      })(),
    ])
  }, [loadTab, fetchHoldings, fetchSchedules, fetchDiaries])

  // ── 탭 전환: 첫 방문이면 카드별 로드, 재방문이면 가벼운 refresh(받은 카드는 그대로 두고 머리에 작은 스피너) ──
  useEffect(() => {
    if (loading) return // 초기 로딩 완료 전 무시
    if (!loadedTabs.current.has(activeTab)) {
      loadedTabs.current.add(activeTab)
      loadTab(activeTab, { y: summaryYear, m: summaryMonth, sd: startDay, calY: calendarYear, calM: calendarMonth })
      return
    }
    if (activeTab === 'life') {
      track([TAB], Promise.all([fetchSchedules(), fetchDiaries()])).catch(() => {})
    } else if (activeTab === 'ledger' && canSee('ledger')) {
      track([TAB], Promise.all([
        fetchTransactions(summaryYear, summaryMonth, startDay),
        fetchSummary(summaryYear, summaryMonth, startDay),
        fetchCalendar(calendarYear, calendarMonth),
        track(['fe'], apiFetch<FixedExpense[]>('/api/fixed-expenses').then(fe => setFixedExpenses(Array.isArray(fe) ? fe : []))),
      ])).catch(() => {})
    } else if (activeTab === 'wealth' && canSeeHoldings()) {
      track([TAB], fetchHoldings()).catch(() => {})
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
  const refetchPortfolio = () => track(['holdings'], (async () => {
    const updated = await apiFetch<PortfolioResponse>('/api/stocks/portfolio')
    if (Array.isArray(updated)) {
      setPortfolio(updated)
      setPortfolioSummary(null)
    } else {
      setPortfolio(updated?.items ?? [])
      setPortfolioSummary(updated?.summary ?? null)
    }
  })())

  // ── assets refetch ────────────────────────────────────────────────────────
  const refetchAssets = () => track(['holdings'], (async () => {
    const updated = await apiFetch<OtherAsset[]>('/api/assets')
    setOtherAssets(Array.isArray(updated) ? updated : [])
  })())

  // ── fixed expense refetch ─────────────────────────────────────────────────
  const refetchFixedExpenses = useCallback((y = summaryYear, m = summaryMonth) => track(['fe', 'tx'], (async () => {
    const [feData, feSummaryData, txData] = await Promise.all([
      apiFetch<FixedExpense[]>('/api/fixed-expenses'),
      apiFetch<FixedExpenseSummary>(`/api/fixed-expenses/summary?year=${y}&month=${m}`),
      apiFetch<Transaction[]>(`/api/transactions?year=${y}&month=${m}`),
    ])
    setFixedExpenses(Array.isArray(feData) ? feData : [])
    setFeSummary(feSummaryData)
    setTransactions(Array.isArray(txData) ? txData : [])
  })()), [summaryYear, summaryMonth, track])

  // ── transaction handlers ──────────────────────────────────────────────────
  // ── 거래 추가: 입력 시트·달력 공용 ─────────────────────────────────────────
  // 지출·수입은 화면에 먼저 넣고, 저장이 실패하면 되돌린 뒤 토스트를 띄우고 던진다(설계서 9.C-12).
  // 저축은 자산이 같이 바뀌어 서버 결과로만 그린다.
  // 만든 거래 id 를 저장 직후 돌려준다(빠른 입력의 되돌리기·N페이). 목록 새로고침은 뒤에서 돈다.
  const handleAddTransaction = async (p: AddTransactionPayload): Promise<string> => {
    const date = `${p.date}T12:00:00+09:00` // 한국 정오 — UTC 로 넘어가 전날이 되지 않게
    const body = {
      user_id: p.user_id, type: p.type, amount: p.amount, currency: 'KRW',
      category: p.category, title: p.title, payment_method: p.payment_method ?? '카드',
      date, saving_link: p.saving_link,
    }
    const tempID = `temp-${Date.now()}`
    const optType = p.type === 'saving' ? null : p.type
    if (optType) {
      const temp: Transaction = {
        id: tempID, couple_id: session?.user?.backendUser?.couple_id ?? '', user_id: p.user_id,
        type: p.type, amount: p.amount, currency: 'KRW', category: p.category, subcategory: '',
        title: p.title, memo: '', date, payment_method: body.payment_method, is_fixed: false,
        tags: [], location: null, created_at: date, updated_at: date,
      }
      setTransactions(prev => [temp, ...prev])
      setSummary(prev => applySummaryDelta(prev, optType, p.amount))
    }
    let created: Transaction
    try {
      created = await apiFetch<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(body) })
    } catch (e) {
      if (optType) {
        setTransactions(prev => prev.filter(tx => tx.id !== tempID))
        // 이 거래 몫만 뺀다 — 그사이 다른 저장이 반영한 금액은 남긴다
        setSummary(prev => applySummaryDelta(prev, optType, -p.amount))
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
    // 새로고침은 기다리지 않는다 — id 를 바로 돌려야 N페이가 탭 직후에 열리고 되돌리기도 바로 뜬다
    void Promise.allSettled(refetches).then(rs => {
      const failed = rs.find((r): r is PromiseRejectedResult => r.status === 'rejected' && (r.reason as Error)?.name !== 'AbortError')
      if (failed) toastError('새로고침', failed.reason)
    })
    return created.id
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
    await apiFetch('/api/stocks', { method: 'POST', body: JSON.stringify(data) })
    await refetchPortfolio()
  }

  const handleEditStock = async (id: string, data: Parameters<React.ComponentProps<typeof EditStockModal>['onEdit']>[1]) => {
    await apiFetch(`/api/stocks/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    await refetchPortfolio()
  }

  const handleBuySellStock = async (
    mode: 'buy' | 'sell',
    data: { quantity: number; price: number; exchange_rate: number; memo: string },
  ) => {
    if (!buySellTarget) return
    await apiFetch(`/api/stocks/${buySellTarget.asset.id}/${mode}`, { method: 'POST', body: JSON.stringify(data) })
    await refetchPortfolio()
  }

  const handleDeleteStock = async (asset: StockAssetWithPrice) => {
    try {
      await apiFetch(`/api/stocks/${asset.id}?force=true`, { method: 'DELETE' })
      setPortfolio(prev => prev.filter(a => a.id !== asset.id))
      await refetchPortfolio()
    } catch (e) {
      toastError('종목 삭제', e)
    }
  }

  // ── other-asset handlers ──────────────────────────────────────────────────
  const handleAddAsset = async (data: CreateOtherAssetRequest) => {
    await apiFetch('/api/assets', { method: 'POST', body: JSON.stringify(data) })
    await refetchAssets()
    if (data.asset_type === '대출') {
      await refetchFixedExpenses()
      await fetchCalendar(calendarYear, calendarMonth)
    }
  }

  const handleEditAsset = async (id: string, data: UpdateOtherAssetRequest) => {
    await apiFetch(`/api/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    await refetchAssets()
  }

  const handleDeleteAsset = async (id: string) => {
    try {
      await apiFetch(`/api/assets/${id}`, { method: 'DELETE' })
      setOtherAssets(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      toastError('자산 삭제', e)
    }
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
    try {
      await apiFetch('/api/stocks/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) })
    } catch (e) {
      setPortfolio(previous)
      toastError('순서 저장', e)
      throw e
    }
  }

  const handleReorderAssets = async (ids: string[]) => {
    const previous = otherAssets
    setOtherAssets(prev => reorderByIDs(prev, ids))
    try {
      await apiFetch('/api/assets/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) })
    } catch (e) {
      setOtherAssets(previous)
      toastError('순서 저장', e)
      throw e
    }
  }

  const handleCreateLoanExpense = async (id: string) => {
    try {
      await apiFetch(`/api/assets/${id}/loan-expense`, { method: 'POST' })
      await refetchFixedExpenses()
      await fetchCalendar(calendarYear, calendarMonth)
    } catch (e) {
      toastError('대출 고정비 등록', e)
    }
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
    const created = await apiFetch<Schedule>('/api/schedules', { method: 'POST', body: JSON.stringify(req) })
    setSchedules(s => [...s, created])
  }

  const handleEditSchedule = async (id: string, req: UpdateScheduleRequest) => {
    const updated = await apiFetch<Schedule>(`/api/schedules/${id}`, { method: 'PUT', body: JSON.stringify(req) })
    setSchedules(s => s.map(x => x.id === id ? updated : x))
  }

  const handleDeleteSchedule = async (id: string) => {
    await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' })
    setSchedules(s => s.filter(x => x.id !== id))
  }

  // ── diary ─────────────────────────────────────────────────────────────────
  // 사진은 한 장씩 올리고(presigned, attachDiaryPhotos), 실패한 장수를 알린다(설계서 9.C-12).
  // 일기 글은 이미 저장됐으므로 던지지 않는다: 쓰기 창이 열린 채 다시 저장해 같은 일기가 또 생기는 일을 막는다.
  const uploadDiaryPhotos = async (diaryID: string, files: File[]) => {
    let failed = 0
    let firstError: unknown
    for (const file of files) {
      try {
        await attachDiaryPhotos(_accessToken, diaryID, [file])
      } catch (e) {
        failed++
        firstError ??= e
      }
    }
    // 첫 실패 사유를 같이 보인다(저장 공간이 가득 찬 413 문구 등).
    const reason = firstError instanceof Error && firstError.message ? ` (${firstError.message})` : ''
    if (failed > 0) showToast(`사진 ${failed}장을 올리지 못했어요${reason}. 수정에서 다시 올려 주세요`)
  }

  // 저장 뒤 목록 새로고침 실패도 던지지 않는다(같은 이유).
  const refetchDiaries = async () => {
    try {
      await fetchDiaries()
    } catch (e) {
      toastError('일기 목록 새로고침', e)
    }
  }

  const handleAddDiary = async (req: CreateDiaryRequest, photos: File[]) => {
    const created = await apiFetch<DiaryEntry>('/api/diaries', { method: 'POST', body: JSON.stringify(req) })
    await uploadDiaryPhotos(created.id, photos)
    await refetchDiaries()
  }

  const handleUpdateDiary = async (id: string, req: UpdateDiaryRequest, newPhotos: File[]) => {
    await apiFetch(`/api/diaries/${id}`, { method: 'PUT', body: JSON.stringify(req) })
    await uploadDiaryPhotos(id, newPhotos)
    await refetchDiaries()
  }

  /** photo 는 저장소 키 */
  const handleDeleteDiaryPhoto = async (id: string, photo: string) => {
    await apiFetch(`/api/diaries/${id}/photos?key=${encodeURIComponent(photo)}`, { method: 'DELETE' })
    setDiaries(ds => ds.map(d => {
      if (d.id !== id) return d
      const i = d.photos.indexOf(photo)
      return i < 0 ? d : { ...d, photos: d.photos.filter((_, k) => k !== i), photo_urls: d.photo_urls.filter((_, k) => k !== i) }
    }))
  }

  const handleDeleteDiary = async (id: string) => {
    await apiFetch(`/api/diaries/${id}`, { method: 'DELETE' })
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
  // 카드 하나의 불러오기 상태 + 다시 시도
  const sec = (key: string, retry: () => Promise<unknown>): SectionState => ({
    view: sectionView(loads[key]),
    onRetry: () => { retry().catch(() => {}) },
  })
  // 2단 메뉴 세그먼트. 하나뿐이면 숨김. 시안처럼 화면 제목 아래에 두려고 화면에 prop 으로 넘긴다.
  const chipRow = currentTab && currentTab.subs.length > 1 ? (
    <Segmented items={currentTab.subs} value={currentSub?.key} onChange={setActiveSub} />
  ) : null

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Header ── */}
      <header className="bg-cream/90 backdrop-blur-md px-5 py-3 sticky top-0 z-40">
        <TopProgress on={(loads[TAB]?.pending ?? 0) > 0} />
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
              className="relative flex -space-x-2 focus:outline-none before:absolute before:-inset-x-1 before:-inset-y-1.5 before:content-['']"
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
            ? 'pb-[calc(var(--nav-h)+1rem)]'
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
        {currentTab?.key === 'baby' && chipRow}

        {/* ══ 아기 ══ */}
        {currentSub?.key === 'baby_photo' && (
          <BabyPhotoTab
            accessToken={session?.user?.accessToken ?? ''}
            users={users}
            isOwner={!!perms?.is_owner}
            canEdit={canEdit('baby_photo')}
          />
        )}
        {currentSub?.key === 'baby_growth' && (
          <BabyGrowthTab
            accessToken={session?.user?.accessToken ?? ''}
            isOwner={!!perms?.is_owner}
            canEdit={canEdit('baby_growth')}
          />
        )}

        {/* ══ 자산현황 ══ */}
        {currentSub?.key === 'assets' && (
            <WealthScreen
              holdings={sec('holdings', fetchHoldings)}
              canEdit={canEdit('assets')}
              chips={chipRow}
              accessToken={session?.user?.accessToken ?? ''}
              currentUserID={currentUserID}
              users={users}
              portfolio={portfolio}
              portfolioSummary={portfolioSummary}
              otherAssets={otherAssets}
              fixedExpenseTitles={fixedExpenses.map(fe => fe.title)}
              onAddStock={() => setShowAddStock(true)}
              onHistory={() => setShowTradeHistory(true)}
              onEditStock={setEditingStock}
              onBuySell={(asset, mode) => setBuySellTarget({ asset, mode })}
              onDeleteStock={handleDeleteStock}
              onReorderStocks={handleReorderStocks}
              onAddAsset={handleAddAsset}
              onEditAsset={handleEditAsset}
              onDeleteAsset={handleDeleteAsset}
              onCreateLoanExpense={handleCreateLoanExpense}
              onReorderAssets={handleReorderAssets}
            />
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
            sections={{
              summary: sec('summary', () => fetchSummary(summaryYear, summaryMonth, startDay)),
              feed: sec('tx', () => fetchTransactions(summaryYear, summaryMonth, startDay)),
              breakdown: { view: mergeViews(sectionView(loads.tx), sectionView(loads.fe)), onRetry: () => {
                if (sectionView(loads.tx) === 'error') fetchTransactions(summaryYear, summaryMonth, startDay).catch(() => {})
                if (sectionView(loads.fe) === 'error') fetchFixed(summaryYear, summaryMonth).catch(() => {})
              } },
              dividends: sec('div', () => refetchDividends(calendarYear, calendarMonth)),
              fixed: sec('fe', () => fetchFixed(summaryYear, summaryMonth)),
              calendar: sec('cal', () => Promise.all([fetchCalendar(calendarYear, calendarMonth), fetchCalendarTransactions(calendarYear, calendarMonth)])),
            }}
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

        {/* ══ 일상: 일정 · 일기 ══ */}
        {currentTab?.key === 'life' && (
          currentSub?.key === 'diary' ? (
            <DiaryScreen
              section={sec('diaries', fetchDiaries)}
              diaries={diaries}
              users={users}
              currentUserID={currentUserID}
              accessToken={session?.user?.accessToken ?? ''}
              isOwner={!!perms?.is_owner}
              photosLoadedAt={diariesAt}
              onReloadPhotos={refetchDiaries}
              canEdit={canEdit('diary')}
              hasNav={tabs.length > 1}
              chips={chipRow}
              onAdd={handleAddDiary}
              onUpdate={handleUpdateDiary}
              onDeletePhoto={handleDeleteDiaryPhoto}
              onDelete={handleDeleteDiary}
            />
          ) : (
            <ScheduleScreen
              section={sec('schedules', fetchSchedules)}
              schedules={schedules}
              diaries={diaries}
              currentUserID={currentUserID}
              canEdit={canEdit('schedule')}
              chips={chipRow}
              onAdd={handleAddSchedule}
              onEdit={handleEditSchedule}
              onDelete={handleDeleteSchedule}
            />
          )
        )}

        {/* ══ Tab 4: 로드맵 ══ */}
        {currentSub?.key === 'roadmap' && (
          <RoadmapTab accessToken={session?.user?.accessToken} prefetched={roadmap} canEdit={canEdit('roadmap')} chips={chipRow} />
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
        <nav ref={navRef} className="fixed bottom-0 inset-x-0 z-50 rounded-t-card bg-white shadow-warm-up">
          <div className="max-w-2xl mx-auto flex pb-safe">
            {tabs.map(t => {
              const Icon = TAB_ICONS[t.key]
              const on = currentTab?.key === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => { tapHaptic(); setActiveTab(t.key); setActiveSub(null) }}
                  className={`flex-1 flex flex-col items-center pt-2.5 pb-4 gap-1 transition-colors ${on ? 'text-brand-500' : 'text-stone-400'}`}
                >
                  <div className={`relative flex h-8 w-14 items-center justify-center ${on ? 'text-white' : ''}`}>
                    {on && (
                      <motion.span
                        layoutId="nav-pill"
                        transition={reduceMotion ? NO_MOTION : SPRING}
                        className="absolute inset-0 rounded-full bg-brand-500"
                      />
                    )}
                    <motion.span
                      className="relative"
                      animate={{ scale: on && !reduceMotion ? [1, 1.15, 1] : 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      <Icon className="h-5 w-5" />
                    </motion.span>
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
