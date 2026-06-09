'use client';

import { useState, useRef, useCallback } from 'react';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PencilSquareIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { PlusIcon } from '@heroicons/react/24/solid';
import type { StockAssetWithPrice, User, PortfolioSummary } from '@/types';

interface StockPortfolioCardProps {
  assets: StockAssetWithPrice[];
  users: User[];
  summary?: PortfolioSummary | null;
  onAddClick?: () => void;
  onEditClick?: (asset: StockAssetWithPrice) => void;
  onBuySellClick?: (asset: StockAssetWithPrice, mode: 'buy' | 'sell') => void;
  /** Returns true if deleted (quantity reached 0 or forced), false if only updated */
  onDeleteClick?: (asset: StockAssetWithPrice) => void;
}

function formatCurrency(value: number, currency: string): string {
  if (currency === 'KRW') return `₩${value.toLocaleString()}`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatKRW(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2)}억원`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000).toLocaleString()}만원`;
  return `${sign}${abs.toLocaleString()}원`;
}

// ─── KRW 플래시 카드 (롱프레스 시 종목 row 내 오버레이) ──────────────────────────

function KRWFlashCard({
  asset,
  onClose,
}: {
  asset: StockAssetWithPrice;
  onClose: () => void;
}) {
  const valueKRW = asset.current_value_krw ?? 0;
  const pnlKRW   = asset.profit_loss_krw   ?? 0;
  const pnlPct   = asset.profit_loss_pct   ?? 0;
  const costKRW  = valueKRW - pnlKRW;
  const isUp     = pnlKRW >= 0;

  return (
    <div className='absolute inset-0 bg-white z-10 flex flex-col justify-center px-3 py-2'>
      {/* 상단: symbol + 환율 + 닫기 */}
      <div className='flex items-center justify-between mb-1'>
        <div className='flex items-center gap-1.5 min-w-0'>
          <span className='text-[10px] font-bold text-indigo-600 bg-indigo-50 rounded-lg px-1.5 py-0.5 flex-shrink-0'>
            {asset.symbol}
          </span>
          {asset.currency !== 'KRW' && asset.exchange_rate && (
            <span className='text-[9px] text-slate-400 flex-shrink-0'>
              {asset.exchange_rate.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원/USD
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          className='w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors flex-shrink-0'
        >
          <XMarkIcon className='h-3 w-3' />
        </button>
      </div>

      {/* 수치 행 */}
      <div className='flex items-start gap-1.5'>
        {/* 보유금액 */}
        <div className='flex-1 min-w-0'>
          <p className='text-[9px] text-slate-400'>보유</p>
          <p className='text-sm font-black text-slate-900 tabular-nums leading-tight'>{formatKRW(valueKRW)}</p>
        </div>

        <div className='w-px h-7 bg-slate-100 flex-shrink-0 mt-1' />

        {/* 매수금액 */}
        <div className='flex-1 min-w-0'>
          <p className='text-[9px] text-slate-400'>매수</p>
          <p className='text-xs font-bold text-slate-600 tabular-nums leading-tight'>{formatKRW(costKRW)}</p>
        </div>

        <div className='w-px h-7 bg-slate-100 flex-shrink-0 mt-1' />

        {/* 수익 */}
        <div className='flex-1 min-w-0 text-right'>
          <p className={`text-[9px] font-semibold ${isUp ? 'text-emerald-500' : 'text-rose-400'}`}>
            {isUp ? '수익' : '손실'}
          </p>
          <p className={`text-xs font-bold tabular-nums leading-tight ${isUp ? 'text-emerald-700' : 'text-rose-600'}`}>
            {isUp ? '+' : ''}{formatKRW(pnlKRW)}
          </p>
          <p className={`text-[9px] tabular-nums ${isUp ? 'text-emerald-500' : 'text-rose-400'}`}>
            {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── 롱프레스 훅 ────────────────────────────────────────────────────────────────

function useLongPress(onLongPress: () => void, delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    timerRef.current = setTimeout(() => {
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onMouseDown:   start,
    onMouseUp:     cancel,
    onMouseLeave:  cancel,
    onTouchStart:  start,
    onTouchEnd:    cancel,
    onTouchMove:   cancel,
  };
}

// ─── Group assets by symbol ───────────────────────────────────────────────────

interface StockGroup {
  symbol: string;
  exchange: string;
  name: string;
  currency: string;
  current_price: number;
  exchange_rate?: number;
  assets: StockAssetWithPrice[];
  totalQty: number;
  weightedAvg: number;
  totalValueKRW: number;
  pnlKRW: number;
  pnlPct: number;
  price_source: string;
}

function groupAssets(assets: StockAssetWithPrice[]): StockGroup[] {
  const map = new Map<string, StockAssetWithPrice[]>();
  for (const a of assets) {
    const key = `${a.symbol}::${a.exchange}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return Array.from(map.values()).map(group => {
    const first = group[0];
    const totalQty = group.reduce((s, a) => s + a.quantity, 0);
    const weightedAvg = totalQty > 0
      ? group.reduce((s, a) => s + a.quantity * a.average_price, 0) / totalQty
      : 0;
    const totalValueKRW = group.reduce((s, a) => s + (a.current_value_krw ?? 0), 0);
    const totalCostKRW = group.reduce((s, a) => {
      const rate = a.exchange_rate ?? 1;
      return s + a.quantity * a.average_price * (a.currency === 'KRW' ? 1 : rate);
    }, 0);
    const pnlKRW = totalValueKRW - totalCostKRW;
    const pnlPct = totalCostKRW > 0 ? (pnlKRW / totalCostKRW) * 100 : 0;
    return {
      symbol: first.symbol,
      exchange: first.exchange,
      name: first.name,
      currency: first.currency,
      current_price: first.current_price,
      exchange_rate: first.exchange_rate,
      assets: group,
      totalQty,
      weightedAvg,
      totalValueKRW,
      pnlKRW,
      pnlPct,
      price_source: first.price_source,
    };
  });
}

// ─── Individual user holding row (inside expanded group) ─────────────────────

function UserHoldingRow({
  asset, user, onEdit, onBuy, onSell, onDelete,
}: {
  asset: StockAssetWithPrice;
  user?: User;
  onEdit?: () => void;
  onBuy?: () => void;
  onSell?: () => void;
  onDelete?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pnlPct = asset.average_price > 0
    ? ((asset.current_price - asset.average_price) / asset.average_price) * 100 : 0;
  const isUp = pnlPct >= 0;

  return (
    <div className='flex flex-col bg-slate-50/80 border-t border-slate-100 px-5 py-2.5'>
      <div className='flex items-center gap-2'>
        {/* User dot */}
        <span
          className='w-2.5 h-2.5 rounded-full flex-shrink-0'
          style={{ backgroundColor: user?.avatar_color ?? '#94a3b8' }}
        />
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-1.5'>
            <span className='text-xs font-semibold text-slate-700'>{user?.name ?? '알 수 없음'}</span>
            <span className='text-[10px] text-slate-400'>{asset.quantity}주</span>
          </div>
          <span className='text-[11px] text-slate-400'>
            평균 {formatCurrency(asset.average_price, asset.currency)}
          </span>
        </div>
        <div className='text-right flex-shrink-0'>
          <p className='text-xs font-bold text-slate-700 tabular-nums'>
            {formatCurrency(asset.current_price * asset.quantity, asset.currency)}
          </p>
          <p className={`text-[11px] tabular-nums font-semibold ${isUp ? 'text-emerald-600' : 'text-rose-500'}`}>
            {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
          </p>
        </div>
        {/* Menu */}
        <div className='relative flex-shrink-0'>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className='w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-200 transition-colors'
          >
            <svg viewBox='0 0 24 24' fill='currentColor' className='h-3.5 w-3.5'>
              <circle cx='12' cy='5' r='1.5' /><circle cx='12' cy='12' r='1.5' /><circle cx='12' cy='19' r='1.5' />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className='fixed inset-0 z-10' onClick={() => setMenuOpen(false)} />
              <div className='absolute right-0 bottom-full mb-1 z-20 bg-white border border-slate-100 rounded-xl shadow-lg py-1 min-w-[110px]'>
                <button onClick={() => { setMenuOpen(false); onEdit?.(); }}
                  className='flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50'>
                  <PencilSquareIcon className='h-4 w-4 text-slate-400' />수정
                </button>
                <button onClick={() => { setMenuOpen(false); onDelete?.(); }}
                  className='flex items-center gap-2 w-full px-4 py-2 text-sm text-rose-500 hover:bg-rose-50'>
                  <TrashIcon className='h-4 w-4' />삭제
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Buy/Sell */}
      <div className='flex gap-2 mt-1.5 pl-4'>
        <button onClick={onBuy}
          className='flex-1 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 active:scale-[0.97] transition-all'>
          + 매수
        </button>
        <button onClick={onSell}
          className='flex-1 py-1 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold hover:bg-rose-100 active:scale-[0.97] transition-all'>
          − 매도
        </button>
      </div>
    </div>
  );
}

// ─── Grouped stock row ────────────────────────────────────────────────────────

function GroupedStockRow({
  group, userMap, onEdit, onBuy, onSell, onDelete,
}: {
  group: StockGroup;
  userMap: Record<string, User>;
  onEdit: (asset: StockAssetWithPrice) => void;
  onBuy: (asset: StockAssetWithPrice) => void;
  onSell: (asset: StockAssetWithPrice) => void;
  onDelete: (asset: StockAssetWithPrice) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const pnlPct = group.pnlPct;
  const isUp = pnlPct >= 0;

  // Synthetic asset for KRW flash card
  const syntheticAsset: StockAssetWithPrice = {
    ...group.assets[0],
    quantity: group.totalQty,
    average_price: group.weightedAvg,
    current_value_krw: group.totalValueKRW,
    profit_loss_krw: group.pnlKRW,
    profit_loss_pct: group.pnlPct,
  };

  const longPressHandlers = useLongPress(() => setShowDetail(true));

  return (
    <li className='relative overflow-hidden'>
      {/* Main grouped row */}
      <div
        className='relative flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors select-none cursor-pointer overflow-hidden'
        onClick={() => setExpanded(v => !v)}
        {...longPressHandlers}
      >
        {/* Symbol badge */}
        <div className='flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center'>
          <span className='text-[10px] font-bold text-indigo-600 leading-tight text-center px-1'>{group.symbol}</span>
        </div>

        {/* Name + meta */}
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-1.5'>
            <p className='text-sm font-semibold text-slate-800 truncate'>{group.name}</p>
            <span className='text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium'>{group.exchange}</span>
          </div>
          <div className='flex items-center gap-1.5 mt-0.5'>
            {/* User avatar dots */}
            <div className='flex gap-0.5'>
              {group.assets.map(a => (
                <span key={a.id} className='w-2 h-2 rounded-full flex-shrink-0'
                  style={{ backgroundColor: userMap[a.user_id]?.avatar_color ?? '#94a3b8' }} />
              ))}
            </div>
            <span className='text-xs text-slate-400'>
              총 {group.totalQty}주 · 평균 {formatCurrency(group.weightedAvg, group.currency)}
            </span>
          </div>
        </div>

        {/* Price + P&L */}
        <div className='flex-shrink-0 text-right'>
          <p className='text-sm font-bold text-slate-800 tabular-nums'>
            {formatCurrency(group.current_price, group.currency)}
          </p>
          <p className={`text-xs font-semibold tabular-nums flex items-center justify-end gap-0.5 ${isUp ? 'text-emerald-600' : 'text-rose-500'}`}>
            {isUp ? <ArrowTrendingUpIcon className='h-3 w-3' /> : <ArrowTrendingDownIcon className='h-3 w-3' />}
            {isUp ? '+' : ''}{pnlPct.toFixed(2)}%
          </p>
        </div>

        {/* Expand chevron */}
        <div className='flex-shrink-0 ml-1'>
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2}
            className={`h-4 w-4 text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7' />
          </svg>
        </div>
      </div>

      {/* KRW flash card overlay — positioned relative to <li> to avoid clipping */}
      {showDetail && (
        <KRWFlashCard asset={syntheticAsset} onClose={() => setShowDetail(false)} />
      )}

      {/* Expanded: per-user holdings */}
      {expanded && group.assets.map(asset => (
        <UserHoldingRow
          key={asset.id}
          asset={asset}
          user={userMap[asset.user_id]}
          onEdit={() => onEdit(asset)}
          onBuy={() => onBuy(asset)}
          onSell={() => onSell(asset)}
          onDelete={() => onDelete(asset)}
        />
      ))}
    </li>
  );
}

// ─── Delete confirm (일반) ───────────────────────────────────────────────────

function DeleteConfirm({
  asset,
  onConfirm,
  onCancel,
}: {
  asset: StockAssetWithPrice;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className='fixed inset-0 z-50 flex flex-col justify-end'>
      <div className='absolute inset-0 bg-black/40 backdrop-blur-sm' onClick={onCancel} />
      <div className='relative bg-white rounded-t-3xl p-6 space-y-4 z-10'>
        <div className='flex justify-center mb-1'><div className='w-10 h-1 bg-slate-200 rounded-full' /></div>
        <div className='text-center'>
          <div className='w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-3'>
            <TrashIcon className='h-6 w-6 text-rose-500' />
          </div>
          <h3 className='text-base font-bold text-slate-800'>{asset.symbol} 삭제</h3>
          <p className='text-sm text-slate-400 mt-1'>
            {asset.name} ({asset.quantity}주)를 삭제하면
            <br />
            복구할 수 없습니다.
          </p>
        </div>
        <div className='flex gap-2 pb-6'>
          <button
            onClick={onCancel}
            className='flex-1 py-3 rounded-2xl border border-slate-200 text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors'
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className='flex-1 py-3 rounded-2xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 active:scale-[0.98] transition-all'
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm (세금 경고) ──────────────────────────────────────────────

function TaxWarningConfirm({
  asset,
  year,
  onConfirm,
  onCancel,
}: {
  asset: StockAssetWithPrice;
  year: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className='fixed inset-0 z-50 flex flex-col justify-end'>
      <div className='absolute inset-0 bg-black/40 backdrop-blur-sm' onClick={onCancel} />
      <div className='relative bg-white rounded-t-3xl p-6 space-y-4 z-10'>
        <div className='flex justify-center mb-1'><div className='w-10 h-1 bg-slate-200 rounded-full' /></div>
        <div className='text-center'>
          <div className='w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3'>
            <ExclamationTriangleIcon className='h-6 w-6 text-amber-500' />
          </div>
          <h3 className='text-base font-bold text-slate-800'>양도소득세 경고</h3>
          <p className='text-sm text-slate-500 mt-2 leading-relaxed'>
            <span className='font-semibold text-slate-700'>{asset.symbol}</span>은 {year}년에 매도 이력이 있습니다.
            <br /><br />이 종목을 삭제하면{' '}
            <span className='text-rose-500 font-semibold'>
              과거 매도 기록이 사라져 {year}년 양도소득세 계산에 오류
            </span>
            가 발생합니다.
          </p>
        </div>
        <div className='flex gap-2 pb-6'>
          <button
            onClick={onCancel}
            className='flex-1 py-3 rounded-2xl border border-slate-200 text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors'
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className='flex-1 py-3 rounded-2xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 active:scale-[0.98] transition-all'
          >
            그래도 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function StockPortfolioCard({
  assets = [],
  users = [],
  summary,
  onAddClick,
  onEditClick,
  onBuySellClick,
  onDeleteClick,
}: StockPortfolioCardProps) {
  const [pendingDelete, setPendingDelete] = useState<StockAssetWithPrice | null>(null);
  const [taxWarning, setTaxWarning] = useState<{ asset: StockAssetWithPrice; year: number } | null>(null);
  const [checkingDelete, setCheckingDelete] = useState<string | null>(null); // asset id

  const safeAssets = Array.isArray(assets) ? assets : [];
  const safeUsers = Array.isArray(users) ? users : [];
  const userMap = Object.fromEntries(safeUsers.map((u) => [u.id, u]));
  const groups = groupAssets(safeAssets);

  const totalValueKRW = summary?.total_value_krw ?? safeAssets.reduce((sum, a) => sum + (a.current_value_krw ?? 0), 0);
  const totalCostKRW = summary?.total_cost_krw ?? 0;
  const totalPnlKRW = totalValueKRW - totalCostKRW;
  const isOverallUp = totalPnlKRW >= 0;

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

  const handleDeleteRequest = async (asset: StockAssetWithPrice) => {
    setCheckingDelete(asset.id);
    try {
      const res = await fetch(`${API_BASE}/api/stocks/${asset.id}/tax-check`);
      const data = await res.json();
      if (data.has_sell_current_year) {
        setTaxWarning({ asset, year: data.year });
      } else {
        setPendingDelete(asset);
      }
    } catch {
      setPendingDelete(asset);
    } finally {
      setCheckingDelete(null);
    }
  };

  return (
    <>
      <div className='bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between px-5 py-4 border-b border-slate-50'>
          <div>
            <h2 className='text-sm font-semibold text-slate-700'>주식 포트폴리오</h2>
            {safeAssets.length > 0 && summary?.usd_krw && (
              <p className='text-[11px] text-slate-400 mt-0.5'>USD/KRW {summary.usd_krw.toFixed(0)}원 기준</p>
            )}
          </div>
          <div className='flex items-center gap-3'>
            {safeAssets.length > 0 && (
              <div className='text-right'>
                <p className='text-sm font-bold text-slate-800 tabular-nums'>₩{Math.round(totalValueKRW / 10000).toLocaleString()}만</p>
                <p className={`text-xs font-semibold tabular-nums ${isOverallUp ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {isOverallUp ? '+' : ''}₩{Math.abs(Math.round(totalPnlKRW / 10000)).toLocaleString()}만 손익
                </p>
              </div>
            )}
            <button
              onClick={onAddClick}
              className='w-8 h-8 rounded-xl bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center transition-colors'
              aria-label='종목 추가'
            >
              <PlusIcon className='h-4 w-4 text-indigo-600' />
            </button>
          </div>
        </div>

        {/* Grouped rows */}
        {groups.length === 0 ? (
          <div className='px-5 py-10 flex flex-col items-center gap-2 text-center'>
            <p className='text-sm font-medium text-slate-400'>보유 주식이 없습니다</p>
            <p className='text-xs text-slate-300'>+ 버튼으로 종목을 추가해보세요</p>
          </div>
        ) : (
          <ul className='divide-y divide-slate-50'>
            {groups.map(group => (
              <GroupedStockRow
                key={`${group.symbol}::${group.exchange}`}
                group={group}
                userMap={userMap}
                onEdit={a => onEditClick?.(a)}
                onBuy={a => onBuySellClick?.(a, 'buy')}
                onSell={a => onBuySellClick?.(a, 'sell')}
                onDelete={a => handleDeleteRequest(a)}
              />
            ))}
          </ul>
        )}

        {/* Checking indicator */}
        {checkingDelete && (
          <div className='px-5 py-2 text-xs text-slate-400 text-center animate-pulse'>삭제 전 세금 이력 확인 중...</div>
        )}
      </div>

      {/* Normal delete confirm */}
      {pendingDelete && (
        <DeleteConfirm
          asset={pendingDelete}
          onConfirm={() => {
            onDeleteClick?.(pendingDelete);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Tax-warning delete confirm */}
      {taxWarning && (
        <TaxWarningConfirm
          asset={taxWarning.asset}
          year={taxWarning.year}
          onConfirm={() => {
            onDeleteClick?.(taxWarning.asset);
            setTaxWarning(null);
          }}
          onCancel={() => setTaxWarning(null)}
        />
      )}
    </>
  );
}
