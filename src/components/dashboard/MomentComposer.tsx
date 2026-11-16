'use client'

import { useEffect, useRef, useState } from 'react'
import { PhotoIcon, PlayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { apiFetch } from '@/lib/api'
import { prepareImage, uploadMedia, videoContentType, videoDuration } from '@/lib/media'
import { MAX_FILE_BYTES, MAX_VIDEO_SEC } from '@/lib/mediaRules'
import { CARD, localToday } from './BabyProfile'
import type { BabyMedia, BabyMoment } from '@/types'

interface Picked { file: File; kind: 'image' | 'video'; preview: string; duration?: number }

/** 서버는 duration_sec 30.5 까지 받는다 */
const LONG_VIDEO_SEC = MAX_VIDEO_SEC + 0.5

function Thumb({ src, video, onRemove }: { src: string; video: boolean; onRemove?: () => void }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-[18px] bg-gradient-to-br from-[#fde2e4] to-[#cde5f5]">
      {video
        ? <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        // eslint-disable-next-line @next/next/no-img-element -- presigned R2 주소·blob 미리보기라 next/image 를 못 쓴다
        : <img src={src} alt="" className="h-full w-full object-cover" />}
      {video && <PlayIcon className="absolute inset-0 m-auto h-7 w-7 text-white drop-shadow" />}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="빼기"
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white">
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

/** 사진일기 쓰기·고치기: 날짜·글·사진/영상 여러 개, 올리는 진행률 표시(설계서 6.2). */
export default function MomentComposer({ accessToken, moment, onClose, onSaved }: {
  accessToken: string
  moment: BabyMoment | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [date, setDate] = useState(moment?.date ?? localToday())
  const [content, setContent] = useState(moment?.content ?? '')
  const [existing, setExisting] = useState<BabyMedia[]>(moment?.media ?? [])
  const [picked, setPicked] = useState<Picked[]>([])
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickedRef = useRef(picked)
  useEffect(() => { pickedRef.current = picked }, [picked])
  useEffect(() => () => pickedRef.current.forEach(p => URL.revokeObjectURL(p.preview)), [])

  const addVideo = (file: File, duration: number) => {
    if (file.size > MAX_FILE_BYTES) { setError('영상은 100MB 까지 올릴 수 있어요'); return }
    setPicked(ps => [...ps, { file, kind: 'video', preview: URL.createObjectURL(file), duration }])
  }

  const addFiles = async (files: File[]) => {
    setError(null)
    for (const file of files) {
      if (!file.type.startsWith('video/') && !/\.(mov|mp4)$/i.test(file.name)) {
        setPicked(ps => [...ps, { file, kind: 'image', preview: URL.createObjectURL(file) }])
        continue
      }
      try {
        videoContentType(file) // mp4·mov 가 아니면 고를 때 바로 알린다
        const duration = await videoDuration(file)
        if (duration > LONG_VIDEO_SEC) {
          // Task 7 자리: 여기서 VideoTrimSheet 를 열고 잘린 결과를 addVideo(f, d) 로 넘긴다.
          setError('30초 이하 영상만 올릴 수 있어요. 자르기 기능은 곧 추가됩니다.')
          continue
        }
        addVideo(file, duration)
      } catch (e) {
        setError(e instanceof Error ? e.message : '영상을 읽지 못했어요')
      }
    }
  }

  const removePicked = (i: number) =>
    setPicked(ps => { URL.revokeObjectURL(ps[i].preview); return ps.filter((_, j) => j !== i) })

  const removeExisting = async (md: BabyMedia) => {
    if (!confirm('이 사진·영상을 지울까요?')) return
    try {
      await apiFetch(`/api/baby/media/${md.id}`, accessToken, { method: 'DELETE' })
      setExisting(xs => xs.filter(x => x.id !== md.id))
    } catch {
      setError('지우지 못했어요')
    }
  }

  const save = async () => {
    if (!moment && picked.length === 0 && !content.trim()) { setError('사진·영상이나 글을 넣어 주세요'); return }
    setError(null)
    try {
      const keys: string[] = []
      for (let i = 0; i < picked.length; i++) {
        const p = picked[i]
        const label = `올리는 중 ${i + 1}/${picked.length}`
        setProgress(label)
        const onProgress = (r: number) => setProgress(`${label} · ${Math.round(r * 100)}%`)
        if (p.kind === 'image') {
          const { blob, contentType } = await prepareImage(p.file)
          keys.push(await uploadMedia(accessToken, 'baby', blob, contentType, undefined, onProgress))
        } else {
          keys.push(await uploadMedia(accessToken, 'baby', p.file, videoContentType(p.file), p.duration, onProgress))
        }
      }
      setProgress('저장 중')
      if (moment) {
        await apiFetch(`/api/baby/moments/${moment.id}`, accessToken, {
          method: 'PUT', body: JSON.stringify({ date, content, add_media: keys }),
        })
      } else {
        await apiFetch('/api/baby/moments', accessToken, {
          method: 'POST', body: JSON.stringify({ date, content, media: keys }),
        })
      }
      await onSaved()
    } catch (e) {
      // ponytail: 중간에 실패하면 이미 올린 파일은 사용량에 남는다(안전한 쪽) — 쌓이면 정리 명령 추가
      setError(e instanceof Error ? e.message : '저장하지 못했어요')
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null
  const input = 'w-full rounded-xl border border-line px-3 py-2.5 text-sm'
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-cream pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] text-stone-800">
      <div className="mx-auto max-w-2xl space-y-3 px-3">
        <div className="flex items-end justify-between px-1 pb-1 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]">
          <div>
            <small className="block text-xs text-stone-400">사진일기</small>
            <b className="text-xl font-extrabold">{moment ? '기록 고치기' : '오늘의 순간'}</b>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="닫기" className="p-2 text-stone-400">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className={`${CARD} space-y-3 p-4`}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={input} />
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
            placeholder="어떤 순간이었나요?" className={`${input} resize-none`} />
          <div className="grid grid-cols-3 gap-2">
            {existing.map(md => (
              <Thumb key={md.id} src={md.url} video={md.kind === 'video'} onRemove={busy ? undefined : () => removeExisting(md)} />
            ))}
            {picked.map((p, i) => (
              <Thumb key={p.preview} src={p.preview} video={p.kind === 'video'} onRemove={busy ? undefined : () => removePicked(i)} />
            ))}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="flex aspect-square flex-col items-center justify-center rounded-[18px] border-2 border-dashed border-line text-stone-400">
              <PhotoIcon className="h-6 w-6" />
              <span className="text-xs">사진·영상</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={e => { const list = Array.from(e.target.files ?? []); e.target.value = ''; addFiles(list) }} />
          <p className="text-xs text-stone-400">영상은 30초까지 올릴 수 있어요.</p>
        </div>
        {error && <p className="px-1 text-xs text-rose-500">{error}</p>}
        <button type="button" onClick={save} disabled={busy}
          className="w-full rounded-[18px] bg-brand-500 py-3.5 text-sm font-bold text-white disabled:opacity-60">
          {progress ?? '저장'}
        </button>
      </div>
    </div>
  )
}
