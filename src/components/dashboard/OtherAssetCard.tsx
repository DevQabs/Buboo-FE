'use client'

import { useState, useMemo } from 'react'
import { PencilSquareIcon, TrashIcon, XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { PlusIcon } from '@heroicons/react/24/solid'
import type {
  OtherAsset,
  OtherAssetType,
  LoanType,
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

// 예/적금 세후 만기 수령액 (단리, 이자소득세 15.4%)
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
  return Math.round(principal + interest * (1 - 0.154))
}

interface LoanPayment {
  total: number
  principal: number
  interest: number
  remainingMonths: number
}

// 대출 월 납입금 계산
function calcLoanPayment(
  balance: number,
  annualRatePct: number,
  loanType: string,
  maturityDate: string,
): LoanPayment | null {
  if (!balance || !annualRatePct || !loanType || !maturityDate) return null
  const r = annualRatePct / 100 / 12
  const now = new Date()
  const end = new Date(maturityDate)
  const remainingMonths = Math.max(1, Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))

  if (loanType === '만기일시상환') {
    const interest = Math.round(balance * r)
    return { total: interest, principal: 0, interest, remainingMonths }
  }
  if (loanType === '원리금균등상환') {
    if (r === 0) {
      const p = Math.round(balance / remainingMonths)
      return { total: p, principal: p, interest: 0, remainingMonths }
    }
    const factor = Math.pow(1 + r, remainingMonths)
    const monthly = Math.round(balance * r * factor / (factor - 1))
    const interest = Math.round(balance * r)
    return { total: monthly, principal: monthly - interest, interest, remainingMonths }
  }
  if (loanType === '원금균등상환') {
    const principal = Math.round(balance / remainingMonths)
    const interest = Math.round(balance * r)
    return { total: principal + interest, principal, interest, remainingMonths }
  }
  return null
}

const LOAN_TYPES: LoanType[] = ['원리금균등상환', '원금균등상환', '만기일시상환']

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

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
  const [valueUSD, setValueUSD] = useState(initial?.value_usd != null ? String(initial.value_usd) : '')
  const [currency, setCurrency] = useState<'KRW' | 'USD'>(
    initial?.currency?.toUpperCase() === 'USD' ? 'USD' : 'KRW'
  )
  const [costKRW, setCostKRW] = useState(initial?.cost_krw ? String(initial.cost_krw) : '')
  const [isLocked, setIsLocked] = useState(initial?.is_locked ?? false)
  const [interestRate, setInterestRate] = useState(initial?.interest_rate != null ? String(initial.interest_rate) : '')
  const [maturityDate, setMaturityDate] = useState(
    initial?.maturity_date ? initial.maturity_date.slice(0, 10) : ''
  )
  const [acquiredAt, setAcquiredAt] = useState(
    initial?.acquired_at ? initial.acquired_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [loanType, setLoanType] = useState<LoanType>((initial?.loan_type as LoanType) ?? '원리금균등상환')
  const [paymentDay, setPaymentDay] = useState(initial?.payment_day ? String(initial.payment_day) : '25')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [loading, setLoading] = useState(false)

  const isLoan    = assetType === '대출'
  const isDeposit = assetType === '예/적금'
  const isCash    = assetType === '현금'
  const isUSD     = isCash && currency === 'USD'
  const showInterest = isDeposit || isLoan
  const showMaturity = isDeposit || assetType === '부동산' || isLoan

  // 예/적금 세후 만기 수령액
  const afterTaxMaturity = useMemo(() => {
    if (!isDeposit) return null
    return calcAfterTaxMaturity(parseFloat(valueKRW) || 0, parseFloat(interestRate) || 0, acquiredAt, maturityDate)
  }, [isDeposit, valueKRW, interestRate, acquiredAt, maturityDate])

  // 대출 월 납입금
  const loanPayment = useMemo(() => {
    if (!isLoan) return null
    return calcLoanPayment(parseFloat(valueKRW) || 0, parseFloat(interestRate) || 0, loanType, maturityDate)
  }, [isLoan, valueKRW, interestRate, loanType, maturityDate])

  const handleTypeChange = (t: OtherAssetType) => {
    setAssetType(t)
    if (t !== '현금') setCurrency('KRW')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const needsValue = isUSD ? !valueUSD : !valueKRW
    if (!name || needsValue) return
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        user_id: userID,
        asset_type: assetType,
        name: name.trim(),
        description: description.trim(),
        currency: isUSD ? 'USD' : 'KRW',
        cost_krw: costKRW ? parseFloat(costKRW.replace(/,/g, '')) : undefined,
        is_locked: isLoan ? false : isLocked,
        interest_rate: interestRate ? parseFloat(interestRate) : null,
        maturity_date: maturityDate ? `${maturityDate}T00:00:00Z` : null,
        loan_type: isLoan ? loanType : '',
        payment_day: isLoan ? parseInt(paymentDay) || 0 : 0,
        memo: memo.trim(),
        acquired_at: acquiredAt ? `${acquiredAt}T00:00:00Z` : null,
      }
      if (isUSD) {
        payload.value_usd = parseFloat(valueUSD)
        payload.value_krw = 0  // server recomputes
      } else {
        payload.value_krw = parseFloat(valueKRW.replace(/,/g, ''))
        payload.value_usd = null
      }
      await onSubmit(payload as CreateOtherAssetRequest | UpdateOtherAssetRequest)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-4 z-10 max-h-[90vh] overflow-y-auto">
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
                  onClick={() => handleTypeChange(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    assetType === t
                      ? t === '대출' ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'
                      : t === '대출' ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {ASSET_TYPE_EMOJI[t]} {t}
                </button>
              ))}
            </div>
            {isLoan && (
              <p className="text-[10px] text-rose-500 mt-1">대출은 자동으로 부채로 분류됩니다</p>
            )}
          </div>

          {/* 인출불가 토글 — 대출 제외 */}
          {!isLoan && (
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-medium text-slate-500">인출/처분 불가 자산?</label>
                <p className="text-[10px] text-slate-400 mt-0.5">부동산·장기투자 등 즉시 현금화 불가</p>
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
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              {isLoan ? '대출명' : '자산명'}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isLoan ? '예: 주택담보대출, 신용대출' : '예: 해운대 아파트, 카카오뱅크 정기예금'}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
            />
          </div>

          {/* 현금 통화 선택 */}
          {isCash && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">통화</label>
              <div className="flex gap-2">
                {(['KRW', 'USD'] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      currency === c ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c === 'KRW' ? '🇰🇷 KRW' : '🇺🇸 USD'}
                  </button>
                ))}
              </div>
              {isUSD && (
                <p className="text-[10px] text-indigo-500 mt-1">실시간 환율로 원화 환산됩니다</p>
              )}
            </div>
          )}

          {/* 금액 */}
          {isUSD ? (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">보유 금액 (USD)</label>
              <input
                type="number"
                value={valueUSD}
                onChange={e => setValueUSD(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>
          ) : (
            <div className={isDeposit || isCash ? '' : 'grid grid-cols-2 gap-3'}>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  {isLoan ? '잔여 대출금 (원)' : isDeposit ? '납입 원금 (원)' : '현재 가치 (원)'}
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
              {!isDeposit && !isCash && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">
                    {isLoan ? '최초 대출 원금 (원)' : '취득원가 (원)'}
                  </label>
                  <input
                    type="number"
                    value={costKRW}
                    onChange={e => setCostKRW(e.target.value)}
                    placeholder="0 (선택)"
                    min="0"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
                  />
                </div>
              )}
            </div>
          )}

          {/* 대출 전용: 상환 방식 */}
          {isLoan && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">상환 방식</label>
              <div className="flex gap-2 flex-wrap">
                {LOAN_TYPES.map(lt => (
                  <button
                    key={lt}
                    type="button"
                    onClick={() => setLoanType(lt)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      loanType === lt ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                    }`}
                  >
                    {lt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 예/적금 가입일 · 대출 실행일 */}
          {(isDeposit || isLoan) && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {isLoan ? '대출 실행일' : '가입일'}
              </label>
              <input
                type="date"
                value={acquiredAt}
                onChange={e => setAcquiredAt(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          {/* 연이율 */}
          {showInterest && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {isLoan ? '대출 연이율 (%)' : '연이율 (%)'}
              </label>
              <input
                type="number"
                value={interestRate}
                onChange={e => setInterestRate(e.target.value)}
                placeholder={isLoan ? '3.8' : '3.5'}
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>
          )}

          {/* 만기일 / 대출 만기 */}
          {showMaturity && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">
                {isLoan ? '대출 만기일' : `만기일${isDeposit ? '' : ' (선택)'}`}
              </label>
              <input
                type="date"
                value={maturityDate}
                onChange={e => setMaturityDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          {/* 대출 납입일 */}
          {isLoan && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">납입일 (매월 몇 일?)</label>
              <input
                type="number"
                value={paymentDay}
                onChange={e => setPaymentDay(e.target.value)}
                placeholder="25"
                min="1"
                max="28"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-400 placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>
          )}

          {/* 대출 월 납입금 프리뷰 */}
          {isLoan && loanPayment !== null && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-rose-700">월 납입금 (예상)</p>
              <p className="text-lg font-bold text-rose-900 tabular-nums">{formatKRW(loanPayment.total)}</p>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-rose-500">
                {loanType !== '만기일시상환' && (
                  <span>원금 {formatKRW(loanPayment.principal)}</span>
                )}
                <span>이자 {formatKRW(loanPayment.interest)}</span>
                <span className="col-span-2 text-rose-400">잔여 {loanPayment.remainingMonths}개월 · 매월 {paymentDay}일 납입</span>
              </div>
              {loanType === '원금균등상환' && (
                <p className="text-[10px] text-rose-400">* 원금균등은 매월 이자가 줄어드는 방식 — 이번 달 기준</p>
              )}
            </div>
          )}

          {/* 예/적금 세후 만기 수령액 */}
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
              placeholder={isLoan ? '금융기관, 용도...' : '부산 해운대구, 전세 보증금...'}
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
            className={`w-full py-3.5 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-60 active:scale-[0.98] ${
              isLoan ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? '저장 중...' : mode === 'add' ? '자산 추가하기' : '수정 저장하기'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ asset, onConfirm, onCancel }: { asset: OtherAsset; onConfirm: () => void; onCancel: () => void }) {
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
          <p className="text-sm text-slate-400 mt-1">이 자산을 삭제하면 복구할 수 없습니다.</p>
        </div>
        <div className="flex gap-2 pb-6">
          <button onClick={onCancel} className="flex-1 py-3 rounded-2xl border border-slate-200 text-sm text-slate-600 font-medium hover:bg-slate-50 transition-colors">취소</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-2xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 active:scale-[0.98] transition-all">삭제</button>
        </div>
      </div>
    </div>
  )
}

// ─── Asset Row ────────────────────────────────────────────────────────────────

function AssetRow({ asset, user, onEdit, onDelete }: { asset: OtherAsset; user?: User; onEdit: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isLoan = asset.asset_type === '대출'
  const pnl = !isLoan && asset.cost_krw > 0 ? asset.value_krw - asset.cost_krw : null
  const isUp = pnl !== null && pnl >= 0

  const afterTaxMaturity = asset.asset_type === '예/적금' && asset.interest_rate != null && asset.maturity_date
    ? calcAfterTaxMaturity(asset.value_krw, asset.interest_rate, asset.acquired_at, asset.maturity_date)
    : null

  const loanPayment = isLoan && asset.interest_rate != null && asset.loan_type && asset.maturity_date
    ? calcLoanPayment(asset.value_krw, asset.interest_rate, asset.loan_type, asset.maturity_date)
    : null

  return (
    <li className="relative flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
        isLoan ? 'bg-rose-50' : asset.is_liability ? 'bg-rose-50' : asset.is_locked ? 'bg-amber-50' : 'bg-emerald-50'
      }`}>
        {ASSET_TYPE_EMOJI[asset.asset_type]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-slate-800 truncate">{asset.name}</p>
          {isLoan && (
            <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-medium">대출</span>
          )}
          {isLoan && asset.loan_type && (
            <span className="text-[10px] bg-rose-50 text-rose-400 px-1.5 py-0.5 rounded">{asset.loan_type}</span>
          )}
          {!isLoan && asset.is_liability && (
            <span className="text-[10px] bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded font-medium">부채</span>
          )}
          {asset.is_locked && !asset.is_liability && (
            <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium">
              <LockClosedIcon className="h-2.5 w-2.5" />인출불가
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {user && <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: user.avatar_color }} />}
          <span className="text-xs text-slate-400 truncate">
            {user?.name}
            {asset.description ? ` · ${asset.description}` : ''}
            {asset.interest_rate != null ? ` · ${asset.interest_rate}%` : ''}
            {isLoan && asset.payment_day ? ` · 매월 ${asset.payment_day}일` : ''}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 text-right mr-1">
        <p className={`text-sm font-bold tabular-nums ${asset.is_liability || isLoan ? 'text-rose-500' : 'text-slate-800'}`}>
          {asset.is_liability || isLoan ? '-' : ''}{formatKRW(asset.value_krw)}
        </p>
        {loanPayment !== null && (
          <p className="text-[10px] text-rose-400 font-semibold tabular-nums">
            월 {formatKRW(loanPayment.total)}
          </p>
        )}
        {afterTaxMaturity !== null && (
          <p className="text-[10px] text-indigo-500 font-semibold tabular-nums">만기 {formatKRW(afterTaxMaturity)}</p>
        )}
        {pnl !== null && afterTaxMaturity === null && (
          <p className={`text-xs font-semibold tabular-nums ${isUp ? 'text-emerald-600' : 'text-rose-500'}`}>
            {isUp ? '+' : ''}{formatKRW(pnl)}
          </p>
        )}
        {asset.maturity_date && (
          <p className="text-[10px] text-slate-400">{asset.maturity_date.slice(0, 10)}</p>
        )}
      </div>

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
              <button onClick={() => { setMenuOpen(false); onEdit() }} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                <PencilSquareIcon className="h-4 w-4 text-slate-400" />수정
              </button>
              <button onClick={() => { setMenuOpen(false); onDelete() }} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 transition-colors">
                <TrashIcon className="h-4 w-4" />삭제
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

  const liquidAssets  = safeAssets.filter(a => !a.is_liability && !a.is_locked && a.asset_type !== '대출')
  const lockedAssets  = safeAssets.filter(a => !a.is_liability && a.is_locked)
  const liabilities   = safeAssets.filter(a => a.is_liability || a.asset_type === '대출')

  const totalLiquid    = liquidAssets.reduce((s, a) => s + a.value_krw, 0)
  const totalLocked    = lockedAssets.reduce((s, a) => s + a.value_krw, 0)
  const totalLiability = liabilities.reduce((s, a) => s + a.value_krw, 0)
  const net            = totalLiquid + totalLocked - totalLiability

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">기타 자산</h2>
            {safeAssets.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">부동산·예/적금·현금·대출 등</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {safeAssets.length > 0 && (
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800 tabular-nums">{formatKRW(net)}</p>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  {totalLocked > 0 && (
                    <span className="text-[10px] text-amber-500 tabular-nums flex items-center gap-0.5">
                      <LockClosedIcon className="h-2.5 w-2.5" />{formatKRW(totalLocked)}
                    </span>
                  )}
                  {totalLiability > 0 && (
                    <span className="text-[10px] text-rose-500 tabular-nums">-{formatKRW(totalLiability)}</span>
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

        {safeAssets.length === 0 ? (
          <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
            <p className="text-sm font-medium text-slate-400">등록된 자산이 없습니다</p>
            <p className="text-xs text-slate-300">+ 버튼으로 부동산, 예/적금, 대출 등을 추가해보세요</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {liquidAssets.length > 0 && (lockedAssets.length > 0 || liabilities.length > 0) && (
              <li className="px-5 py-1.5 bg-slate-50">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">유동 자산</span>
              </li>
            )}
            {liquidAssets.map(asset => (
              <AssetRow key={asset.id} asset={asset} user={userMap[asset.user_id]} onEdit={() => setEditingAsset(asset)} onDelete={() => setPendingDelete(asset)} />
            ))}

            {lockedAssets.length > 0 && (
              <li className="px-5 py-1.5 bg-amber-50 flex items-center gap-1.5">
                <LockClosedIcon className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">인출 불가 자산</span>
              </li>
            )}
            {lockedAssets.map(asset => (
              <AssetRow key={asset.id} asset={asset} user={userMap[asset.user_id]} onEdit={() => setEditingAsset(asset)} onDelete={() => setPendingDelete(asset)} />
            ))}

            {liabilities.length > 0 && (
              <li className="px-5 py-1.5 bg-rose-50">
                <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wide">부채 · 대출</span>
              </li>
            )}
            {liabilities.map(asset => (
              <AssetRow key={asset.id} asset={asset} user={userMap[asset.user_id]} onEdit={() => setEditingAsset(asset)} onDelete={() => setPendingDelete(asset)} />
            ))}
          </ul>
        )}
      </div>

      {showAdd && (
        <AssetFormModal mode="add" users={safeUsers} onClose={() => setShowAdd(false)} onSubmit={data => onAdd(data as CreateOtherAssetRequest)} />
      )}
      {editingAsset && (
        <AssetFormModal mode="edit" initial={editingAsset} users={safeUsers} onClose={() => setEditingAsset(null)} onSubmit={data => onEdit(editingAsset.id, data as UpdateOtherAssetRequest)} />
      )}
      {pendingDelete && (
        <DeleteConfirm
          asset={pendingDelete}
          onConfirm={async () => { await onDelete(pendingDelete.id); setPendingDelete(null) }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
