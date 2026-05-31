'use client'

import { useState, useMemo } from 'react'
import { PencilSquareIcon, TrashIcon, XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { PlusIcon } from '@heroicons/react/24/solid'
import type {
  OtherAsset,
  OtherAssetType,
  User,
  CreateOtherAssetRequest,
  UpdateOtherAssetRequest,
} from '@/types'
import { OTHER_ASSET_TYPES, ASSET_TYPE_EMOJI } from '@/types'

interface OtherAssetCardProps {
  assets: OtherAsset[]
  users: User[]
  onAdd: (data: CreateOtherAssetRequest) => Promise<void>
  onEdit: (id: string, data: UpdateOtherAssetRequest) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatKRW(v: number): string {
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(2)}억`
  if (Math.abs(v) >= 10_000) return `${(v / 10_000).toFixed(1)}만`
  return `${v.toLocaleString()}원`
}

// 예/적금 세후 만기 수령액 계산 (단리, 이자소득세 15.4%)
function calcAfterTaxMaturity(
  principal: number,
  annualRatePct: number,
  startDate: string,
  endDate: string,
): number | null {
  if (!principal || !annualRatePct || !startDate || !endDate) return null
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  if (days <= 0) return null
  const interest = principal * (annualRatePct / 100) * (days / 365)
  const afterTaxInterest = interest * (1 - 0.154)
  return Math.round(principal + afterTaxInterest)
}

// ─── Add / Edit Modal (unified) ───────────────────────────────────────────────

interface AssetFormModalProps {
  mode: 'add' | 'edit'
  initial?: OtherAsset
  users: User[]
  onClose: () => void
  onSubmit: (data: CreateOtherAssetRequest | UpdateOtherAssetRequest) => Promise<void>
}

function AssetFormModal({ mode, initial, users, onClose, onSubmit }: AssetFormModalProps) {
  const safeUsers = Array.isArray(users) ? users : []
  const [userID, setUserID] = useState(initial?.user_id ?? safeUsers[0]?.id ?? '')
  const [assetType, setAssetType] = useState<OtherAssetType>(initial?.asset_type ?? '기타')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [valueKRW, setValueKRW] = useState(initial ? String(initial.value_krw) : '')
  const [costKRW, setCostKRW] = useState(initial?.cost_krw ? String(initial.cost_krw) : '')
  const [isLiability, setIsLiability] = useState(initial?.is_liability ?? false)
  const [isLocked, setIsLocked] = useState(initial?.is_locked ?? false)
  const [interestRate, setInterestRate] = useState(initial?.interest_rate != null ? String(initial.interest_rate) : '')
  const [maturityDate, setMaturityDate] = useState(
    initial?.maturity_date ? initial.maturity_date.slice(0, 10) : ''
  )
  const [acquiredAt, setAcquiredAt] = useState(
    initial?.acquired_at ? initial.acquired_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [cryptoSymbol, setCryptoSymbol] = useState(initial?.crypto_symbol ?? '')
  const [cryptoQty, setCryptoQty] = useState(initial?.crypto_qty != null ? String(initial.crypto_qty) : '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [loading, setLoading] = useState(false)

  const isDeposit = assetType === '예/적금'
  const showCrypto = assetType === '가상화폐'
  const showInterest = isDeposit || assetType === '보험'
  const showMaturity = isDeposit || assetType === '보험' || assetType === '부동산'

  // 예/적금 세후 만기 수령액 실시간 계산
  const afterTaxMaturity = useMemo(() => {
    if (!isDeposit) return null
    const principal = parseFloat(valueKRW) || 0
    const rate = parseFloat(interestRate) || 0
    return calcAfterTaxMaturity(principal, rate, acquiredAt, maturityDate)
  }, [isDeposit, valueKRW, interestRate, acquiredAt, maturityDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !valueKRW) return
    setLoading(true)
    try {
      const payload = {
        user_id: userID,
        asset_type: assetType,
        name: name.trim(),
        description: description.trim(),
        value_krw: parseFloat(valueKRW.replace(/,/g, '')),
        cost_krw: costKRW ? parseFloat(costKRW.replace(/,/g, '')) : undefined,
        is_liability: isLiability,
        is_locked: isLocked,
        interest_rate: interestRate ? parseFloat(interestRate) : null,
        maturity_date: maturityDate ? `${maturityDate}T00:00:00Z` : null,
        crypto_symbol: cryptoSymbol.trim() || null,
        crypto_qty: cryptoQty ? parseFloat(cryptoQty) : null,
        memo: memo.trim(),
        acquired_at: acquiredAt ? `${acquiredAt}T00:00:00Z` : null,
      }
      await onSubmit(payload)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-4 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">
            {mode === 'add' ? '자산 추가' : '자산 수정'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 자산 유형 chips */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">자산 유형</label>
            <div className="flex flex-wrap gap-2">
              {OTHER_ASSET_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAssetType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    assetType === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {ASSET_TYPE_EMOJI[t]} {t}
                </button>
              ))}
            </div>
          </div>

          {/* 부채 여부 + 인출불가 여부 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">부채(마이너스 자산)?</label>
              <button
                type="button"
                onClick={() => { setIsLiability(v => !v); if (!isLiability) setIsLocked(false) }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isLiability ? 'bg-rose-500' : 'bg-slate-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isLiability ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            {!isLiability && (
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-medium text-slate-500">인출/처분 불가 자산?</label>
                  <p className="text-[10px] text-slate-400 mt-0.5">부동산·보험·장기투자 등 즉시 현금화 불가</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLocked(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    isLocked ? 'bg-amber-500' : 'bg-slate-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isLocked ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            )}
          </div>

          {/* 누가? */}
          {safeUsers.length > 1 && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">누가?</label>
              <select
                value={userID}
                onChange={e => setUserID(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                {safeUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 자산명 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">자산명</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 해운대 아파트, 카카오뱅크 정기예금"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
            />
          </div>

          {/* 현재가치 + 취득원가 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {isLiability ? '부채 금액 (원)' : isDeposit ? '납입 원금 (원)' : '현재 가치 (원)'}
              </label>
              <input
                type="number"
                value={valueKRW}
                onChange={e => setValueKRW(e.target.value)}
                placeholder="0"
                min="0"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">취득원가 (원)</label>
              <input
                type="number"
                value={costKRW}
                onChange={e => setCostKRW(e.target.value)}
                placeholder="0 (선택)"
                min="0"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>
          </div>

          {/* 가상화폐 전용 */}
          {showCrypto && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">코인 심볼</label>
                <input
                  type="text"
                  value={cryptoSymbol}
                  onChange={e => setCryptoSymbol(e.target.value.toUpperCase())}
                  placeholder="BTC"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">보유 수량</label>
                <input
                  type="number"
                  value={cryptoQty}
                  onChange={e => setCryptoQty(e.target.value)}
                  placeholder="0.0"
                  step="0.00000001"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
                />
              </div>
            </div>
          )}

          {/* 예/적금 전용: 가입일 */}
          {isDeposit && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">가입일</label>
              <input
                type="date"
                value={acquiredAt}
                onChange={e => setAcquiredAt(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          {/* 예금/보험 전용: 연이율 */}
          {showInterest && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">연이율 (%)</label>
              <input
                type="number"
                value={interestRate}
                onChange={e => setInterestRate(e.target.value)}
                placeholder="3.5"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>
          )}

          {/* 만기일 */}
          {showMaturity && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">만기일 {isDeposit ? '' : '(선택)'}</label>
              <input
                type="date"
                value={maturityDate}
                onChange={e => setMaturityDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          {/* 예/적금 세후 만기 수령액 미리보기 */}
          {isDeposit && afterTaxMaturity !== null && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-indigo-700">세후 만기 수령액 (예상)</p>
              <p className="text-lg font-bold text-indigo-900 tabular-nums">{formatKRW(afterTaxMaturity)}</p>
              <div className="flex items-center justify-between text-[10px] text-indigo-500">
                <span>원금 {formatKRW(parseFloat(valueKRW) || 0)}</span>
                <span>+</span>
                <span>세후이자 {formatKRW(afterTaxMaturity - (parseFloat(valueKRW) || 0))}</span>
                <span className="text-indigo-400">(세율 15.4%)</span>
              </div>
            </div>
          )}

          {/* 설명 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">설명 (선택)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="부산 해운대구, 전세 보증금..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">메모 (선택)</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="기타 메모..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {loading ? '저장 중...' : mode === 'add' ? '자산 추가하기' : '수정 저장하기'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({
  asset,
  onConfirm,
  onCancel,
}: {
  asset: OtherAsset
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-t-3xl p-6 space-y-4 z-10">
        <div className="flex justify-center mb-1"><div className="w-10 h-1 bg-slate-200 rounded-full" /></div>
        <div className="text-center">
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <TrashIcon className="h-6 w-6 text-rose-500" />
          </div>
          <h3 className="text-base font-bold text-slate-800">{asset.name} 삭제</h3>
          <p className="text-sm text-slate-400 mt-1">
            이 자산을 삭제하면 복구할 수 없습니다.
          </p>
        </div>
        <div className="flex gap-2 pb-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 active:scale-[0.98] transition-all"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Asset Row ────────────────────────────────────────────────────────────────

function AssetRow({
  asset,
  user,
  onEdit,
  onDelete,
}: {
  asset: OtherAsset
  user?: User
  onEdit: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pnl = asset.cost_krw > 0 ? asset.value_krw - asset.cost_krw : null
  const isUp = pnl !== null && pnl >= 0

  // 예/적금 세후 만기 수령액
  const afterTaxMaturity = asset.asset_type === '예/적금' && asset.interest_rate != null && asset.maturity_date
    ? calcAfterTaxMaturity(asset.value_krw, asset.interest_rate, asset.acquired_at, asset.maturity_date)
    : null

  return (
    <li className="relative flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
      {/* Type badge */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
        asset.is_liability ? 'bg-rose-50' : asset.is_locked ? 'bg-amber-50' : 'bg-emerald-50'
      }`}>
        {ASSET_TYPE_EMOJI[asset.asset_type]}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-slate-800 truncate">{asset.name}</p>
          {asset.is_liability && (
            <span className="text-[10px] bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded font-medium">부채</span>
          )}
          {asset.is_locked && !asset.is_liability && (
            <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium">
              <LockClosedIcon className="h-2.5 w-2.5" />
              인출불가
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {user && (
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: user.avatar_color }}
            />
          )}
          <span className="text-xs text-slate-400 truncate">
            {user?.name}
            {asset.description ? ` · ${asset.description}` : ''}
            {asset.interest_rate != null ? ` · ${asset.interest_rate}%` : ''}
          </span>
        </div>
      </div>

      {/* Value + P&L + maturity */}
      <div className="flex-shrink-0 text-right mr-1">
        <p className={`text-sm font-bold tabular-nums ${asset.is_liability ? 'text-rose-500' : 'text-slate-800'}`}>
          {asset.is_liability ? '-' : ''}{formatKRW(asset.value_krw)}
        </p>
        {afterTaxMaturity !== null && (
          <p className="text-[10px] text-indigo-500 font-semibold tabular-nums">
            만기 {formatKRW(afterTaxMaturity)}
          </p>
        )}
        {pnl !== null && afterTaxMaturity === null && (
          <p className={`text-xs font-semibold tabular-nums ${isUp ? 'text-emerald-600' : 'text-rose-500'}`}>
            {isUp ? '+' : ''}{formatKRW(pnl)}
          </p>
        )}
        {asset.maturity_date && (
          <p className="text-[10px] text-slate-400">
            만기 {asset.maturity_date.slice(0, 10)}
          </p>
        )}
      </div>

      {/* Action menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="더보기"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 bottom-full mb-1 z-20 bg-white border border-slate-100 rounded-xl shadow-lg py-1 min-w-[100px]">
              <button
                onClick={() => { setMenuOpen(false); onEdit() }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <PencilSquareIcon className="h-4 w-4 text-slate-400" />
                수정
              </button>
              <button
                onClick={() => { setMenuOpen(false); onDelete() }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                삭제
              </button>
            </div>
          </>
        )}
      </div>
    </li>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function OtherAssetCard({ assets = [], users = [], onAdd, onEdit, onDelete }: OtherAssetCardProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingAsset, setEditingAsset] = useState<OtherAsset | null>(null)
  const [pendingDelete, setPendingDelete] = useState<OtherAsset | null>(null)

  const safeAssets = Array.isArray(assets) ? assets : []
  const safeUsers = Array.isArray(users) ? users : []
  const userMap = Object.fromEntries(safeUsers.map(u => [u.id, u]))

  const liquidAssets  = safeAssets.filter(a => !a.is_liability && !a.is_locked)
  const lockedAssets  = safeAssets.filter(a => !a.is_liability && a.is_locked)
  const liabilities   = safeAssets.filter(a => a.is_liability)

  const totalLiquid    = liquidAssets.reduce((s, a) => s + a.value_krw, 0)
  const totalLocked    = lockedAssets.reduce((s, a) => s + a.value_krw, 0)
  const totalLiability = liabilities.reduce((s, a) => s + a.value_krw, 0)
  const totalAsset     = totalLiquid + totalLocked
  const net            = totalAsset - totalLiability

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">기타 자산</h2>
            {safeAssets.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                부동산·예/적금·가상화폐·차량 등
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {safeAssets.length > 0 && (
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800 tabular-nums">
                  {formatKRW(net)}
                </p>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  {totalLocked > 0 && (
                    <span className="text-[10px] text-amber-500 tabular-nums flex items-center gap-0.5">
                      <LockClosedIcon className="h-2.5 w-2.5" />{formatKRW(totalLocked)}
                    </span>
                  )}
                  {totalLiability > 0 && (
                    <span className="text-[10px] text-rose-500 tabular-nums">
                      -{formatKRW(totalLiability)}
                    </span>
                  )}
                </div>
              </div>
            )}
            <button
              onClick={() => setShowAdd(true)}
              className="w-8 h-8 rounded-xl bg-indigo-50 hover:bg-indigo-100 flex items-center justify-center transition-colors"
              aria-label="자산 추가"
            >
              <PlusIcon className="h-4 w-4 text-indigo-600" />
            </button>
          </div>
        </div>

        {/* Asset rows or empty state */}
        {safeAssets.length === 0 ? (
          <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-medium text-slate-400">등록된 자산이 없습니다</p>
            <p className="text-xs text-slate-300">+ 버튼으로 부동산, 예/적금 등을 추가해보세요</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {/* 유동 자산 */}
            {liquidAssets.length > 0 && lockedAssets.length > 0 && (
              <li className="px-5 py-1.5 bg-slate-50">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">유동 자산</span>
              </li>
            )}
            {liquidAssets.map(asset => (
              <AssetRow
                key={asset.id}
                asset={asset}
                user={userMap[asset.user_id]}
                onEdit={() => setEditingAsset(asset)}
                onDelete={() => setPendingDelete(asset)}
              />
            ))}

            {/* 인출불가 자산 섹션 */}
            {lockedAssets.length > 0 && (
              <li className="px-5 py-1.5 bg-amber-50 flex items-center gap-1.5">
                <LockClosedIcon className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">인출 불가 자산</span>
              </li>
            )}
            {lockedAssets.map(asset => (
              <AssetRow
                key={asset.id}
                asset={asset}
                user={userMap[asset.user_id]}
                onEdit={() => setEditingAsset(asset)}
                onDelete={() => setPendingDelete(asset)}
              />
            ))}

            {/* 부채 */}
            {liabilities.length > 0 && (
              <li className="px-5 py-1.5 bg-rose-50">
                <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wide">부채</span>
              </li>
            )}
            {liabilities.map(asset => (
              <AssetRow
                key={asset.id}
                asset={asset}
                user={userMap[asset.user_id]}
                onEdit={() => setEditingAsset(asset)}
                onDelete={() => setPendingDelete(asset)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <AssetFormModal
          mode="add"
          users={safeUsers}
          onClose={() => setShowAdd(false)}
          onSubmit={data => onAdd(data as CreateOtherAssetRequest)}
        />
      )}

      {/* Edit modal */}
      {editingAsset && (
        <AssetFormModal
          mode="edit"
          initial={editingAsset}
          users={safeUsers}
          onClose={() => setEditingAsset(null)}
          onSubmit={data => onEdit(editingAsset.id, data as UpdateOtherAssetRequest)}
        />
      )}

      {/* Delete confirm */}
      {pendingDelete && (
        <DeleteConfirm
          asset={pendingDelete}
          onConfirm={async () => {
            await onDelete(pendingDelete.id)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
