const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function apiFetch(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options?.headers,
    },
  })
}
