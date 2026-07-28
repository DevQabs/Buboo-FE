import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import type { User } from '@/types'

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:8090'

// Backend access tokens are issued with a 30-day expiry (see IssueToken in
// internal/auth/jwt.go). Refresh a day early so an active session never
// carries a token the backend has already expired.
const ACCESS_TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000

async function fetchBackendToken(googleEmail: string, googleSub: string, inviteCode?: string) {
  const res = await fetch(`${API_URL}/api/auth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ google_email: googleEmail, google_sub: googleSub, invite_code: inviteCode }),
  })
  return res.json()
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async jwt({ token, account, user, trigger, session }) {
      // Session update triggered by client-side update() call (e.g., after /setup or /invite)
      if (trigger === 'update' && session) {
        if (session.accessToken !== undefined) {
          token.accessToken = session.accessToken
          token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL_MS
        }
        if (session.backendUser !== undefined) token.backendUser = session.backendUser
        if (session.needsSetup !== undefined) token.needsSetup = session.needsSetup
        return token
      }

      // Only runs on first sign-in (account is populated)
      if (account?.provider === 'google') {
        try {
          const data = await fetchBackendToken(
            user.email ?? '',
            account.providerAccountId,
            (token.pendingInviteCode as string) ?? undefined,
          )
          if (data.status === 'new_user') {
            token.needsSetup = true
          } else if (data.access_token) {
            token.accessToken = data.access_token
            token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL_MS
            token.backendUser = data.user as User
            token.needsSetup = false
          }
        } catch {
          token.needsSetup = true
        }
        token.googleSub = account.providerAccountId
        token.googleEmail = user.email ?? ''
        return token
      }

      // Subsequent requests: the backend token is a static 30-day JWT that
      // never renews itself, while this session cookie keeps rolling forward
      // on activity — so refresh it before it goes stale.
      const expiresAt = token.accessTokenExpires
      const isStale = typeof expiresAt !== 'number' || Date.now() > expiresAt
      if (token.accessToken && token.googleSub && isStale) {
        try {
          const data = await fetchBackendToken(
            (token.googleEmail as string) ?? '',
            token.googleSub as string,
          )
          if (data.access_token) {
            token.accessToken = data.access_token
            token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL_MS
          }
        } catch {
          // Keep the stale token; next request retries the refresh.
        }
      }

      return token
    },

    async session({ session, token }) {
      session.user.accessToken = token.accessToken as string | undefined
      session.user.backendUser = token.backendUser as User | undefined
      session.user.needsSetup = token.needsSetup as boolean | undefined
      session.user.googleSub = token.googleSub as string | undefined
      session.user.googleEmail = token.googleEmail as string | undefined
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: { strategy: 'jwt' },
})
