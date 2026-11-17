'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { formatBytes, usageLevel } from '@/lib/mediaRules'
import type { StorageUsage } from '@/types'

/** 경고선(8GB)을 넘으면 사용량 막대와 경고를 보인다(설계서 5절). 상한은 환경변수로만 올린다. owner 가 아니면 403 → 숨김. */
export default function StorageWarning({ accessToken, className }: { accessToken: string; className: string }) {
  const [u, setU] = useState<StorageUsage | null>(null)
  useEffect(() => {
    apiFetch<StorageUsage>('/api/storage/usage', accessToken).then(setU).catch(() => {})
  }, [accessToken])
  if (!u) return null
  const level = usageLevel(u.used_bytes, u.warn_bytes, u.limit_bytes)
  if (level === 'ok') return null
  const pct = Math.min(100, (u.used_bytes / u.limit_bytes) * 100)
  return (
    <div className={`${className} border border-amber-200`}>
      <div className="flex items-center justify-between text-xs">
        <b className={level === 'full' ? 'text-rose-600' : 'text-amber-700'}>
          {level === 'full' ? '저장 공간이 가득 찼어요' : '저장 공간이 거의 찼어요'}
        </b>
        <span className="tabular-nums text-stone-500">{formatBytes(u.used_bytes)} / {formatBytes(u.limit_bytes)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-stone-100">
        <div className={`h-2 rounded-full ${level === 'full' ? 'bg-rose-500' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-stone-400">
        {level === 'full' ? '새 사진·영상을 올릴 수 없어요. ' : ''}더 올리려면 오래된 영상을 지우거나 관리자에게 한도를 늘려 달라고 해 주세요.
      </p>
    </div>
  )
}
