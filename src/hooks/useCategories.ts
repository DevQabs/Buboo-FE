'use client'
import { useState, useEffect, useCallback } from 'react'
import { signOut } from 'next-auth/react'

const DEFAULT_EXPENSE = ['식비', '카페', '장보기', '주거', '교통', '의료', '문화', '쇼핑', '기타']
const DEFAULT_INCOME  = ['급여', '부수입', '용돈', '배당', '기타']

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

interface Categories { expense: string[]; income: string[] }

export function useCategories(accessToken?: string) {
  const [cats, setCats] = useState<Categories>({ expense: DEFAULT_EXPENSE, income: DEFAULT_INCOME })

  useEffect(() => {
    if (!accessToken) return
    fetch(`${API_BASE}/api/categories`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => {
        if (r.status === 401) { signOut({ callbackUrl: '/login' }); return null }
        return r.ok ? r.json() : null
      })
      .then((data: Categories | null) => { if (data) setCats(data) })
      .catch(() => {})
  }, [accessToken])

  const save = useCallback((next: Categories) => {
    if (!accessToken) return
    fetch(`${API_BASE}/api/categories`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(next),
    }).catch(console.error)
  }, [accessToken])

  const addCategory = (type: 'expense' | 'income', name: string) => {
    const t = name.trim()
    if (!t) return
    setCats(prev => {
      if (prev[type].includes(t)) return prev
      const next = { ...prev, [type]: [...prev[type], t] }
      save(next)
      return next
    })
  }

  const removeCategory = (type: 'expense' | 'income', name: string) => {
    setCats(prev => {
      const next = { ...prev, [type]: prev[type].filter(c => c !== name) }
      save(next)
      return next
    })
  }

  return {
    expenseCategories: cats.expense,
    incomeCategories: cats.income,
    addCategory,
    removeCategory,
  }
}
