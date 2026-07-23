import type { CategoryBudget } from '../../hooks/useCategoryBudgets'
import type { CategorySummary } from '../../hooks/useReveal'
import { NO_IDEA_CATEGORY_ID, OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import type { SpendingFrequency } from '../../lib/constants'

export interface DraftRow {
  category_id: string
  icon: string
  label: string
  lowActual: number
  medianActual: number
  highActual: number
  target: number
  existingBudgetId: string | null
  spendingFrequency: SpendingFrequency
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function sliderBounds(row: DraftRow): { min: number; max: number } {
  if (row.medianActual === 0) {
    const fallback = Math.max(row.highActual, 100)
    return { min: 0, max: fallback }
  }
  return {
    min: Math.max(0, Math.round(row.medianActual * 0.7)),
    max: Math.round(row.medianActual * 1.3),
  }
}

export function deltaLabel(target: number, suggested: number): { text: string; color: string } {
  if (suggested === 0) return { text: '', color: 'text-surface-500' }
  const pct = Math.round(((target - suggested) / suggested) * 100)
  if (pct === 0) return { text: 'at suggested', color: 'text-surface-500' }
  if (pct > 0) return { text: `+${pct}% above suggested`, color: 'text-amber-400' }
  return { text: `${pct}% below suggested`, color: 'text-emerald-400' }
}

export function buildDraftRows(
  summaryByMonth: Map<string, CategorySummary[]>,
  months: string[],
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string; spendingFrequency?: SpendingFrequency }>,
  budgets: CategoryBudget[],
): DraftRow[] {
  const budgetMap = new Map(budgets.map(b => [b.category_id, b]))
  const catIds = new Set<string>()

  for (const [, summaries] of summaryByMonth) {
    for (const s of summaries) {
      if (s.category !== OWN_TRANSFERS_CATEGORY_ID && s.category !== NO_IDEA_CATEGORY_ID) catIds.add(s.category)
    }
  }

  const rows: DraftRow[] = []

  for (const catId of catIds) {
    const info = categoryLookup[catId]
    if (!info) continue
    const freq: SpendingFrequency = info.spendingFrequency ?? 'monthly'
    if (freq === 'one_off') continue

    const monthlyAmounts = months.map(m => {
      const summary = summaryByMonth.get(m)
      const cat = summary?.find(c => c.category === catId)
      return cat ? Math.abs(Number(cat.total_amount)) : 0
    })

    const nonZero = monthlyAmounts.filter(v => v > 0)
    const lowActual = nonZero.length > 0 ? Math.min(...nonZero) : 0
    const highActual = nonZero.length > 0 ? Math.max(...nonZero) : 0
    const existing = budgetMap.get(catId)

    let medianActual: number
    if (freq === 'annual') {
      const totalSpent = monthlyAmounts.reduce((s, v) => s + v, 0)
      const yearsOfData = Math.max(months.length / 12, 1)
      medianActual = Math.round(totalSpent / yearsOfData / 12)
    } else {
      medianActual = computeMedian(monthlyAmounts)
    }

    rows.push({
      category_id: catId,
      icon: info.icon,
      label: info.label,
      lowActual,
      medianActual,
      highActual,
      target: existing ? Math.round(Number(existing.monthly_target)) : Math.round(medianActual),
      existingBudgetId: existing?.id ?? null,
      spendingFrequency: freq,
    })
  }

  return rows.sort((a, b) => b.medianActual - a.medianActual)
}

export interface SmartReduction {
  category_id: string
  label: string
  icon: string
  currentTarget: number
  proposedTarget: number
  reduction: number
  isFixed: boolean
}

export interface SmartReductionResult {
  reductions: SmartReduction[]
  totalReduction: number
  newTotal: number
}

/**
 * Propose weighted reductions across discretionary categories to fit within
 * the spending cap. Fixed categories are excluded. Larger discretionary
 * categories absorb proportionally more of the cut.
 */
export function computeSmartReductions(
  rows: DraftRow[],
  envelope: number,
  categoryLookup: Record<string, { icon?: string; label?: string; expenseType?: string }>,
): SmartReductionResult {
  const totalAllocated = rows.reduce((s, r) => s + r.target, 0)
  const overAmount = totalAllocated - envelope
  if (overAmount <= 0) return { reductions: [], totalReduction: 0, newTotal: totalAllocated }

  const discretionary = rows.filter(r => {
    const info = categoryLookup[r.category_id]
    return info?.expenseType !== 'fixed' && r.target > 0
  })

  const discretionaryTotal = discretionary.reduce((s, r) => s + r.target, 0)
  if (discretionaryTotal <= 0) return { reductions: [], totalReduction: 0, newTotal: totalAllocated }

  const reductions: SmartReduction[] = []
  let totalReduction = 0

  for (const row of discretionary) {
    const weight = row.target / discretionaryTotal
    const rawCut = Math.round(overAmount * weight)
    const floor = Math.round(row.lowActual > 0 ? row.lowActual : row.target * 0.5)
    const maxCut = Math.max(0, row.target - floor)
    const reduction = Math.min(rawCut, maxCut)

    if (reduction > 0) {
      reductions.push({
        category_id: row.category_id,
        label: row.label,
        icon: row.icon,
        currentTarget: row.target,
        proposedTarget: row.target - reduction,
        reduction,
        isFixed: false,
      })
      totalReduction += reduction
    }
  }

  reductions.sort((a, b) => b.reduction - a.reduction)

  return {
    reductions,
    totalReduction,
    newTotal: totalAllocated - totalReduction,
  }
}
