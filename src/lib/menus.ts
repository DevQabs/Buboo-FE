import type { MenuKey, MyPermissions, PermLevel } from '@/types'

export type TabKey = 'baby' | 'ledger' | 'life' | 'wealth'
export interface SubMenu { key: MenuKey; label: string }
export interface TabDef { key: TabKey; label: string; subs: SubMenu[] }

/** 설계서 3절 메뉴 구조. 배열 순서 = 하단 탭 순서 = 기본 진입 우선순위. */
export const TABS: TabDef[] = [
  { key: 'baby', label: '아기', subs: [{ key: 'baby_photo', label: '사진일기' }, { key: 'baby_growth', label: '성장' }] },
  { key: 'ledger', label: '가계부', subs: [{ key: 'ledger', label: '가계부' }] },
  { key: 'life', label: '일상', subs: [{ key: 'schedule', label: '일정' }, { key: 'diary', label: '일기' }] },
  { key: 'wealth', label: '자산', subs: [{ key: 'assets', label: '자산현황' }, { key: 'roadmap', label: '로드맵' }] },
]

export function levelOf(p: MyPermissions | null, menu: MenuKey): PermLevel {
  if (!p) return 'hidden'
  if (p.is_owner) return 'edit'
  return p.menus[menu] ?? 'hidden'
}

/** 보이는 1단 탭과 그 안의 보이는 2단 메뉴만 남긴다. */
export function visibleTabs(p: MyPermissions | null): TabDef[] {
  return TABS
    .map(t => ({ ...t, subs: t.subs.filter(s => levelOf(p, s.key) !== 'hidden') }))
    .filter(t => t.subs.length > 0)
}

/** 구성원 목록 한 줄 요약. 예: "사진일기·성장 편집, 일정 보기" */
export function permissionSummary(p: MyPermissions): string {
  if (p.is_owner) return '관리자 · 전체'
  const all = TABS.flatMap(t => t.subs)
  const edit = all.filter(s => levelOf(p, s.key) === 'edit')
  const view = all.filter(s => levelOf(p, s.key) === 'view')
  if (edit.length === all.length) return '전체 편집'
  if (edit.length === 0 && view.length === 0) return '권한 없음'
  const part = (subs: SubMenu[], word: string) => (subs.length ? `${subs.map(s => s.label).join('·')} ${word}` : '')
  return [part(edit, '편집'), part(view, '보기')].filter(Boolean).join(', ')
}
