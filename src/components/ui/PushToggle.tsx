'use client'

// 아바타 메뉴의 "이 기기에서 알림 받기" 스위치(push 설계서 7절). 헤더는 모든 구성원에게 보여
// 아기 탭만 보는 부모님도 닿는다. 기기(브라우저)마다 따로 켠다.
import { useEffect, useState } from 'react'
import { BellIcon } from '@heroicons/react/24/outline'
import { toastError } from '@/components/ui/Toast'
import { currentSubscription, disablePush, enablePush, pushSupported } from '@/lib/push'

export default function PushToggle({ accessToken }: { accessToken: string }) {
  const [on, setOn] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!pushSupported()) return
    setDenied(Notification.permission === 'denied')
    currentSubscription().then(s => setOn(!!s)).catch(() => {}).finally(() => setReady(true))
  }, [])

  if (!pushSupported()) return null

  const toggle = async () => {
    setBusy(true)
    try {
      if (on) {
        await disablePush(accessToken)
        setOn(false)
      } else if (await enablePush(accessToken)) {
        setOn(true)
      } else {
        setDenied(Notification.permission === 'denied')
      }
    } catch (e) {
      toastError('알림 설정', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={!ready || busy || (denied && !on)}
        onClick={toggle}
        className="flex min-h-11 w-full items-center gap-3 text-sm text-slate-700 disabled:opacity-60"
      >
        <BellIcon className="h-4 w-4 text-brand-500" />
        <span className="flex-1 text-left">이 기기에서 알림 받기</span>
        <span className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-slate-200'}`}>
          <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
      </button>
      {denied && !on && <p className="pb-1 text-xs text-stone-400">브라우저 설정에서 알림을 허용해 주세요</p>}
    </div>
  )
}
