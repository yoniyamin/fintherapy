import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { MultiMonthData } from '../../hooks/useMultiMonthReveal'
import { generateInsights, type AdvisorInsight, type InsightInput, type InsightPriority } from '../../lib/advisorInsights'
import { detectRecurring } from '../../lib/recurringDetector'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import type { SpendingFrequency } from '../../lib/constants'
import { formatCurrency } from '../../lib/formatCurrency'
import { ui } from '../../lib/uiClasses'
import AnalysisIcon from './AnalysisIcons'
import { getInsightIconName } from './analysisIconPaths'

interface Props {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string; spendingFrequency?: SpendingFrequency; parentCategoryId?: string }>
}

const SEVERITY_STYLES: Record<string, string> = {
  positive: 'border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.06] to-emerald-500/[0.02]',
  neutral: 'border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent',
  warning: 'border-amber-500/20 bg-gradient-to-r from-amber-500/[0.06] to-amber-500/[0.02]',
  concern: 'border-red-500/20 bg-gradient-to-r from-red-500/[0.08] to-red-500/[0.02]',
}

const PRIORITY_ACCENT: Record<InsightPriority, string> = {
  critical: 'border-l-[3px] border-l-red-400',
  actionable: 'border-l-[3px] border-l-amber-400/70',
  informational: 'border-l-[3px] border-l-surface-600/40',
}

const PRIORITY_LABELS: Record<InsightPriority, { label: string; color: string }> = {
  critical: { label: 'Needs attention', color: 'text-red-400' },
  actionable: { label: 'Worth exploring', color: 'text-amber-400' },
  informational: { label: 'Good to know', color: 'text-surface-500' },
}

const SEVERITY_ICON_COLOR: Record<string, string> = {
  positive: 'text-emerald-400',
  warning: 'text-amber-400',
  concern: 'text-red-400',
  neutral: 'text-surface-400',
}

export default function AdvisorNotes({ data, months, categoryLookup }: Props) {
  const insights = useMemo<AdvisorInsight[]>(() => {
    const recurringCharges = detectRecurring(data.allTransactions, months)
    const fixedTotal = data.aggregatedSummary
      .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && categoryLookup[c.category]?.expenseType === 'fixed')
      .reduce((s, c) => s + Number(c.total_amount), 0)
    const discretionaryTotal = data.aggregatedSummary
      .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && categoryLookup[c.category]?.expenseType !== 'fixed')
      .reduce((s, c) => s + Number(c.total_amount), 0)

    const input: InsightInput = {
      months,
      aggregatedSummary: data.aggregatedSummary,
      summaryByMonth: data.summaryByMonth,
      monthlyTotals: data.monthlyTotals,
      categoryTrend: data.categoryTrend,
      dailyTotals: data.dailyTotals,
      income: data.householdIncome,
      categoryLookup,
      transactions: data.allTransactions,
      recurringCharges,
      spendingByAccount: data.spendingByAccount,
      fixedTotal,
      discretionaryTotal,
    }
    return generateInsights(input)
  }, [data, months, categoryLookup])

  const totalSpent = data.aggregatedSummary.reduce((s, c) => s + Number(c.total_amount), 0)
  const annualSpend = data.aggregatedSummary
    .filter(c => categoryLookup[c.category]?.spendingFrequency === 'annual')
    .reduce((s, c) => s + Number(c.total_amount), 0)
  const oneOffSpend = data.aggregatedSummary
    .filter(c => categoryLookup[c.category]?.spendingFrequency === 'one_off')
    .reduce((s, c) => s + Number(c.total_amount), 0)
  const baseline = months.length > 0 ? (totalSpent - annualSpend - oneOffSpend) / months.length : 0
  const hasFrequencyData = annualSpend > 0 || oneOffSpend > 0

  const sinkingFundCategories = data.aggregatedSummary
    .filter(c => categoryLookup[c.category]?.spendingFrequency === 'annual' && Number(c.total_amount) > 0)
    .map(c => {
      const yearsOfData = Math.max(months.length / 12, 1)
      const normalizedAnnual = Number(c.total_amount) / yearsOfData
      return { category: c.category, label: categoryLookup[c.category]?.label ?? c.category, annualCost: normalizedAnnual, monthly: normalizedAnnual / 12 }
    })
    .sort((a, b) => b.annualCost - a.annualCost)
  const sinkingTotal = sinkingFundCategories.reduce((s, c) => s + c.monthly, 0)

  if (insights.length === 0 && !hasFrequencyData) return null

  const grouped: { priority: InsightPriority; items: AdvisorInsight[] }[] = []
  for (const p of ['critical', 'actionable', 'informational'] as InsightPriority[]) {
    const items = insights.filter(i => i.priority === p)
    if (items.length > 0) grouped.push({ priority: p, items })
  }

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

      {hasFrequencyData && (
        <div className="mt-3 rounded-xl border border-duo-green/20 bg-duo-green/[0.04] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-duo-green/70">True Monthly Baseline</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-surface-200">{formatCurrency(baseline, false)}/mo</p>
          <p className="mt-0.5 text-[10px] text-surface-400">
            Recurring monthly spend: {formatCurrency(baseline, false)}. Set aside {formatCurrency(sinkingTotal, false)}/mo for annual expenses. Total: {formatCurrency(baseline + sinkingTotal, false)}/mo.
          </p>
        </div>
      )}

      {sinkingFundCategories.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Sinking Fund</p>
          <div className="mt-2 space-y-1">
            {sinkingFundCategories.map(c => (
              <div key={c.category} className="flex items-center justify-between">
                <span className="text-[11px] text-surface-300">{c.label}</span>
                <span className="text-[11px] tabular-nums text-surface-400">{formatCurrency(c.annualCost, false)}/yr ({formatCurrency(c.monthly, false)}/mo)</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-1 mt-1">
              <span className="text-[11px] font-semibold text-surface-200">Total set-aside</span>
              <span className="text-[11px] font-semibold tabular-nums text-surface-200">{formatCurrency(sinkingTotal, false)}/mo</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-4">
        {grouped.map(({ priority, items }) => (
          <div key={priority}>
            <p className={`mb-2 text-[9px] font-semibold uppercase tracking-wider ${PRIORITY_LABELS[priority].color}`}>{PRIORITY_LABELS[priority].label}</p>
            <div className="space-y-2">
              {items.map((insight, i) => (
                <motion.div
                  key={insight.id}
                  className={`rounded-xl border px-3.5 py-3 ${SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.neutral} ${PRIORITY_ACCENT[insight.priority]}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className="flex gap-2.5">
                    <span className={`mt-0.5 shrink-0 ${SEVERITY_ICON_COLOR[insight.severity] ?? SEVERITY_ICON_COLOR.neutral}`}>
                      <AnalysisIcon name={getInsightIconName(insight.id)} width={16} height={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs leading-relaxed text-surface-200">{insight.text}</p>
                      <p className="mt-1 text-[10px] leading-snug text-surface-500">{insight.rationale}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
