// B 톤 공용 조각(설계서 7절). 두 화면 이상이 쓰는 것만 둔다.
import type { ReactNode } from 'react'

/** 흰 카드: rounded-[22px] + 따뜻한 그림자 */
export function Card({ className = '', onClick, children }: { className?: string; onClick?: () => void; children: ReactNode }) {
  return (
    <div onClick={onClick} className={`rounded-card bg-white shadow-warm ${className}`}>
      {children}
    </div>
  )
}

/** 화면 머리: 작은 설명 + 큰 제목 + 오른쪽 도구 (시안 .hd) */
export function PageTitle({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-1">
      <div>
        <p className="text-xs text-stone-400">{eyebrow}</p>
        <h2 className="text-xl font-extrabold text-stone-800">{title}</h2>
      </div>
      {right && <div className="flex items-center gap-1">{right}</div>}
    </div>
  )
}

/** 카드 위 작은 소제목 (시안 .lb) */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="px-2 text-xs font-medium text-stone-400">{children}</p>
}

/** 2단 메뉴·선택 칩. 선택 시 brand-500 채움 */
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        on ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-white text-stone-500'
      }`}
    >
      {children}
    </button>
  )
}

/** 머리 오른쪽 둥근 아이콘 버튼 */
export function IconButton({ label, on = false, onClick, children }: { label: string; on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
        on ? 'bg-brand-500 text-white' : 'bg-white text-stone-500 shadow-warm'
      }`}
    >
      {children}
    </button>
  )
}

/** 하단 탭 위에 떠 있는 입력 바. 탭바가 없으면(탭이 하나뿐) 화면 바닥에 붙는다 */
export function FloatingBar({ hasNav, onClick, className = '', children }: { hasNav: boolean; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <div
      className={`fixed inset-x-0 z-50 px-3 ${
        hasNav
          ? 'bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+0.75rem)]'
          : 'bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`mx-auto flex w-full max-w-[calc(42rem-1.5rem)] items-center justify-between rounded-[18px] px-4 py-3 text-sm ${className}`}
      >
        {children}
      </button>
    </div>
  )
}
