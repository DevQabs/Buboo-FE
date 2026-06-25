/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 배포 시 standalone 모드로 최소 번들 생성
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,

  // /api/* 요청을 Go 백엔드로 프록시
  // 개발: API_INTERNAL_URL 미설정 → localhost:8090
  // 프로덕션: API_INTERNAL_URL=http://<backend-private-url>:8090
  async rewrites() {
    return {
      // afterFiles: checked AFTER internal Next.js routes (pages, API routes)
      // so /api/auth/[...nextauth] is served by Next.js before this rewrite applies
      beforeFiles: [],
      afterFiles: [
        {
          // Proxy /api/* to Go backend, but NOT /api/auth/* (handled by NextAuth)
          source: '/api/((?!auth(?:/|$)).*)',
          destination: `${process.env.API_INTERNAL_URL ?? 'http://localhost:8090'}/api/$1`,
        },
      ],
      fallback: [],
    }
  },
}

export default nextConfig
