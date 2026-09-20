'use client';

import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { RoadmapAssumptions, RoadmapProjection } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

const eok = (krw: number) => `${(krw / 100_000_000).toFixed(2)}억`;
const man = (krw: number) => `${Math.round(krw / 10_000).toLocaleString()}만`;

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  label?: number;
  payload?: Array<{ dataKey: string; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  const plan = payload.find(p => p.dataKey === 'plan')?.value;
  const actual = payload.find(p => p.dataKey === 'actual')?.value;
  return (
    <div className='rounded-xl bg-slate-800 px-3 py-2 text-white shadow-lg'>
      <p className='text-[10px] text-slate-300'>{label}년</p>
      {plan != null && <p className='text-xs font-semibold tabular-nums'>계획 {eok(plan)}</p>}
      {actual != null && <p className='text-xs font-semibold tabular-nums text-brand-300'>실적 {eok(actual)}</p>}
    </div>
  );
}

export default function RoadmapTab({ accessToken }: { accessToken?: string }) {
  const [data, setData] = useState<RoadmapProjection | null>(null);
  const [assumptions, setAssumptions] = useState<RoadmapAssumptions | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback(
    (): HeadersInit => ({
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    }),
    [accessToken],
  );

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        fetch(`${API_BASE}/api/roadmap/projection`, { headers: headers() }),
        fetch(`${API_BASE}/api/roadmap/assumptions`, { headers: headers() }),
      ]);
      if (!p.ok || !a.ok) throw new Error('load failed');
      setData(await p.json());
      setAssumptions(await a.json());
    } catch {
      setError('로드맵을 불러오지 못했습니다');
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  async function saveAssumptions(next: RoadmapAssumptions) {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/roadmap/assumptions`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError('가정을 저장하지 못했습니다');
    } finally {
      setSaving(false);
    }
  }

  async function recordSnapshot() {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/roadmap/snapshot`, { method: 'POST', headers: headers() });
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <div className='bg-white rounded-3xl shadow-sm border border-slate-100 px-5 py-10 text-center'>
        <p className='text-sm font-medium text-slate-400'>{error}</p>
      </div>
    );
  }
  if (!data || !assumptions) {
    return <div className='bg-white rounded-3xl shadow-sm border border-slate-100 h-40 animate-pulse' />;
  }

  const { goal, current, years } = data;
  const chartData = years.map(y => ({ year: y.year, plan: y.projected_net_worth_krw, actual: y.actual_net_worth_krw }));

  return (
    <div className='space-y-3'>
      {/* ① 목표 히어로 */}
      <div className='rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-white px-5 py-5'>
        <div className='flex items-baseline justify-between'>
          <p className='text-xs text-slate-300'>{goal.target_date.slice(0, 7).replace('-', '년 ')}월 · 만 {goal.age_at_target}세</p>
          <p className='text-xs text-slate-300 tabular-nums'>D-{current.days_left.toLocaleString()}</p>
        </div>
        <p className='mt-1 text-2xl font-black tabular-nums'>
          {eok(current.net_worth_krw)}
          <span className='text-base font-semibold text-slate-400'> / {eok(goal.target_krw)}</span>
        </p>
        <div className='mt-3 h-2 rounded-full bg-white/15 overflow-hidden'>
          <div className='h-full rounded-full bg-brand-400' style={{ width: `${Math.min(100, current.progress_pct)}%` }} />
        </div>
        <p className='mt-2 text-xs text-slate-300 tabular-nums'>{current.progress_pct.toFixed(1)}% 달성</p>
      </div>

      {/* ② 필요 수익률 */}
      <div className='bg-white rounded-3xl shadow-sm border border-slate-100 px-5 py-4'>
        <p className='text-xs font-semibold text-slate-400 tracking-wide uppercase'>필요 수익률</p>
        <p className='mt-1 text-xl font-black text-slate-800 tabular-nums'>{(data.required_total_return * 100).toFixed(2)}%</p>
        <p className='mt-0.5 text-xs text-slate-400 tabular-nums'>
          가격 {(data.required_price_growth * 100).toFixed(2)}% + 배당 {(data.current_dividend_yield * 100).toFixed(2)}%
        </p>
      </div>

      {/* ③ 자산 추이 */}
      <div className='bg-white rounded-3xl shadow-sm border border-slate-100 px-5 py-4'>
        <div className='flex items-center justify-between mb-3'>
          <p className='text-xs font-semibold text-slate-400 tracking-wide uppercase'>자산 추이</p>
          <button
            onClick={recordSnapshot}
            disabled={saving}
            className='text-xs font-semibold text-brand-600 disabled:opacity-40'
          >
            이번 달 실적 기록
          </button>
        </div>
        <ResponsiveContainer width='100%' height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke='#F1F5F9' vertical={false} />
            <XAxis dataKey='year' tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `${(v / 100_000_000).toFixed(0)}억`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line type='monotone' dataKey='plan' stroke='#6366F1' strokeWidth={2} dot={false} />
            <Line type='monotone' dataKey='actual' stroke='#10B981' strokeWidth={2} strokeDasharray='4 4' dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ④ 연도별 마일스톤 */}
      <div className='bg-white rounded-3xl shadow-sm border border-slate-100 px-5 py-4'>
        <p className='text-xs font-semibold text-slate-400 tracking-wide uppercase mb-3'>연도별 마일스톤</p>
        <table className='w-full text-xs tabular-nums'>
          <thead>
            <tr className='text-slate-400'>
              <th className='text-left font-medium pb-2'>연도</th>
              <th className='text-right font-medium pb-2'>월 적립</th>
              <th className='text-right font-medium pb-2'>배당</th>
              <th className='text-right font-medium pb-2'>목표</th>
              <th className='text-right font-medium pb-2'>실적</th>
            </tr>
          </thead>
          <tbody>
            {years.map(y => {
              const diff = y.actual_net_worth_krw != null ? y.actual_net_worth_krw - y.projected_net_worth_krw : null;
              return (
                <tr key={y.year} className='border-t border-slate-50'>
                  <td className='py-1.5 font-semibold text-slate-700'>{y.year}<span className='text-slate-300'> · {y.age}세</span></td>
                  <td className='text-right text-slate-500'>{man(y.monthly_krw)}</td>
                  <td className='text-right text-slate-500'>{man(y.dividend_after_tax_krw)}</td>
                  <td className='text-right font-semibold text-slate-700'>{eok(y.projected_net_worth_krw)}</td>
                  <td className={`text-right font-semibold ${diff == null ? 'text-slate-300' : diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {y.actual_net_worth_krw != null ? eok(y.actual_net_worth_krw) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ⑤ 가정 편집 */}
      <div className='bg-white rounded-3xl shadow-sm border border-slate-100 px-5 py-4'>
        <button
          onClick={() => setShowAssumptions(v => !v)}
          className='w-full flex items-center justify-between'
        >
          <span className='text-xs font-semibold text-slate-400 tracking-wide uppercase'>가정</span>
          <span className='text-xs text-slate-400'>{showAssumptions ? '접기' : '펼치기'}</span>
        </button>

        {showAssumptions && (
          <div className='mt-4 space-y-4'>
            <div>
              <p className='text-xs font-semibold text-slate-500 mb-2'>월 적립</p>
              <div className='space-y-1.5'>
                {assumptions.contributions.map((c, i) => (
                  <div key={c.year} className='flex items-center gap-2'>
                    <span className='text-xs text-slate-500 w-12 tabular-nums'>{c.year}</span>
                    <input
                      type='number'
                      value={c.monthly_krw}
                      onChange={e => {
                        const next = { ...assumptions, contributions: [...assumptions.contributions] };
                        next.contributions[i] = { ...c, monthly_krw: Number(e.target.value) };
                        setAssumptions(next);
                      }}
                      className='flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500'
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className='text-xs font-semibold text-slate-500 mb-2'>배당 (주당 배당 · 시작 인상률 · 연 감속 · 하한)</p>
              <div className='space-y-1.5'>
                {assumptions.dividend_plan.map((d, i) => (
                  <div key={d.symbol} className='flex items-center gap-1.5'>
                    <span className='text-xs font-semibold text-slate-600 w-12'>{d.symbol}</span>
                    {(['dps', 'growth_start', 'decay', 'floor'] as const).map(field => (
                      <input
                        key={field}
                        type='number'
                        step='0.0001'
                        value={d[field]}
                        onChange={e => {
                          const next = { ...assumptions, dividend_plan: [...assumptions.dividend_plan] };
                          next.dividend_plan[i] = { ...d, [field]: Number(e.target.value) };
                          setAssumptions(next);
                        }}
                        className='flex-1 min-w-0 border border-slate-200 rounded-xl px-2 py-1.5 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500'
                      />
                    ))}
                  </div>
                ))}
                {assumptions.dividend_plan.length === 0 && (
                  <p className='text-xs text-slate-300'>등록된 배당 종목이 없습니다</p>
                )}
              </div>
            </div>

            <button
              onClick={() => saveAssumptions(assumptions)}
              disabled={saving}
              className='w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-40'
            >
              {saving ? '저장 중...' : '저장하고 다시 계산'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
