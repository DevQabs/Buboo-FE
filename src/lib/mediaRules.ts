// 사진·영상 규칙과 표시용 순수 함수 (설계서 5·6절). 런타임 import 금지 — checks.test.ts 가 node 로 바로 돌린다.

export const MAX_IMAGE_EDGE = 2048
export const MAX_VIDEO_SEC = 30
/** 서버 maxObjectBytes(100 << 20)와 같은 값 */
export const MAX_FILE_BYTES = 100 * 1024 * 1024

/** presigned 주소는 1시간 유효 — 화면이 이보다 오래 열려 있었으면 다시 받는다 */
export const MEDIA_STALE_MS = 50 * 60_000
/** 마지막으로 받은 지 이보다 짧으면 깨진 미디어로 다시 받지 않는다(진짜 깨진 파일로 무한 반복 방지) */
export const MEDIA_ERROR_RELOAD_GAP_MS = 60_000

export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const s = Math.min(1, max / Math.max(w, h))
  return { width: Math.round(w * s), height: Math.round(h * s) }
}

/** 30초 구간이 영상 안에 들어가도록 시작점을 맞춘다. */
export function clampTrimStart(start: number, duration: number, length = MAX_VIDEO_SEC): number {
  return Math.min(Math.max(0, start), Math.max(0, duration - length))
}

/** 생후 N일. 태어난 날이 0일(시안: 10/05 생 → 11/16 은 42일). YYYY-MM-DD 는 UTC 로 읽혀 서머타임 영향이 없다. */
export function daysSinceBirth(birth: string, date: string): number {
  return Math.round((Date.parse(date) - Date.parse(birth)) / 86_400_000)
}

/** 서버와 같은 십진 단위(1GB = 10^9 바이트). */
export function formatBytes(n: number): string {
  return n >= 1e9 ? `${(n / 1e9).toFixed(1)}GB` : `${(n / 1e6).toFixed(1)}MB`
}

export function formatClock(sec: number): string {
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function usageLevel(used: number, warn: number, limit: number): 'ok' | 'warn' | 'full' {
  if (used >= limit) return 'full'
  if (used >= warn) return 'warn'
  return 'ok'
}
