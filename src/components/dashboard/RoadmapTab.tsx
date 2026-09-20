'use client';

import { useCallback, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type {
  RoadmapAssumptions,
  RoadmapAssumptionsResponse,
  RoadmapDividendCandidate,
  RoadmapProjection,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

const eok = (krw: number) => `${(krw / 100_000_000).toFixed(2)}억`;
const man = (krw: number) => `${Math.round(krw / 10_000).toLocaleString()}만`;

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey: string; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  const plan = payload.find(p => p.dataKey === 'plan')?.value;
  const actual = payload.find(p => p.dataKey === 'actual')?.value;
  return (
    <div className='rounded-xl bg-slate-800 px-3 py-2 text-white shadow-lg'>
      <p className='text-[10px] text-slate-300'>{label}</p>
      {plan != null && <p className='text-xs font-semibold tabular-nums'>계획 {eok(plan)}</p>}
      {actual != null && <p className='text-xs font-semibold tabular-nums text-emerald-300'>실적 {eok(actual)}</p>}
    </div>
  );
}

export default function RoadmapTab({ accessToken }: { accessToken?: string }) {
  const [data, setData] = useState<RoadmapProjection | null>(null);
  const [assumptions, setAssumptions] = useState<RoadmapAssumptions | null>(null);
  const [candidates, setCandidates] = useState<RoadmapDividendCandidate[]>([]);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [scale, setScale] = useState<'year' | 'month'>('month');
  const [tableScale, setTableScale] = useState<'year' | 'month'>('year');
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
      const body: RoadmapAssumptionsResponse = await a.json();
      setAssumptions(body.assumptions);
      setCandidates(body.dividend_candidates ?? []);
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
  // 월별은 앞으로 1년까지만 본다. 75개월을 한 화면에 그리면 계단이 뭉개진다.
  const chartData = scale === 'year'
    ? years.map(y => ({ label: String(y.year), plan: y.projected_net_worth_krw, actual: y.actual_net_worth_krw }))
    : (data.months ?? []).slice(0, 13).map(m => ({
        label: m.month.slice(2).replace('-', '.'), // 26.09
        plan: m.projected_net_worth_krw,
        actual: m.actual_net_worth_krw,
      }));

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
          <div className='h-full rounded-full bg-brand-300' style={{ width: `${Math.min(100, current.progress_pct)}%` }} />
        </div>
        <p className='mt-2 text-xs text-slate-300 tabular-nums'>{current.progress_pct.toFixed(1)}% 달성</p>
      </div>

      {/* ② 필요 수익률 */}
      <div className='bg-white rounded-3xl shadow-sm border border-slate-100 px-5 py-4'>
        <p className='text-xs font-semibold text-slate-400 tracking-wide uppercase'>필요 수익률</p>
        <p className='mt-1 text-xl font-black text-slate-800 tabular-nums'>{(data.required_total_return * 100).toFixed(2)}%</p>
      </div>

      {/* ③ 자산 추이 */}
      <div className='bg-white rounded-3xl shadow-sm border border-slate-100 px-5 py-4'>
        <div className='flex items-center justify-between mb-3'>
          <p className='text-xs font-semibold text-slate-400 tracking-wide uppercase'>자산 추이</p>
          <div className='flex items-center gap-3'>
            <div className='flex rounded-lg bg-slate-100 p-0.5'>
              {(['month', 'year'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                    scale === s ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
                  }`}
                >
                  {s === 'year' ? '연도' : '월'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <ResponsiveContainer width='100%' height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke='#F1F5F9' vertical={false} />
            <XAxis
              dataKey='label' tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false}
              interval='preserveStartEnd' minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `${(v / 100_000_000).toFixed(scale === 'month' ? 1 : 0)}억`}
              domain={scale === 'month' ? ['dataMin - 10000000', 'dataMax + 10000000'] : [0, 'auto']}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type={scale === 'month' ? 'stepAfter' : 'monotone'}
              dataKey='plan' stroke='#6366F1' strokeWidth={2} dot={false}
            />
            <Line
              type={scale === 'month' ? 'stepAfter' : 'monotone'}
              dataKey='actual' stroke='#10B981' strokeWidth={2} strokeDasharray='4 4' dot={{ r: 3 }} connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ④ 마일스톤 */}
      <div className='bg-white rounded-3xl shadow-sm border border-slate-100 px-5 py-4'>
        <div className='flex items-center justify-between mb-3'>
          <p className='text-xs font-semibold text-slate-400 tracking-wide uppercase'>마일스톤</p>
          <div className='flex rounded-lg bg-slate-100 p-0.5'>
            {(['month', 'year'] as const).map(s => (
              <button
                key={s}
                onClick={() => setTableScale(s)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                  tableScale === s ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400'
                }`}
              >
                {s === 'year' ? '연도' : '월'}
              </button>
            ))}
          </div>
        </div>
        <table className='w-full text-xs tabular-nums'>
          <thead>
            <tr className='text-slate-400'>
              <th className='text-left font-medium pb-2'>{tableScale === 'year' ? '연도' : '월'}</th>
              <th className='text-right font-medium pb-2'>적립</th>
              <th className='text-right font-medium pb-2'>세후 배당(예상)</th>
              <th className='text-right font-medium pb-2'>목표</th>
              <th className='text-right font-medium pb-2'>실적</th>
            </tr>
          </thead>
          <tbody>
            {tableScale === 'year'
              ? years.map(y => {
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
                })
              : (data.months ?? []).slice(0, 13).map((m, idx) => {
                  const diff = m.actual_net_worth_krw != null ? m.actual_net_worth_krw - m.projected_net_worth_krw : null;
                  // 첫 줄은 출발점이다. 이번 달 적립과 배당은 이미 현재 순자산에
                  // 들어 있어 계획에서 다시 더하지 않는다.
                  const isAnchor = idx === 0;
                  return (
                    <tr key={m.month} className='border-t border-slate-50'>
                      <td className='py-1.5 font-semibold text-slate-700'>
                        {m.month.replace('-', '.')}
                        {isAnchor && <span className='text-slate-300'> · 현재</span>}
                      </td>
                      <td className='text-right text-slate-500'>
                        <span>{isAnchor ? '반영됨' : m.contribution_krw > 0 ? man(m.contribution_krw) : '—'}</span>
                        {/* 실제로 넣은 돈: 저축 + 주식 순매수 */}
                        {m.actual_contribution_krw != null && (
                          <span
                            className={`block text-[10px] ${
                              m.actual_contribution_krw >= m.contribution_krw ? 'text-emerald-600' : 'text-rose-500'
                            }`}
                          >
                            실적 {man(m.actual_contribution_krw)}
                          </span>
                        )}
                      </td>
                      <td className='text-right text-slate-500'>{isAnchor ? '반영됨' : m.dividend_after_tax_krw > 0 ? man(m.dividend_after_tax_krw) : '—'}</td>
                      <td className='text-right font-semibold text-slate-700'>{eok(m.projected_net_worth_krw)}</td>
                      <td className={`text-right font-semibold ${diff == null ? 'text-slate-300' : diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {m.actual_net_worth_krw != null ? eok(m.actual_net_worth_krw) : '—'}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {tableScale === 'month' && (
          <p className='mt-2 text-[10px] text-slate-400'>
            이번 달 적립과 배당은 이미 현재 순자산에 들어 있어 계획에 다시 더하지 않습니다
          </p>
        )}
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
                    <div className='flex-1 flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-brand-500'>
                      <input
                        type='text'
                        inputMode='numeric'
                        // 만원 단위로 넣는다. 원 단위 0 여섯 개는 눈으로 세기 어렵다.
                        value={(c.monthly_krw / 10_000).toLocaleString('ko-KR')}
                        onChange={e => {
                          const man = Number(e.target.value.replace(/[^0-9]/g, ''));
                          const next = { ...assumptions, contributions: [...assumptions.contributions] };
                          next.contributions[i] = { ...c, monthly_krw: man * 10_000 };
                          setAssumptions(next);
                        }}
                        className='flex-1 min-w-0 text-xs text-right tabular-nums focus:outline-none'
                      />
                      <span className='text-xs text-slate-400 shrink-0'>만원</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className='text-xs font-semibold text-slate-500 mb-2'>배당 계산에 넣을 종목</p>
              <div className='space-y-1'>
                {candidates.map(c => (
                  <label key={c.symbol} className='flex items-center gap-2 py-1 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={c.selected}
                      onChange={e => {
                        const next = candidates.map(x =>
                          x.symbol === c.symbol ? { ...x, selected: e.target.checked } : x,
                        );
                        setCandidates(next);
                        setAssumptions({
                          ...assumptions,
                          dividend_symbols: next.filter(x => x.selected).map(x => x.symbol),
                        });
                      }}
                      className='w-4 h-4 rounded accent-brand-500'
                    />
                    <span className='text-xs font-semibold text-slate-600 w-14'>{c.symbol}</span>
                    <span className='text-xs text-slate-400 tabular-nums flex-1'>
                      {c.shares.toLocaleString()}주 · 배당률 {(c.yield * 100).toFixed(2)}% · 성장 {(c.cagr_3y * 100).toFixed(1)}%
                    </span>
                  </label>
                ))}
                {candidates.length === 0 && <p className='text-xs text-slate-300'>배당 내역이 있는 보유 종목이 없습니다</p>}
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
