import 'server-only'

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:8090'

type AuthPath = '/api/auth/callback' | '/api/auth/setup'

// Calls the backend routes that trust a Google identity in the body.
// Only the Next.js server holds INTERNAL_API_SECRET, so the browser can no
// longer claim to be someone else.
export async function callBackendAuth(path: AuthPath, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': process.env.INTERNAL_API_SECRET ?? '',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({ error: 'invalid backend response' }))
  return { status: res.status, data }
}
