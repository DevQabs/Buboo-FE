'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/solid';
import type { User } from '@/types';
import { formatAmountInput } from '@/lib/formatNumber';

interface AddStockModalProps {
  users: User[];
  onClose: () => void;
  onAdd: (data: {
    user_id: string;
    symbol: string;
    exchange: string;
    name: string;
    quantity: number;
    average_price: number;
    currency: string;
    memo: string;
  }) => Promise<void>;
}

const EXCHANGES = ['NASDAQ', 'NYSE', 'KRX', '기타'];

export default function AddStockModal({ users, onClose, onAdd }: AddStockModalProps) {
  const [userID, setUserID] = useState(users[0]?.id ?? '');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [exchange, setExchange] = useState('NASDAQ');
  const [currency, setCurrency] = useState('USD');
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-set currency when exchange changes
  const handleExchangeChange = (ex: string) => {
    setExchange(ex);
    if (ex === 'KRX' || ex === 'KOSDAQ') setCurrency('KRW');
    else if (ex !== '기타') setCurrency('USD');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !name || !quantity || !avgPrice) return;
    setLoading(true);
    await onAdd({
      user_id: userID,
      symbol: symbol.toUpperCase().trim(),
      exchange,
      name: name.trim(),
      quantity: parseFloat(quantity),
      average_price: parseFloat(avgPrice.replace(/,/g, '')),
      currency,
      memo,
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-center'>
      {/* Backdrop */}
      <motion.div
        className='absolute inset-0 bg-black/30 backdrop-blur-sm'
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Sheet */}
      <motion.div
        className='relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-5 z-10 max-h-[90vh] overflow-y-auto'
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Header */}
        <div className='flex items-center justify-between'>
          <h3 className='text-base font-bold text-slate-800'>주식 추가</h3>
          <div className='flex items-center gap-2'>
            <div className='flex gap-1'>
              {users.map((u) => (
                <button
                  key={u.id}
                  type='button'
                  onClick={() => setUserID(u.id)}
                  title={u.name}
                  className={`w-7 h-7 rounded-full text-white text-xs font-bold transition-all ${userID === u.id ? 'ring-2 ring-offset-1 ring-brand-500 scale-110' : 'opacity-40'}`}
                  style={{ backgroundColor: u.avatar_color }}
                >
                  {u.name[0]}
                </button>
              ))}
            </div>
            <button onClick={onClose} className='text-slate-400 hover:text-slate-600 transition-colors'>
              <XMarkIcon className='h-5 w-5' />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Symbol + Exchange (inline) */}
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='text-xs font-medium text-slate-500 mb-1 block'>티커 심볼</label>
              <input
                type='text'
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder='AAPL'
                required
                className='w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-300 placeholder:font-normal'
              />
            </div>
            <div>
              <label className='text-xs font-medium text-slate-500 mb-1 block'>거래소</label>
              <select
                value={exchange}
                onChange={(e) => handleExchangeChange(e.target.value)}
                className='w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white'
              >
                {EXCHANGES.map((ex) => (
                  <option key={ex} value={ex}>
                    {ex}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 종목명 */}
          <div>
            <label className='text-xs font-medium text-slate-500 mb-1 block'>종목명</label>
            <input
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Apple Inc.'
              required
              className='w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-300'
            />
          </div>

          {/* 수량 + 평균단가 (inline) */}
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='text-xs font-medium text-slate-500 mb-1 block'>보유 수량</label>
              <input
                type='number'
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder='0'
                min='0'
                step='0.0001'
                required
                className='w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-300 placeholder:font-normal'
              />
            </div>
            <div>
              <label className='text-xs font-medium text-slate-500 mb-1 block'>
                평균 매입가 ({currency === 'KRW' ? '원' : '$'})
              </label>
              <input
                type='text'
                inputMode='decimal'
                value={avgPrice}
                onChange={(e) => setAvgPrice(formatAmountInput(e.target.value, true))}
                placeholder='0'
                required
                className='w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-300 placeholder:font-normal'
              />
            </div>
          </div>

          {/* 총 매입금액 미리보기 */}
          {quantity && avgPrice && (
            <div className='bg-slate-50 rounded-xl px-4 py-3'>
              <p className='text-xs text-slate-500'>총 매입금액</p>
              <p className='text-sm font-bold text-slate-800 mt-0.5'>
                {currency === 'KRW'
                  ? `₩${(parseFloat(quantity) * parseFloat(avgPrice.replace(/,/g, ''))).toLocaleString()}원`
                  : `$${(parseFloat(quantity) * parseFloat(avgPrice.replace(/,/g, ''))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </div>
          )}

          {/* 통화 */}
          <div>
            <label className='text-xs font-medium text-slate-500 mb-2 block'>통화</label>
            <div className='flex gap-2'>
              {(['USD', 'KRW'] as const).map((c) => (
                <button
                  key={c}
                  type='button'
                  onClick={() => setCurrency(c)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border ${
                    currency === c
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {c === 'USD' ? '🇺🇸 USD' : '🇰🇷 KRW'}
                </button>
              ))}
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className='text-xs font-medium text-slate-500 mb-1 block'>메모 (선택)</label>
            <input
              type='text'
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder='장기 보유, 배당주...'
              className='w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-300'
            />
          </div>

          {/* Submit */}
          <button
            type='submit'
            disabled={loading}
            className='w-full py-3.5 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 active:scale-[0.98] transition-all disabled:opacity-60'
          >
            {loading ? '저장 중...' : '주식 추가하기'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
