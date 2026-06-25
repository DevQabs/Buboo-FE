# Frontend Design System

> 이 문서는 AI 코드 생성 시에도 반드시 준수해야 할 디자인 시스템 규칙입니다.

## 색상 팔레트 (Option B — Royal Blue + Emerald)

| 역할 | Tailwind 토큰 | 헥스 | 용도 |
|------|-------------|------|------|
| **Primary** | `brand-500` | `#0F4C81` | 버튼, 액션, 포커스 링, 탭 액티브 |
| **Primary Light** | `brand-50` | `#eff6ff` | 배경 강조, 선택 상태 bg |
| **Primary Mid** | `brand-100` | `#dbeafe` | 보조 배경 |
| **Primary Dark** | `brand-600` | `#0a3d6e` | hover 상태 |
| **Primary Darker** | `brand-700` | `#082e55` | 다크 그래디언트, 텍스트 |
| **Success / 수입 / 이익** | `emerald-500` | `#059669` | 수입, 양수 값, 이익 |
| **Danger / 지출 / 손실** | `rose-500` | `#E11D48` | 지출, 음수 값, 손실, 삭제 |
| **Background** | `bg-[#F1F5F9]` | `#F1F5F9` | 페이지 배경 |
| **Card** | `bg-white` | `#FFFFFF` | 카드 배경 |
| **Neutral** | `slate-*` | Tailwind 기본 | 텍스트, 경계선, 아이콘 |
| **Warning** | `amber-*` | Tailwind 기본 | 고정비, 주의 상태 |

## 타이포그래피

**기본 폰트:** `Pretendard Variable` (최우선) → `Pretendard` → 시스템 폰트 폴백

### 텍스트 스케일 표준

| 역할 | 클래스 |
|------|--------|
| 카드 섹션 제목 | `text-sm font-bold text-slate-800` |
| 주요 금액 (카드 헤더) | `text-base font-black tabular-nums text-slate-800` |
| 보조 금액/손익 | `text-xs font-semibold tabular-nums` + emerald/rose |
| 폼 레이블 | `text-xs font-medium text-slate-500 mb-1 block` |
| 모달 헤더 | `text-base font-bold text-slate-800` |
| 캡션/부가 정보 | `text-xs text-slate-400` |
| 배지/태그 | `text-[10px] font-semibold` (공간 제약 시) / `text-xs font-medium` (여유 있을 때) |

**금지:** `text-[11px]` 사용 금지 → `text-xs` 사용
- CDN: `pretendardvariable-dynamic-subset.min.css` (`globals.css`에서 로드)
- `font-sans` 클래스 = Pretendard Variable 자동 적용
- 숫자: `tabular-nums` 클래스 사용 (금액 정렬)

## 절대 금지 규칙

- **`indigo-*` 클래스 사용 금지** → `brand-*` 사용
- **`blue-*` 클래스 사용 금지** → `brand-*` 사용
- `emerald` / `rose` / `slate` / `amber` 변경 금지 (의미 색상)

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
className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4"
```

### 탭 액티브 상태
```tsx
activeTab === 'X' ? 'text-brand-600' : 'text-slate-400'
activeTab === 'X' ? 'bg-brand-50' : ''
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
`ScheduleTab.tsx`의 `COLOR_MAP`에서 `indigo` → `brand-*`으로 매핑.
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
