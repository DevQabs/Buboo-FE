// 카드별 불러오기 상태. 같은 카드에 요청이 겹칠 수 있어(달 넘기기·저장 뒤 새로고침) 진행 중 개수로 센다.

export interface LoadState {
  /** 진행 중인 요청 수 */
  pending: number
  /** 마지막으로 끝난 요청이 실패했는지 */
  error: boolean
  /** 한 번이라도 받아 왔는지(받은 뒤로는 새로고침이 화면을 가리지 않는다) */
  loaded: boolean
}

/** spinner: 처음 받는 중, error: 처음 받기 실패, refreshing: 있는 데이터 위로 새로고침 중 */
export type SectionView = 'spinner' | 'error' | 'refreshing' | 'content'

export interface SectionState {
  view: SectionView
  onRetry: () => void
}

export type LoadEvent = 'start' | 'ok' | 'error' | 'abort'

export function stepLoad(s: LoadState | undefined, ev: LoadEvent): LoadState {
  const cur = s ?? { pending: 0, error: false, loaded: false }
  if (ev === 'start') return { ...cur, pending: cur.pending + 1 }
  const pending = Math.max(0, cur.pending - 1)
  if (ev === 'ok') return { pending, error: false, loaded: true }
  if (ev === 'error') return { ...cur, pending, error: true }
  return { ...cur, pending }
}

/** 아직 한 번도 시작 안 한 카드(undefined)는 곧 받을 것이라 spinner 로 둔다 */
export function sectionView(s: LoadState | undefined): SectionView {
  if (!s) return 'spinner'
  if (s.loaded) return s.pending > 0 ? 'refreshing' : 'content'
  if (s.pending > 0) return 'spinner'
  return s.error ? 'error' : 'spinner'
}

const RANK: Record<SectionView, number> = { error: 3, spinner: 2, refreshing: 1, content: 0 }

/** 여러 데이터를 같이 쓰는 카드: 가장 나쁜 상태를 따른다 */
export function mergeViews(...views: SectionView[]): SectionView {
  return views.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'content')
}
