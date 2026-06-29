'use client';

import { useState, useMemo } from 'react';
import { XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/outline';
import type { StockTransaction, User } from '@/types';

interface TradeHistoryModalProps {
  transactions: StockTransaction[];
  users: User[];
  exchangeRate: number;
  onClose: () => void;
}

const BASIC_DEDUCTION_KRW = 2_500_000;
const TAX_RATE = 0.22;

type YearSummary = { year: number; grossKRW: number; taxKRW: number; afterTaxKRW: number };

function pnlToKRW(tx: StockTransaction, fallbackRate: number): number {
  // New system: exchange_rate_at_tx > 0 → realized_pnl is already KRW
  // Legacy: exchange_rate_at_tx === 0 → convert via fallbackRate
  if (tx.exchange_rate_at_tx > 0) return tx.realized_pnl;
  return tx.currency === 'USD' ? tx.realized_pnl * fallbackRate : tx.realized_pnl;
}

function calcAfterTaxByYear(txs: StockTransaction[], exchangeRate: number): YearSummary[] {
  const byYear = new Map<number, number>();
  for (const tx of txs) {
    if (tx.type !== 'sell') continue;
    const year = new Date(tx.executed_at).getFullYear();
    const krw = pnlToKRW(tx, exchangeRate);
    byYear.set(year, (byYear.get(year) ?? 0) + krw);
  }
  return Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, grossKRW]) => {
      if (grossKRW <= 0) return { year, grossKRW, taxKRW: 0, afterTaxKRW: grossKRW };
      const taxKRW = Math.max(0, grossKRW - BASIC_DEDUCTION_KRW) * TAX_RATE;
      return { year, grossKRW, taxKRW, afterTaxKRW: grossKRW - taxKRW };
    });
}

function sumAfterTax(summaries: YearSummary[]) {
  return summaries.reduce((s, y) => s + y.afterTaxKRW, 0);
}

function sumGross(txs: StockTransaction[], exchangeRate: number) {
  return txs
    .filter(t => t.type === 'sell')
    .reduce((s, t) => s + pnlToKRW(t, exchangeRate), 0);
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

export default function TradeHistoryModal({ transactions, users, exchangeRate, onClose }: TradeHistoryModalProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set()); // 기본 접힘

  const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);

  const userStats = useMemo(() => {
    return users.map(u => {
      const userTxs = transactions.filter(t => t.user_id === u.id);
      const yearSummaries = calcAfterTaxByYear(userTxs, exchangeRate);
      const afterTaxKRW = sumAfterTax(yearSummaries);
      const grossKRW = sumGross(userTxs, exchangeRate);
      const hasSells = userTxs.some(t => t.type === 'sell');
      return { user: u, yearSummaries, afterTaxKRW, grossKRW, hasSells };
    });
  }, [users, transactions, exchangeRate]);

  const totalAfterTaxKRW = useMemo(
    () => userStats.reduce((s, u) => s + u.afterTaxKRW, 0),
    [userStats]
  );

  const hasSells = transactions.some(t => t.type === 'sell');

  const filtered = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
    );
    if (filter === 'all') return sorted;
    return sorted.filter(t => t.type === filter);
  }, [transactions, filter]);

  function toggleUser(userId: string) {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center">
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
          <div className="mx-5 mb-3 rounded-2xl bg-slate-50 p-4 shrink-0 space-y-2">
            {/* Per-user rows (collapsible) */}
            {userStats.map(({ user, yearSummaries, afterTaxKRW, grossKRW, hasSells: userHasSells }) => {
              const isExpanded = expandedUsers.has(user.id);
              return (
                <div key={user.id} className="rounded-xl overflow-hidden">
                  {/* Collapsed header row — always visible */}
                  <button
                    type="button"
                    onClick={() => toggleUser(user.id)}
                    className="w-full flex items-center justify-between py-2 px-0 group"
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: user.avatar_color }}
                      >
                        {user.name[0]}
                      </div>
                      <span className="text-xs font-semibold text-slate-600">{user.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {userHasSells && (
                        <span className={`text-sm font-bold tabular-nums ${afterTaxKRW >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {fmtKRW(afterTaxKRW)}
                          <span className="text-[10px] font-normal text-slate-400 ml-1">세후</span>
                        </span>
                      )}
                      {!userHasSells && (
                        <span className="text-xs text-slate-400">매도 없음</span>
                      )}
                      <ChevronDownIcon
                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && userHasSells && (
                    <div className="pl-6 pb-2 space-y-1.5">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-slate-400">세전 실현손익</p>
                          <p className={`text-sm font-semibold tabular-nums ${grossKRW >= 0 ? 'text-slate-600' : 'text-rose-400'}`}>
                            {fmtKRW(grossKRW)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">세후 실현손익</p>
                          <p className={`text-sm font-bold tabular-nums ${afterTaxKRW >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {fmtKRW(afterTaxKRW)}
                          </p>
                        </div>
                      </div>
                      {yearSummaries.map(ys => (
                        <p key={ys.year} className="text-[10px] text-slate-400">
                          {ys.year}년 기본공제 250만 → 세금 {ys.taxKRW > 0 ? fmtKRW(-ys.taxKRW) : '없음'}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Combined total */}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <p className="text-xs font-semibold text-slate-500">합산 세후 실현손익</p>
              <p className={`text-lg font-bold tabular-nums ${totalAfterTaxKRW >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {fmtKRW(totalAfterTaxKRW)}
              </p>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 px-5 mb-3 shrink-0">
          {(['all', 'buy', 'sell'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
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
                const pnlKRW = pnlToKRW(tx, exchangeRate);
                const txUser = userMap[tx.user_id];

                return (
                  <li key={tx.id} className="px-5 py-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isBuy ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      {isBuy
                        ? <ArrowTrendingUpIcon className="w-4 h-4 text-emerald-500" />
                        : <ArrowTrendingDownIcon className="w-4 h-4 text-rose-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-800">{tx.symbol}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isBuy ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                          {isBuy ? '매수' : '매도'}
                        </span>
                        {txUser && (
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                            style={{ backgroundColor: txUser.avatar_color }}
                          >
                            {txUser.name[0]}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {fmtDate(tx.executed_at)} · {tx.quantity}주 · {tx.currency === 'USD' ? `$${tx.price.toFixed(2)}` : `₩${tx.price.toLocaleString()}`}
                        {tx.memo && ` · ${tx.memo}`}
                      </p>
                    </div>

                    {!isBuy && (
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${pnlKRW >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {fmtKRW(pnlKRW)}
                        </p>
                        {tx.exchange_rate_at_tx > 0 && tx.currency === 'USD' && (
                          <p className="text-[10px] text-slate-400 tabular-nums">
                            @{tx.exchange_rate_at_tx.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원
                          </p>
                        )}
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
