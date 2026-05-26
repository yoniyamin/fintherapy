import { useMemo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { MultiMonthData } from '../../hooks/useMultiMonthReveal'
import { getSpendingPredictability, getBiggestMover } from '../../lib/advisorInsights'
import { ui } from '../../lib/uiClasses'

interface Props {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string }>
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

function pctChange(from: number, to: number): number {
  if (from === 0) return 0
  return ((to - from) / Math.abs(from)) * 100
}

function formatMonth(m: string): string {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-US', { month: 'short' })
}

export default function KpiCards({ data, months, categoryLookup }: Props) {
  const sorted = useMemo(() => [...months].sort(), [months])
  const totals = useMemo(() => data.monthlyTotals.map(t => Number(t.total_amount)), [data.monthlyTotals])
  const totalSpent = useMemo(() => totals.reduce((s, v) => s + v, 0), [totals])
  const avgMonthly = totals.length > 0 ? totalSpent / totals.length : 0

  const savingsRateData = useMemo(() => {
    if (!data.householdIncome || data.householdIncome <= 0) return null
    const income = data.householdIncome
    const avgRate = ((income - avgMonthly) / income) * 100

    const monthRates = data.monthlyTotals.map(t => {
      const spend = Number(t.total_amount)
      return { month: t.billing_month, rate: ((income - spend) / income) * 100 }
    })
    const best = monthRates.reduce((a, b) => (b.rate > a.rate ? b : a), monthRates[0])
    const worst = monthRates.reduce((a, b) => (b.rate < a.rate ? b : a), monthRates[0])

    return { avgRate, monthRates, best, worst }
  }, [data.householdIncome, data.monthlyTotals, avgMonthly])

  const biggestMover = useMemo(
    () => getBiggestMover(data.summaryByMonth, sorted, categoryLookup),
    [data.summaryByMonth, sorted, categoryLookup],
  )

  const predictability = useMemo(() => getSpendingPredictability(totals), [totals])

  const cards = useMemo(() => {
    const result: { title: string; value: string; context: string; insight: string; color: string }[] = []

    result.push({
      title: 'Avg Monthly Spend',
      value: fmt(avgMonthly),
      context: `${fmt(totalSpent)} over ${sorted.length} months`,
      insight: `Your family averages ${fmt(avgMonthly)}/month across this period.`,
      color: 'text-ice',
    })

    if (savingsRateData) {
      const sign = savingsRateData.avgRate >= 0 ? '' : '-'
      result.push({
        title: 'Savings Rate',
        value: `${sign}${Math.abs(Math.round(savingsRateData.avgRate))}%`,
        context: savingsRateData.best && savingsRateData.worst
          ? `Best: ${formatMonth(savingsRateData.best.month)} · Worst: ${formatMonth(savingsRateData.worst.month)}`
          : '',
        insight: savingsRateData.avgRate >= 10
          ? `You're saving well — keep building that buffer.`
          : savingsRateData.avgRate >= 0
            ? `You're breaking even. Even saving 5% makes a difference over time.`
            : `Spending exceeds income. Let's look at where to trim.`,
        color: savingsRateData.avgRate >= 10 ? 'text-emerald-400' : savingsRateData.avgRate >= 0 ? 'text-amber-400' : 'text-red-400',
      })
    }

    if (biggestMover) {
      result.push({
        title: 'Biggest Mover',
        value: `${biggestMover.icon} ${biggestMover.label}`,
        context: `${biggestMover.direction === 'up' ? '+' : ''}${Math.round(biggestMover.pct)}% (${biggestMover.direction === 'up' ? '+' : ''}${fmt(biggestMover.delta)})`,
        insight: biggestMover.direction === 'up'
          ? `${biggestMover.label} grew the most — this area has the most room to adjust.`
          : `${biggestMover.label} dropped the most — great progress here.`,
        color: biggestMover.direction === 'up' ? 'text-amber-400' : 'text-emerald-400',
      })
    }

    result.push({
      title: 'Spending Predictability',
      value: predictability.label,
      context: `Variation coefficient: ${(predictability.cv * 100).toFixed(0)}%`,
      insight: predictability.cv < 0.2
        ? `Stable spending makes budgeting easier. Your household is ${predictability.label.toLowerCase()}.`
        : `Monthly spending varies. Setting a target could help smooth things out.`,
      color: predictability.cv < 0.15 ? 'text-emerald-400' : predictability.cv < 0.25 ? 'text-amber-400' : 'text-red-400',
    })

    return result
  }, [avgMonthly, totalSpent, sorted.length, savingsRateData, biggestMover, predictability])

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
  }, [cards])

  return (
    <div className="relative">
      {/* Right fade hint */}
      {canScroll && !scrolledToEnd && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-[rgba(15,23,42,0.9)] to-transparent" />
      )}

      <div ref={scrollRef} className="-mx-5 overflow-x-auto px-5 scrollbar-hide">
        <div className="flex gap-3 pb-2" style={{ width: 'max-content' }}>
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              className={`${ui.glassFlat} w-52 shrink-0 px-4 py-3.5`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                {card.title}
              </p>
              <p className={`mt-1 text-xl font-bold ${card.color}`}>
                {card.value}
              </p>
              <p className="mt-0.5 text-[11px] text-surface-400">
                {card.context}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-surface-300">
                {card.insight}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Swipe hint */}
      {canScroll && !scrolledToEnd && (
        <div className="mt-1 flex justify-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] text-surface-400">
            Swipe for more <span className="text-surface-500">&rarr;</span>
          </span>
        </div>
      )}
    </div>
  )
}
