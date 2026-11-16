const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// 백엔드 호출 공용 함수. 토큰을 붙이고, 실패 응답은 서버의 {"error"} 문구로 ApiError 를 던진다.
// 화면은 실패를 잡아 낙관적 반영을 되돌리고 토스트를 띄운다(4단계에서 화면별로 교체).
export async function apiFetch<T = unknown>(path: string, accessToken: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? `API ${path} → ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// 마지막 호출만 살린다. 부를 때마다 직전 요청을 취소하고 새 signal 을 준다.
export function latestOnly(): () => AbortSignal {
  let ctrl: AbortController | undefined
  return () => {
    ctrl?.abort()
    ctrl = new AbortController()
    return ctrl.signal
  }
}

// 취소된 요청의 AbortError 는 삼키고, 다른 오류는 그대로 던진다.
export function ignoreAbort(e: unknown): void {
  if ((e as Error)?.name !== 'AbortError') throw e
}
