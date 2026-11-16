// 사진·영상 업로드 (설계서 5절): 서버에서 presigned PUT 주소를 받아 R2 에 직접 올리고 키를 돌려준다.
import { apiFetch } from '@/lib/api'
import { MAX_IMAGE_EDGE, fitWithin } from '@/lib/mediaRules'

export type UploadPurpose = 'diary' | 'baby'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

/**
 * 긴 변 2048px JPEG(0.85)로 줄인다. 브라우저가 못 여는 형식(예: 갤럭시의 HEIF '고효율 사진')은
 * 원본을 image/heic 로 그대로 돌려준다(서버는 image/heic 만 받는다).
 */
export async function prepareImage(file: File): Promise<{ blob: Blob; contentType: string }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = fitWithin(bmp.width, bmp.height, MAX_IMAGE_EDGE)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, width, height)
    bmp.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (blob) return { blob, contentType: 'image/jpeg' }
  } catch {
    // 해독 못 함 → 원본
  }
  const heic = /^image\/hei[cf]$/.test(file.type) || (!file.type && /\.hei[cf]$/i.test(file.name))
  const type = heic ? 'image/heic' : file.type
  if (!IMAGE_TYPES.includes(type)) throw new Error('올릴 수 없는 사진 형식이에요')
  return { blob: file, contentType: type }
}

/** <video> 메타데이터로 길이(초)를 읽는다. */
export function videoDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(file)
    const fail = () => { URL.revokeObjectURL(url); reject(new Error('영상 길이를 읽지 못했어요')) }
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      if (Number.isFinite(v.duration) && v.duration > 0) resolve(v.duration)
      else fail()
    }
    v.onerror = fail
    v.src = url
  })
}

export function videoContentType(file: File): string {
  if (file.type === 'video/mp4' || file.type === 'video/quicktime') return file.type
  if (/\.mov$/i.test(file.name)) return 'video/quicktime'
  if (/\.mp4$/i.test(file.name)) return 'video/mp4'
  throw new Error('mp4·mov 영상만 올릴 수 있어요')
}

/**
 * 업로드 주소를 받아 R2 에 직접 PUT 하고 키를 돌려준다. 주소는 Content-Type 과 크기까지 서명돼 있어
 * 같은 blob·같은 타입으로 보내야 한다. 진행률은 XHR 로만 알 수 있다.
 * 서버 거절(413 한도 초과 등)은 apiFetch 가 서버 문구로 ApiError 를 던진다.
 */
export async function uploadMedia(
  accessToken: string,
  purpose: UploadPurpose,
  blob: Blob,
  contentType: string,
  durationSec?: number,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const { key, url } = await apiFetch<{ key: string; url: string }>('/api/media/upload-url', accessToken, {
    method: 'POST',
    body: JSON.stringify({ purpose, content_type: contentType, size: blob.size, duration_sec: durationSec ?? 0 }),
  })

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(e.loaded / e.total) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`업로드 실패 (${xhr.status})`)))
    xhr.onerror = () => reject(new Error('업로드 실패 (네트워크)'))
    xhr.send(blob)
  })
  return key
}

/** 일기 사진: 줄이고 → 올리고 → 일기에 키를 붙인다. 하나라도 실패하면 거기서 멈추고 오류. */
export async function attachDiaryPhotos(accessToken: string, diaryId: string, files: File[]): Promise<void> {
  for (const file of files) {
    const { blob, contentType } = await prepareImage(file)
    const key = await uploadMedia(accessToken, 'diary', blob, contentType)
    await apiFetch(`/api/diaries/${diaryId}/photos`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ key }),
    })
  }
}
