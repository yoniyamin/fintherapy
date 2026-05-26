import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'
import type { MultiMonthData } from '../../hooks/useMultiMonthReveal'
import { ui } from '../../lib/uiClasses'

interface Props {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string }>
}

const PALETTE = [
  '#34D399', '#60A5FA', '#F59E0B', '#F472B6', '#A78BFA',
  '#FB923C', '#38BDF8', '#818CF8', '#22D3EE', '#E879F9',
]

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

function formatMonth(m: string): string {
  const [, mo] = m.split('-')
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return labels[Number(mo) - 1] ?? mo
}

function pctChange(from: number, to: number): number {
  if (from === 0) return 0
  return ((to - from) / Math.abs(from)) * 100
}

export default function CategoryTrendChart({ data, months, categoryLookup }: Props) {
  const sorted = useMemo(() => [...months].sort(), [months])
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const top5Categories = useMemo(() => {
    return data.aggregatedSummary.slice(0, 5).map(c => c.category)
  }, [data.aggregatedSummary])

  const chartData = useMemo(() => {
    const byMonth = new Map<string, Record<string, number>>()
    for (const m of sorted) byMonth.set(m, {})

    for (const point of data.categoryTrend) {
      if (!top5Categories.includes(point.category)) continue
      const row = byMonth.get(point.month)
      if (row) {
        const label = categoryLookup[point.category]?.label ?? point.category
        row[label] = point.amount
      }
    }

    return sorted.map(m => ({
      month: formatMonth(m),
      ...byMonth.get(m),
    }))
  }, [data.categoryTrend, sorted, top5Categories, categoryLookup])

  const categoryLabels = useMemo(
    () => top5Categories.map(c => categoryLookup[c]?.label ?? c),
    [top5Categories, categoryLookup],
  )

  const advisorCallout = useMemo(() => {
    if (sorted.length < 2) return null

    let biggestTrend: { label: string; pct: number } | null = null
    for (const cat of top5Categories) {
      const label = categoryLookup[cat]?.label ?? cat
      const first = data.categoryTrend.find(p => p.month === sorted[0] && p.category === cat)
      const last = data.categoryTrend.find(p => p.month === sorted[sorted.length - 1] && p.category === cat)
      if (first && last && first.amount > 30) {
        const pct = pctChange(first.amount, last.amount)
        if (!biggestTrend || Math.abs(pct) > Math.abs(biggestTrend.pct)) {
          biggestTrend = { label, pct }
        }
      }
    }

    if (!biggestTrend || Math.abs(biggestTrend.pct) < 10) return null

    const dir = biggestTrend.pct > 0 ? 'climbing' : 'decreasing'
    const sign = biggestTrend.pct > 0 ? 'up' : 'down'
    return `${biggestTrend.label} has been ${dir} — ${sign} ${Math.abs(Math.round(biggestTrend.pct))}% over this period.`
  }, [data.categoryTrend, sorted, top5Categories, categoryLookup])

  return (
    <motion.div
      className={ui.chartCard}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">
        Category Spending Trend
      </p>

      <div className="mt-3" style={{ height: 208, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={208}>
          <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip
              contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
              formatter={(value: number) => [fmt(value), '']}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              onClick={(e) => setHighlighted(h => h === e.value ? null : e.value as string)}
            />
            {data.householdIncome != null && data.householdIncome > 0 && (
              <ReferenceLine
                y={data.householdIncome}
                stroke="#64748b"
                strokeDasharray="6 4"
                label={{ value: 'Income', position: 'right', fill: '#64748b', fontSize: 10 }}
              />
            )}
            {categoryLabels.map((label, i) => (
              <Line
                key={label}
                type="monotone"
                dataKey={label}
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={highlighted === label ? 3 : highlighted ? 1 : 2}
                strokeOpacity={highlighted && highlighted !== label ? 0.25 : 1}
                dot={{ r: highlighted === label ? 4 : 2, fill: PALETTE[i % PALETTE.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {advisorCallout && (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-surface-950/40 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-surface-300">
            <span className="mr-1.5 text-amber-400">💡</span>
            {advisorCallout}
          </p>
        </div>
      )}
    </motion.div>
  )
}
