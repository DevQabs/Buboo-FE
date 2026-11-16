'use client'

// 로드맵 A 윗부분(시안 roadmap-a): 달성 게이지 + 계획 대비, 다음 마일스톤, 가정 슬라이더.
import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { formatMan } from '@/lib/formatNumber'
import { aheadOfPlan, contributionFor, monthsBetween, nextMilestone, previewReachMonth, shiftContributions } from '@/lib/roadmap'
import type { RoadmapAssumptions, RoadmapProjection } from '@/types'

const ymLabel = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`

export function RoadmapHero({ data, thisMonth }: { data: RoadmapProjection; thisMonth: string }) {
  const pct = Math.max(0, Math.min(100, data.current.progress_pct))
  const ahead = aheadOfPlan(data.current.net_worth_krw, data.months ?? [], thisMonth)
  return (
    <Card className="px-4 py-5 text-center">
      <div
        className="mx-auto flex h-32 w-32 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(#0F4C81 0 ${pct}%, #F5EFE6 ${pct}% 100%)` }}
      >
        <div className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full bg-white">
          <span className="text-2xl font-black tabular-nums text-brand-500">{data.current.progress_pct.toFixed(1)}%</span>
          <span className="text-xs text-stone-400">{formatMan(data.goal.target_krw)} 목표</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-stone-700">
        <span className="font-bold">{ymLabel(data.goal.target_date.slice(0, 7))}</span> · 만 {data.goal.age_at_target}세 · D-{data.current.days_left.toLocaleString('ko-KR')}
      </p>
      <p className="text-xs tabular-nums text-stone-400">지금 {formatMan(data.current.net_worth_krw)}</p>
      {ahead != null && (
        <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${ahead >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
          계획보다 {formatMan(Math.abs(ahead))} {ahead >= 0 ? '앞서는 중' : '뒤처지는 중'}
        </span>
      )}
    </Card>
  )
}

export function NextMilestoneCard({ data }: { data: RoadmapProjection }) {
  const nw = data.current.net_worth_krw
  const next = nextMilestone(nw, data.goal.target_krw, data.months ?? [])
  const plan = data.plan
  // 계획보다 뒤처지면 더 벌어야 하니 빨강, 앞서면 초록(옛 ② 카드 규칙)
  const behind = plan != null && data.required_total_return > plan.total_return
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-stone-400">다음 마일스톤</p>
      {next ? (
        <>
          <div className="mt-0.5 flex items-center justify-between">
            <span className="text-base font-bold text-stone-800">{formatMan(next.amount)}</span>
            <span className="text-xs text-stone-400">{next.month ? `${ymLabel(next.month)} 예상` : '계획 기간 밖'}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand">
            <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (nw / next.amount) * 100)}%` }} />
          </div>
        </>
      ) : (
        <p className="mt-0.5 text-sm font-bold text-emerald-600">목표에 닿았어요</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-2.5">
        {plan && (
          <div>
            <p className="text-xs text-stone-400">계획 수익률</p>
            <p className="text-sm font-black tabular-nums text-stone-800">연 {(plan.total_return * 100).toFixed(2)}%</p>
            <p className="text-[10px] tabular-nums text-stone-400">
              {plan.anchor_month.replace('-', '.')} {formatMan(plan.anchor_net_worth_krw)} 출발 · 고정
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-stone-400">지금부터 필요</p>
          <p className={`text-sm font-black tabular-nums ${plan ? (behind ? 'text-rose-500' : 'text-emerald-600') : 'text-stone-800'}`}>
            연 {(data.required_total_return * 100).toFixed(2)}%
          </p>
          <p className="text-[10px] text-stone-400">현재 순자산 기준</p>
        </div>
      </div>
    </Card>
  )
}

export function AssumptionSlider({ data, assumptions, canEdit, saving, thisMonth, onSave }: {
  data: RoadmapProjection
  assumptions: RoadmapAssumptions
  canEdit: boolean
  saving: boolean
  thisMonth: string
  onSave: (next: RoadmapAssumptions) => Promise<void>
}) {
  const base = contributionFor(assumptions.contributions, Number(thisMonth.slice(0, 4)))
  const [value, setValue] = useState(base)
  const delta = value - base
  const max = Math.max(5_000_000, Math.ceil((base * 2) / 1_000_000) * 1_000_000)
  const common = {
    startMonth: thisMonth,
    netWorth: data.current.net_worth_krw,
    target: data.goal.target_krw,
    annualReturn: data.plan?.total_return ?? data.required_total_return,
    contributions: assumptions.contributions,
  }
  const before = previewReachMonth({ ...common, delta: 0 })
  const after = previewReachMonth({ ...common, delta })
  const faster = before && after ? monthsBetween(after, before) : null // +면 빨라짐

  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-stone-400">가정 · 바로 조정</p>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="text-stone-600">월 적립(올해)</span>
        <span className="font-bold tabular-nums text-stone-800">{formatMan(value)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={100_000}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        aria-label="월 적립"
        className="mt-2 w-full accent-brand-500"
      />
      <p className="mt-1 text-xs text-stone-500">
        {after ? `목표 도달 ${ymLabel(after)} 예상` : '50년 안에 닿지 않아요'}
        {faster != null && faster !== 0 && (
          <span className={faster > 0 ? 'text-emerald-600' : 'text-rose-500'}> · {Math.abs(faster)}개월 {faster > 0 ? '빨라요' : '늦어요'}</span>
        )}
      </p>
      <p className="text-[10px] text-stone-400">움직이면 바로 보이는 어림값이에요. 저장하면 계획을 다시 세워요.</p>
      {canEdit && delta !== 0 && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setValue(base)} className="flex-1 rounded-xl bg-stone-100 py-2 text-xs font-semibold text-stone-600">
            되돌리기
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave({ ...assumptions, contributions: shiftContributions(assumptions.contributions, delta) })}
            className="flex-1 rounded-xl bg-brand-500 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {saving ? '저장 중...' : '모든 해에 적용하고 저장'}
          </button>
        </div>
      )}
    </Card>
  )
}
