'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { PlusIcon, XMarkIcon, PencilIcon } from '@heroicons/react/24/outline'
import type {
  FridgeItem, SideDish,
  CreateFridgeItemRequest, UpdateFridgeItemRequest,
  CreateSideDishRequest, UpdateSideDishRequest,
  FridgeLocation, FridgeCategory, SideDishLocation,
} from '@/types'
import { FRIDGE_CATEGORIES } from '@/types'

// ─── 선반 위치 정의 (상단=냉동, 중단=냉장, 채소칸, 신선실=실온) ──────────────

type ShelfId = '냉동' | '냉장' | '채소칸' | '실온'

const SHELF_LABEL: Record<ShelfId, string> = {
  냉동: '상단 선반 · 냉동',
  냉장: '중단 선반 · 냉장',
  채소칸: '채소칸',
  실온: '신선실 · 실온 & 반찬',
}

const SHELF_ICON: Record<ShelfId, string> = {
  냉동: '❄️',
  냉장: '🥶',
  채소칸: '🥬',
  실온: '🌿',
}

const SHELF_COLOR: Record<ShelfId, string> = {
  냉동: 'bg-sky-50/70',
  냉장: 'bg-blue-50/70',
  채소칸: 'bg-emerald-50/70',
  실온: 'bg-green-50/60',
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    .toISOString().slice(0, 10)
}

function toDateStr(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function addDaysToToday(days: number): string {
  const d = new Date(todayStr())
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysUntil(isoOrNull: string | null | undefined): number | null {
  if (!isoOrNull) return null
  const today = new Date(todayStr())
  const target = new Date(isoOrNull.slice(0, 10))
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function daysSince(iso: string): number {
  const today = new Date(todayStr())
  const target = new Date(iso.slice(0, 10))
  return Math.round((today.getTime() - target.getTime()) / 86400000)
}

// ─── D-Day 상태 ───────────────────────────────────────────────────────────────

type ExpiryStatus = 'fresh' | 'warn' | 'expired' | 'none'

function getExpiryStatus(isoDate: string | null | undefined): ExpiryStatus {
  const days = daysUntil(isoDate)
  if (days === null) return 'none'
  if (days <= 0)    return 'expired'
  if (days <= 3)    return 'warn'
  return 'fresh'
}

const CARD_BG: Record<ExpiryStatus, string> = {
  fresh:   'bg-green-50 border-green-200',
  warn:    'bg-amber-50 border-amber-200',
  expired: 'bg-red-50 border-red-200',
  none:    'bg-white/80 border-slate-200/70',
}

const BADGE_COLOR: Record<ExpiryStatus, string> = {
  fresh:   'bg-green-100 text-green-700',
  warn:    'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-600 animate-pulse',
  none:    'bg-slate-100 text-slate-500',
}

function getDDayLabel(isoDate: string | null | undefined): string | null {
  const days = daysUntil(isoDate)
  if (days === null) return null
  if (days < 0)  return `D+${Math.abs(days)}`
  if (days === 0) return 'D-Day'
  return `D-${days}`
}

// ─── ShelfItem 타입 ───────────────────────────────────────────────────────────

interface ShelfItem {
  id: string
  name: string
  expiryDate?: string | null
  subLabel?: string
  type: 'item' | 'dish'
  currentShelf: ShelfId
  quantity?: string
  isPackaged?: boolean
}

// ─── DraggableFoodCard ────────────────────────────────────────────────────────
// 드래그 가능 + 항상 보이는 × 버튼

interface DraggableFoodCardProps {
  item: ShelfItem
  isDragDisabled?: boolean
  onDelete: () => void
  onEdit: () => void
}

function DraggableFoodCard({ item, isDragDisabled, onDelete, onEdit }: DraggableFoodCardProps) {
  const [showActions, setShowActions] = useState(false)
  const status  = getExpiryStatus(item.expiryDate)
  const ddLabel = getDDayLabel(item.expiryDate)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: isDragDisabled,
    data: { type: item.type, currentShelf: item.currentShelf },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.35 : 1,
    touchAction: 'none',
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowActions(false)
    onDelete()
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowActions(false)
    onEdit()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative rounded-2xl border p-2.5 select-none
        transition-all duration-150
        ${CARD_BG[status]}
        ${isDragging ? 'shadow-xl z-50 scale-105' : 'shadow-sm'}
      `}
    >
      {/* 드래그 핸들 + 카드 내용 영역 */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
        onClick={() => setShowActions(s => !s)}
      >
        {/* 드래그 인디케이터 (상단 점 3개) */}
        <div className="flex justify-center mb-1 gap-0.5 opacity-30">
          <span className="w-1 h-1 rounded-full bg-slate-400" />
          <span className="w-1 h-1 rounded-full bg-slate-400" />
          <span className="w-1 h-1 rounded-full bg-slate-400" />
        </div>

        {/* 음식명 */}
        <p className="text-xs font-bold text-slate-800 truncate leading-snug pr-4">{item.name}</p>

        {/* 완제품 수량 뱃지 */}
        {item.isPackaged && item.quantity && (
          <span className="mt-0.5 inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
            {item.quantity}개
          </span>
        )}

        {/* D-Day 배지 */}
        {ddLabel ? (
          <span className={`mt-0.5 inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${BADGE_COLOR[status]}`}>
            {ddLabel}
          </span>
        ) : (!item.isPackaged && item.subLabel) ? (
          <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{item.subLabel}</p>
        ) : null}
      </div>

      {/* 항상 보이는 × 삭제 버튼 */}
      <button
        onClick={handleDeleteClick}
        className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-slate-200/80 hover:bg-rose-400 hover:text-white flex items-center justify-center transition-colors text-slate-500"
        title="삭제"
      >
        <XMarkIcon className="w-2.5 h-2.5" />
      </button>

      {/* 탭 시 수정 버튼 오버레이 */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 rounded-2xl flex items-center justify-center bg-white/90 backdrop-blur-sm z-10"
            onClick={() => setShowActions(false)}
          >
            <button
              onClick={handleEditClick}
              className="flex items-center gap-1 px-3 py-1.5 bg-brand-500 text-white rounded-xl text-[11px] font-bold shadow hover:bg-brand-600 transition-colors"
            >
              <PencilIcon className="h-3 w-3" /> 수정
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── DragOverlayCard (드래그 중 떠다니는 카드) ───────────────────────────────

function DragOverlayCard({ item }: { item: ShelfItem | null }) {
  if (!item) return null
  const status  = getExpiryStatus(item.expiryDate)
  const ddLabel = getDDayLabel(item.expiryDate)

  return (
    <div className={`rounded-2xl border p-2.5 shadow-2xl w-28 rotate-3 ${CARD_BG[status]}`}>
      <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
      {ddLabel && (
        <span className={`mt-1 inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${BADGE_COLOR[status]}`}>
          {ddLabel}
        </span>
      )}
    </div>
  )
}

// ─── DroppableShelf ───────────────────────────────────────────────────────────

interface DroppableShelfProps {
  shelfId: ShelfId
  items: ShelfItem[]
  pendingDeleteIds: Set<string>
  onDelete: (id: string, type: 'item' | 'dish') => void
  onEdit:   (id: string, type: 'item' | 'dish') => void
  isDraggingOver?: boolean
}

function DroppableShelf({
  shelfId, items, pendingDeleteIds, onDelete, onEdit,
}: DroppableShelfProps) {
  const { setNodeRef, isOver } = useDroppable({ id: shelfId })

  const visibleItems = items.filter(i => !pendingDeleteIds.has(i.id))

  return (
    <div className="py-3">
      {/* 선반 레이블 */}
      <div className="flex items-center gap-1.5 px-4 mb-2.5">
        <span className="text-base leading-none">{SHELF_ICON[shelfId]}</span>
        <span className="text-[11px] font-bold text-slate-600 tracking-tight">{SHELF_LABEL[shelfId]}</span>
        {visibleItems.length > 0 && (
          <span className="text-[10px] text-slate-400 font-medium">({visibleItems.length})</span>
        )}
      </div>

      {/* 유리 선반 면 */}
      <div
        ref={setNodeRef}
        className={`
          mx-3 rounded-2xl border p-3 min-h-[70px]
          shadow-[inset_0_1px_4px_rgba(0,0,0,0.06),0_1px_2px_rgba(255,255,255,0.8)]
          transition-all duration-150 backdrop-blur-sm
          ${SHELF_COLOR[shelfId]}
          ${isOver
            ? 'ring-2 ring-brand-400 ring-offset-1 bg-brand-50/60 scale-[1.01]'
            : ''
          }
        `}
      >
        {visibleItems.length === 0 ? (
          <p className={`text-center text-[11px] py-2 transition-colors ${isOver ? 'text-brand-400 font-medium' : 'text-slate-400'}`}>
            {isOver ? '여기에 놓기' : (shelfId === '실온' ? '실온 식재료나 반찬이 없어요' : `${shelfId} 식재료가 없어요`)}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <AnimatePresence mode="popLayout">
              {visibleItems.map(item => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{
                    scale:   [1, 1.1, 0.8, 0],
                    opacity: [1, 1,   0.6, 0],
                    rotate:  [0, -3,  6,  -8],
                    x:       [0, 2,  -3,  10],
                    transition: { duration: 0.4, times: [0, 0.2, 0.6, 1], ease: 'easeIn' },
                  }}
                  transition={{ duration: 0.18, type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <DraggableFoodCard
                    item={item}
                    onDelete={() => onDelete(item.id, item.type)}
                    onEdit={()   => onEdit(item.id, item.type)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {/* 드롭 힌트 (아이템이 있어도 드래그 중일 때) */}
            {isOver && (
              <div className="rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/50 min-h-[60px] flex items-center justify-center">
                <span className="text-[10px] text-brand-400 font-medium">여기에 놓기</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 선반 하단 물리 그림자 */}
      <div className="mx-4 h-1 rounded-b-full bg-gradient-to-r from-transparent via-slate-300/40 to-transparent mt-1" />
    </div>
  )
}

// ─── ItemFormModal ────────────────────────────────────────────────────────────

interface ItemFormProps {
  initial?: FridgeItem
  onClose: () => void
  onSave: (data: CreateFridgeItemRequest) => Promise<void>
}

function ItemFormModal({ initial, onClose, onSave }: ItemFormProps) {
  const [name,       setName]       = useState(initial?.name       ?? '')
  const [quantity,   setQuantity]   = useState(initial?.quantity   ?? '')
  const [expiryDate, setExpiryDate] = useState(toDateStr(initial?.expiry_date))
  const [location,   setLocation]   = useState<FridgeLocation>(initial?.location  ?? '냉장')
  const [category,   setCategory]   = useState<FridgeCategory>(initial?.category  ?? '기타')
  const [memo,       setMemo]       = useState(initial?.memo       ?? '')
  const [saving,     setSaving]     = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(), quantity: quantity.trim(),
        expiry_date: expiryDate || null,
        location, category, memo: memo.trim(),
      })
      onClose()
    } finally { setSaving(false) }
  }

  const locations: FridgeLocation[] = ['냉장', '냉동', '채소칸', '실온']

  const qtyNum = parseInt(quantity || '1') || 1

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative w-full max-w-lg bg-white rounded-t-3xl p-5 pb-8 space-y-4 z-10 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">{initial ? '식재료 수정' : '식재료 추가'}</h3>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">이름 *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 당근, 닭가슴살"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">수량</label>
              {category === '완제품' ? (
                <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
                  <button type="button"
                    onClick={() => setQuantity(String(Math.max(1, qtyNum - 1)))}
                    className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-base transition-colors">
                    −
                  </button>
                  <span className="flex-1 text-center text-sm font-bold text-slate-800">{qtyNum}</span>
                  <button type="button"
                    onClick={() => setQuantity(String(qtyNum + 1))}
                    className="w-7 h-7 rounded-full bg-brand-500 hover:bg-brand-600 flex items-center justify-center text-white font-bold text-base transition-colors">
                    +
                  </button>
                  <span className="text-xs text-slate-400">개</span>
                </div>
              ) : (
                <input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="예: 300g, 1팩"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">유통기한</label>
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">보관 위치</label>
            <div className="flex gap-2">
              {locations.map(loc => (
                <button key={loc} type="button" onClick={() => setLocation(loc)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    location === loc ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>{loc}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">카테고리</label>
            <div className="flex flex-wrap gap-1.5">
              {FRIDGE_CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => {
                  setCategory(cat)
                  if (cat === '완제품' && !quantity) setQuantity('1')
                }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    category === cat ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>{cat}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">메모</label>
            <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="추가 메모"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button type="submit" disabled={!name.trim() || saving}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-40">
            {saving ? '저장 중...' : (initial ? '수정' : '추가')}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// ─── DishFormModal ────────────────────────────────────────────────────────────

interface DishFormProps {
  initial?: SideDish
  onClose: () => void
  onSave: (data: CreateSideDishRequest) => Promise<void>
}

function DishFormModal({ initial, onClose, onSave }: DishFormProps) {
  const [name,      setName]      = useState(initial?.name      ?? '')
  const [madeAt,    setMadeAt]    = useState(toDateStr(initial?.made_at) || todayStr())
  const [expiresAt, setExpiresAt] = useState(toDateStr(initial?.expires_at))
  const [location,  setLocation]  = useState<SideDishLocation>(initial?.location ?? '냉장')
  const [memo,      setMemo]      = useState(initial?.memo      ?? '')
  const [saving,    setSaving]    = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(), made_at: madeAt,
        expires_at: expiresAt || null, location, memo: memo.trim(),
      })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="relative w-full max-w-lg bg-white rounded-t-3xl p-5 pb-8 space-y-4 z-10 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">{initial ? '반찬 수정' : '반찬 추가'}</h3>
          <button onClick={onClose}><XMarkIcon className="h-5 w-5 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">반찬 이름 *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 깍두기, 시금치나물"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">만든 날짜 *</label>
              <input type="date" value={madeAt} onChange={e => setMadeAt(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">소비기한 (선택)</label>
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">보관 위치</label>
            <div className="flex gap-2">
              {(['냉장', '냉동'] as SideDishLocation[]).map(loc => (
                <button key={loc} type="button" onClick={() => setLocation(loc)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    location === loc ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>{loc}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">메모</label>
            <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="추가 메모"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button type="submit" disabled={!name.trim() || !madeAt || saving}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 transition-colors disabled:opacity-40">
            {saving ? '저장 중...' : (initial ? '수정' : '추가')}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// ─── FridgeTabProps ───────────────────────────────────────────────────────────

interface FridgeTabProps {
  fridgeItems: FridgeItem[]
  sideDishes: SideDish[]
  onAddItem:    (data: CreateFridgeItemRequest) => Promise<void>
  onUpdateItem: (id: string, data: UpdateFridgeItemRequest) => Promise<void>
  onDeleteItem: (id: string) => Promise<void>
  onAddDish:    (data: CreateSideDishRequest) => Promise<void>
  onUpdateDish: (id: string, data: UpdateSideDishRequest) => Promise<void>
  onDeleteDish: (id: string) => Promise<void>
}

// ─── FridgeTab (main) ─────────────────────────────────────────────────────────

export default function FridgeTab({
  fridgeItems, sideDishes,
  onAddItem, onUpdateItem, onDeleteItem,
  onAddDish,  onUpdateDish,  onDeleteDish,
}: FridgeTabProps) {
  // ── 상태 ─────────────────────────────────────────────────────────────────
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set())
  const [quickName,        setQuickName]        = useState('')
  const [showItemForm,     setShowItemForm]     = useState(false)
  const [showDishForm,     setShowDishForm]     = useState(false)
  const [editingItem,      setEditingItem]      = useState<FridgeItem | null>(null)
  const [editingDish,      setEditingDish]      = useState<SideDish | null>(null)
  const [activeItem,       setActiveItem]       = useState<ShelfItem | null>(null) // drag overlay용

  // ── DnD 센서 ─────────────────────────────────────────────────────────────
  // distance: 8 → 8px 이상 움직여야 드래그, 그 이하는 탭(클릭)으로 처리
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  // ── 낙관적 삭제 필터 ──────────────────────────────────────────────────────
  const visibleItems  = useMemo(
    () => fridgeItems.filter(i => !pendingDeleteIds.has(i.id)),
    [fridgeItems, pendingDeleteIds],
  )
  const visibleDishes = useMemo(
    () => sideDishes.filter(d => !pendingDeleteIds.has(d.id)),
    [sideDishes, pendingDeleteIds],
  )

  // ── 만료 임박 카운트 ──────────────────────────────────────────────────────
  const warnCount = useMemo(() =>
    visibleItems.filter(i => { const d = daysUntil(i.expiry_date); return d !== null && d <= 3 }).length +
    visibleDishes.filter(d => { const days = daysUntil(d.expires_at); return days !== null && days <= 3 }).length,
  [visibleItems, visibleDishes])

  // ── 선반별 데이터 (상단=냉동, 중단=냉장, 신선실=실온+반찬) ───────────────

  const sortByExpiry = (a: ShelfItem, b: ShelfItem) => {
    const da = daysUntil(a.expiryDate), db = daysUntil(b.expiryDate)
    if (da === null && db === null) return 0
    if (da === null) return 1
    if (db === null) return -1
    return da - db
  }

  const mapItem = (shelf: ShelfId) => (i: typeof visibleItems[0]): ShelfItem => ({
    id: i.id, name: i.name, expiryDate: i.expiry_date,
    type: 'item' as const, currentShelf: shelf,
    quantity: i.quantity, isPackaged: i.category === '완제품',
  })

  const topShelf: ShelfItem[] = useMemo(() =>       // ❄️ 상단 = 냉동
    visibleItems.filter(i => i.location === '냉동').map(mapItem('냉동')).sort(sortByExpiry),
  [visibleItems])

  const middleShelf: ShelfItem[] = useMemo(() =>    // 🥶 중단 = 냉장
    visibleItems.filter(i => i.location === '냉장').map(mapItem('냉장')).sort(sortByExpiry),
  [visibleItems])

  const vegShelf: ShelfItem[] = useMemo(() =>       // 🥬 채소칸
    visibleItems.filter(i => i.location === '채소칸').map(mapItem('채소칸')).sort(sortByExpiry),
  [visibleItems])

  const crisperShelf: ShelfItem[] = useMemo(() => { // 🌿 신선실 = 실온 + 반찬
    const roomTemp = visibleItems
      .filter(i => i.location === '실온')
      .map(mapItem('실온'))
      .sort(sortByExpiry)

    const dishes = visibleDishes
      .map(d => ({
        id: d.id,
        name: d.name,
        expiryDate: d.expires_at,
        subLabel: daysSince(d.made_at) === 0 ? '오늘 만든' : `${daysSince(d.made_at)}일 전`,
        type: 'dish' as const,
        currentShelf: '실온' as ShelfId,
      }))
      .sort(sortByExpiry)

    return [...roomTemp, ...dishes]
  }, [visibleItems, visibleDishes])

  // ── DnD 이벤트 ────────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const data = active.data.current as { type: 'item' | 'dish'; currentShelf: ShelfId }
    // 드래그 중인 아이템 찾기 (overlay 렌더용)
    const allItems = [...topShelf, ...middleShelf, ...crisperShelf]
    const found = allItems.find(i => i.id === active.id)
    setActiveItem(found ?? null)
    // 드래그 중 body 스크롤 방지
    document.body.style.overflow = 'hidden'
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    document.body.style.overflow = ''
    setActiveItem(null)

    const { active, over } = event
    if (!over) return

    const newShelf = over.id as ShelfId
    const data     = active.data.current as { type: 'item' | 'dish'; currentShelf: ShelfId }

    if (newShelf === data.currentShelf) return // 같은 선반이면 무시

    // 반찬은 실온/채소칸 드롭 불가 (냉장/냉동만)
    if (data.type === 'dish' && (newShelf === '실온' || newShelf === '채소칸')) return

    try {
      if (data.type === 'item') {
        await onUpdateItem(active.id as string, { location: newShelf })
      } else {
        // 반찬은 냉장/냉동만 허용 (실온 드롭은 위에서 이미 차단됨)
        await onUpdateDish(active.id as string, { location: newShelf as SideDishLocation })
      }
    } catch {
      // 실패해도 화면은 API 응답으로 자동 동기화됨
    }
  }

  const handleDragCancel = () => {
    document.body.style.overflow = ''
    setActiveItem(null)
  }

  // ── 삭제 ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string, type: 'item' | 'dish') => {
    setPendingDeleteIds(prev => { const next = new Set(prev); next.add(id); return next })
    try {
      if (type === 'item') await onDeleteItem(id)
      else                 await onDeleteDish(id)
    } catch {
      setPendingDeleteIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  // ── 수정 ─────────────────────────────────────────────────────────────────

  const handleEdit = (id: string, type: 'item' | 'dish') => {
    if (type === 'item') {
      const item = fridgeItems.find(i => i.id === id)
      if (item) { setEditingItem(item); setShowItemForm(true) }
    } else {
      const dish = sideDishes.find(d => d.id === id)
      if (dish) { setEditingDish(dish); setShowDishForm(true) }
    }
  }

  // ── 폼 저장 ───────────────────────────────────────────────────────────────

  const handleSaveItem = async (data: CreateFridgeItemRequest) => {
    if (editingItem) await onUpdateItem(editingItem.id, data)
    else             await onAddItem(data)
    setEditingItem(null)
  }

  const handleSaveDish = async (data: CreateSideDishRequest) => {
    if (editingDish) await onUpdateDish(editingDish.id, data)
    else             await onAddDish(data)
    setEditingDish(null)
  }

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickName.trim()) return
    await onAddItem({ name: quickName.trim(), quantity: '', expiry_date: null, location: '냉장', category: '기타', memo: '' })
    setQuickName('')
  }

  const totalCount = visibleItems.length + visibleDishes.length

  // ── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 pb-2">

      {/* ══ 퀵 등록 바 ══════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧊</span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">냉장고</h2>
              <p className="text-xs text-slate-400">
                총 {totalCount}개
                {warnCount > 0 && (
                  <span className="ml-1.5 text-rose-500 font-semibold animate-pulse">⚠ {warnCount}개 임박</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => { setEditingItem(null); setShowItemForm(true) }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />식재료
            </button>
            <button
              onClick={() => { setEditingDish(null); setShowDishForm(true) }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:bg-emerald-600 transition-colors"
            >
              <PlusIcon className="h-3.5 w-3.5" />반찬
            </button>
          </div>
        </div>

        {/* 빠른 입력창 */}
        <form onSubmit={handleQuickSubmit} className="flex gap-2">
          <input
            type="text" value={quickName} onChange={e => setQuickName(e.target.value)}
            placeholder="빠른 등록 (예: 두부, 오이)"
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button type="submit" disabled={!quickName.trim()}
            className="px-3 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 hover:bg-brand-600 transition-colors">
            추가
          </button>
        </form>

      </div>


      {/* ══ 냉장고 내부 3층 선반 (DnD) ══════════════════════════════════════ */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          className="rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden"
          style={{ background: 'linear-gradient(175deg, #f0f9ff 0%, #e8f3fb 35%, #edf8f2 75%, #f5f5f0 100%)' }}
        >
          {/* 냉장고 상단 패널 */}
          <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b border-slate-200/50">
            <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">냉장고 내부</span>
            <span className="text-[10px] text-slate-400">
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
            </span>
          </div>

          {/* 상단 선반 — 냉동 */}
          <div className="border-b border-slate-200/50">
            <DroppableShelf
              shelfId="냉동"
              items={topShelf}
              pendingDeleteIds={pendingDeleteIds}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          </div>

          {/* 중단 선반 — 냉장 */}
          <div className="border-b border-slate-200/50">
            <DroppableShelf
              shelfId="냉장"
              items={middleShelf}
              pendingDeleteIds={pendingDeleteIds}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          </div>

          {/* 채소칸 */}
          <div className="border-b border-slate-200/50">
            <DroppableShelf
              shelfId="채소칸"
              items={vegShelf}
              pendingDeleteIds={pendingDeleteIds}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          </div>

          {/* 신선실 — 실온 + 반찬 */}
          <DroppableShelf
            shelfId="실온"
            items={crisperShelf}
            pendingDeleteIds={pendingDeleteIds}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />

          <div className="h-3" />
        </div>

        {/* 드래그 중 떠다니는 카드 */}
        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          <DragOverlayCard item={activeItem} />
        </DragOverlay>
      </DndContext>

      {/* ══ 범례 ══════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 px-1">
        {([['green', '4일 이상'], ['amber', '1~3일'], ['red', '만료/오늘']] as const).map(([color, label]) => (
          <div key={color} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full bg-${color}-200 border border-${color}-300 flex-shrink-0`} />
            <span className="text-[10px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {/* ══ 모달 ════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showItemForm && (
          <ItemFormModal
            initial={editingItem ?? undefined}
            onClose={() => { setShowItemForm(false); setEditingItem(null) }}
            onSave={handleSaveItem}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDishForm && (
          <DishFormModal
            initial={editingDish ?? undefined}
            onClose={() => { setShowDishForm(false); setEditingDish(null) }}
            onSave={handleSaveDish}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
