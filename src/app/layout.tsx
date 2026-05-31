import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: '부부 가계부',
    template: '%s | 부부 가계부',
  },
  description: '부부가 함께 쓰는 가계부 & 자산 관리',
  // 추후 PWA manifest 연결
  // manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // 모바일 상태바 색상 (웹뷰 앱 대비)
  themeColor: '#4f46e5',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  )
}
