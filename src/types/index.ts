// ─────────────────────────────────────────────
//  Domain Types (mirrors Go models)
// ─────────────────────────────────────────────

export type UserRole = 'husband' | 'wife'
export type TransactionType = 'income' | 'expense' | 'saving'

export type SavingKind = 'stock' | 'deposit' | 'general'

export interface SavingLink {
  kind: SavingKind
  link_asset_id?: string
  add_stock_qty?: number
  add_stock_price?: number
  new_stock_symbol?: string
  new_stock_exchange?: string
  new_stock_name?: string
  new_stock_qty?: number
  new_stock_price?: number
  new_stock_currency?: string
  new_stock_sector?: string
  new_asset_name?: string
  new_asset_type?: string
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar_color: string
  created_at: string
}

export interface Couple {
  id: string
  name: string
  monthly_budget: number
  ledger_start_day: number  // 가계부 기간 시작일 (1-28), 공유 설정
  currency: string
  created_at: string
}

export interface Location {
  name: string
  lat: number | null
  lng: number | null
  address: string
}

export interface Transaction {
  id: string
  couple_id: string
  user_id: string
  type: TransactionType
  amount: number
  currency: string
  category: string
  subcategory: string
  title: string
  memo: string
  date: string
  payment_method: string
  is_fixed: boolean
  tags: string[]
  location: Location | null
  fixed_expense_id?: string  // 고정비 자동 생성 시 연결 ID
  saving_link?: SavingLink
  created_at: string
  updated_at: string
}

export interface StockAsset {
  id: string
  couple_id: string
  user_id: string
  symbol: string
  exchange: string
  name: string
  name_en: string
  quantity: number
  average_price: number
  currency: string
  sector: string
  memo: string
  logo_url: string | null
  purchased_at: string
  created_at: string
  updated_at: string
}

export interface PriceSnapshot {
  symbol: string
  exchange: string
  price: number
  currency: string
  change: number
  change_percent: number
  snapshotted_at: string
}

export interface StockAssetWithPrice extends StockAsset {
  current_price: number
  current_value: number
  current_value_krw: number
  profit_loss: number
  profit_loss_krw: number
  profit_loss_pct: number
  change: number
  change_percent: number
  exchange_rate?: number
  price_source: 'live' | 'cached'
  price_updated_at: string
}

export interface PortfolioSummary {
  total_value_krw: number
  total_cost_krw: number
  total_profit_krw: number
  total_profit_pct: number
  usd_krw: number
  fx_source: 'live' | 'fallback'
  calculated_at: string
}

// GET /api/stocks/portfolio 응답 형태
// Go 백엔드가 { items, summary } 객체를 반환함
export interface PortfolioResponse {
  items: StockAssetWithPrice[]
  summary: PortfolioSummary
}

export interface MonthlySummary {
  year: number
  month: number
  total_income: number
  total_expense: number
  balance: number
  budget_limit: number
}

// ─────────────────────────────────────────────
//  StockTransaction (매수/매도 이력 — Immutable Log)
// ─────────────────────────────────────────────

export type StockTxType = 'buy' | 'sell'

export interface StockTransaction {
  id: string
  couple_id: string
  user_id: string
  stock_asset_id: string
  symbol: string
  exchange: string
  name: string
  type: StockTxType
  quantity: number
  price: number
  currency: string
  avg_price_at_tx: number
  realized_pnl: number      // sell only: (price - avg) * qty; 0 for buy
  memo: string
  executed_at: string
  created_at: string
}

export interface AnnualTaxSummary {
  year: number
  couple_id: string
  total_realized_pnl: number
  taxable_gain: number
  estimated_tax: number
  tax_rate: number
  by_symbol: SymbolTaxSummary[]
}

export interface SymbolTaxSummary {
  symbol: string
  exchange: string
  sell_count: number
  realized_pnl: number
  estimated_tax: number
}

export interface TaxCheckResponse {
  has_sell_current_year: boolean
  year: number
}

export interface SellResult {
  asset?: StockAssetWithPrice
  removed?: boolean
  realized_pnl: number
  symbol?: string
}

// ─────────────────────────────────────────────
//  Stock 추가 요청 DTO
// ─────────────────────────────────────────────

export interface CreateStockRequest {
  user_id: string
  symbol: string
  exchange: string
  name: string
  name_en?: string
  quantity: number
  average_price: number
  currency: string       // "KRW" | "USD"
  sector?: string
  memo?: string
  purchased_at?: string  // ISO 8601 — null이면 서버에서 현재 시각 사용
}

// ─────────────────────────────────────────────
//  OtherAsset (기타 자산)
// ─────────────────────────────────────────────

export type OtherAssetType =
  | '부동산'
  | '예/적금'
  | '현금'
  | '대출'
  | '기타'

export type LoanType = '만기일시상환' | '원리금균등상환' | '원금균등상환'

export const OTHER_ASSET_TYPES: OtherAssetType[] = [
  '부동산', '예/적금', '현금', '대출', '기타',
]

export const ASSET_TYPE_EMOJI: Record<OtherAssetType, string> = {
  부동산:   '🏠',
  '예/적금': '🏦',
  현금:     '💵',
  대출:     '💳',
  기타:     '📦',
}

export interface OtherAsset {
  id: string
  couple_id: string
  user_id: string
  asset_type: OtherAssetType
  name: string
  description: string
  value_krw: number
  value_usd: number | null        // USD 현금 전용
  cost_krw: number
  currency: string                // "KRW" | "USD"
  is_liability: boolean           // 대출이면 true (자동)
  is_locked: boolean
  location: Location | null
  maturity_date: string | null
  interest_rate: number | null
  loan_type: string
  payment_day: number
  memo: string
  acquired_at: string
  created_at: string
  updated_at: string
}

export interface CreateOtherAssetRequest {
  user_id: string
  asset_type: OtherAssetType
  name: string
  description?: string
  value_krw: number
  value_usd?: number | null       // USD 현금 전용
  cost_krw?: number
  currency?: string               // 기본값 "KRW"
  is_locked?: boolean
  location?: Location | null
  maturity_date?: string | null
  interest_rate?: number | null
  loan_type?: string
  payment_day?: number
  memo?: string
  acquired_at?: string | null
}

export interface UpdateOtherAssetRequest {
  asset_type?: OtherAssetType
  name?: string
  description?: string
  value_krw?: number
  value_usd?: number | null       // USD 현금 전용
  cost_krw?: number
  is_locked?: boolean
  location?: Location | null
  maturity_date?: string | null
  interest_rate?: number | null
  loan_type?: string
  payment_day?: number
  memo?: string
}

export interface NetWorthSummary {
  stock_value_krw: number   // 주식 포트폴리오 합산 (KRW 환산)
  asset_value_krw: number   // 기타 자산 합산
  liability_krw: number     // 부채 합산
  net_worth_krw: number     // 순자산 (주식 + 자산 − 부채)
  calculated_at: string
}

// ─────────────────────────────────────────────
//  FixedExpense (고정비 — 정기 지출 템플릿)
// ─────────────────────────────────────────────

export type RecurringCycle = 'monthly' | 'weekly'
export type FixedExpenseOwner = 'husband' | 'wife' | 'joint'
export type FixedExpenseKind = 'spending' | 'saving'

export interface FixedExpense {
  id: string
  couple_id: string
  user_id: string
  owner: FixedExpenseOwner   // husband | wife | joint
  kind: FixedExpenseKind     // spending | saving
  title: string
  category: string
  amount: number             // KRW
  currency: string
  cycle: RecurringCycle
  day_of_month: number       // 1-28, 매월 N일
  day_of_week?: number       // 0-6, 매주 N요일
  is_active: boolean
  memo: string
  saving_link?: SavingLink
  created_at: string
  updated_at: string
}

export interface CreateFixedExpenseRequest {
  user_id: string
  owner: FixedExpenseOwner
  kind?: FixedExpenseKind
  title: string
  category?: string
  amount: number
  currency?: string
  cycle: RecurringCycle
  day_of_month: number
  day_of_week?: number
  memo?: string
  saving_link?: SavingLink
}

export interface UpdateFixedExpenseRequest {
  owner?: FixedExpenseOwner
  kind?: FixedExpenseKind
  title?: string
  category?: string
  amount?: number
  day_of_month?: number
  is_active?: boolean
  memo?: string
  saving_link?: SavingLink
}

export interface FixedExpenseSummary {
  total_amount: number       // 이번 달 고정비 총액
  applied_count: number      // 이미 가계부에 반영된 건수
  total_count: number        // 활성 고정비 총 건수
  unapplied: FixedExpense[]  // 아직 미반영 항목들
}

export interface ApplyFixedExpensesResult {
  applied: Transaction[]     // 새로 생성된 거래 내역
  skipped: number            // 이미 적용됐던 건수
  total: number              // 전체 고정비 건수
}

// ─────────────────────────────────────────────
//  DividendEvent (배당 이벤트)
// ─────────────────────────────────────────────

export interface DividendEvent {
  id: string
  couple_id: string
  user_id: string
  stock_asset_id: string     // 포트폴리오 연결
  symbol: string
  exchange: string
  name: string
  quantity: number           // 보유 주식 수
  amount_per_share: number   // 주당 배당금
  currency: string           // "USD" 등
  total_amount: number       // quantity × amount_per_share (세전)
  tax_rate: number           // 0.154
  after_tax_amount: number   // 세후 배당금
  usd_krw_rate: number       // 입력 시 환율
  amount_krw: number         // 원화 환산 (세후)
  ex_dividend_date?: string  // 배당락일 (optional)
  payment_date: string       // 지급일
  is_applied: boolean        // 가계부 반영 여부
  memo: string
  created_at: string
  updated_at: string
}

export interface CreateDividendRequest {
  user_id: string
  stock_asset_id: string
  symbol: string
  exchange: string
  name: string
  quantity: number
  amount_per_share: number
  currency: string
  tax_rate?: number          // 기본값 0.154
  usd_krw_rate: number
  ex_dividend_date?: string
  payment_date: string       // YYYY-MM-DD
  memo?: string
}

// ─────────────────────────────────────────────
//  Calendar (일별 집계)
// ─────────────────────────────────────────────

export interface CalendarDay {
  date: string              // "YYYY-MM-DD"
  total_expense: number
  total_income: number
  transaction_count: number
}

export type CalendarEventType = 'fixed_expense' | 'dividend'

export interface CalendarEvent {
  date: string              // "YYYY-MM-DD"
  type: CalendarEventType
  title: string
  amount: number            // KRW
}

export interface CalendarSummaryResponse {
  year: number
  month: number
  days: CalendarDay[]       // only days with transactions
  events: CalendarEvent[]   // fixed expense + dividend dots
}

export interface DividendYearlySummary {
  year: number
  total_usd: number
  total_after_tax_usd: number
  total_krw: number
  applied_count: number
  pending_count: number
  events: DividendEvent[]
}

// ─────────────────────────────────────────────
//  Schedule (일정)
// ─────────────────────────────────────────────

export type ScheduleColor = 'indigo' | 'rose' | 'emerald' | 'amber' | 'sky'

export interface Schedule {
  id: string
  couple_id: string
  user_id: string
  title: string
  description: string
  start_date: string
  end_date?: string
  all_day: boolean
  is_dday: boolean
  dday_label: string
  color: ScheduleColor
  created_at: string
  updated_at: string
}

export interface CreateScheduleRequest {
  user_id: string
  title: string
  description?: string
  start_date: string
  end_date?: string
  all_day?: boolean
  is_dday?: boolean
  dday_label?: string
  color?: ScheduleColor
}

// ─────────────────────────────────────────────
//  DiaryEntry (일기)
// ─────────────────────────────────────────────

export type DiaryMood = 'happy' | 'good' | 'normal' | 'sad' | 'tired'

export interface DiaryEntry {
  id: string
  couple_id: string
  user_id: string
  date: string
  content: string
  photos: string[]
  mood: DiaryMood
  created_at: string
  updated_at: string
}

export interface CreateDiaryRequest {
  user_id: string
  date: string
  content: string
  mood: DiaryMood
}
