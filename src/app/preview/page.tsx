// 개발 전용 화면 미리보기: 로그인·백엔드 없이 실제 대시보드를 가짜 데이터로 띄운다. /preview?screen=ledger
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import PreviewClient from './PreviewClient'

export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <Suspense><PreviewClient /></Suspense>
}
