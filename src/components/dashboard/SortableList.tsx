'use client'

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Bars3Icon } from '@heroicons/react/24/outline'

/**
 * Drag-to-reorder primitives shared by the asset cards.
 *
 * StockPortfolioCard and OtherAssetCard need the same behaviour — a list of rows
 * each carrying a grip on the left — so the DndContext wiring lives here once
 * instead of twice.
 *
 *   <SortableList ids={ids} onReorder={next => save(next)}>
 *     {items.map(item => (
 *       <SortableRow key={item.id} id={item.id} className="flex items-center">
 *         <DragHandle />
 *         ...row content...
 *       </SortableRow>
 *     ))}
 *   </SortableList>
 *
 * Rendering several <SortableList> blocks in one <ul> keeps them independent:
 * a row can only be dropped within the list it belongs to.
 */

interface SortableListProps {
  /** Row identifiers in their current display order. */
  ids: string[]
  /** Receives the complete reordered id list. Not called when nothing moved. */
  onReorder: (nextIDs: string[]) => void
  children: ReactNode
}

export function SortableList({ ids, onReorder, children }: SortableListProps) {
  // distance:5 means a press only becomes a drag once the finger actually moves,
  // so the grip never swallows a tap and vertical page scrolling still works.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return

    const next = [...ids]
    next.splice(to, 0, next.splice(from, 1)[0])
    onReorder(next)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
      // Without a container the screen-reader markup renders inline, which would
      // put <div>s straight inside the <ul> these lists live in.
      accessibility={{ container: typeof document === 'undefined' ? undefined : document.body }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

/**
 * Lets a nested <DragHandle /> reach the listeners of the row that owns it, so
 * only the grip starts a drag rather than the whole row.
 */
type HandleProps = Pick<
  ReturnType<typeof useSortable>,
  'attributes' | 'listeners' | 'setActivatorNodeRef'
>

const HandleContext = createContext<HandleProps | null>(null)

interface SortableRowProps {
  id: string
  className?: string
  children: ReactNode
}

export function SortableRow({ id, className = '', children }: SortableRowProps) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <HandleContext.Provider value={{ attributes, listeners, setActivatorNodeRef }}>
      <li
        ref={setNodeRef}
        style={style}
        className={`${className} ${isDragging ? 'relative z-20 opacity-60 bg-white shadow-lg' : ''}`}
      >
        {children}
      </li>
    </HandleContext.Provider>
  )
}

// ─── Handle ───────────────────────────────────────────────────────────────────

/** The 3-line grip. Renders nothing unless placed inside a <SortableRow />. */
export function DragHandle({ className = '' }: { className?: string }) {
  const ctx = useContext(HandleContext)
  if (!ctx) return null

  return (
    <button
      ref={ctx.setActivatorNodeRef}
      type="button"
      aria-label="순서 변경"
      // Rows may be clickable (expand/collapse) — the grip must never trigger that.
      onClick={e => e.stopPropagation()}
      className={`flex-shrink-0 -ml-2 w-5 h-8 flex items-center justify-center text-slate-300 hover:text-slate-500 active:text-slate-600 cursor-grab active:cursor-grabbing touch-none transition-colors ${className}`}
      {...ctx.attributes}
      {...ctx.listeners}
    >
      <Bars3Icon className="h-4 w-4" />
    </button>
  )
}
