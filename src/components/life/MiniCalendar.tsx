'use client'

// 월 달력(ScheduleTab 에서 옮김). 공휴일 빨강, 음력 날짜, 일정·일기 점.
import { useMemo } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { getHolidaysForMonth } from '@/lib/koreanHolidays'
import { lunarCellDay } from '@/lib/lunar'
import { todayKST } from '@/lib/date'
import type { DiaryEntry, Schedule } from '@/types'

export default function MiniCalendar({
  year, month, schedules, diaries,
  onPrev, onNext, onDayClick, selectedDate,
}: {
  year: number
  month: number
  schedules: Schedule[]
  diaries: DiaryEntry[]
  onPrev: () => void
  onNext: () => void
  onDayClick: (date: string) => void
  selectedDate: string
}) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  const scheduleDays = new Set(
    schedules.map(s => s.start_date.slice(0, 10))
  )
  const diaryDays = new Set(diaries.map(d => d.date))

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const holidayMap = useMemo(() => getHolidaysForMonth(year, month), [year, month])
  const todayStr = todayKST()

  return (
    <div className="rounded-card bg-white p-4 shadow-warm">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronLeftIcon className="h-4 w-4 text-slate-400" />
        </button>
        <span className="text-sm font-bold text-slate-800">
          {year}년 {month}월
        </span>
        <button onClick={onNext} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronRightIcon className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-semibold py-1 ${
            i === 0 ? 'text-rose-400' : i === 6 ? 'text-brand-400' : 'text-slate-400'
          }`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const hasSchedule = scheduleDays.has(dateStr)
          const hasDiary = diaryDays.has(dateStr)
          const holiday = holidayMap[dateStr]
          const col = i % 7

          return (
            <button
              key={i}
              onClick={() => onDayClick(dateStr)}
              className={`flex flex-col items-center py-1 rounded-lg transition-colors ${
                isSelected ? 'bg-brand-500' : isToday ? 'bg-brand-50' : 'hover:bg-slate-50'
              }`}
            >
              <span className={`text-xs font-medium ${
                isSelected ? 'text-white'
                : isToday   ? 'text-brand-600'
                : col === 0 || (col !== 6 && holiday) ? 'text-rose-500'
                : col === 6 ? 'text-brand-400'
                : 'text-slate-700'
              }`}>{day}</span>
              <span className={`text-[8px] leading-none ${isSelected ? 'text-brand-100' : 'text-slate-300'}`}>
                {lunarCellDay(dateStr)}
              </span>
              <div className="flex gap-0.5 mt-0.5 h-1">
                {hasSchedule && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-500'}`} />}
                {hasDiary    && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-400'}`} />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-brand-500" />
          <span className="text-[10px] text-slate-400">일정</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[10px] text-slate-400">일기</span>
        </div>
      </div>
    </div>
  )
}
