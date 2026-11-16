/**
 * Dashboard Page — 서버 셸. 화면과 상태는 DashboardClient 에 있다.
 */

import { Suspense } from 'react'
import DashboardClient from './DashboardClient'

export const metadata = {
  title: '대시보드',
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient />
    </Suspense>
  )
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 space-y-4 animate-pulse">
      <div className="h-10 bg-slate-200 rounded-xl w-48" />
      <div className="h-48 bg-slate-200 rounded-2xl" />
      <div className="h-64 bg-slate-200 rounded-2xl" />
      <div className="h-96 bg-slate-200 rounded-2xl" />
    </div>
  )
}
