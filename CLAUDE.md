# Frontend Design System

> 이 문서는 AI 코드 생성 시에도 반드시 준수해야 할 디자인 시스템 규칙입니다.

## 톤: B — 따뜻한 가족 앨범

근거: `buboo-be/docs/superpowers/specs/2026-11-16-uri-jip-design.md` 7절, 시안 `buboo-be/docs/superpowers/specs/2026-11-16-uri-jip-mockups/visual-direction.html`(B), `redesign-screens.html`.
크림 배경 위 흰 카드, 브랜드 블루는 포인트(선택 칩·주요 버튼·핵심 숫자)에만.

## 색상 팔레트

| 역할 | Tailwind 토큰 | 헥스 | 용도 |
|------|-------------|------|------|
| **Primary** | `brand-500` | `#0F4C81` | 주요 버튼, 선택 칩, 탭 액티브, 핵심 숫자, 포커스 링 |
| **Primary Light** | `brand-50` | `#eff6ff` | 아이콘 배경 |
| **Primary Mid** | `brand-100` | `#dbeafe` | 보조 배경 |
| **Primary Dark** | `brand-600` | `#0a3d6e` | hover |
| **Primary Darker** | `brand-700` | `#082e55` | 진한 글자 |
| **Success / 수입 / 이익** | `emerald-500` | `#059669` | 수입, 양수, 이익 |
| **Danger / 지출 / 손실** | `rose-500` | `#E11D48` | 지출, 음수, 손실, 삭제 |
| **Warning / 고정비** | `amber-*` | Tailwind 기본 | 고정비, 주의 |
| **페이지 배경** | `bg-cream` | `#FBF8F3` | body, 헤더 |
| **카드** | `bg-white` | `#FFFFFF` | 카드 |
| **옅은 바탕** | `bg-sand` | `#F5EFE6` | 막대의 빈 부분, 빈 칸 |
| **테두리** | `border-line` | `#EEE7DD` | 칩 테두리, 구분선 |
| **중립 글자·아이콘** | `stone-*` | Tailwind 기본 | 본문 `stone-800`, 보조 `stone-500`, 캡션 `stone-400` |
| **의미 회색** | `slate-*` | Tailwind 기본 | 의미가 있는 회색(예: 기분 '피곤'). 아직 B 톤으로 안 바꾼 옛 모달 안은 slate 그대로 둔다 |

## 타이포그래피

**기본 폰트:** `Pretendard Variable` (최우선) → `Pretendard` → 시스템 폰트 폴백

| 역할 | 클래스 |
|------|--------|
| 화면 제목 | `PageTitle` (작은 설명 `text-xs text-stone-400` + 제목 `text-xl font-extrabold text-stone-800`) |
| 카드 섹션 제목 | `text-sm font-bold text-stone-800` |
| 핵심 숫자 (히어로) | `text-3xl font-black tabular-nums text-brand-500` |
| 주요 금액 | `text-base font-black tabular-nums text-stone-800` |
| 보조 금액/손익 | `text-xs font-semibold tabular-nums` + emerald/rose |
| 폼 레이블 | `text-xs font-medium text-stone-500 mb-1 block` |
| 캡션/부가 정보 | `text-xs text-stone-400` |
| 배지/태그 | `text-[10px] font-semibold` (공간 제약 시) / `text-xs font-medium` |

- 숫자: `tabular-nums`. 금액 줄여 쓰기: `formatMan()` (`@/lib/formatNumber`).

## 절대 금지 규칙

- **`indigo-*` 클래스 금지** → `brand-*`
- **`blue-*` 클래스 금지** → `brand-*`
- **`text-[11px]` 금지** → `text-xs`
- **이모지 금지** — 화면 문구, 코드, 주석, 커밋 어디에도
- `emerald` / `rose` / `slate` / `amber` 의미 바꾸지 말 것
- **`fetch(` 직접 호출 금지** → `@/lib/api`의 `apiFetch(path, accessToken, options)` (토큰·`res.ok` 검사). 실패는 `toastError()`(`@/components/ui/Toast`) 또는 폼 오류 문구로 알리고, 낙관적 반영은 되돌린다
- **누르는 요소 최소 44px(필터 칩 40px), 2단 메뉴는 전체 폭 세그먼트** — 작은 아이콘 버튼은 `before:` 로 누르는 영역을 넓힌다(`IconButton`)
- 오늘 날짜는 `todayKST()` (`@/lib/date`). `toISOString().slice(0, 10)` 금지

## 공용 조각 (`@/components/ui/Card`, `@/components/ui/Toast`)

| 조각 | 쓰임 |
|------|------|
| `Card` | 흰 카드 `rounded-card bg-white shadow-warm` |
| `PageTitle` | 화면 머리(시안 `.hd`) |
| `SectionLabel` | 카드 위 작은 소제목(시안 `.lb`) |
| `Chip` | 화면 안 필터·선택 칩(`min-h-10 py-2.5 text-sm`), 선택 시 `brand-500` 채움 |
| `Segmented` | 2단 메뉴 전체 폭 세그먼트(칸 같은 폭, `h-11 text-sm font-semibold`) |
| `IconButton` | 머리 오른쪽 둥근 아이콘 버튼 |
| `FloatingBar` | 하단 탭 위 입력 바(가계부 금액 입력, 일기 쓰기) |
| `showToast` / `toastError` / `Toaster` | 저장 실패 알림(`Toaster`는 대시보드에 하나) |

## 아바타 색상

`DashboardClient.tsx`에서 users 로드 시 role별 자동 주입:
```typescript
husband → '#0F4C81'  (brand-500)
wife    → '#FDA4AF'  (rose-300 pastel)
```
컴포넌트에서 `user.avatar_color` 그대로 사용. 별도 처리 불필요.

## 컴포넌트 패턴

### 기본 버튼 (Primary)
```tsx
className="py-3 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-40"
```

### 보조 버튼 (Secondary)
```tsx
className="py-3 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
```

### 포커스 링
```tsx
focus:ring-2 focus:ring-brand-500 focus:outline-none
```

### 카드
```tsx
className="rounded-card bg-white shadow-warm p-4"  // 또는 <Card>
```

### 탭 액티브 상태
```tsx
on ? 'text-brand-500' : 'text-stone-400'
on ? 'bg-brand-500 text-white' : ''   // 아이콘 칸 채움
```

### 유저 선택 아바타 버튼 (모달 헤더)
```tsx
className={`w-7 h-7 rounded-full text-white text-xs font-bold transition-all
  ${userID === u.id ? 'ring-2 ring-offset-1 ring-brand-500 scale-110' : 'opacity-40'}`}
style={{ backgroundColor: u.avatar_color }}
```

### 입력 필드
```tsx
className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
```

## 스케줄 색상 (`ScheduleColor`)

DB에 `'indigo' | 'rose' | 'emerald' | 'amber' | 'sky'` 저장.
`life/ScheduleScreen.tsx`·`ScheduleModals.tsx`의 `COLOR_MAP`에서 `indigo` → `brand-*`으로 매핑.
**타입/DB 값은 변경하지 말 것.**

## 고정비 Owner 색상

| Owner | 색상 |
|-------|------|
| `husband` | `#0F4C81` (brand) |
| `wife` | `#059669` (emerald) |
| `joint` | `#8b5cf6` (violet — 유지) |

## 레이아웃 표준

| 요소 | 값 |
|------|-----|
| 바텀 내비 높이 | `4rem` (64px) — CSS var `--nav-h` |
| 메인 콘텐츠 하단 패딩 | `pb-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+1rem)]` |
| FAB bottom | `bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+1rem)]` |
| z-index 계층 | 헤더: `z-40` / 내비+FAB: `z-50` / 모달: `z-60` |
| Safe area | 바텀 내비 flex컨테이너에 `pb-safe` 적용 |
| 수평 패딩 | 헤더: `px-5` / 메인 콘텐츠: `px-3` |
| 카드 간격 | `space-y-3` |
| 하단 탭바 | `rounded-t-card bg-white shadow-warm-up` |
| 떠 있는 입력 바 | `FloatingBar` — 탭바 위 `0.75rem`, 화면은 `pb-20`으로 가리지 않게 |

## 포트 & 실행

```bash
# 백엔드: 8090
DATABASE_URL=... COUPLE_ID=... go run ./cmd/main.go

# 프론트: 3300
cd frontend && npm run dev
# → http://localhost:3300/dashboard
```

## 타입 체크

```bash
cd frontend && npx tsc --noEmit
```
