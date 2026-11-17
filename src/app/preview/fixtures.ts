// 개발 전용 미리보기(/preview)의 가짜 백엔드 응답. 오늘(2026-11-17) 기준으로 11월 말·12월 초, 긴 제목, 0/1/여러 건, 5천원~1억+ 금액을 섞었다.
import type {
  Baby, BabyGrowth, BabyMoment, CalendarEvent, CalendarSummaryResponse, Couple, DiaryEntry, DividendYearlySummary,
  FixedExpense, FixedExpenseSummary, Member, MenuKey, MonthlySummary, MyPermissions, OtherAsset, PortfolioResponse,
  RoadmapAssumptionsResponse, RoadmapProjection, Schedule, StockAssetWithPrice, StockTransaction, StorageUsage,
  Transaction, User,
} from '@/types'

const C = 'c1'
const T = '2026-11-01T00:00:00Z'
const HUSBAND = 'u1'
const WIFE = 'u2'

// 사진 자리: 외부 주소 없이 그라데이션 SVG
const photo = (a: string, b: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/></svg>`)}`

export const users: User[] = [
  { id: HUSBAND, couple_id: C, name: '김민준', email: 'a@example.com', role: 'husband', avatar_color: '', is_owner: true, created_at: T },
  { id: WIFE, couple_id: C, name: '이서연', email: 'b@example.com', role: 'wife', avatar_color: '', created_at: T },
]

const ALL: MenuKey[] = ['baby_photo', 'baby_growth', 'ledger', 'schedule', 'diary', 'assets', 'roadmap']
const allEdit = Object.fromEntries(ALL.map(k => [k, 'edit'])) as Member['menus']
export const permissions: MyPermissions = { is_owner: true, menus: allEdit }

export const members: Member[] = [
  { ...users[0], avatar_color: '#0F4C81', is_owner: true, menus: allEdit },
  { ...users[1], avatar_color: '#FDA4AF', is_owner: false, menus: allEdit },
  {
    id: 'u3', couple_id: C, name: '박할머니(외할머니, 부산 해운대)', email: 'grandma.long.address@example.com', role: 'family',
    avatar_color: '#a8a29e', is_owner: false, created_at: T,
    menus: { ...allEdit, ledger: 'hidden', assets: 'hidden', roadmap: 'hidden', schedule: 'view', diary: 'view' },
  },
]

// 10일 시작: 11/10~12/9 기간이라 곧 나갈 돈에 12월 초가 들어온다
export const couple: Couple = { id: C, name: '민준이네 우리집', monthly_budget: 2_500_000, ledger_start_day: 10, currency: 'KRW', created_at: T }

let n = 0
const tx = (date: string, type: Transaction['type'], amount: number, category: string, title: string, user = HUSBAND, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`, couple_id: C, user_id: user, type, amount, currency: 'KRW', category, subcategory: '', title, memo: '',
  date, payment_method: '카드', is_fixed: false, tags: [], location: null, created_at: T, updated_at: T, ...extra,
})

export const transactions: Transaction[] = [
  tx('2026-11-17', 'expense', 5_000, '카페', '아메리카노'),
  tx('2026-11-17', 'expense', 128_400, '장보기', '이마트 트레이더스 월계점 장보기 (기저귀·분유·과일·세제 대용량)', WIFE),
  tx('2026-11-17', 'expense', 1_250_000, '의료', '산후조리원 잔금 및 신생아 예방접종 추가 비용', WIFE),
  tx('2026-11-16', 'income', 4_830_000, '급여', '11월 급여'),
  tx('2026-11-16', 'expense', 32_000, '식비', '배달의민족 치킨'),
  tx('2026-11-15', 'expense', 9_900, '문화', '넷플릭스'),
  tx('2026-11-14', 'saving', 500_000, '저축', '청년도약계좌 자동이체', WIFE),
  tx('2026-11-12', 'expense', 64_000, '교통', 'SK주유소 경부고속도로 서울방향 만남의광장'),
  tx('2026-11-10', 'income', 125_000_000, '부수입', '전세 보증금 반환'),
  tx('2026-12-01', 'expense', 15_000, '식비', '점심'),
]

export const summary: MonthlySummary = { year: 2026, month: 11, total_income: 129_830_000, total_expense: 1_488_300, balance: 128_341_700, budget_limit: 2_500_000 }

const fe = (id: string, title: string, amount: number, day: number, owner: FixedExpense['owner'], category: string, kind: FixedExpense['kind'] = 'spending'): FixedExpense => ({
  id, couple_id: C, user_id: HUSBAND, owner, kind, title, category, amount, currency: 'KRW', cycle: 'monthly', day_of_month: day,
  is_active: true, memo: '', created_at: T, updated_at: T,
})
export const fixedExpenses: FixedExpense[] = [
  fe('f1', '아파트 관리비', 287_000, 25, 'joint', '주거'),
  fe('f2', 'KT 인터넷+IPTV 결합 (기가 와이파이 프리미엄)', 49_500, 28, 'joint', '통신'),
  fe('f3', '주택담보대출 원리금', 1_830_000, 1, 'joint', '대출'),
  fe('f4', '휴대폰 요금', 55_000, 3, 'wife', '통신'),
  fe('f5', '적립식 펀드', 300_000, 5, 'husband', '저축', 'saving'),
  fe('f6', '유튜브 프리미엄', 14_900, 20, 'husband', '문화'),
]
export const feSummary: FixedExpenseSummary = { total_amount: 2_536_400, applied_count: 2, total_count: 6, unapplied: fixedExpenses.slice(0, 4) }

const evNov: CalendarEvent[] = [
  { date: '2026-11-20', type: 'fixed_expense', title: '유튜브 프리미엄', amount: 14_900 },
  { date: '2026-11-25', type: 'fixed_expense', title: '아파트 관리비', amount: 287_000 },
  { date: '2026-11-25', type: 'dividend', title: 'SCHD 배당', amount: 182_300 },
  { date: '2026-11-28', type: 'fixed_expense', title: 'KT 인터넷+IPTV 결합 (기가 와이파이 프리미엄)', amount: 49_500 },
]
const evDec: CalendarEvent[] = [
  { date: '2026-12-01', type: 'fixed_expense', title: '주택담보대출 원리금', amount: 1_830_000 },
  { date: '2026-12-03', type: 'fixed_expense', title: '휴대폰 요금', amount: 55_000 },
  { date: '2026-12-05', type: 'fixed_expense', title: '적립식 펀드', amount: 300_000 },
]
export function calendarSummary(year: number, month: number): CalendarSummaryResponse {
  const key = `${year}-${String(month).padStart(2, '0')}`
  const days = new Map<string, { e: number; i: number; c: number }>()
  for (const t of transactions) {
    if (!t.date.startsWith(key)) continue
    const d = days.get(t.date) ?? { e: 0, i: 0, c: 0 }
    if (t.type === 'expense') d.e += t.amount
    if (t.type === 'income') d.i += t.amount
    d.c++
    days.set(t.date, d)
  }
  return {
    year, month,
    days: Array.from(days, ([date, d]) => ({ date, total_expense: d.e, total_income: d.i, transaction_count: d.c })),
    events: month === 11 ? evNov : month === 12 ? evDec : [],
  }
}

export const dividends: DividendYearlySummary = {
  year: 2026, month: 11, total_usd: 152.4, total_after_tax_usd: 128.9, total_krw: 182_300, applied_count: 0, pending_count: 1,
  events: [{
    id: 'd1', couple_id: C, user_id: HUSBAND, stock_asset_id: 's1', symbol: 'SCHD', exchange: 'NYSE', name: 'Schwab U.S. Dividend Equity ETF',
    quantity: 520, amount_per_share: 0.2931, currency: 'USD', total_amount: 152.4, tax_rate: 0.154, after_tax_amount: 128.9,
    usd_krw_rate: 1414, amount_krw: 182_300, payment_date: '2026-11-25', is_applied: false, memo: '', created_at: T, updated_at: T,
  }],
}

const stock = (id: string, symbol: string, name: string, qty: number, avg: number, price: number, currency: string, user = HUSBAND): StockAssetWithPrice => {
  const fx = currency === 'USD' ? 1414 : 1
  const value = qty * price * fx
  const cost = qty * avg * fx
  return {
    id, couple_id: C, user_id: user, symbol, exchange: currency === 'USD' ? 'NYSE' : 'KRX', name, name_en: name, quantity: qty,
    average_price: avg, avg_krw_price: avg * fx, currency, sector: '', memo: '', logo_url: null, purchased_at: T, sort_order: 0,
    created_at: T, updated_at: T, current_price: price, current_value: qty * price, current_value_krw: value,
    profit_loss: qty * (price - avg), profit_loss_krw: value - cost, profit_loss_pct: ((price - avg) / avg) * 100,
    krw_basis_exact: true, change: price * 0.012, change_percent: 1.2, exchange_rate: fx, price_source: 'live', price_updated_at: T,
  }
}
const stocks = [
  stock('s1', 'SCHD', 'Schwab U.S. Dividend Equity ETF', 520, 25.1, 28.4, 'USD'),
  stock('s2', '005930', '삼성전자', 310, 71_200, 58_900, 'KRW', WIFE),
  stock('s3', '360750', 'TIGER 미국S&P500', 1_204, 15_400, 21_380, 'KRW'),
]
export const portfolio: PortfolioResponse = {
  items: stocks,
  summary: {
    total_value_krw: stocks.reduce((s, x) => s + x.current_value_krw, 0), total_cost_krw: 60_000_000, total_profit_krw: 8_412_000,
    total_profit_pct: 14.02, usd_krw: 1414, fx_source: 'live', calculated_at: T, krw_basis_approx_count: 0,
    estimated_tax_krw: 1_120_000, net_after_tax_krw: 67_292_000,
  },
}

const asset = (id: string, asset_type: OtherAsset['asset_type'], name: string, value_krw: number, extra: Partial<OtherAsset> = {}): OtherAsset => ({
  id, couple_id: C, user_id: HUSBAND, asset_type, name, description: '', value_krw, value_usd: null, cost_krw: value_krw, currency: 'KRW',
  is_liability: asset_type === '대출', is_locked: false, location: null, maturity_date: null, interest_rate: null, loan_type: '',
  payment_day: 0, memo: '', acquired_at: T, sort_order: 0, created_at: T, updated_at: T, ...extra,
})
export const otherAssets: OtherAsset[] = [
  asset('a1', '부동산', '래미안 원베일리 112동 2304호 (전용 84㎡)', 1_250_000_000),
  asset('a2', '예/적금', '카카오뱅크 26주 적금', 5_000),
  asset('a3', '현금', '비상금 통장', 3_200_000),
  asset('a4', '대출', '주택담보대출 (KB국민 30년 원리금균등)', 412_000_000, { interest_rate: 3.95, loan_type: '원리금균등상환', payment_day: 1 }),
]

export const stockTransactions: StockTransaction[] = [{
  id: 'st1', couple_id: C, user_id: HUSBAND, stock_asset_id: 's1', symbol: 'SCHD', exchange: 'NYSE', name: 'Schwab U.S. Dividend Equity ETF',
  type: 'buy', quantity: 20, price: 27.9, currency: 'USD', avg_price_at_tx: 25.0, realized_pnl: 0, exchange_rate_at_tx: 1402, memo: '',
  executed_at: '2026-11-03T00:00:00Z', created_at: T,
}]

const sch = (id: string, title: string, start: string, color: Schedule['color'], extra: Partial<Schedule> = {}): Schedule => ({
  id, couple_id: C, user_id: HUSBAND, title, description: '', start_date: start, all_day: true, is_dday: false, is_anniversary: false,
  dday_label: '', color, created_at: T, updated_at: T, ...extra,
})
export const schedules: Schedule[] = [
  sch('sc1', '소아과 BCG 접종', '2026-11-17', 'rose'),
  sch('sc2', '서연이 대학 동기 결혼식 (더채플앳청담 3층 그랜드볼룸, 축의금 챙기기)', '2026-11-21', 'amber', { description: '주차 2시간 무료, 오후 1시 30분 예식' }),
  sch('sc3', '부모님 김장 도와드리기', '2026-11-28', 'emerald', { end_date: '2026-11-29' }),
  sch('sc4', '아기 100일', '2026-12-01', 'indigo', { is_dday: true, dday_label: '100일' }),
  sch('sc5', '연말 가족 모임', '2026-12-05', 'sky'),
  sch('sc6', '크리스마스 여행 (강릉 씨마크호텔)', '2026-12-24', 'rose', { end_date: '2026-12-26' }),
  sch('sc7', '결혼기념일', '2022-05-21', 'rose', { is_anniversary: true, dday_label: '결혼' }),
  sch('sc8', '처음 만난 날', '2019-09-14', 'indigo', { is_anniversary: true, dday_label: '처음 만난 날' }),
]

const diary = (id: string, date: string, content: string, mood: DiaryEntry['mood'], photos: string[] = [], user = WIFE): DiaryEntry => ({
  id, couple_id: C, user_id: user, date, content, photos, photo_urls: photos, mood, created_at: T, updated_at: T,
})
export const diaries: DiaryEntry[] = [
  diary('di1', '2026-11-17', '오늘 처음으로 뒤집기를 했다! 한참을 낑낑대더니 결국 성공. 둘이서 박수 치면서 영상 찍느라 정신없었다. 저녁은 간단히 김치찌개.', 'happy', [photo('#fde68a', '#fca5a5'), photo('#bfdbfe', '#a7f3d0'), photo('#ddd6fe', '#fbcfe8')]),
  diary('di2', '2026-11-16', '피곤', 'tired', [], HUSBAND),
  diary('di3', '2026-11-12', '비 오는 날. 집에서 영화 한 편 보고 일찍 잤다.', 'normal', [photo('#e7e5e4', '#a8a29e')]),
  diary('di4', '2026-10-31', '할로윈이라 아기 호박 옷 입혀서 사진 찍음. 너무 귀여워서 할머니께 바로 보내드렸다.', 'good'),
]

export const baby: Baby = { name: '김하늘', birth_date: '2026-08-23', sex: 'female' }

const moment = (id: string, date: string, content: string, colors: [string, string][]): BabyMoment => ({
  id, user_id: WIFE, date, content, created_at: T,
  media: colors.map(([a, b], i) => ({ id: `${id}m${i}`, moment_id: id, kind: 'image', key: `k${id}${i}`, content_type: 'image/svg+xml', size_bytes: 1000, sort_order: i, url: photo(a, b) })),
})
export const moments: BabyMoment[] = [
  moment('m1', '2026-11-17', '첫 뒤집기 성공! 엄마 아빠 둘 다 소리 질렀다', [['#fde68a', '#fca5a5'], ['#bfdbfe', '#a7f3d0']]),
  moment('m2', '2026-11-10', '', [['#ddd6fe', '#fbcfe8']]),
  moment('m3', '2026-10-30', '외할머니 댁 첫 방문. 부산까지 KTX 타고 가는 동안 한 번도 안 울고 잘 잤다. 기특한 우리 하늘이', [['#a7f3d0', '#fde68a'], ['#fbcfe8', '#bfdbfe'], ['#e7e5e4', '#fca5a5'], ['#fed7aa', '#c7d2fe']]),
]

export const growth: BabyGrowth[] = [
  { id: 'g1', measured_on: '2026-08-23', height_cm: 49.5, weight_kg: 3.12, head_cm: 34, memo: '출생' },
  { id: 'g2', measured_on: '2026-09-25', height_cm: 54.2, weight_kg: 4.35, head_cm: 37.1, memo: '1개월 검진' },
  { id: 'g3', measured_on: '2026-10-24', height_cm: 58.0, weight_kg: 5.6, head_cm: null, memo: '' },
  { id: 'g4', measured_on: '2026-11-17', height_cm: null, weight_kg: 6.42, head_cm: 40.3, memo: '소아과 BCG 접종하면서 몸무게만 잼, 키는 누워서 안 재짐' },
]

export const storage: StorageUsage = { used_bytes: 4.6e9, limit_bytes: 5e9, warn_bytes: 4e9 }

const months: RoadmapProjection['months'] = Array.from({ length: 24 }, (_, i) => {
  const y = 2026 + Math.floor((i + 10) / 12)
  const m = ((i + 10) % 12) + 1
  const v = 900_000_000 + i * 18_000_000
  return {
    month: `${y}-${String(m).padStart(2, '0')}`, contribution_krw: 2_000_000, dividend_after_tax_krw: 180_000 + i * 3000,
    projected_net_worth_krw: v, actual_net_worth_krw: i < 2 ? v - 4_000_000 : null, actual_contribution_krw: i < 2 ? 1_850_000 : null,
  }
})
export const roadmapProjection: RoadmapProjection = {
  goal: { target_krw: 3_000_000_000, target_date: '2040-12-31', age_at_target: 50 },
  current: { net_worth_krw: 908_000_000, progress_pct: 30.3, days_left: 5158 },
  plan: { anchor_month: '2026-11', anchor_net_worth_krw: 900_000_000, price_growth: 0.07, total_return: 0.095 },
  required_price_growth: 0.061, current_dividend_yield: 0.034, required_total_return: 0.095,
  years: Array.from({ length: 15 }, (_, i) => ({
    year: 2026 + i, age: 36 + i, monthly_krw: 2_000_000, annual_contribution_krw: 24_000_000, dividend_after_tax_krw: 2_200_000 + i * 400_000,
    projected_net_worth_krw: 900_000_000 + i * 150_000_000, actual_net_worth_krw: i === 0 ? 908_000_000 : null,
  })),
  months,
}
export const roadmapAssumptions: RoadmapAssumptionsResponse = {
  assumptions: {
    id: 'r1', couple_id: C, goal_id: 'g1', price_growth: 0.07, dividend_tax_rate: 0.154, other_assets_krw: 841_200_000,
    contributions: [{ year: 2026, monthly_krw: 2_000_000 }, { year: 2030, monthly_krw: 3_000_000 }],
    dividend_plan: [{ symbol: 'SCHD', shares: 520, dps: 1.05, growth_start: 0.08, decay: 0.9, floor: 0.03, starts_year: 2026 }],
    dividend_symbols: ['SCHD'], updated_at: T,
  },
  dividend_candidates: [
    { symbol: 'SCHD', shares: 520, annual_dps: 1.05, yield: 0.037, cagr_3y: 0.08, selected: true, auto_include: true },
    { symbol: '005930', shares: 310, annual_dps: 1444, yield: 0.025, cagr_3y: 0.02, selected: false, auto_include: false },
  ],
}

export const categories = {
  expense: ['식비', '카페', '장보기', '아기용품·기저귀', '주거', '교통', '의료', '문화', '쇼핑', '경조사비', '기타'],
  income: ['급여', '부수입', '용돈', '배당', '기타'],
}

/** GET 경로 → 응답. 없는 경로는 null(호출부가 404 로 돌려준다). */
export function respond(path: string, q: URLSearchParams): unknown {
  const num = (k: string) => Number(q.get(k))
  switch (path) {
    case '/api/couple': return couple
    case '/api/me/permissions': return permissions
    case '/api/users': return users
    case '/api/members': return members
    case '/api/summary': return summary
    case '/api/transactions': {
      if (q.get('start_date')) return transactions.filter(t => t.date >= q.get('start_date')! && t.date <= q.get('end_date')!)
      const key = `${num('year')}-${String(num('month')).padStart(2, '0')}`
      return transactions.filter(t => t.date.startsWith(key))
    }
    case '/api/transactions/calendar-summary': return calendarSummary(num('year'), num('month'))
    case '/api/fixed-expenses': return fixedExpenses
    case '/api/fixed-expenses/summary': return feSummary
    case '/api/dividends/summary': return dividends
    case '/api/stocks/portfolio': return portfolio
    case '/api/assets': return otherAssets
    case '/api/stocks/transactions': return stockTransactions
    case '/api/schedules': return schedules
    case '/api/diaries': return diaries
    case '/api/baby': return baby
    case '/api/baby/moments': return moments
    case '/api/baby/growth': return growth
    case '/api/storage/usage': return storage
    case '/api/roadmap/projection': return roadmapProjection
    case '/api/roadmap/assumptions': return roadmapAssumptions
    case '/api/categories': return categories
    default: return null
  }
}
