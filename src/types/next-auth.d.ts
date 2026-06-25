import 'next-auth'
import type { User } from './index'

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      accessToken?: string
      backendUser?: User
      needsSetup?: boolean
      googleSub?: string
      googleEmail?: string
    }
  }
}
