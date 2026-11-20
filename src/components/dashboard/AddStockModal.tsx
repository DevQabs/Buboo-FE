'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { formatAmountInput } from '@/lib/formatNumber';
import { Chip } from '@/components/ui/Card';

interface AddStockModalProps {
  currentUserID: string;
  exchangeRate?: number;
  onClose: () => void;
  onAdd: (data: {
    user_id: string;
    symbol: string;
    exchange: string;
    name: string;
    quantity: number;
    average_price: number;
    currency: string;
    exchange_rate: number;
    memo: string;
  }) => Promise<void>;
}

// 시장 하나로 거래소(시세 조회 접미사 .KS/.KQ)와 통화를 함께 정한다. 미국은 거래소 구분이 시세에 안 쓰인다.
const MARKETS = [
  { label: '미국', exchange: 'NASDAQ', currency: 'USD' },
  { label: '코스피', exchange: 'KRX', currency: 'KRW' },
  { label: '코스닥', exchange: 'KOSDAQ', currency: 'KRW' },
] as const;

export default function AddStockModal({ currentUserID, exchangeRate = 0, onClose, onAdd }: AddStockModalProps) {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [exchange, setExchange] = useState('NASDAQ');
  const [currency, setCurrency] = useState('USD');
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);

  const pickMarket = (m: (typeof MARKETS)[number]) => { setExchange(m.exchange); setCurrency(m.currency); };
  // 숫자 6자리 종목코드면 한국 주식: 미국이 골라져 있으면 코스피로
  const changeSymbol = (v: string) => {
    const t = v.toUpperCase();
    setSymbol(t);
    if (/^\d{6}$/.test(t.trim()) && exchange === 'NASDAQ') pickMarket(MARKETS[1]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !name || !quantity || !avgPrice) return;
    setLoading(true);
    await onAdd({
      user_id: currentUserID,
      symbol: symbol.toUpperCase().trim(),
      exchange,
      name: name.trim(),
      quantity: parseFloat(quantity),
      average_price: parseFloat(avgPrice.replace(/,/g, '')),
      currency,
      exchange_rate: currency === 'USD' && exchangeRate > 0 ? exchangeRate : 0,
      memo,
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className='fixed inset-0 z-60 flex items-end sm:items-center justify-center'>
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
          <button onClick={onClose} className='relative before:absolute before:content-[""] before:-inset-y-3 before:-inset-x-2 text-slate-400 hover:text-slate-600 transition-colors'>
            <XMarkIcon className='h-5 w-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label className='text-xs font-medium text-slate-500 mb-1 block'>시장</label>
            <div className='flex gap-2'>
              {MARKETS.map((m) => (
                <Chip key={m.exchange} on={exchange === m.exchange} onClick={() => pickMarket(m)}>{m.label}</Chip>
              ))}
            </div>
          </div>

          <div>
            <label className='text-xs font-medium text-slate-500 mb-1 block'>{currency === 'KRW' ? '종목코드' : '티커 심볼'}</label>
            <input
              type='text'
              value={symbol}
              onChange={(e) => changeSymbol(e.target.value)}
              placeholder={currency === 'KRW' ? '005930' : 'AAPL'}
              required
              className='w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-300 placeholder:font-normal'
            />
          </div>

          {/* 종목명 */}
          <div>
            <label className='text-xs font-medium text-slate-500 mb-1 block'>종목명</label>
            <input
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={currency === 'KRW' ? '삼성전자' : 'Apple Inc.'}
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
