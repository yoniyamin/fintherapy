import { useMemo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { MultiMonthData } from '../../hooks/useMultiMonthReveal'
import { ui } from '../../lib/uiClasses'

interface Props {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string }>
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)

function formatMonth(m: string): string {
  const [, mo] = m.split('-')
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return labels[Number(mo) - 1] ?? mo
}

function pctChange(from: number, to: number): number {
  if (from === 0) return 0
  return ((to - from) / Math.abs(from)) * 100
}

interface RowData {
  category: string
  icon: string
  label: string
  amounts: number[]
  totalPctChange: number
  flagged: boolean
}

export default function ComparisonTable({ data, months, categoryLookup }: Props) {
  const sorted = useMemo(() => [...months].sort(), [months])

  const rows = useMemo<RowData[]>(() => {
    const catSet = new Set<string>()
    data.aggregatedSummary.forEach(c => catSet.add(c.category))

    const result: RowData[] = []
    for (const cat of catSet) {
      const amounts = sorted.map(m => {
        const monthData = data.summaryByMonth.get(m) ?? []
        const entry = monthData.find(c => c.category === cat)
        return entry ? Number(entry.total_amount) : 0
      })

      const first = amounts[0]
      const last = amounts[amounts.length - 1]
      const totalPct = pctChange(first, last)
      const flagged = totalPct > 25 && first > 30

      const info = categoryLookup[cat]
      result.push({
        category: cat,
        icon: info?.icon ?? '📦',
        label: info?.label ?? cat,
        amounts,
        totalPctChange: totalPct,
        flagged,
      })
    }

    return result.sort((a, b) => {
      if (a.flagged !== b.flagged) return a.flagged ? -1 : 1
      const totalA = a.amounts.reduce((s, v) => s + v, 0)
      const totalB = b.amounts.reduce((s, v) => s + v, 0)
      return totalB - totalA
    })
  }, [data, sorted, categoryLookup])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState(false)
  const [scrolledToEnd, setScrolledToEnd] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const check = () => {
      const hasOverflow = el.scrollWidth > el.clientWidth + 2
      setCanScroll(hasOverflow)
      setScrolledToEnd(hasOverflow && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4)
    }

    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', check); ro.disconnect() }
  }, [rows, sorted])

  return (
    <motion.div
      className={ui.chartCard}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">
        Month-over-Month Comparison
      </p>

      <div className="relative mt-3">
        {/* Scroll fade hint */}
        {canScroll && !scrolledToEnd && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-20 w-8 bg-gradient-to-l from-[rgba(15,23,42,0.85)] to-transparent" />
        )}

        <div ref={scrollRef} className="-mx-4 overflow-x-auto px-0 scrollbar-hide">
          <table className="w-full text-xs" style={{ minWidth: Math.max(360, sorted.length * 72 + 160) }}>
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="sticky left-0 z-10 bg-surface-950/90 backdrop-blur-md py-2 pl-4 pr-2 text-left font-semibold text-surface-400 whitespace-nowrap">
                  Category
                </th>
                {sorted.map(m => (
                  <th key={m} className="px-2 py-2 text-right font-semibold text-surface-400 whitespace-nowrap">
                    {formatMonth(m)}
                  </th>
                ))}
                <th className="px-3 py-2 pr-4 text-right font-semibold text-surface-400 whitespace-nowrap">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row.category}
                  className={`border-b border-white/[0.03] ${row.flagged ? 'bg-amber-500/[0.03]' : ''}`}
                >
                  <td className="sticky left-0 z-10 bg-surface-950/90 backdrop-blur-md py-2 pl-4 pr-2">
                    <div className="flex items-center gap-1.5">
                      {row.flagged && <span className="text-[10px] text-amber-400" title="Grew significantly">&#9888;</span>}
                      <span className="text-[13px]">{row.icon}</span>
                      <span className="font-medium text-surface-200 whitespace-nowrap">{row.label}</span>
                    </div>
                  </td>
                  {row.amounts.map((amount, i) => {
                    const prev = i > 0 ? row.amounts[i - 1] : null
                    const delta = prev != null && prev > 0 ? pctChange(prev, amount) : null
                    let cellColor = 'text-surface-300'
                    if (delta != null) {
                      if (delta < -5) cellColor = 'text-emerald-400'
                      else if (delta > 15) cellColor = 'text-red-400'
                      else if (delta > 5) cellColor = 'text-amber-400'
                    }

                    return (
                      <td key={i} className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${cellColor}`}>
                        {amount > 0 ? fmt(amount) : '\u2014'}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                    <TrendBadge pct={row.totalPctChange} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Swipe hint pill */}
        {canScroll && !scrolledToEnd && (
          <div className="mt-2 flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] text-surface-400">
              Swipe for more <span className="text-surface-500">&rarr;</span>
            </span>
          </div>
        )}
      </div>

      {rows.some(r => r.flagged) && (
        <div className="mt-3 rounded-xl border border-amber-400/10 bg-amber-500/[0.04] px-3 py-2">
          <p className="text-[11px] leading-relaxed text-amber-300/80">
            <span className="mr-1">&#9888;</span>
            Flagged categories grew more than 25% over this period and may deserve a closer look.
          </p>
        </div>
      )}
    </motion.div>
  )
}

function TrendBadge({ pct }: { pct: number }) {
  if (Math.abs(pct) < 1) {
    return <span className="text-surface-500">—</span>
  }
  const isUp = pct > 0
  const color = isUp ? 'text-red-400' : 'text-emerald-400'
  return (
    <span className={`font-semibold ${color}`}>
      {isUp ? '↑' : '↓'} {Math.abs(Math.round(pct))}%
    </span>
  )
}
