'use client'

// 저장 실패 알림(설계서 9.C-12). 어디서든 showToast 를 부르면 화면 위쪽에 3초 뜬다.
import { useEffect, useState } from 'react'

type Listener = (msg: string) => void
const listeners = new Set<Listener>()

export function showToast(msg: string): void {
  listeners.forEach(l => l(msg))
}

/** "{what} 실패: {서버 문구}" — ApiError 의 message 는 서버 {"error"} 문구다 */
export function toastError(what: string, e: unknown): void {
  showToast(`${what} 실패: ${e instanceof Error ? e.message : '다시 시도해 주세요'}`)
}

/** 대시보드에 한 번만 둔다 */
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const listener: Listener = m => {
      setMsg(m)
      clearTimeout(timer)
      timer = setTimeout(() => setMsg(null), 3000)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      clearTimeout(timer)
    }
  }, [])
  if (!msg) return null
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[70] flex justify-center px-4"
    >
      <p className="max-w-sm rounded-2xl bg-stone-800 px-4 py-2.5 text-sm font-medium text-white shadow-warm">{msg}</p>
    </div>
  )
}
