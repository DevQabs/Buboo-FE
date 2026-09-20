'use client';

import { useEffect, useState } from 'react';
import type { RoadmapProjection } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

function fmtEok(krw: number) {
  return `${(krw / 100_000_000).toFixed(2)}억`;
}

export default function RoadmapTab({ accessToken }: { accessToken?: string }) {
  const [data, setData] = useState<RoadmapProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/roadmap/projection`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(setData)
      .catch(() => setError('로드맵을 불러오지 못했습니다'));
  }, [accessToken]);

  if (error) {
    return (
      <div className='bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-10 text-center'>
        <p className='text-sm font-medium text-slate-400'>{error}</p>
      </div>
    );
  }
  if (!data) {
    return <div className='bg-white rounded-2xl shadow-sm border border-slate-100 h-40 animate-pulse' />;
  }

  const { goal, current } = data;

  return (
    <div className='space-y-3'>
      {/* ① 목표 히어로 */}
      <div className='rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-white px-5 py-5'>
        <p className='text-xs text-slate-300'>{goal.target_date.slice(0, 7)} · 만 {goal.age_at_target}세</p>
        <p className='mt-1 text-2xl font-black tabular-nums'>
          {fmtEok(current.net_worth_krw)}
          <span className='text-base font-semibold text-slate-400'> / {fmtEok(goal.target_krw)}</span>
        </p>
        <div className='mt-3 h-2 rounded-full bg-white/15 overflow-hidden'>
          <div
            className='h-full rounded-full bg-brand-400'
            style={{ width: `${Math.min(100, current.progress_pct)}%` }}
          />
        </div>
        <p className='mt-2 text-xs text-slate-300 tabular-nums'>
          {current.progress_pct.toFixed(1)}% · D-{current.days_left.toLocaleString()}
        </p>
      </div>

      {/* ② 필요 수익률 */}
      <div className='bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4'>
        <p className='text-xs font-semibold text-slate-400 tracking-wide uppercase'>필요 수익률</p>
        <p className='mt-1 text-xl font-black text-slate-800 tabular-nums'>
          {(data.required_total_return * 100).toFixed(2)}%
        </p>
        <p className='mt-0.5 text-xs text-slate-400 tabular-nums'>
          가격 {(data.required_price_growth * 100).toFixed(2)}% + 배당 {(data.current_dividend_yield * 100).toFixed(2)}%
        </p>
      </div>
    </div>
  );
}
