import type { CategorySummary, MonthlyTotal } from '../hooks/useReveal'
import type { DailyTotal, CategoryTrendPoint } from '../hooks/useMultiMonthReveal'

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

interface InsightInput {
  months: string[]
  aggregatedSummary: CategorySummary[]
  summaryByMonth: Map<string, CategorySummary[]>
  monthlyTotals: MonthlyTotal[]
  categoryTrend: CategoryTrendPoint[]
  dailyTotals: DailyTotal[]
  income: number | null
  categoryLookup: Record<string, { icon: string; label: string }>
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

function pctChange(from: number, to: number): number {
  if (from === 0) return 0
  return ((to - from) / Math.abs(from)) * 100
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

export function getHealthSummary(input: InsightInput): HealthSummary {
  const { monthlyTotals, income, months } = input
  const totals = monthlyTotals.map(t => Number(t.total_amount))
  const avgSpend = totals.length > 0 ? totals.reduce((s, v) => s + v, 0) / totals.length : 0

  if (income != null && income > 0) {
    const savingsRate = ((income - avgSpend) / income) * 100
    if (savingsRate >= 10) {
      return {
        verdict: 'green',
        message: `Your household is in good shape — spending is stable and you're saving ${Math.round(savingsRate)}% of income.`,
      }
    }
    if (savingsRate >= 0) {
      return {
        verdict: 'amber',
        message: `You're breaking even with a ${Math.round(savingsRate)}% savings rate. There may be room to build a stronger buffer.`,
      }
    }
    return {
      verdict: 'red',
      message: `Your household is spending more than it earns. Let's look at where to adjust.`,
    }
  }

  if (totals.length >= 2) {
    const firstHalf = totals.slice(0, Math.floor(totals.length / 2))
    const secondHalf = totals.slice(Math.floor(totals.length / 2))
    const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
    const change = pctChange(avgFirst, avgSecond)

    if (change > 15) {
      return {
        verdict: 'amber',
        message: `Spending has been rising over the last ${months.length} months. A few categories are worth watching.`,
      }
    }
    if (change < -10) {
      return {
        verdict: 'green',
        message: `Great trend — your household spending has been decreasing. Keep it up.`,
      }
    }
  }

  return {
    verdict: 'green',
    message: `Your spending across ${months.length} months looks steady. Here's the full picture.`,
  }
}

export function generateInsights(input: InsightInput): AdvisorInsight[] {
  const insights: AdvisorInsight[] = []
  const { months, aggregatedSummary, summaryByMonth, monthlyTotals, dailyTotals, income, categoryLookup } = input

  const sortedMonths = [...months].sort()
  const totals = monthlyTotals.map(t => Number(t.total_amount))
  const totalSpent = totals.reduce((s, v) => s + v, 0)
  const avgMonthly = totals.length > 0 ? totalSpent / totals.length : 0

  const catLabel = (id: string) => categoryLookup[id]?.label ?? id

  // 1. Savings rate insight
  if (income != null && income > 0) {
    const savingsRate = ((income - avgMonthly) / income) * 100
    if (savingsRate < 0) {
      const growing = findGrowingCategories(summaryByMonth, sortedMonths, 2)
      const names = growing.map(c => catLabel(c)).join(' and ')
      insights.push({
        id: 'overspending',
        emoji: '🔴',
        text: `Your household is spending more than its income. The biggest opportunities to adjust are ${names}.`,
        severity: 'concern',
      })
    } else if (savingsRate >= 20) {
      insights.push({
        id: 'strong-saver',
        emoji: '💚',
        text: `You're saving ${Math.round(savingsRate)}% of income — that's excellent discipline. Keep it going.`,
        severity: 'positive',
      })
    }
  }

  // 2. Category dominance
  if (totalSpent > 0 && aggregatedSummary.length > 0) {
    const top = aggregatedSummary[0]
    const share = (top.total_amount / totalSpent) * 100
    if (share > 35) {
      insights.push({
        id: 'dominant-category',
        emoji: '📊',
        text: `${catLabel(top.category)} makes up ${Math.round(share)}% of all spending. Consider whether that aligns with your priorities.`,
        severity: 'neutral',
      })
    }
  }

  // 3. Biggest category decrease (positive news first)
  if (sortedMonths.length >= 2) {
    const firstMonth = summaryByMonth.get(sortedMonths[0]) ?? []
    const lastMonth = summaryByMonth.get(sortedMonths[sortedMonths.length - 1]) ?? []
    const firstMap = new Map(firstMonth.map(c => [c.category, Number(c.total_amount)]))

    let biggestDrop: { cat: string; pct: number } | null = null
    let biggestRise: { cat: string; pct: number; delta: number } | null = null

    for (const c of lastMonth) {
      const prev = firstMap.get(c.category)
      if (prev != null && prev > 50) {
        const change = pctChange(prev, Number(c.total_amount))
        if (change < -15 && (!biggestDrop || change < biggestDrop.pct)) {
          biggestDrop = { cat: c.category, pct: change }
        }
        if (change > 25 && (!biggestRise || change > biggestRise.pct)) {
          biggestRise = { cat: c.category, pct: change, delta: Number(c.total_amount) - prev }
        }
      }
    }

    if (biggestDrop) {
      insights.push({
        id: 'category-decrease',
        emoji: '📉',
        text: `Great news — ${catLabel(biggestDrop.cat)} spending decreased by ${Math.abs(Math.round(biggestDrop.pct))}%. Whatever you changed, it's working.`,
        severity: 'positive',
      })
    }

    if (biggestRise) {
      insights.push({
        id: 'category-increase',
        emoji: '📈',
        text: `${catLabel(biggestRise.cat)} grew by ${Math.round(biggestRise.pct)}% — this area may deserve a closer look.`,
        severity: 'warning',
      })
    }
  }

  // 4. Spending predictability
  if (totals.length >= 3) {
    const cv = coefficientOfVariation(totals)
    if (cv < 0.1) {
      insights.push({
        id: 'very-stable',
        emoji: '🎯',
        text: `Your spending is very predictable, which is healthy for budgeting. Keep it steady.`,
        severity: 'positive',
      })
    } else if (cv > 0.3) {
      insights.push({
        id: 'variable-spending',
        emoji: '🎢',
        text: `Monthly spending varies quite a bit. Setting a monthly target could help smooth things out.`,
        severity: 'warning',
      })
    }
  }

  // 5. Weekend vs weekday pattern
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
        text: `Weekend spending is ${pct}% higher than weekdays on average. Planning ahead for weekends could help.`,
        severity: 'neutral',
      })
    }
  }

  // 6. Best and worst months
  if (totals.length >= 3) {
    const minIdx = totals.indexOf(Math.min(...totals))
    const maxIdx = totals.indexOf(Math.max(...totals))
    const bestMonth = monthlyTotals[minIdx]
    const worstMonth = monthlyTotals[maxIdx]

    if (bestMonth && worstMonth && bestMonth.billing_month !== worstMonth.billing_month) {
      insights.push({
        id: 'best-worst-month',
        emoji: '📅',
        text: `Your lightest spending month was ${formatMonth(bestMonth.billing_month)} (${fmt(Number(bestMonth.total_amount))}) and heaviest was ${formatMonth(worstMonth.billing_month)} (${fmt(Number(worstMonth.total_amount))}).`,
        severity: 'neutral',
      })
    }
  }

  return insights.slice(0, 5)
}

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
    const prev = firstMap.get(c.category) ?? 0
    deltas.push({ category: c.category, delta: Number(c.total_amount) - prev })
  }

  return deltas
    .sort((a, b) => b.delta - a.delta)
    .slice(0, count)
    .map(d => d.category)
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
