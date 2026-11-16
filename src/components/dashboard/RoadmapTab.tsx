'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, PageTitle } from '@/components/ui/Card';
import { toastError } from '@/components/ui/Toast';
import { SectionError, SectionLoading, Spinner } from '@/components/ui/Loading';
import { AssumptionSlider, NextMilestoneCard, RoadmapHero } from '@/components/wealth/RoadmapCards';
import { apiFetch } from '@/lib/api';
import { todayKST } from '@/lib/date';
import { contributionFor } from '@/lib/roadmap';
import type {
  RoadmapAssumptions,
  RoadmapAssumptionsResponse,
  RoadmapDividendCandidate,
  RoadmapProjection,
} from '@/types';

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

export interface RoadmapPrefetch {
  projection: RoadmapProjection;
  assumptions: RoadmapAssumptions;
  candidates: RoadmapDividendCandidate[];
}

export default function RoadmapTab({
  accessToken,
  prefetched,
  canEdit,
  chips,
}: {
  accessToken?: string;
  // 대시보드가 미리 받아 둔 데이터. 있으면 첫 화면을 바로 그린다.
  prefetched?: RoadmapPrefetch | null;
  /** false 면 가정 편집 카드를 숨긴다(보기 전용). */
  canEdit: boolean;
  /** 2단 메뉴 칩 줄(제목 아래) */
  chips: ReactNode;
}) {
  const [data, setData] = useState<RoadmapProjection | null>(prefetched?.projection ?? null);
  const [assumptions, setAssumptions] = useState<RoadmapAssumptions | null>(prefetched?.assumptions ?? null);
  const [candidates, setCandidates] = useState<RoadmapDividendCandidate[]>(prefetched?.candidates ?? []);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [scale, setScale] = useState<'year' | 'month'>('month');
  const [tableScale, setTableScale] = useState<'year' | 'month'>('month');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const token = accessToken ?? '';
      const [p, a] = await Promise.all([
        apiFetch<RoadmapProjection>('/api/roadmap/projection', token),
        apiFetch<RoadmapAssumptionsResponse>('/api/roadmap/assumptions', token),
      ]);
      setData(p);
      setAssumptions(a.assumptions);
      setCandidates(a.dividend_candidates ?? []);
    } catch {
      setError('로드맵을 불러오지 못했습니다');
    }
  }, [accessToken]);

  useEffect(() => {
    if (prefetched) return; // 이미 받아 둔 데이터가 있으면 다시 부르지 않는다
    load();
  }, [load, prefetched]);

  async function saveAssumptions(next: RoadmapAssumptions) {
    setSaving(true);
    try {
      await apiFetch('/api/roadmap/assumptions', accessToken ?? '', { method: 'PUT', body: JSON.stringify(next) });
      await load();
    } catch (e) {
      toastError('가정 저장', e); // 화면은 그대로 두고 알린다
    } finally {
      setSaving(false);
    }
  }

  // 로딩·오류 중에도 제목과 칩(자산현황/로드맵)은 보인다
  const header = (
    <>
      <PageTitle eyebrow='자산' title='로드맵' right={saving ? <Spinner size='sm' label='새로 고치는 중' /> : undefined} />
      {chips}
    </>
  );
  // 처음 받기 실패만 화면을 바꾼다. 저장 뒤 다시 받기가 실패하면 있던 화면을 그대로 둔다
  if (!data || !assumptions) {
    return (
      <div className='space-y-3'>
        {header}
        {error ? <SectionError minH={240} onRetry={load} /> : <SectionLoading minH={240} />}
      </div>
    );
  }

  const { years } = data;
  const thisMonth = todayKST().slice(0, 7);
  // 저장·해마다 입력으로 기준값이 바뀌면 슬라이더를 처음 값으로 되돌린다
  const sliderKey = contributionFor(assumptions.contributions, Number(thisMonth.slice(0, 4)));
  // 이번 달 적립은 그 해 계획 월 적립으로 둔다. 주식 순매수 집계는 계좌 안에서
  // 옮긴 돈까지 잡아 실제로 새로 넣은 금액보다 크게 나온다.
  const anchorContributionKRW = years[0]?.monthly_krw ?? 0;
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
      {header}
      <RoadmapHero data={data} thisMonth={thisMonth} />
      <NextMilestoneCard data={data} />
      <AssumptionSlider
        key={sliderKey}
        data={data}
        assumptions={assumptions}
        canEdit={canEdit}
        saving={saving}
        thisMonth={thisMonth}
        onSave={saveAssumptions}
      />

      {/* ③ 자산 추이 */}
      <div className='bg-white rounded-card shadow-warm px-5 py-4'>
        <div className='flex items-center justify-between mb-3'>
          <p className='text-xs font-semibold text-stone-400 tracking-wide uppercase'>자산 추이</p>
          <div className='flex items-center gap-3'>
            <div className='flex rounded-lg bg-stone-100 p-0.5'>
              {(['month', 'year'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={`relative before:absolute before:content-[''] before:-inset-y-3 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                    scale === s ? 'bg-white text-stone-700 shadow-sm' : 'text-stone-400'
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
              dataKey='plan' stroke='#0F4C81' strokeWidth={2} dot={false}
            />
            <Line
              type={scale === 'month' ? 'stepAfter' : 'monotone'}
              dataKey='actual' stroke='#10B981' strokeWidth={2} strokeDasharray='4 4' dot={{ r: 3 }} connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ④ 마일스톤 */}
      <div className='bg-white rounded-card shadow-warm px-5 py-4'>
        <div className='flex items-center justify-between mb-3'>
          <p className='text-xs font-semibold text-stone-400 tracking-wide uppercase'>마일스톤</p>
          <div className='flex rounded-lg bg-stone-100 p-0.5'>
            {(['month', 'year'] as const).map(s => (
              <button
                key={s}
                onClick={() => setTableScale(s)}
                className={`relative before:absolute before:content-[''] before:-inset-y-3 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                  tableScale === s ? 'bg-white text-stone-700 shadow-sm' : 'text-stone-400'
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
                      {/* 적립은 실제로 넣은 돈이다. 아직 오지 않은 달은 비운다. */}
                      <td className='text-right text-slate-500'>
                        {isAnchor ? man(anchorContributionKRW) : '—'}
                      </td>
                      <td className='text-right text-slate-500'>{m.dividend_after_tax_krw > 0 ? man(m.dividend_after_tax_krw) : '—'}</td>
                      <td className='text-right font-semibold text-slate-700'>{eok(m.projected_net_worth_krw)}</td>
                      <td className={`text-right font-semibold ${diff == null ? 'text-slate-300' : diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {m.actual_net_worth_krw != null ? eok(m.actual_net_worth_krw) : '—'}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* ⑤ 가정 편집 */}
      {canEdit && (
      <div className='bg-white rounded-card shadow-warm px-5 py-4'>
        <button
          onClick={() => setShowAssumptions(v => !v)}
          className='w-full flex items-center justify-between'
        >
          <span className='text-xs font-semibold text-stone-400 tracking-wide uppercase'>가정 자세히 · 해마다 적립 · 배당 종목</span>
          <span className='text-xs text-stone-400'>{showAssumptions ? '접기' : '펼치기'}</span>
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
              {saving ? '저장 중...' : '저장하고 계획 다시 세우기'}
            </button>
            <p className='text-[10px] text-slate-400 text-center'>저장하면 이번 달 자산에서 계획을 새로 세웁니다</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
