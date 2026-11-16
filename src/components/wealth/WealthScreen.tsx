'use client'

// 자산 B (시안 wealth-b): 구성비 도넛 → 보유 종목 한 줄 목록 → 예적금·기타 접힌 행.
import { useState, type ReactNode } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Card, PageTitle } from '@/components/ui/Card'
import { Section } from '@/components/ui/Loading'
import type { SectionState } from '@/lib/loadState'
import StockPortfolioCard from '@/components/dashboard/StockPortfolioCard'
import OtherAssetCard from '@/components/dashboard/OtherAssetCard'
import AllocationCard from './AllocationCard'
import type {
  CreateOtherAssetRequest, OtherAsset, PortfolioSummary, StockAssetWithPrice, UpdateOtherAssetRequest, User,
} from '@/types'

interface WealthScreenProps {
  canEdit: boolean
  /** 종목·자산 불러오기 상태(구성비·보유 종목·예적금 카드 공용) */
  holdings: SectionState
  chips: ReactNode
  accessToken: string
  currentUserID: string
  users: User[]
  portfolio: StockAssetWithPrice[]
  portfolioSummary: PortfolioSummary | null
  otherAssets: OtherAsset[]
  fixedExpenseTitles: string[]
  onAddStock: () => void
  onHistory: () => void
  onEditStock: (asset: StockAssetWithPrice) => void
  onBuySell: (asset: StockAssetWithPrice, mode: 'buy' | 'sell') => void
  onDeleteStock: (asset: StockAssetWithPrice) => Promise<void>
  onReorderStocks: (ids: string[]) => Promise<void>
  onAddAsset: (data: CreateOtherAssetRequest) => Promise<void>
  onEditAsset: (id: string, data: UpdateOtherAssetRequest) => Promise<void>
  onDeleteAsset: (id: string) => Promise<void>
  onCreateLoanExpense: (id: string) => Promise<void>
  onReorderAssets: (ids: string[]) => Promise<void>
}

export default function WealthScreen(p: WealthScreenProps) {
  const [showOther, setShowOther] = useState(false)
  return (
    <div className="space-y-3">
      <PageTitle eyebrow="자산" title="자산현황" />
      {p.chips}

      <Section s={p.holdings} minH={200}>
        <AllocationCard portfolioSummary={p.portfolioSummary} otherAssets={p.otherAssets} />
      </Section>

      <Section s={p.holdings} minH={160}>
      <StockPortfolioCard
        assets={p.portfolio}
        users={p.users}
        summary={p.portfolioSummary}
        accessToken={p.accessToken}
        canEdit={p.canEdit}
        onAddClick={p.onAddStock}
        onHistoryClick={p.onHistory}
        onEditClick={p.onEditStock}
        onBuySellClick={p.onBuySell}
        onDeleteClick={p.onDeleteStock}
        onReorder={p.onReorderStocks}
      />
      </Section>

      <Section s={p.holdings} minH={48}>
      <Card>
        <button type="button" onClick={() => setShowOther(v => !v)} className="flex w-full items-center justify-between px-4 py-3">
          <span className="text-sm font-bold text-stone-800">예적금 · 기타</span>
          <span className="flex items-center gap-1 text-xs text-stone-400">
            {p.otherAssets.length}건
            <ChevronDownIcon className={`h-4 w-4 transition-transform ${showOther ? 'rotate-180' : ''}`} />
          </span>
        </button>
      </Card>
      </Section>
      {showOther && p.holdings.view !== 'spinner' && p.holdings.view !== 'error' && (
        <OtherAssetCard
          assets={p.otherAssets}
          users={p.users}
          currentUserID={p.currentUserID}
          fixedExpenseTitles={p.fixedExpenseTitles}
          onAdd={p.onAddAsset}
          onEdit={p.onEditAsset}
          onDelete={p.onDeleteAsset}
          onCreateLoanExpense={p.onCreateLoanExpense}
          onReorder={p.onReorderAssets}
          canEdit={p.canEdit}
        />
      )}
    </div>
  )
}
