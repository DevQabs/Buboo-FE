'use client';

import { useState, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { User } from '@/types';
import { useCategories } from '@/hooks/useCategories';

interface SamsungPayCardProps {
  users: User[];
  onAdd: (data: {
    user_id: string;
    type: 'expense';
    amount: number;
    category: string;
    title: string;
    payment_method: string;
  }) => Promise<void>;
}

const PAYMENT_METHODS = ['카드', '현금', '이체', '기타'];

function openSamsungPay() {
  // Android PWA: intent:// is the reliable way to launch a specific app
  window.location.href =
    'intent://pay#Intent;scheme=samsungpay;package=com.samsung.android.spay;end';
}

export default function SamsungPayCard({ users, onAdd }: SamsungPayCardProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [payment, setPayment] = useState('카드');
  const [userID, setUserID] = useState(users[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const { expenseCategories } = useCategories();

  function resetForm() {
    setAmount('');
    setTitle('');
    setCategory(expenseCategories[0] ?? '');
    setPayment('카드');
    setUserID(users[0]?.id ?? '');
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setAmount(raw ? parseInt(raw, 10).toLocaleString() : '');
  }

  async function handleSubmit() {
    const num = parseInt(amount.replace(/,/g, ''), 10);
    if (!num || !title) return;
    setLoading(true);
    try {
      await onAdd({
        user_id: userID,
        type: 'expense',
        amount: num,
        category: category || expenseCategories[0] || '식비',
        title,
        payment_method: payment,
      });
      setOpen(false);
      resetForm();
      openSamsungPay();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Credit card UI */}
      <button
        type="button"
        onClick={handleOpen}
        className="w-full rounded-3xl overflow-hidden shadow-lg active:scale-[0.98] transition-transform"
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #312e81 60%, #1e40af 100%)',
          aspectRatio: '1.586',
        }}
      >
        <div className="h-full flex flex-col justify-between p-5 text-left">
          {/* Top row */}
          <div className="flex items-start justify-between">
            {/* Chip */}
            <div className="w-9 h-7 rounded-md bg-yellow-300/90 flex items-center justify-center">
              <div className="w-6 h-5 rounded-sm border border-yellow-500/60 grid grid-cols-2 gap-0.5 p-0.5">
                <div className="bg-yellow-500/40 rounded-sm" />
                <div className="bg-yellow-500/40 rounded-sm" />
                <div className="bg-yellow-500/40 rounded-sm" />
                <div className="bg-yellow-500/40 rounded-sm" />
              </div>
            </div>
            {/* Samsung Pay wordmark */}
            <div className="text-right">
              <p className="text-[10px] text-blue-200/70 font-medium tracking-widest uppercase">Samsung</p>
              <p className="text-sm font-bold text-white tracking-wide">Pay</p>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-end justify-between">
            {/* NFC icon */}
            <div className="flex items-center gap-1.5 text-white/50">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
                <path strokeLinecap="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0" />
              </svg>
            </div>
            {/* Tap hint */}
            <div className="text-right">
              <p className="text-xs text-white/50">탭하여 결제 등록</p>
              <p className="text-base font-semibold text-white/90">삼성페이 결제</p>
            </div>
          </div>
        </div>
      </button>

      {/* Bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-3xl z-10">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <h3 className="text-base font-bold text-slate-800">삼성페이 결제</h3>
              <div className="flex items-center gap-2">
                {/* User selector */}
                <div className="flex gap-1">
                  {users.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setUserID(u.id)}
                      className={`w-7 h-7 rounded-full text-white text-xs font-bold transition-all ${
                        userID === u.id ? 'ring-2 ring-offset-1 ring-indigo-400 scale-110' : 'opacity-40'
                      }`}
                      style={{ backgroundColor: u.avatar_color }}
                    >
                      {u.name[0]}
                    </button>
                  ))}
                </div>
                <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                  <XMarkIcon className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="px-5 pb-10 space-y-3">
              {/* Amount */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">금액</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount}
                  onChange={handleAmountChange}
                  className="w-full px-3 py-3 rounded-xl border border-slate-200 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  autoFocus
                />
              </div>

              {/* Title */}
              <div>
                <label className="text-xs text-slate-500 mb-1 block">내용</label>
                <input
                  type="text"
                  placeholder="어디서 결제했나요?"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">카테고리</label>
                <div className="flex flex-wrap gap-2">
                  {expenseCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        (category || expenseCategories[0]) === cat
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">결제수단</label>
                <div className="flex gap-2">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayment(m)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        payment === m
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="button"
                disabled={loading || !amount || !title}
                onClick={handleSubmit}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white active:scale-[0.98] transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1e293b 0%, #312e81 60%, #1e40af 100%)' }}
              >
                {loading ? '저장 중...' : '결제하기 → Samsung Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
