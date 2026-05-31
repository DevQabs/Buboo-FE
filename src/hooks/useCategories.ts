'use client'
import { useState, useEffect } from 'react'

const DEFAULT_EXPENSE = ['식비', '카페', '장보기', '주거', '교통', '의료', '문화', '쇼핑', '기타']
const DEFAULT_INCOME  = ['급여', '부수입', '용돈', '배당', '기타']
const STORAGE_KEY = 'app_categories_v1'

interface Categories { expense: string[]; income: string[] }

export function useCategories() {
  const [cats, setCats] = useState<Categories>(() => {
    if (typeof window === 'undefined') return { expense: DEFAULT_EXPENSE, income: DEFAULT_INCOME }
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s) return JSON.parse(s) as Categories
    } catch {}
    return { expense: DEFAULT_EXPENSE, income: DEFAULT_INCOME }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cats))
  }, [cats])

  const addCategory = (type: 'expense' | 'income', name: string) => {
    const t = name.trim()
    if (!t) return
    setCats(prev => prev[type].includes(t) ? prev : { ...prev, [type]: [...prev[type], t] })
  }

  const removeCategory = (type: 'expense' | 'income', name: string) => {
    setCats(prev => ({ ...prev, [type]: prev[type].filter(c => c !== name) }))
  }

  return {
    expenseCategories: cats.expense,
    incomeCategories: cats.income,
    addCategory,
    removeCategory,
  }
}
