import type { CategorySummary, MonthlyTotal } from '../hooks/useReveal'
import type { AccountSpending, DailyTotal, CategoryTrendPoint } from '../hooks/useMultiMonthReveal'
import type { ExportRow } from '../hooks/useTransactions'
import type { RecurringCharge } from './recurringDetector'
import { detectRecurring } from './recurringDetector'
import { OWN_TRANSFERS_CATEGORY_ID } from './constants'
import type { SpendingFrequency } from './constants'
import { formatCurrency } from './formatCurrency'

export type InsightSeverity = 'positive' | 'neutral' | 'warning' | 'concern'
export type InsightPriority = 'critical' | 'actionable' | 'informational'

export interface EvidenceRow {
  label: string
  value: string
  detail?: string
}

export interface EvidenceGroup {
  title: string
  rows: EvidenceRow[]
}

export interface AdvisorInsight {
  id: string
  emoji: string
  text: string
  /** Short explanation of why this insight matters to the user. */
  rationale: string
  severity: InsightSeverity
  priority: InsightPriority
  /** Supporting data the user can expand to understand the insight. */
  evidence?: EvidenceGroup[]
}

export type HealthVerdict = 'green' | 'amber' | 'red'

export interface HealthSummary {
  verdict: HealthVerdict
  message: string
}

export interface DeltaDriver {
  category: string
  label: string
  delta: number
  pct: number
  topTransactions: { merchant: string; amount: number }[]
}

export interface InsightInput {
  months: string[]
  aggregatedSummary: CategorySummary[]
  summaryByMonth: Map<string, CategorySummary[]>
  monthlyTotals: MonthlyTotal[]
  categoryTrend: CategoryTrendPoint[]
  dailyTotals: DailyTotal[]
  income: number | null
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string; spendingFrequency?: SpendingFrequency; parentCategoryId?: string }>
  transactions: ExportRow[]
  recurringCharges: RecurringCharge[]
  spendingByAccount: AccountSpending[]
  fixedTotal: number
  discretionaryTotal: number
  budgets?: { category_id: string; monthly_target: number }[]
}

/** Builds a complete insight payload from multi-month analysis data. */
export function buildInsightInput(params: {
  months: string[]
  aggregatedSummary: CategorySummary[]
  summaryByMonth: Map<string, CategorySummary[]>
  monthlyTotals: MonthlyTotal[]
  categoryTrend: CategoryTrendPoint[]
  dailyTotals: DailyTotal[]
  income: number | null
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string; spendingFrequency?: SpendingFrequency; parentCategoryId?: string }>
  transactions: ExportRow[]
  spendingByAccount?: AccountSpending[]
  budgets?: { category_id: string; monthly_target: number }[]
}): InsightInput {
  const recurringCharges = detectRecurring(params.transactions, params.months)
  const fixedTotal = params.aggregatedSummary
    .filter((c) => c.category !== OWN_TRANSFERS_CATEGORY_ID && params.categoryLookup[c.category]?.expenseType === 'fixed')
    .reduce((s, c) => s + Number(c.total_amount), 0)
  const discretionaryTotal = params.aggregatedSummary
    .filter((c) => c.category !== OWN_TRANSFERS_CATEGORY_ID && params.categoryLookup[c.category]?.expenseType !== 'fixed')
    .reduce((s, c) => s + Number(c.total_amount), 0)
  return {
    months: params.months,
    aggregatedSummary: params.aggregatedSummary,
    summaryByMonth: params.summaryByMonth,
    monthlyTotals: params.monthlyTotals,
    categoryTrend: params.categoryTrend,
    dailyTotals: params.dailyTotals,
    income: params.income,
    categoryLookup: params.categoryLookup,
    transactions: params.transactions,
    recurringCharges,
    spendingByAccount: params.spendingByAccount ?? [],
    fixedTotal,
    discretionaryTotal,
    budgets: params.budgets,
  }
}

function pctChange(from: number, to: number): number {
  if (Math.abs(from) < 1) return 0
  const raw = ((to - from) / Math.abs(from)) * 100
  return Math.max(-500, Math.min(500, raw))
}

function formatMonth(value: string): string {
  const [year, month] = value.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'short' })
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  if (mean === 0) return 0
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / Math.abs(mean)
}

// ---------------------------------------------------------------------------
// Headline generator
// ---------------------------------------------------------------------------

/**
 * Generates a single bold sentence summarizing the financial period.
 * Designed to be the first thing users read in the report.
 */
export function generateHeadline(input: InsightInput): string {
  const { monthlyTotals, income, months, summaryByMonth, categoryLookup } = input
  const totals = monthlyTotals.map(t => Number(t.total_amount))
  const avgMonthly = totals.length > 0 ? totals.reduce((s, v) => s + v, 0) / totals.length : 0

  if (income != null && income > 0) {
    const diff = avgMonthly - income
    const topDrivers = getTopCategoryDrivers(summaryByMonth, months, categoryLookup)
    const driverNames = topDrivers.slice(0, 2).map(d => d.label).join(' and ')

    if (diff > 50) {
      return `You overspent by ${formatCurrency(diff, false)}/month on average. ${driverNames ? `${driverNames} drove most of the increase.` : 'Review your top categories for adjustment opportunities.'}`
    }
    if (diff < -50) {
      return `You saved ${formatCurrency(Math.abs(diff), false)}/month on average — solid household discipline.${driverNames ? ` ${driverNames} were your biggest categories.` : ''}`
    }
    return `You're breaking even at ${formatCurrency(avgMonthly, false)}/month vs ${formatCurrency(income, false)} income.${driverNames ? ` Watch ${driverNames} for savings opportunities.` : ''}`
  }

  if (totals.length >= 2) {
    const firstHalf = totals.slice(0, Math.floor(totals.length / 2))
    const secondHalf = totals.slice(Math.floor(totals.length / 2))
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
    const change = pctChange(avgFirst, avgSecond)

    if (Math.abs(change) > 10) {
      const dir = change > 0 ? 'increased' : 'decreased'
      return `Your spending ${dir} ${Math.abs(Math.round(change))}% over the last ${months.length} months, averaging ${formatCurrency(avgMonthly, false)}/month.`
    }
  }

  return `Your household spent ${formatCurrency(avgMonthly, false)}/month on average across ${months.length} months.`
}

// ---------------------------------------------------------------------------
// Delta drivers — explains WHY a category changed
// ---------------------------------------------------------------------------

export function getDeltaDrivers(input: InsightInput): DeltaDriver[] {
  const { summaryByMonth, months, categoryLookup, transactions } = input
  const sorted = [...months].sort()
  if (sorted.length < 2) return []

  const first = summaryByMonth.get(sorted[0]) ?? []
  const last = summaryByMonth.get(sorted[sorted.length - 1]) ?? []
  const firstMap = new Map(first.map(c => [c.category, Number(c.total_amount)]))

  const drivers: DeltaDriver[] = []
  const lastMonth = sorted[sorted.length - 1]
  const lastMonthTxs = transactions.filter(tx => tx.billing_month === lastMonth)

  for (const c of last) {
    if (c.category === OWN_TRANSFERS_CATEGORY_ID) continue
    const prev = firstMap.get(c.category)
    if (prev == null || prev < 30) continue

    const delta = Number(c.total_amount) - prev
    const pct = pctChange(prev, Number(c.total_amount))
    if (Math.abs(pct) < 25) continue

    const catTxs = lastMonthTxs
      .filter(tx => tx.category === c.category)
      .sort((a, b) => Math.abs(Number(b.normalized_amount ?? b.amount)) - Math.abs(Number(a.normalized_amount ?? a.amount)))
      .slice(0, 3)
      .map(tx => ({
        merchant: tx.merchant_clean || tx.merchant_raw,
        amount: Number(tx.normalized_amount ?? tx.amount),
      }))

    const cat = categoryLookup[c.category]
    drivers.push({
      category: c.category,
      label: cat?.label ?? c.category,
      delta,
      pct,
      topTransactions: catTxs,
    })
  }

  return drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4)
}

// ---------------------------------------------------------------------------
// Health summary (verdict banner)
// ---------------------------------------------------------------------------

export function getHealthSummary(input: InsightInput): HealthSummary {
  const { monthlyTotals, income, months } = input
  const totals = monthlyTotals.map(t => Number(t.total_amount))
  const avgSpend = totals.length > 0 ? totals.reduce((s, v) => s + v, 0) / totals.length : 0

  if (income != null && income > 0) {
    const savingsRate = ((income - avgSpend) / income) * 100
    if (savingsRate >= 10) {
      return {
        verdict: 'green',
        message: `Your household is in good shape — saving ${Math.round(savingsRate)}% of income (${formatCurrency(income - avgSpend, false)}/month).`,
      }
    }
    if (savingsRate >= 0) {
      return {
        verdict: 'amber',
        message: `Breaking even with a ${Math.round(savingsRate)}% savings rate. There may be room to build a stronger buffer.`,
      }
    }
    return {
      verdict: 'red',
      message: `Spending exceeds income by ${formatCurrency(avgSpend - income, false)}/month. Let's find where to adjust.`,
    }
  }

  if (totals.length >= 2) {
    const firstHalf = totals.slice(0, Math.floor(totals.length / 2))
    const secondHalf = totals.slice(Math.floor(totals.length / 2))
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
    const change = pctChange(avgFirst, avgSecond)

    if (change > 15) {
      return { verdict: 'amber', message: `Spending rising over ${months.length} months. A few categories are worth watching.` }
    }
    if (change < -10) {
      return { verdict: 'green', message: `Great trend — household spending has been decreasing.` }
    }
  }

  return { verdict: 'green', message: `Spending across ${months.length} months looks steady.` }
}

// ---------------------------------------------------------------------------
// Full insights generation (12 rules, max 8 returned)
// ---------------------------------------------------------------------------

export function generateInsights(input: InsightInput): AdvisorInsight[] {
  const insights: AdvisorInsight[] = []
  const {
    months, aggregatedSummary, summaryByMonth, monthlyTotals,
    dailyTotals, income, categoryLookup, transactions,
    recurringCharges, spendingByAccount, fixedTotal, discretionaryTotal,
    budgets,
  } = input

  const sortedMonths = [...months].sort()
  const totals = monthlyTotals.map(t => Number(t.total_amount))
  const totalSpent = totals.reduce((s, v) => s + v, 0)
  const avgMonthly = totals.length > 0 ? totalSpent / totals.length : 0

  const catLabel = (id: string) => categoryLookup[id]?.label ?? id

  // 1. Fixed vs discretionary split
  if (income != null && income > 0 && (fixedTotal > 0 || discretionaryTotal > 0)) {
    const discretionaryBudget = income - (fixedTotal / Math.max(months.length, 1))
    const discretionaryAvg = discretionaryTotal / Math.max(months.length, 1)
    const fixedAvg = fixedTotal / Math.max(months.length, 1)

    const fixedCats = aggregatedSummary
      .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && categoryLookup[c.category]?.expenseType === 'fixed')
      .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
    const discCats = aggregatedSummary
      .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && categoryLookup[c.category]?.expenseType !== 'fixed' && Number(c.total_amount) > 0)
      .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))

    const splitEvidence: EvidenceGroup[] = [
      { title: 'Fixed costs', rows: fixedCats.slice(0, 5).map(c => ({ label: catLabel(c.category), value: `${formatCurrency(Number(c.total_amount) / Math.max(months.length, 1), false)}/mo` })) },
      { title: 'Top discretionary', rows: discCats.slice(0, 5).map(c => ({ label: catLabel(c.category), value: `${formatCurrency(Number(c.total_amount) / Math.max(months.length, 1), false)}/mo` })) },
    ]

    if (discretionaryAvg > discretionaryBudget && discretionaryBudget > 0) {
      insights.push({
        id: 'fixed-discretionary-split',
        emoji: '🔒',
        text: `${formatCurrency(fixedAvg, false)} is committed to fixed costs monthly. You have ${formatCurrency(discretionaryBudget, false)} for choices — but spent ${formatCurrency(discretionaryAvg, false)} on discretionary items (${formatCurrency(discretionaryAvg - discretionaryBudget, false)} over).`,
        rationale: 'Fixed costs reduce the money available for choices. Knowing the gap helps set realistic limits.',
        severity: 'warning',
        priority: 'actionable',
        evidence: splitEvidence,
      })
    } else if (fixedAvg > 0) {
      insights.push({
        id: 'fixed-discretionary-split',
        emoji: '🔒',
        text: `${formatCurrency(fixedAvg, false)}/month is committed (fixed). You had ${formatCurrency(discretionaryBudget, false)} for choices and spent ${formatCurrency(discretionaryAvg, false)} — within budget.`,
        rationale: 'Your discretionary spending stayed within the room left after fixed costs.',
        severity: 'positive',
        priority: 'informational',
        evidence: splitEvidence,
      })
    }
  }

  // 2. Recurring charges
  if (recurringCharges.length > 3) {
    const recurringTotal = recurringCharges.reduce((s, r) => s + r.monthlyEstimate, 0)
    const topNames = recurringCharges.slice(0, 3).map(r => r.merchantClean.split(' ')[0]).join(', ')
    insights.push({
      id: 'recurring-total',
      emoji: '🔄',
      text: `${recurringCharges.length} recurring charges total ${formatCurrency(recurringTotal, false)}/month (${formatCurrency(recurringTotal * 12, false)}/year). Top: ${topNames}.`,
      rationale: 'Subscriptions and recurring fees are easy to forget. Reviewing them annually often uncovers unused services.',
      severity: recurringTotal > avgMonthly * 0.15 ? 'warning' : 'neutral',
      priority: 'actionable',
      evidence: [{
        title: 'Recurring charges',
        rows: recurringCharges.slice(0, 8).map(r => ({
          label: r.merchantClean,
          value: `${formatCurrency(r.monthlyEstimate, false)}/mo`,
          detail: `${r.monthsPresent}/${months.length} months`,
        })),
      }],
    })
  }

  // 3. Micro-spend aggregation
  const microThreshold = 15
  const microTxs = transactions.filter(tx =>
    tx.category !== OWN_TRANSFERS_CATEGORY_ID &&
    tx.status !== 'transfer' && tx.status !== 'offset' &&
    Math.abs(Number(tx.normalized_amount ?? tx.amount)) < microThreshold &&
    Math.abs(Number(tx.normalized_amount ?? tx.amount)) > 0
  )
  const avgMicroPerMonth = microTxs.length / Math.max(months.length, 1)
  if (avgMicroPerMonth > 30) {
    const microTotal = microTxs.reduce((s, tx) => s + Math.abs(Number(tx.normalized_amount ?? tx.amount)), 0)
    const microMonthly = microTotal / Math.max(months.length, 1)
    const microPct = avgMonthly > 0 ? Math.round((microMonthly / avgMonthly) * 100) : 0

    const microByMerchant = new Map<string, { count: number; total: number }>()
    for (const tx of microTxs) {
      const name = tx.merchant_clean || tx.merchant_raw
      const entry = microByMerchant.get(name) ?? { count: 0, total: 0 }
      entry.count++
      entry.total += Math.abs(Number(tx.normalized_amount ?? tx.amount))
      microByMerchant.set(name, entry)
    }
    const topMicro = [...microByMerchant.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6)

    insights.push({
      id: 'micro-spend',
      emoji: '🪙',
      text: `${Math.round(avgMicroPerMonth)} small purchases (under ${formatCurrency(microThreshold, false)}) per month totaling ${formatCurrency(microMonthly, false)}.`,
      rationale: `Small charges are ${microPct}% of your monthly spend. They fly under the radar individually but compound fast.`,
      severity: microMonthly > avgMonthly * 0.05 ? 'warning' : 'neutral',
      priority: 'informational',
      evidence: [{
        title: 'Most frequent small purchases',
        rows: topMicro.map(([name, info]) => ({
          label: name,
          value: formatCurrency(info.total, false),
          detail: `${info.count} charges`,
        })),
      }],
    })
  }

  // 4. Per-member/account imbalance
  if (spendingByAccount.length > 1) {
    const accountTotals = new Map<string, { label: string; amount: number }>()
    for (const row of spendingByAccount) {
      const key = row.account_last4 ?? 'unknown'
      const existing = accountTotals.get(key)
      if (existing) {
        existing.amount += Number(row.total_amount)
      } else {
        accountTotals.set(key, { label: row.label, amount: Number(row.total_amount) })
      }
    }
    if (accountTotals.size > 1) {
      const parts = Array.from(accountTotals.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3)
        .map(a => `${a.label}: ${formatCurrency(a.amount / Math.max(months.length, 1), false)}/mo`)
        .join(' · ')
      insights.push({
        id: 'member-breakdown',
        emoji: '👥',
        text: `Spending by card: ${parts}`,
        rationale: 'Knowing which card carries the load helps spot imbalances and optimize rewards or cash flow.',
        severity: 'neutral',
        priority: 'informational',
      })
    }
  }

  // 5. Savings rate / overspending
  if (income != null && income > 0) {
    const savingsRate = ((income - avgMonthly) / income) * 100
    if (savingsRate < 0) {
      const growing = findGrowingCategories(summaryByMonth, sortedMonths, 2)
      const names = growing.map(c => catLabel(c)).join(' and ')
      insights.push({
        id: 'overspending',
        emoji: '🔴',
        text: `Spending exceeds income by ${formatCurrency(avgMonthly - income, false)}/month.${names ? ` Watch ${names}.` : ''}`,
        rationale: 'Spending more than you earn depletes savings or grows debt. This is the single most important signal to address.',
        severity: 'concern',
        priority: 'critical',
      })
    } else if (savingsRate >= 20) {
      insights.push({
        id: 'strong-saver',
        emoji: '💚',
        text: `Saving ${Math.round(savingsRate)}% of income — excellent household discipline.`,
        rationale: 'A 20%+ savings rate puts you ahead of most households and builds a strong financial cushion.',
        severity: 'positive',
        priority: 'informational',
      })
    }
  }

  // 6. Delta drivers (top category changes)
  if (sortedMonths.length >= 2) {
    const firstMonth = summaryByMonth.get(sortedMonths[0]) ?? []
    const lastMonth = summaryByMonth.get(sortedMonths[sortedMonths.length - 1]) ?? []
    const firstMap = new Map(firstMonth.map(c => [c.category, Number(c.total_amount)]))

    let biggestRise: { cat: string; pct: number; delta: number } | null = null

    for (const c of lastMonth) {
      if (c.category === OWN_TRANSFERS_CATEGORY_ID) continue
      const prev = firstMap.get(c.category)
      if (prev != null && prev > 50) {
        const change = pctChange(prev, Number(c.total_amount))
        if (change > 25 && (!biggestRise || change > biggestRise.pct)) {
          biggestRise = { cat: c.category, pct: change, delta: Number(c.total_amount) - prev }
        }
      }
    }

    if (biggestRise) {
      const lastMonthTxs = transactions
        .filter(tx => tx.billing_month === sortedMonths[sortedMonths.length - 1] && tx.category === biggestRise!.cat)
        .sort((a, b) => Math.abs(Number(b.normalized_amount ?? b.amount)) - Math.abs(Number(a.normalized_amount ?? a.amount)))
      const catTxNames = lastMonthTxs
        .slice(0, 2)
        .map(tx => (tx.merchant_clean || tx.merchant_raw).split(' ').slice(0, 3).join(' '))

      const driverHint = catTxNames.length > 0 ? ` (${catTxNames.join(', ')})` : ''
      insights.push({
        id: 'delta-driver',
        emoji: '📈',
        text: `${catLabel(biggestRise.cat)} grew ${Math.round(biggestRise.pct)}% (+${formatCurrency(biggestRise.delta, false)})${driverHint}.`,
        rationale: 'A sharp increase in one category often signals a new habit or one-off event worth investigating.',
        severity: 'warning',
        priority: 'actionable',
        evidence: [{
          title: `${catLabel(biggestRise.cat)} charges this month`,
          rows: lastMonthTxs.slice(0, 8).map(tx => ({
            label: tx.merchant_clean || tx.merchant_raw,
            value: formatCurrency(Math.abs(Number(tx.normalized_amount ?? tx.amount)), false),
            detail: tx.tx_date,
          })),
        }],
      })
    }
  }

  // 7. Category dominance
  if (totalSpent > 0 && aggregatedSummary.length > 0) {
    const top = aggregatedSummary[0]
    if (top.category !== OWN_TRANSFERS_CATEGORY_ID) {
      const share = (top.total_amount / totalSpent) * 100
      if (share > 35) {
        const domTxs = transactions
          .filter(tx => tx.category === top.category)
          .sort((a, b) => Math.abs(Number(b.normalized_amount ?? b.amount)) - Math.abs(Number(a.normalized_amount ?? a.amount)))
        const domMerchants = new Map<string, { count: number; total: number }>()
        for (const tx of domTxs) {
          const name = tx.merchant_clean || tx.merchant_raw
          const entry = domMerchants.get(name) ?? { count: 0, total: 0 }
          entry.count++
          entry.total += Math.abs(Number(tx.normalized_amount ?? tx.amount))
          domMerchants.set(name, entry)
        }
        insights.push({
          id: 'dominant-category',
          emoji: '📊',
          text: `${catLabel(top.category)} is ${Math.round(share)}% of all spending. Does that align with priorities?`,
          rationale: 'When one category dominates, small changes there have outsized impact on the total.',
          severity: 'neutral',
          priority: 'actionable',
          evidence: [{
            title: `Where ${catLabel(top.category)} goes`,
            rows: [...domMerchants.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 8)
              .map(([name, info]) => ({
                label: name,
                value: formatCurrency(info.total / Math.max(months.length, 1), false) + '/mo',
                detail: `${info.count} charges`,
              })),
          }],
        })
      }
    }
  }

  // 8. D3: Experiment framing (replaces old variable-spending rule)
  for (const cs of aggregatedSummary) {
    if (cs.category === OWN_TRANSFERS_CATEGORY_ID) continue
    const freq = categoryLookup[cs.category]?.spendingFrequency ?? 'monthly'
    if (freq !== 'monthly') continue

    const catMonthlyAmounts = sortedMonths.map(m => {
      const monthCats = summaryByMonth.get(m)
      const match = monthCats?.find(c => c.category === cs.category)
      return match ? Number(match.total_amount) : 0
    }).filter(v => v > 0)

    if (catMonthlyAmounts.length >= 3) {
      const cv = coefficientOfVariation(catMonthlyAmounts)
      if (cv > 0.25) {
        const min = Math.min(...catMonthlyAmounts)
        const max = Math.max(...catMonthlyAmounts)

        const monthRows: EvidenceRow[] = sortedMonths.map(m => {
          const monthCats = summaryByMonth.get(m)
          const match = monthCats?.find(c => c.category === cs.category)
          const amt = match ? Number(match.total_amount) : 0
          return { label: formatMonth(m), value: formatCurrency(amt, false) }
        }).filter(r => r.value !== formatCurrency(0, false))

        insights.push({
          id: `experiment-framing-${cs.category}`,
          emoji: '🧪',
          text: `${catLabel(cs.category)} varied between ${formatCurrency(min, false)} and ${formatCurrency(max, false)} over ${catMonthlyAmounts.length} months. Consider tracking a specific change for 3 months and measuring actual savings.`,
          rationale: 'High variance means this category is responsive to behavior changes — a good place to experiment.',
          severity: 'neutral',
          priority: 'actionable',
          evidence: [{ title: `${catLabel(cs.category)} by month`, rows: monthRows }],
        })
        break
      }
    }
  }

  // 9. Weekend pattern
  if (dailyTotals.length > 7) {
    let weekdayTotal = 0, weekdayDays = 0
    let weekendTotal = 0, weekendDays = 0

    for (const d of dailyTotals) {
      const day = new Date(d.date).getDay()
      if (day === 0 || day === 6) {
        weekendTotal += d.amount
        weekendDays++
      } else {
        weekdayTotal += d.amount
        weekdayDays++
      }
    }

    const avgWeekday = weekdayDays > 0 ? weekdayTotal / weekdayDays : 0
    const avgWeekend = weekendDays > 0 ? weekendTotal / weekendDays : 0

    if (avgWeekend > avgWeekday * 1.4 && avgWeekend > 0) {
      const pct = Math.round(((avgWeekend - avgWeekday) / avgWeekday) * 100)

      const weekendTxs = transactions.filter(tx => {
        const day = new Date(tx.tx_date).getDay()
        return (day === 0 || day === 6) && tx.status !== 'transfer' && tx.status !== 'offset' && tx.category !== OWN_TRANSFERS_CATEGORY_ID
      })
      const weekendMerchants = new Map<string, { count: number; total: number }>()
      for (const tx of weekendTxs) {
        const name = tx.merchant_clean || tx.merchant_raw
        const entry = weekendMerchants.get(name) ?? { count: 0, total: 0 }
        entry.count++
        entry.total += Math.abs(Number(tx.normalized_amount ?? tx.amount))
        weekendMerchants.set(name, entry)
      }

      insights.push({
        id: 'weekend-spending',
        emoji: '🗓️',
        text: `Weekend spending is ${pct}% higher than weekdays. Planning ahead for weekends could help.`,
        rationale: 'Weekend spending spikes often come from unplanned dining, activities, or impulse purchases.',
        severity: 'neutral',
        priority: 'informational',
        evidence: [{
          title: 'Top weekend merchants',
          rows: [...weekendMerchants.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 6)
            .map(([name, info]) => ({
              label: name,
              value: formatCurrency(info.total, false),
              detail: `${info.count} charges`,
            })),
        }],
      })
    }
  }

  // 10. Best and worst months
  if (totals.length >= 3) {
    const minIdx = totals.indexOf(Math.min(...totals))
    const maxIdx = totals.indexOf(Math.max(...totals))
    const bestMonth = monthlyTotals[minIdx]
    const worstMonth = monthlyTotals[maxIdx]

    if (bestMonth && worstMonth && bestMonth.billing_month !== worstMonth.billing_month) {
      const worstCats = (summaryByMonth.get(worstMonth.billing_month) ?? [])
        .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && Number(c.total_amount) > 0)
        .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
        .slice(0, 5)
      const bestCats = (summaryByMonth.get(bestMonth.billing_month) ?? [])
        .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && Number(c.total_amount) > 0)
        .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
        .slice(0, 5)

      insights.push({
        id: 'best-worst-month',
        emoji: '📅',
        text: `Lightest month: ${formatMonth(bestMonth.billing_month)} (${formatCurrency(Number(bestMonth.total_amount), false)}). Heaviest: ${formatMonth(worstMonth.billing_month)} (${formatCurrency(Number(worstMonth.total_amount), false)}).`,
        rationale: 'Understanding your best and worst months helps anticipate cash flow peaks.',
        severity: 'neutral',
        priority: 'informational',
        evidence: [
          { title: `${formatMonth(worstMonth.billing_month)} (heaviest)`, rows: worstCats.map(c => ({ label: catLabel(c.category), value: formatCurrency(Number(c.total_amount), false) })) },
          { title: `${formatMonth(bestMonth.billing_month)} (lightest)`, rows: bestCats.map(c => ({ label: catLabel(c.category), value: formatCurrency(Number(c.total_amount), false) })) },
        ],
      })
    }
  }

  // D1. Average Trap Warning — fires when annual category raw avg >= 2x annualized allocation
  const annualCatSpend = aggregatedSummary
    .filter(c => categoryLookup[c.category]?.spendingFrequency === 'annual' && Number(c.total_amount) > 0)
  const oneOffSpend = aggregatedSummary
    .filter(c => categoryLookup[c.category]?.spendingFrequency === 'one_off')
    .reduce((s, c) => s + Number(c.total_amount), 0)

  if (annualCatSpend.length > 0 && months.length > 0 && months.length < 12) {
    const annualTotal = annualCatSpend.reduce((s, c) => s + Number(c.total_amount), 0)
    const rawMonthlyAvg = annualTotal / months.length
    const annualizedAllocation = annualTotal / 12
    if (rawMonthlyAvg >= annualizedAllocation * 2) {
      const baseline = (totalSpent - annualTotal - oneOffSpend) / months.length
      const annualNames = annualCatSpend.map(c => catLabel(c.category)).join(', ')

      const trapEvidence: EvidenceGroup[] = []

      for (const cs of annualCatSpend) {
        const catTxs = transactions
          .filter(tx => tx.category === cs.category)
          .map(tx => ({
            merchant: tx.merchant_clean || tx.merchant_raw,
            amount: Math.abs(Number(tx.normalized_amount ?? tx.amount)),
            month: tx.billing_month,
          }))

        const allAmounts = catTxs.map(tx => tx.amount).sort((a, b) => a - b)
        const median = allAmounts.length > 0 ? allAmounts[Math.floor(allAmounts.length / 2)] : 0
        const bigThreshold = Math.max(median * 3, 100)

        const bigCharges = catTxs.filter(tx => tx.amount >= bigThreshold)
        const smallCharges = catTxs.filter(tx => tx.amount < bigThreshold)

        if (bigCharges.length > 0) {
          const merchantTotals = new Map<string, { count: number; total: number }>()
          for (const tx of bigCharges) {
            const e = merchantTotals.get(tx.merchant) ?? { count: 0, total: 0 }
            e.count++
            e.total += tx.amount
            merchantTotals.set(tx.merchant, e)
          }
          trapEvidence.push({
            title: `Occasional big expenses (${formatCurrency(bigCharges.reduce((s, tx) => s + tx.amount, 0), false)} total)`,
            rows: [...merchantTotals.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 6)
              .map(([name, info]) => ({
                label: name,
                value: formatCurrency(info.total, false),
                detail: info.count > 1 ? `${info.count} charges` : undefined,
              })),
          })
        }

        if (smallCharges.length > 0) {
          const merchantTotals = new Map<string, { count: number; total: number }>()
          for (const tx of smallCharges) {
            const e = merchantTotals.get(tx.merchant) ?? { count: 0, total: 0 }
            e.count++
            e.total += tx.amount
            merchantTotals.set(tx.merchant, e)
          }
          trapEvidence.push({
            title: `Day-to-day spending (${formatCurrency(smallCharges.reduce((s, tx) => s + tx.amount, 0), false)} total)`,
            rows: [...merchantTotals.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 6)
              .map(([name, info]) => ({
                label: name,
                value: formatCurrency(info.total, false),
                detail: info.count > 1 ? `${info.count} charges` : undefined,
              })),
          })
        }
      }

      insights.push({
        id: 'average-trap',
        emoji: '⚠️',
        text: `${annualNames} look${annualCatSpend.length === 1 ? 's' : ''} like ${formatCurrency(rawMonthlyAvg, false)}/month but include${annualCatSpend.length === 1 ? 's' : ''} costs that occur a few times per year. Your true monthly baseline without these is ${formatCurrency(baseline, false)}.`,
        rationale: 'Averaging annual costs into monthly figures inflates your baseline and can lead to cutting the wrong things.',
        severity: 'warning',
        priority: 'critical',
        evidence: trapEvidence,
      })
    }
  }

  // D2. Annualized Impact Framing — show annual impact for top category savings
  if (income != null && income > 0) {
    const topCat = aggregatedSummary
      .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && categoryLookup[c.category]?.spendingFrequency !== 'one_off')
      .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))[0]
    if (topCat) {
      const monthlyAvg = Number(topCat.total_amount) / Math.max(months.length, 1)
      if (monthlyAvg > avgMonthly * 0.1) {
        const tenPctSaving = monthlyAvg * 0.1
        const impactTxs = transactions.filter(tx => tx.category === topCat.category)
        const impactMerchants = new Map<string, { count: number; total: number }>()
        for (const tx of impactTxs) {
          const name = tx.merchant_clean || tx.merchant_raw
          const entry = impactMerchants.get(name) ?? { count: 0, total: 0 }
          entry.count++
          entry.total += Math.abs(Number(tx.normalized_amount ?? tx.amount))
          impactMerchants.set(name, entry)
        }

        insights.push({
          id: 'annualized-impact',
          emoji: '📐',
          text: `Reducing ${catLabel(topCat.category)} by just 10% (${formatCurrency(tenPctSaving, false)}/month) saves ${formatCurrency(tenPctSaving * 12, false)}/year.`,
          rationale: 'Small monthly reductions in your biggest category compound into meaningful annual savings.',
          severity: 'neutral',
          priority: 'informational',
          evidence: [{
            title: `${catLabel(topCat.category)} top merchants`,
            rows: [...impactMerchants.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 6)
              .map(([name, info]) => ({
                label: name,
                value: formatCurrency(info.total / Math.max(months.length, 1), false) + '/mo',
                detail: `${info.count} charges`,
              })),
          }],
        })
      }
    }
  }

  // D4. Sustainability Check — budget exceeded 15%+ for 3+ consecutive months
  if (budgets && budgets.length > 0 && sortedMonths.length >= 3) {
    for (const budget of budgets) {
      let consecutive = 0
      for (const m of sortedMonths) {
        const monthCats = summaryByMonth.get(m)
        const actual = monthCats?.find(c => c.category === budget.category_id)
        const spent = actual ? Math.abs(Number(actual.total_amount)) : 0
        if (spent > budget.monthly_target * 1.15) {
          consecutive++
        } else {
          consecutive = 0
        }
      }
      if (consecutive >= 3) {
        const budgetMonthRows: EvidenceRow[] = sortedMonths.map(m => {
          const monthCats = summaryByMonth.get(m)
          const actual = monthCats?.find(c => c.category === budget.category_id)
          const spent = actual ? Math.abs(Number(actual.total_amount)) : 0
          const over = spent - budget.monthly_target
          return {
            label: formatMonth(m),
            value: formatCurrency(spent, false),
            detail: over > 0 ? `+${formatCurrency(over, false)} over` : 'within budget',
          }
        })

        insights.push({
          id: `sustainability-${budget.category_id}`,
          emoji: '🔥',
          text: `${catLabel(budget.category_id)} has exceeded its budget by 15%+ for ${consecutive} consecutive months. The target of ${formatCurrency(budget.monthly_target, false)}/month may not be sustainable — consider adjusting to a level you can maintain.`,
          rationale: 'Consistently blown budgets cause guilt without results. A realistic target you can hit is more effective.',
          severity: 'concern',
          priority: 'critical',
          evidence: [{ title: `${catLabel(budget.category_id)} vs budget (${formatCurrency(budget.monthly_target, false)}/mo)`, rows: budgetMonthRows }],
        })
        break
      }
    }
  }

  // D5. Category Depth Prompt — suggest subcategories for large unsplit categories
  const topCategories = aggregatedSummary
    .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID)
    .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
    .slice(0, 3)

  for (const tc of topCategories) {
    const info = categoryLookup[tc.category]
    if (!info) continue
    const hasChildren = Object.values(categoryLookup).some(c => c.parentCategoryId === tc.category)
    if (hasChildren) continue
    if (info.parentCategoryId) continue

    const catAvg = Number(tc.total_amount) / Math.max(months.length, 1)
    if (catAvg > avgMonthly * 0.12) {
      const depthTxs = transactions.filter(tx => tx.category === tc.category)
      const depthMerchants = new Map<string, { count: number; total: number }>()
      for (const tx of depthTxs) {
        const name = tx.merchant_clean || tx.merchant_raw
        const entry = depthMerchants.get(name) ?? { count: 0, total: 0 }
        entry.count++
        entry.total += Math.abs(Number(tx.normalized_amount ?? tx.amount))
        depthMerchants.set(name, entry)
      }

      insights.push({
        id: `depth-prompt-${tc.category}`,
        emoji: '🔍',
        text: `${catLabel(tc.category)} averages ${formatCurrency(catAvg, false)}/month. Breaking it into subcategories (e.g., activities, items, services) would reveal where the spending concentrates.`,
        rationale: 'Broad categories hide the actionable detail. You can only optimize what you can see.',
        severity: 'neutral',
        priority: 'actionable',
        evidence: [{
          title: `What's inside ${catLabel(tc.category)}`,
          rows: [...depthMerchants.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 8)
            .map(([name, info]) => ({
              label: name,
              value: formatCurrency(info.total / Math.max(months.length, 1), false) + '/mo',
              detail: `${info.count} charges`,
            })),
        }],
      })
      break
    }
  }

  return selectInsightsByPriority(insights)
}

/**
 * Selects insights using priority tiers:
 * - Critical: uncapped, always shown
 * - Actionable: up to 4 after critical
 * - Informational: up to 2 after actionable
 * - Hard ceiling: 10 total
 */
function selectInsightsByPriority(insights: AdvisorInsight[]): AdvisorInsight[] {
  const critical = insights.filter(i => i.priority === 'critical')
  const actionable = insights.filter(i => i.priority === 'actionable')
  const informational = insights.filter(i => i.priority === 'informational')

  const result: AdvisorInsight[] = [...critical]
  const remaining = 10 - result.length

  const actionableSlots = Math.min(actionable.length, Math.min(4, remaining))
  result.push(...actionable.slice(0, actionableSlots))

  const infoSlots = Math.min(informational.length, Math.min(2, 10 - result.length))
  result.push(...informational.slice(0, infoSlots))

  return result.slice(0, 10)
}

// ---------------------------------------------------------------------------
// Spending velocity (pace within current month)
// ---------------------------------------------------------------------------

export interface VelocityInsight {
  dayOfMonth: number
  daysInMonth: number
  spentSoFar: number
  budget: number
  paceProjection: number
  remainingPerDay: number
}

export function getSpendingVelocity(
  dailyTotals: DailyTotal[],
  income: number | null,
  currentMonth: string,
): VelocityInsight | null {
  if (!income || income <= 0) return null

  const monthTotals = dailyTotals.filter(d => d.date.startsWith(currentMonth))
  if (monthTotals.length === 0) return null

  const [yearStr, monthStr] = currentMonth.split('-')
  const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate()
  const lastDate = monthTotals[monthTotals.length - 1]?.date
  const dayOfMonth = lastDate ? new Date(lastDate).getDate() : 1

  const spentSoFar = monthTotals.reduce((s, d) => s + d.amount, 0)
  const dailyRate = dayOfMonth > 0 ? spentSoFar / dayOfMonth : 0
  const paceProjection = dailyRate * daysInMonth
  const remaining = income - spentSoFar
  const remainingDays = daysInMonth - dayOfMonth
  const remainingPerDay = remainingDays > 0 ? remaining / remainingDays : 0

  return { dayOfMonth, daysInMonth, spentSoFar, budget: income, paceProjection, remainingPerDay }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findGrowingCategories(
  byMonth: Map<string, CategorySummary[]>,
  sortedMonths: string[],
  count: number,
): string[] {
  if (sortedMonths.length < 2) return []

  const first = byMonth.get(sortedMonths[0]) ?? []
  const last = byMonth.get(sortedMonths[sortedMonths.length - 1]) ?? []
  const firstMap = new Map(first.map(c => [c.category, Number(c.total_amount)]))

  const deltas: { category: string; delta: number }[] = []
  for (const c of last) {
    if (c.category === OWN_TRANSFERS_CATEGORY_ID) continue
    const prev = firstMap.get(c.category) ?? 0
    deltas.push({ category: c.category, delta: Number(c.total_amount) - prev })
  }

  return deltas
    .sort((a, b) => b.delta - a.delta)
    .slice(0, count)
    .map(d => d.category)
}

function getTopCategoryDrivers(
  summaryByMonth: Map<string, CategorySummary[]>,
  months: string[],
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>,
): { category: string; label: string; amount: number }[] {
  const sorted = [...months].sort()
  if (sorted.length === 0) return []

  const lastSummary = summaryByMonth.get(sorted[sorted.length - 1]) ?? []
  return lastSummary
    .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID)
    .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
    .slice(0, 3)
    .map(c => ({
      category: c.category,
      label: categoryLookup[c.category]?.label ?? c.category,
      amount: Number(c.total_amount),
    }))
}

export function getSpendingPredictability(totals: number[]): {
  label: string
  cv: number
} {
  const cv = coefficientOfVariation(totals)
  if (cv < 0.1) return { label: 'Very stable', cv }
  if (cv < 0.2) return { label: 'Mostly stable', cv }
  if (cv < 0.3) return { label: 'Some swings', cv }
  return { label: 'Unpredictable', cv }
}

export function getBiggestMover(
  summaryByMonth: Map<string, CategorySummary[]>,
  months: string[],
  categoryLookup: Record<string, { icon: string; label: string }>,
): { category: string; label: string; icon: string; delta: number; pct: number; direction: 'up' | 'down' } | null {
  const sorted = [...months].sort()
  if (sorted.length < 2) return null

  const first = summaryByMonth.get(sorted[0]) ?? []
  const last = summaryByMonth.get(sorted[sorted.length - 1]) ?? []
  const firstMap = new Map(first.map(c => [c.category, Number(c.total_amount)]))

  let best: { category: string; absDelta: number; delta: number; pct: number } | null = null

  for (const c of last) {
    if (c.category === OWN_TRANSFERS_CATEGORY_ID) continue
    const prev = firstMap.get(c.category)
    if (prev != null && prev > 30) {
      const delta = Number(c.total_amount) - prev
      const pct = pctChange(prev, Number(c.total_amount))
      if (!best || Math.abs(delta) > best.absDelta) {
        best = { category: c.category, absDelta: Math.abs(delta), delta, pct }
      }
    }
  }

  if (!best) return null

  const cat = categoryLookup[best.category]
  return {
    category: best.category,
    label: cat?.label ?? best.category,
    icon: cat?.icon ?? '📦',
    delta: best.delta,
    pct: best.pct,
    direction: best.delta >= 0 ? 'up' : 'down',
  }
}

export function detectDayOfWeekPattern(dailyTotals: DailyTotal[]): string | null {
  if (dailyTotals.length < 14) return null

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayTotals = Array.from({ length: 7 }, () => ({ amount: 0, count: 0 }))

  for (const d of dailyTotals) {
    const day = new Date(d.date).getDay()
    dayTotals[day].amount += d.amount
    dayTotals[day].count++
  }

  const dayAvgs = dayTotals.map((d, i) => ({
    day: i,
    avg: d.count > 0 ? d.amount / d.count : 0,
  }))

  const overall = dayAvgs.reduce((s, d) => s + d.avg, 0) / 7
  if (overall === 0) return null

  const heaviest = dayAvgs.reduce((a, b) => (b.avg > a.avg ? b : a))
  if (heaviest.avg > overall * 1.4) {
    return `Your heaviest spending day tends to be ${dayNames[heaviest.day]}s.`
  }

  return null
}
