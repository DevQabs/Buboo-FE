'use client';

import { useState, useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import type { StockTransaction } from '@/types';

interface TradeHistoryModalProps {
  transactions: StockTransaction[];
  exchangeRate: number;
  onClose: () => void;
}

const BASIC_DEDUCTION_KRW = 2_500_000;
const TAX_RATE = 0.22;

type YearSummary = {
  year: number;
  grossKRW: number;
  taxKRW: number;
  afterTaxKRW: number;
};

function calcAfterTaxByYear(transactions: StockTransaction[], exchangeRate: number): YearSummary[] {
  const sellsByYear = new Map<number, number>();

  for (const tx of transactions) {
    if (tx.type !== 'sell') continue;
    const year = new Date(tx.executed_at).getFullYear();
    const krw = tx.currency === 'USD' ? tx.realized_pnl * exchangeRate : tx.realized_pnl;
    sellsByYear.set(year, (sellsByYear.get(year) ?? 0) + krw);
  }

  return Array.from(sellsByYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, grossKRW]) => {
      if (grossKRW <= 0) return { year, grossKRW, taxKRW: 0, afterTaxKRW: grossKRW };
      const taxableKRW = Math.max(0, grossKRW - BASIC_DEDUCTION_KRW);
      const taxKRW = taxableKRW * TAX_RATE;
      return { year, grossKRW, taxKRW, afterTaxKRW: grossKRW - taxKRW };
    });
}

function fmtKRW(val: number): string {
  const abs = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  if (abs >= 100_000_000) return `${sign}₩${(abs / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${sign}₩${Math.round(abs / 10_000).toLocaleString()}만`;
  return `${sign}₩${Math.round(abs).toLocaleString()}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear().toString().slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

type FilterType = 'all' | 'buy' | 'sell';

export default function TradeHistoryModal({ transactions, exchangeRate, onClose }: TradeHistoryModalProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const yearSummaries = useMemo(
    () => calcAfterTaxByYear(transactions, exchangeRate),
    [transactions, exchangeRate]
  );

  const totalAfterTaxKRW = useMemo(
    () => yearSummaries.reduce((s, y) => s + y.afterTaxKRW, 0),
    [yearSummaries]
  );

  const totalGrossKRW = useMemo(() => {
    return transactions
      .filter(t => t.type === 'sell')
      .reduce((s, t) => {
        const krw = t.currency === 'USD' ? t.realized_pnl * exchangeRate : t.realized_pnl;
        return s + krw;
      }, 0);
  }, [transactions, exchangeRate]);

  const filtered = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
    );
    if (filter === 'all') return sorted;
    return sorted.filter(t => t.type === filter);
  }, [transactions, filter]);

  const hasSells = transactions.some(t => t.type === 'sell');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h3 className="text-base font-bold text-slate-800">매매 이력</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <XMarkIcon className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Summary bar */}
        {hasSells && (
          <div className="mx-5 mb-3 rounded-2xl bg-slate-50 p-4 shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">세후 실현손익</p>
                <p className={`text-xl font-bold tabular-nums ${totalAfterTaxKRW >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {fmtKRW(totalAfterTaxKRW)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 mb-0.5">세전 실현손익</p>
                <p className={`text-sm font-semibold tabular-nums ${totalGrossKRW >= 0 ? 'text-slate-600' : 'text-rose-400'}`}>
                  {fmtKRW(totalGrossKRW)}
                </p>
              </div>
            </div>

            {/* Per-year tax breakdown */}
            {yearSummaries.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                {yearSummaries.map(ys => (
                  <div key={ys.year} className="flex justify-between text-xs text-slate-500">
                    <span>{ys.year}년 기본공제 250만원 적용</span>
                    <span>
                      세금 {ys.taxKRW > 0 ? fmtKRW(-ys.taxKRW) : '없음'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 px-5 mb-3 shrink-0">
          {(['all', 'buy', 'sell'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? '전체' : f === 'buy' ? '매수' : '매도'}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 self-center">{filtered.length}건</span>
        </div>

        {/* Transaction list */}
        <div className="overflow-y-auto flex-1 pb-safe">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">내역이 없습니다</div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {filtered.map(tx => {
                const isBuy = tx.type === 'buy';
                const pnlKRW = tx.currency === 'USD'
                  ? tx.realized_pnl * exchangeRate
                  : tx.realized_pnl;

                return (
                  <li key={tx.id} className="px-5 py-3 flex items-center gap-3">
                    {/* Type icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isBuy ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      {isBuy
                        ? <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-500" />
                        : <ArrowTrendingDownIcon className="w-4 h-4 text-rose-500" />}
                    </div>

                    {/* Symbol + date */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-800">{tx.symbol}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isBuy ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                          {isBuy ? '매수' : '매도'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fmtDate(tx.executed_at)} · {tx.quantity}주 · {tx.currency === 'USD' ? `$${tx.price.toFixed(2)}` : `₩${tx.price.toLocaleString()}`}
                        {tx.memo && ` · ${tx.memo}`}
                      </p>
                    </div>

                    {/* P&L (sell only) */}
                    {!isBuy && (
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${pnlKRW >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {tx.currency === 'USD'
                            ? `${tx.realized_pnl >= 0 ? '+' : ''}$${tx.realized_pnl.toFixed(2)}`
                            : fmtKRW(tx.realized_pnl)}
                        </p>
                        <p className="text-[10px] text-slate-400 tabular-nums">
                          {fmtKRW(pnlKRW)}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
