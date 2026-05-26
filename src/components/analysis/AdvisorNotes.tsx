import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { MultiMonthData } from '../../hooks/useMultiMonthReveal'
import { generateInsights, type AdvisorInsight } from '../../lib/advisorInsights'
import { ui } from '../../lib/uiClasses'

interface Props {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string }>
}

const SEVERITY_STYLES: Record<string, string> = {
  positive: 'border-emerald-500/15 bg-emerald-500/[0.03]',
  neutral: 'border-surface-500/10 bg-white/[0.02]',
  warning: 'border-amber-500/15 bg-amber-500/[0.03]',
  concern: 'border-red-500/15 bg-red-500/[0.03]',
}

export default function AdvisorNotes({ data, months, categoryLookup }: Props) {
  const insights = useMemo<AdvisorInsight[]>(
    () => generateInsights({
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

  if (insights.length === 0) return null

  return (
    <motion.div
      className={ui.chartCard}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">
        Advisor Notes
      </p>
      <p className="mt-0.5 text-[11px] text-surface-600">
        Here's what we'd recommend focusing on
      </p>

      <div className="mt-3 space-y-2">
        {insights.map((insight, i) => (
          <motion.div
            key={insight.id}
            className={`rounded-xl border px-3 py-2.5 ${SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.neutral}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <p className="text-xs leading-relaxed text-surface-200">
              <span className="mr-1.5">{insight.emoji}</span>
              {insight.text}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
