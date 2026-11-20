// 자산현황 계산(설계서 7절 자산 B). 런타임 import 없음.
import type { OtherAsset } from '@/types'

type AssetFields = Pick<OtherAsset, 'asset_type' | 'is_liability' | 'is_locked' | 'value_krw'>

export interface Slice { key: 'stock' | 'liquid' | 'estate' | 'locked'; label: string; value: number; pct: number; color: string }

/** 주식·예적금(현금 포함)·부동산·그 밖에 묶인 자산 비중과 대출. 분류는 OtherAssetCard 의 liquid/locked/liability 와 같다. */
export function allocation(stockKRW: number, assets: AssetFields[]): { slices: Slice[]; gross: number; liability: number; net: number } {
  const isDebt = (a: AssetFields) => a.is_liability || a.asset_type === '대출'
  const sum = (xs: AssetFields[]) => xs.reduce((s, a) => s + a.value_krw, 0)
  const isEstate = (a: AssetFields) => !isDebt(a) && a.asset_type === '부동산'
  const liquid = sum(assets.filter(a => !isDebt(a) && !isEstate(a) && !a.is_locked))
  const estate = sum(assets.filter(isEstate))
  const locked = sum(assets.filter(a => !isDebt(a) && !isEstate(a) && a.is_locked))
  const liability = sum(assets.filter(isDebt))
  const gross = stockKRW + liquid + estate + locked
  const pct = (v: number) => (gross > 0 ? (v / gross) * 100 : 0)
  return {
    slices: [
      { key: 'stock', label: '주식', value: stockKRW, pct: pct(stockKRW), color: '#0F4C81' },
      { key: 'liquid', label: '예적금·현금', value: liquid, pct: pct(liquid), color: '#34D399' },
      { key: 'estate', label: '부동산', value: estate, pct: pct(estate), color: '#FB923C' },
      { key: 'locked', label: '묶인 자산', value: locked, pct: pct(locked), color: '#FBBF24' },
    ],
    gross,
    liability,
    net: gross - liability,
  }
}

const qty = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 4 })

/** 여러 명이 나눠 가진 종목의 합계 주식 수 "412주". 누가 얼마인지는 행을 펼쳐 본다. */
export function totalShares(holdings: { quantity: number }[]): string {
  return `${qty(holdings.reduce((s, h) => s + h.quantity, 0))}주`
}
