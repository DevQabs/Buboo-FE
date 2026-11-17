import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  const publicPaths = ['/login', '/invite', '/api/account/']
  // 개발 전용 화면 미리보기(가짜 데이터). 페이지도 production 이면 404 다
  if (process.env.NODE_ENV !== 'production') publicPaths.push('/preview')
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session.user?.needsSetup && pathname !== '/setup') {
    return NextResponse.redirect(new URL('/setup', req.url))
  }

  if (!session.user?.needsSetup && pathname === '/setup') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$|manifest.json).*)'],
}
