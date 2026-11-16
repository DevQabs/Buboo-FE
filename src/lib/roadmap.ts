// 로드맵 A 계산(설계서 7절). 런타임 import 없음.
import type { RoadmapContribution, RoadmapMonthPoint } from '@/types'

type MonthPoint = Pick<RoadmapMonthPoint, 'month' | 'projected_net_worth_krw'>

const STEP = 100_000_000 // 마일스톤 단위 1억

/** 지금 순자산 바로 위 1억 단위 금액(목표를 넘지 않음)과 계획선이 처음 그 금액에 닿는 달. 목표에 닿았으면 null. */
export function nextMilestone(netWorth: number, target: number, months: MonthPoint[]): { amount: number; month: string | null } | null {
  if (netWorth >= target) return null
  const amount = Math.min(target, (Math.floor(netWorth / STEP) + 1) * STEP)
  return { amount, month: months.find(m => m.projected_net_worth_krw >= amount)?.month ?? null }
}

/** 이번 달 계획선 대비 차이(+면 앞섬). 계획선에 이번 달이 없으면 null. */
export function aheadOfPlan(netWorth: number, months: MonthPoint[], thisMonth: string): number | null {
  const m = months.find(p => p.month === thisMonth)
  return m ? netWorth - m.projected_net_worth_krw : null
}

/** 슬라이더 기준값: 그 해 월 적립, 그 해가 없으면 첫 해. */
export function contributionFor(cs: RoadmapContribution[], year: number): number {
  return cs.find(c => c.year === year)?.monthly_krw ?? cs[0]?.monthly_krw ?? 0
}

/**
 * 월 적립을 delta 만큼 바꿨을 때 목표에 닿는 달("YYYY-MM")을 어림한다. 못 닿으면 null.
 * 그 해 적립이 없으면 0 — 서버 service.monthlyContribution 과 같은 규칙.
 * ponytail: 배당 일정·종목별 성장을 빼고 연 수익률 하나로 굴리는 어림이다. 정확한 궤적은
 * 저장 뒤 서버 계획선(service.Project)이 다시 낸다. 화면은 delta=0 과 같은 식으로 견줘 차이만 보인다.
 */
export function previewReachMonth(o: {
  startMonth: string
  netWorth: number
  target: number
  annualReturn: number
  contributions: RoadmapContribution[]
  delta: number
  maxMonths?: number
}): string | null {
  const growth = Math.pow(1 + o.annualReturn, 1 / 12)
  let [y, m] = o.startMonth.split('-').map(Number)
  let v = o.netWorth
  for (let i = 0; i < (o.maxMonths ?? 600); i++) {
    m += 1
    if (m > 12) { m = 1; y += 1 }
    const c = (o.contributions.find(x => x.year === y)?.monthly_krw ?? 0) + o.delta
    v = (v + Math.max(0, c)) * growth
    if (v >= o.target) return `${y}-${String(m).padStart(2, '0')}`
  }
  return null
}

/** 모든 해 월 적립에 delta 를 더한다(0 아래로는 내리지 않는다). */
export function shiftContributions(cs: RoadmapContribution[], delta: number): RoadmapContribution[] {
  return cs.map(c => ({ ...c, monthly_krw: Math.max(0, c.monthly_krw + delta) }))
}

/** "YYYY-MM" 두 달 차이(b − a). */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by * 12 + bm) - (ay * 12 + am)
}
