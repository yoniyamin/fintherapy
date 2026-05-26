import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { MultiMonthData } from '../../hooks/useMultiMonthReveal'
import { getHealthSummary, type HealthVerdict } from '../../lib/advisorInsights'

interface Props {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string }>
}

const VERDICT_STYLES: Record<HealthVerdict, { border: string; bg: string; glow: string; dot: string }> = {
  green: {
    border: 'border-emerald-400/30',
    bg: 'bg-emerald-500/[0.06]',
    glow: 'shadow-[0_0_20px_-6px_rgba(52,211,153,0.25)]',
    dot: 'bg-emerald-400',
  },
  amber: {
    border: 'border-amber-400/30',
    bg: 'bg-amber-500/[0.06]',
    glow: 'shadow-[0_0_20px_-6px_rgba(245,158,11,0.25)]',
    dot: 'bg-amber-400',
  },
  red: {
    border: 'border-red-400/30',
    bg: 'bg-red-500/[0.06]',
    glow: 'shadow-[0_0_20px_-6px_rgba(248,113,113,0.25)]',
    dot: 'bg-red-400',
  },
}

export default function HealthSummaryBanner({ data, months, categoryLookup }: Props) {
  const health = useMemo(
    () => getHealthSummary({
      months,
      aggregatedSummary: data.aggregatedSummary,
      summaryByMonth: data.summaryByMonth,
      monthlyTotals: data.monthlyTotals,
      categoryTrend: data.categoryTrend,
      dailyTotals: data.dailyTotals,
      income: data.householdIncome,
      categoryLookup,
    }),
    [data, months, categoryLookup],
  )

  const s = VERDICT_STYLES[health.verdict]

  return (
    <motion.div
      className={`rounded-2xl border ${s.border} ${s.bg} ${s.glow} backdrop-blur-md px-4 py-3.5`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-2.5">
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
        <p className="text-sm leading-relaxed text-surface-200">
          {health.message}
        </p>
      </div>
    </motion.div>
  )
}
