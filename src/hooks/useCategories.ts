'use client'
import { useState, useEffect, useCallback } from 'react'

const DEFAULT_EXPENSE = ['식비', '카페', '장보기', '주거', '교통', '의료', '문화', '쇼핑', '기타']
const DEFAULT_INCOME  = ['급여', '부수입', '용돈', '배당', '기타']

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

interface Categories { expense: string[]; income: string[] }

export function useCategories() {
  const [cats, setCats] = useState<Categories>({ expense: DEFAULT_EXPENSE, income: DEFAULT_INCOME })

  useEffect(() => {
    fetch(`${API_BASE}/api/categories`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Categories | null) => { if (data) setCats(data) })
      .catch(() => {})
  }, [])

  const save = useCallback((next: Categories) => {
    fetch(`${API_BASE}/api/categories`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(console.error)
  }, [])

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
