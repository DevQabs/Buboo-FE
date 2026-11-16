'use client'
import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { apiFetch, ApiError } from '@/lib/api'
import { toastError } from '@/components/ui/Toast'

const DEFAULT_EXPENSE = ['식비', '카페', '장보기', '주거', '교통', '의료', '문화', '쇼핑', '기타']
const DEFAULT_INCOME  = ['급여', '부수입', '용돈', '배당', '기타']

interface Categories { expense: string[]; income: string[] }

export function useCategories(accessToken?: string) {
  const [cats, setCats] = useState<Categories>({ expense: DEFAULT_EXPENSE, income: DEFAULT_INCOME })

  useEffect(() => {
    if (!accessToken) return
    apiFetch<Categories>('/api/categories', accessToken)
      .then(data => { if (data) setCats(data) })
      .catch(e => {
        if (e instanceof ApiError && e.status === 401) signOut({ callbackUrl: '/login' })
        // 그 밖의 실패는 기본 카테고리로 둔다
      })
  }, [accessToken])

  // 화면에 먼저 반영하고 저장한다. 실패하면 이전 목록으로 되돌리고 토스트.
  // PUT 은 setState 업데이터 밖에서 한 번만 부른다(StrictMode 이중 호출 방지).
  const save = (next: Categories) => {
    const prev = cats
    setCats(next)
    if (!accessToken) return
    apiFetch('/api/categories', accessToken, { method: 'PUT', body: JSON.stringify(next) })
      .catch(e => {
        setCats(prev)
        toastError('카테고리 저장', e)
      })
  }

  const addCategory = (type: 'expense' | 'income', name: string) => {
    const t = name.trim()
    if (!t || cats[type].includes(t)) return
    save({ ...cats, [type]: [...cats[type], t] })
  }

  const removeCategory = (type: 'expense' | 'income', name: string) => {
    save({ ...cats, [type]: cats[type].filter(c => c !== name) })
  }

  return {
    expenseCategories: cats.expense,
    incomeCategories: cats.income,
    addCategory,
    removeCategory,
  }
}
