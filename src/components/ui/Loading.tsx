// 불러오는 중·불러오기 실패 표시. 화면 전체가 아니라 카드마다 쓴다(이미 받은 카드는 그대로 둔다).
import type { ReactNode } from 'react'
import type { SectionState } from '@/lib/loadState'

const RING = { sm: 'h-3 w-3 border-[1.5px]', md: 'h-5 w-5 border-2' } as const
const DOT = { sm: 'h-1.5 w-1.5', md: 'h-2.5 w-2.5' } as const

/** 돌아가는 고리. 줄인 움직임이면 깜빡이는 점으로 바뀐다 */
function Ring({ size }: { size: keyof typeof RING }) {
  return (
    <span aria-hidden className="inline-flex items-center justify-center">
      <span className={`${RING[size]} rounded-full border-brand-100 border-t-brand-500 motion-safe:animate-spin motion-reduce:hidden`} />
      <span className={`${DOT[size]} hidden rounded-full bg-brand-500 motion-reduce:block motion-reduce:animate-pulse`} />
    </span>
  )
}

export function Spinner({ size = 'md', label = '불러오는 중' }: { size?: keyof typeof RING; label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex">
      <Ring size={size} />
      <span className="sr-only">{label}</span>
    </span>
  )
}

const BOX = 'flex flex-col items-center justify-center gap-2 rounded-card bg-white shadow-warm px-4'

/** 카드 자리를 같은 높이로 잡아 둔 채 불러오는 중 */
export function SectionLoading({ minH = 96 }: { minH?: number }) {
  return (
    <div role="status" aria-live="polite" className={BOX} style={{ minHeight: minH }}>
      <Ring size="md" />
      <span className="text-xs text-stone-400">불러오는 중</span>
    </div>
  )
}

export function SectionError({ onRetry, minH = 96 }: { onRetry: () => void; minH?: number }) {
  return (
    <div role="alert" className={BOX} style={{ minHeight: minH }}>
      <span className="text-sm text-stone-500">불러오지 못했어요</span>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 rounded-xl bg-brand-50 px-4 text-sm font-semibold text-brand-500 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        다시 시도
      </button>
    </div>
  )
}

/**
 * 카드 하나의 불러오기 상태를 감싼다. 처음엔 SectionLoading/SectionError, 받은 뒤 새로고침 중엔
 * 내용 위 가운데에 작은 고리만 띄운다. 감싸는 div 는 늘 같아서 새로고침해도 카드 안 상태가 유지된다.
 * 내용이 아무것도 안 그리면(빈 카드 숨김) empty:hidden 으로 칸 간격도 남기지 않는다.
 */
export function Section({ s, minH, children }: { s: SectionState; minH?: number; children: ReactNode }) {
  if (s.view === 'spinner') return <SectionLoading minH={minH} />
  if (s.view === 'error') return <SectionError minH={minH} onRetry={s.onRetry} />
  return (
    <div className="relative empty:hidden">
      {children}
      {s.view === 'refreshing' && (
        <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2">
          <Spinner size="sm" label="새로 고치는 중" />
        </span>
      )}
    </div>
  )
}

/** 헤더 아래 얇은 진행 막대. 탭 데이터를 받는 동안 바로 보인다 */
export function TopProgress({ on }: { on: boolean }) {
  if (!on) return null
  return (
    <div role="progressbar" aria-label="불러오는 중" className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-brand-100">
      <div className="h-full w-2/5 bg-brand-500 motion-safe:animate-indeterminate motion-reduce:w-full motion-reduce:animate-pulse" />
    </div>
  )
}
