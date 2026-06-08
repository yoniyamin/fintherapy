import type { CategorySummary, MonthlyTotal } from '../hooks/useReveal'
import type { AccountSpending, DailyTotal, CategoryTrendPoint } from '../hooks/useMultiMonthReveal'
import type { ExportRow } from '../hooks/useTransactions'
import type { RecurringCharge } from './recurringDetector'
import { detectRecurring } from './recurringDetector'
import { OWN_TRANSFERS_CATEGORY_ID } from './constants'

export type InsightSeverity = 'positive' | 'neutral' | 'warning' | 'concern'

export interface AdvisorInsight {
  id: string
  emoji: string
  text: string
  severity: InsightSeverity
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
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>
  transactions: ExportRow[]
  recurringCharges: RecurringCharge[]
  spendingByAccount: AccountSpending[]
  fixedTotal: number
  discretionaryTotal: number
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
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>
  transactions: ExportRow[]
  spendingByAccount?: AccountSpending[]
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
  }
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

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
      return `You overspent by ${fmt(diff)}/month on average. ${driverNames ? `${driverNames} drove most of the increase.` : 'Review your top categories for adjustment opportunities.'}`
    }
    if (diff < -50) {
      return `You saved ${fmt(Math.abs(diff))}/month on average — solid household discipline.${driverNames ? ` ${driverNames} were your biggest categories.` : ''}`
    }
    return `You're breaking even at ${fmt(avgMonthly)}/month vs ${fmt(income)} income.${driverNames ? ` Watch ${driverNames} for savings opportunities.` : ''}`
  }

  if (totals.length >= 2) {
    const firstHalf = totals.slice(0, Math.floor(totals.length / 2))
    const secondHalf = totals.slice(Math.floor(totals.length / 2))
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
    const change = pctChange(avgFirst, avgSecond)

    if (Math.abs(change) > 10) {
      const dir = change > 0 ? 'increased' : 'decreased'
      return `Your spending ${dir} ${Math.abs(Math.round(change))}% over the last ${months.length} months, averaging ${fmt(avgMonthly)}/month.`
    }
  }

  return `Your household spent ${fmt(avgMonthly)}/month on average across ${months.length} months.`
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
        message: `Your household is in good shape — saving ${Math.round(savingsRate)}% of income (${fmt(income - avgSpend)}/month).`,
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
      message: `Spending exceeds income by ${fmt(avgSpend - income)}/month. Let's find where to adjust.`,
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

    if (discretionaryAvg > discretionaryBudget && discretionaryBudget > 0) {
      insights.push({
        id: 'fixed-discretionary-split',
        emoji: '🔒',
        text: `${fmt(fixedAvg)} is committed to fixed costs monthly. You have ${fmt(discretionaryBudget)} for choices — but spent ${fmt(discretionaryAvg)} on discretionary items (${fmt(discretionaryAvg - discretionaryBudget)} over).`,
        severity: 'warning',
      })
    } else if (fixedAvg > 0) {
      insights.push({
        id: 'fixed-discretionary-split',
        emoji: '🔒',
        text: `${fmt(fixedAvg)}/month is committed (fixed). You had ${fmt(discretionaryBudget)} for choices and spent ${fmt(discretionaryAvg)} — within budget.`,
        severity: 'positive',
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
      text: `${recurringCharges.length} recurring charges total ${fmt(recurringTotal)}/month (${fmt(recurringTotal * 12)}/year). Top: ${topNames}.`,
      severity: recurringTotal > avgMonthly * 0.15 ? 'warning' : 'neutral',
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
    insights.push({
      id: 'micro-spend',
      emoji: '🪙',
      text: `${Math.round(avgMicroPerMonth)} small purchases (under ${fmt(microThreshold)}) per month totaling ${fmt(microMonthly)}.`,
      severity: microMonthly > avgMonthly * 0.05 ? 'warning' : 'neutral',
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
        .map(a => `${a.label}: ${fmt(a.amount / Math.max(months.length, 1))}/mo`)
        .join(' · ')
      insights.push({
        id: 'member-breakdown',
        emoji: '👥',
        text: `Spending by card: ${parts}`,
        severity: 'neutral',
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
        text: `Spending exceeds income by ${fmt(avgMonthly - income)}/month.${names ? ` Watch ${names}.` : ''}`,
        severity: 'concern',
      })
    } else if (savingsRate >= 20) {
      insights.push({
        id: 'strong-saver',
        emoji: '💚',
        text: `Saving ${Math.round(savingsRate)}% of income — excellent household discipline.`,
        severity: 'positive',
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
      const catTxs = transactions
        .filter(tx => tx.billing_month === sortedMonths[sortedMonths.length - 1] && tx.category === biggestRise!.cat)
        .sort((a, b) => Math.abs(Number(b.normalized_amount ?? b.amount)) - Math.abs(Number(a.normalized_amount ?? a.amount)))
        .slice(0, 2)
        .map(tx => (tx.merchant_clean || tx.merchant_raw).split(' ').slice(0, 3).join(' '))

      const driverHint = catTxs.length > 0 ? ` (${catTxs.join(', ')})` : ''
      insights.push({
        id: 'delta-driver',
        emoji: '📈',
        text: `${catLabel(biggestRise.cat)} grew ${Math.round(biggestRise.pct)}% (+${fmt(biggestRise.delta)})${driverHint}.`,
        severity: 'warning',
      })
    }
  }

  // 7. Category dominance
  if (totalSpent > 0 && aggregatedSummary.length > 0) {
    const top = aggregatedSummary[0]
    if (top.category !== OWN_TRANSFERS_CATEGORY_ID) {
      const share = (top.total_amount / totalSpent) * 100
      if (share > 35) {
        insights.push({
          id: 'dominant-category',
          emoji: '📊',
          text: `${catLabel(top.category)} is ${Math.round(share)}% of all spending. Does that align with priorities?`,
          severity: 'neutral',
        })
      }
    }
  }

  // 8. Spending predictability
  if (totals.length >= 3) {
    const cv = coefficientOfVariation(totals)
    if (cv > 0.3) {
      insights.push({
        id: 'variable-spending',
        emoji: '🎢',
        text: `Monthly spending varies significantly. A target budget could help smooth things out.`,
        severity: 'warning',
      })
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
      insights.push({
        id: 'weekend-spending',
        emoji: '🗓️',
        text: `Weekend spending is ${pct}% higher than weekdays. Planning ahead for weekends could help.`,
        severity: 'neutral',
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
      insights.push({
        id: 'best-worst-month',
        emoji: '📅',
        text: `Lightest month: ${formatMonth(bestMonth.billing_month)} (${fmt(Number(bestMonth.total_amount))}). Heaviest: ${formatMonth(worstMonth.billing_month)} (${fmt(Number(worstMonth.total_amount))}).`,
        severity: 'neutral',
      })
    }
  }

  return insights.slice(0, 8)
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
