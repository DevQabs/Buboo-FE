'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Area, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { apiFetch } from '@/lib/api'
import { type Metric, ageInMonths, bandLabel, latestDelta, standardAt } from '@/lib/growthStandard'
import { todayKST } from '@/lib/date'
import { BabyGate, CARD, localToday } from './BabyProfile'
import type { Baby, BabyGrowth } from '@/types'

type Field = 'height_cm' | 'weight_kg' | 'head_cm'
const METRICS: { key: Metric; label: string; short: string; field: Field; unit: string }[] = [
  { key: 'height', label: '키', short: '키', field: 'height_cm', unit: 'cm' },
  { key: 'weight', label: '몸무게', short: '몸무게', field: 'weight_kg', unit: 'kg' },
  { key: 'head', label: '머리둘레', short: '머리', field: 'head_cm', unit: 'cm' },
]
const num = (v: number) => String(Number(v.toFixed(2)))
const signed = (v: number) => `${v >= 0 ? '+' : ''}${num(v)}`

interface Point { m: number; band?: [number, number]; p50?: number; value?: number }

function GrowthForm({ accessToken, record, onClose, onSaved }: {
  accessToken: string
  record: BabyGrowth | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [date, setDate] = useState(record?.measured_on ?? localToday())
  const [vals, setVals] = useState<Record<Field, string>>({
    height_cm: record?.height_cm?.toString() ?? '',
    weight_kg: record?.weight_kg?.toString() ?? '',
    head_cm: record?.head_cm?.toString() ?? '',
  })
  const [memo, setMemo] = useState(record?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 서버처럼 먼저 반올림한다: 키·머리둘레 소수 1자리, 몸무게 2자리
  const parse = (s: string, scale: number) => (s.trim() === '' ? null : Math.round(Number(s) * scale) / scale)

  const save = async () => {
    const body = {
      measured_on: date, memo,
      height_cm: parse(vals.height_cm, 10), weight_kg: parse(vals.weight_kg, 100), head_cm: parse(vals.head_cm, 10),
    }
    const nums = [body.height_cm, body.weight_kg, body.head_cm]
    if (nums.every(v => v == null)) { setError('키·몸무게·머리둘레 중 하나는 입력해 주세요'); return }
    // 서버와 같은 범위: 0 초과 1000 미만
    if (nums.some(v => v != null && !(v > 0 && v < 1000))) { setError('숫자를 확인해 주세요'); return }
    setSaving(true)
    setError(null)
    try {
      await apiFetch(record ? `/api/baby/growth/${record.id}` : '/api/baby/growth', accessToken, {
        method: record ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      })
      await onSaved()
    } catch (e) {
      setError((e as Error).message || '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!record || !confirm('이 기록을 지울까요?')) return
    try {
      await apiFetch(`/api/baby/growth/${record.id}`, accessToken, { method: 'DELETE' })
      await onSaved()
    } catch (e) {
      setError((e as Error).message || '지우지 못했어요')
    }
  }

  const input = 'w-full rounded-xl border border-line px-3 py-2.5 text-sm'
  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-2xl space-y-3 rounded-t-[22px] bg-cream p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
        onClick={e => e.stopPropagation()}>
        <b className="text-sm">{record ? '측정 기록 고치기' : '오늘 잰 값 기록'}</b>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={input} />
        <div className="grid grid-cols-3 gap-2">
          {METRICS.map(m => (
            <label key={m.key} className="text-xs text-stone-400">
              {m.label}({m.unit})
              <input inputMode="decimal" value={vals[m.field]}
                onChange={e => setVals(v => ({ ...v, [m.field]: e.target.value }))}
                className={`${input} mt-1 tabular-nums`} />
            </label>
          ))}
        </div>
        <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모(선택)" className={input} />
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex gap-2">
          {record && <button type="button" onClick={remove} className="rounded-xl px-4 py-3 text-sm text-rose-500">삭제</button>}
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-stone-100 py-3 text-sm text-stone-500">취소</button>
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Growth({ accessToken, baby, canEdit }: { accessToken: string; baby: Baby; canEdit: boolean }) {
  const [rows, setRows] = useState<BabyGrowth[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('weight')
  const [form, setForm] = useState<BabyGrowth | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      setRows((await apiFetch<BabyGrowth[] | null>('/api/baby/growth', accessToken)) ?? [])
      setError(null)
    } catch {
      setError('성장 기록을 불러오지 못했어요')
    }
  }, [accessToken])
  useEffect(() => { load() }, [load])

  const cur = METRICS.find(m => m.key === metric) ?? METRICS[1]
  const list = useMemo(() => rows ?? [], [rows])

  const lastAge = list.length ? ageInMonths(baby.birth_date, list[list.length - 1].measured_on) : 0
  const data = useMemo(() => {
    const xMax = Math.min(35, Math.max(6, Math.ceil(lastAge) + 2))
    const pts: Point[] = []
    for (let m = 0; m <= xMax; m++) {
      const s = standardAt(baby.sex, metric, m)
      if (s) pts.push({ m, band: [s.p3, s.p97], p50: s.p50 })
    }
    for (const r of list) {
      const v = r[cur.field]
      const m = ageInMonths(baby.birth_date, r.measured_on)
      if (v != null && m <= xMax) pts.push({ m, value: v })
    }
    return pts.sort((a, b) => a.m - b.m)
  }, [list, lastAge, baby, metric, cur.field])

  const latest = latestDelta(list, r => r[cur.field])
  const latestRow = [...list].reverse().find(r => r[cur.field] != null)
  const std = latestRow ? standardAt(baby.sex, metric, ageInMonths(baby.birth_date, latestRow.measured_on)) : null

  if (baby.birth_date > todayKST()) {
    return (
      <div className={`${CARD} p-8 text-center`}>
        <p className="text-sm font-semibold text-stone-700">출생 후부터 기록할 수 있어요</p>
        <p className="mt-1 text-xs text-stone-400">그동안은 사진일기에 태아 사진을 남겨 보세요</p>
      </div>
    )
  }

  return (
    <>
      {error && <p className="px-1 text-xs text-rose-500">{error}</p>}

      {/* 최근 측정 3칸 + 직전 대비 증감 */}
      <div className="grid grid-cols-3 gap-2">
        {METRICS.map(m => {
          const d = latestDelta(list, r => r[m.field])
          return (
            <div key={m.key} className={`${CARD} p-2.5 text-center`}>
              <div className="text-xs text-stone-400">{m.label}</div>
              <b className="tabular-nums">{d ? `${num(d.value)}${m.unit}` : '-'}</b>
              {d?.delta != null && (
                <div className={`text-xs tabular-nums ${d.delta >= 0 ? 'text-emerald-700' : 'text-rose-500'}`}>{signed(d.delta)}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* 항목 세그먼트 + 추이 그래프(또래 표준 3~97 음영, 50 점선) */}
      <div className={`${CARD} p-3`}>
        <div className="mb-2 flex rounded-[10px] bg-sand p-0.5 text-xs font-bold">
          {METRICS.map(m => (
            <button key={m.key} type="button" onClick={() => setMetric(m.key)}
              className={`relative before:absolute before:content-[''] before:-inset-y-2 flex-1 rounded-lg py-1.5 ${metric === m.key ? 'bg-white text-brand-500 shadow-sm' : 'text-stone-400'}`}>
              {m.short}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -16 }}>
            <XAxis dataKey="m" type="number" domain={[0, 'dataMax']} tickFormatter={m => `${Math.round(m)}개월`}
              tick={{ fontSize: 10, fill: '#a8a29e' }} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#a8a29e' }} />
            {/* 색은 시안 그대로(브랜드 #0F4C81 계열) */}
            <Area dataKey="band" stroke="none" fill="#eaf1f8" isAnimationActive={false} connectNulls />
            <Line dataKey="p50" stroke="#bfd3e6" strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls />
            <Line dataKey="value" stroke="#0F4C81" strokeWidth={2.5} dot={{ r: 3, fill: '#0F4C81' }} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="text-xs text-stone-400">
          음영 = 또래 표준 범위(질병관리청 2017 성장도표 3~97 백분위)
          {latest && std && ` · 현재 ${bandLabel(latest.value, std)}`}
          {lastAge > 35 && <div>표준 범위는 35개월까지만 있어요</div>}
        </div>
      </div>

      {canEdit && (
        <button type="button" onClick={() => setForm('new')}
          className={`${CARD} w-full py-3 text-center text-[13px] font-bold text-brand-500`}>
          + 오늘 잰 값 기록
        </button>
      )}

      {/* 기록 목록(최근 먼저) */}
      {list.length > 0 && (
        <div className={`${CARD} px-4 py-1.5`}>
          {[...list].reverse().map((r, i, arr) => (
            <button key={r.id} type="button" disabled={!canEdit} onClick={() => setForm(r)}
              className={`flex w-full items-center justify-between py-2.5 text-left text-xs ${i < arr.length - 1 ? 'border-b border-[#f5f0e8]' : ''}`}>
              <span className="text-stone-500">{r.measured_on}{r.memo && ` · ${r.memo}`}</span>
              <span className="tabular-nums text-stone-700">
                {METRICS.flatMap(m => {
                  const v = r[m.field]
                  return v == null ? [] : [`${m.short} ${num(v)}${m.unit}`]
                }).join(' · ')}
              </span>
            </button>
          ))}
        </div>
      )}

      {form && (
        <GrowthForm
          accessToken={accessToken}
          record={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSaved={async () => { setForm(null); await load() }}
        />
      )}
    </>
  )
}

export default function BabyGrowthTab({ accessToken, isOwner, canEdit }: {
  accessToken: string
  isOwner: boolean
  canEdit: boolean
}) {
  return (
    <BabyGate accessToken={accessToken} isOwner={isOwner}>
      {baby => <Growth accessToken={accessToken} baby={baby} canEdit={canEdit} />}
    </BabyGate>
  )
}
