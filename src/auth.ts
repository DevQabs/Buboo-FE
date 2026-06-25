import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import type { User } from '@/types'

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:8090'

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        if (session.accessToken !== undefined) token.accessToken = session.accessToken
        if (session.backendUser !== undefined) token.backendUser = session.backendUser
        if (session.needsSetup !== undefined) token.needsSetup = session.needsSetup
        return token
      }

      // Only runs on first sign-in (account is populated)
      if (account?.provider === 'google') {
        try {
          const res = await fetch(`${API_URL}/api/auth/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              google_email: user.email,
              google_sub: account.providerAccountId,
              invite_code: token.pendingInviteCode ?? undefined,
            }),
          })
          const data = await res.json()

          if (data.status === 'new_user') {
            token.needsSetup = true
          } else if (data.access_token) {
            token.accessToken = data.access_token
            token.backendUser = data.user as User
            token.needsSetup = false
          }
        } catch {
          token.needsSetup = true
        }
        token.googleSub = account.providerAccountId
        token.googleEmail = user.email ?? ''
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
