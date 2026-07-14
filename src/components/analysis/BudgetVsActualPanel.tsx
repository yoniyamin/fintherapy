import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { CategoryBudget } from '../../hooks/useCategoryBudgets'
import type { CategorySummary } from '../../hooks/useReveal'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'

interface Props {
  budgets: CategoryBudget[]
  summaryByMonth: Map<string, CategorySummary[]>
  months: string[]
  income: number | null
  categoryLookup: Record<string, { icon: string; label: string }>
  onEditBudgets: () => void
}

interface BudgetRow {
  category: string
  icon: string
  label: string
  medianActual: number
  target: number
  delta: number
  deltaPct: number
  isOver: boolean
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function buildRows(
  budgets: CategoryBudget[],
  summaryByMonth: Map<string, CategorySummary[]>,
  months: string[],
  categoryLookup: Record<string, { icon: string; label: string }>,
): BudgetRow[] {
  const budgetMap = new Map(budgets.map(b => [b.category_id, b]))

  const rows: BudgetRow[] = []

  for (const [catId, budget] of budgetMap) {
    if (catId === OWN_TRANSFERS_CATEGORY_ID) continue
    const info = categoryLookup[catId]
    if (!info) continue

    const monthlyAmounts = months.map(m => {
      const summary = summaryByMonth.get(m)
      const cat = summary?.find(c => c.category === catId)
      return cat ? Math.abs(Number(cat.total_amount)) : 0
    })

    const medianActual = median(monthlyAmounts)
    const target = Number(budget.monthly_target)
    const delta = medianActual - target
    const deltaPct = target > 0 ? (delta / target) * 100 : 0

    rows.push({
      category: catId,
      icon: info.icon,
      label: info.label,
      medianActual,
      target,
      delta,
      deltaPct,
      isOver: delta > 0,
    })
  }

  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

export default function BudgetVsActualPanel({ budgets, summaryByMonth, months, income, categoryLookup, onEditBudgets }: Props) {
  const rows = useMemo(
    () => buildRows(budgets, summaryByMonth, months, categoryLookup),
    [budgets, summaryByMonth, months, categoryLookup],
  )

  if (budgets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-dashed border-slate-600/50 bg-slate-800/30 p-5 text-center"
      >
        <p className="text-xs text-slate-400">No budget targets set yet.</p>
        <button
          type="button"
          onClick={onEditBudgets}
          className="mt-2 rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-300 transition-colors hover:bg-teal-500/20"
        >
          Set Budget Targets
        </button>
      </motion.div>
    )
  }

  const totalTarget = rows.reduce((s, r) => s + r.target, 0)
  const totalActual = rows.reduce((s, r) => s + r.medianActual, 0)
  const totalDelta = totalActual - totalTarget

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Budget vs Actual
        </h3>
        <button
          type="button"
          onClick={onEditBudgets}
          className="text-[10px] font-medium text-teal-400 hover:text-teal-300"
        >
          Edit
        </button>
      </div>

      <div className="space-y-1.5">
        {rows.map(row => (
          <div key={row.category} className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-slate-700/20">
            <span className="text-sm shrink-0">{row.icon}</span>
            <span className="flex-1 truncate text-xs text-slate-300">{row.label}</span>
            <span className="text-xs tabular-nums text-slate-400 shrink-0">{fmt(row.target)}</span>
            <span className={`text-xs tabular-nums font-medium shrink-0 ${row.isOver ? 'text-red-400' : 'text-emerald-400'}`}>
              {row.isOver ? '+' : ''}{fmt(row.delta)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-slate-700/40 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">Total</span>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-slate-400">Target: {fmt(totalTarget)}</span>
            <span className={`text-xs tabular-nums font-bold ${totalDelta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {totalDelta > 0 ? '+' : ''}{fmt(totalDelta)}/mo
            </span>
          </div>
        </div>
        {income != null && income > 0 && (
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">vs Income ({fmt(income)})</span>
            <span className={`text-[10px] font-medium ${income - totalTarget > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Surplus: {fmt(income - totalTarget)}/mo
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
