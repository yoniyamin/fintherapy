import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { MonthlyTotal } from '../../hooks/useReveal'
import type { CategorySummary } from '../../hooks/useReveal'
import { formatCurrency } from '../../lib/formatCurrency'
import { ui } from '../../lib/uiClasses'

interface Props {
  monthlyTotals: MonthlyTotal[]
  months: string[]
  income: number | null
  summaryByMonth: Map<string, CategorySummary[]>
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>
}

interface ShiftInfo {
  spikeMonth: number
  gapMonth: number
}

interface BillingShiftWarning {
  categoryLabel: string
  gapMonthLabel: string
  spikeMonthLabel: string
}

function formatMonthLabel(m: string): string {
  const [year, mo] = m.split('-')
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${labels[Number(mo) - 1]} ${year}`
}

function formatMonthShort(m: string): string {
  const [, mo] = m.split('-')
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return labels[Number(mo) - 1] ?? mo
}

/** Detects when a category has a zero-month adjacent to a spike (billing shift). */
function detectShift(amounts: number[]): ShiftInfo | null {
  if (amounts.length < 3) return null
  const nonZero = amounts.filter(a => a > 0)
  if (nonZero.length < 2) return null
  const avg = nonZero.reduce((s, v) => s + v, 0) / nonZero.length

  for (let i = 0; i < amounts.length; i++) {
    if (amounts[i] > 0) continue
    const prev = i > 0 ? amounts[i - 1] : null
    const next = i < amounts.length - 1 ? amounts[i + 1] : null
    if (next != null && next >= avg * 1.7) {
      return { spikeMonth: i + 1, gapMonth: i }
    }
    if (prev != null && prev >= avg * 1.7) {
      return { spikeMonth: i - 1, gapMonth: i }
    }
  }
  return null
}

function findBillingShifts(
  sorted: string[],
  summaryByMonth: Map<string, CategorySummary[]>,
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>,
): BillingShiftWarning[] {
  const fixedCats = new Set<string>()
  for (const [id, info] of Object.entries(categoryLookup)) {
    if (info.expenseType === 'fixed') fixedCats.add(id)
  }

  const warnings: BillingShiftWarning[] = []

  for (const cat of fixedCats) {
    const amounts = sorted.map(m => {
      const monthData = summaryByMonth.get(m) ?? []
      const entry = monthData.find(c => c.category === cat)
      return entry ? Number(entry.total_amount) : 0
    })

    const shift = detectShift(amounts)
    if (shift) {
      warnings.push({
        categoryLabel: categoryLookup[cat]?.label ?? cat,
        gapMonthLabel: formatMonthShort(sorted[shift.gapMonth]),
        spikeMonthLabel: formatMonthShort(sorted[shift.spikeMonth]),
      })
    }
  }

  return warnings
}

interface FixedCostRow {
  category: string
  icon: string
  label: string
  amounts: number[]
  hasShift: boolean
  shiftInfo: ShiftInfo | null
}

function buildFixedCostRows(
  sorted: string[],
  summaryByMonth: Map<string, CategorySummary[]>,
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>,
): FixedCostRow[] {
  const rows: FixedCostRow[] = []

  for (const [id, info] of Object.entries(categoryLookup)) {
    if (info.expenseType !== 'fixed') continue

    const amounts = sorted.map(m => {
      const monthData = summaryByMonth.get(m) ?? []
      const entry = monthData.find(c => c.category === id)
      return entry ? Number(entry.total_amount) : 0
    })

    if (amounts.every(a => a === 0)) continue

    const shiftInfo = detectShift(amounts)

    rows.push({
      category: id,
      icon: info.icon,
      label: info.label,
      amounts,
      hasShift: shiftInfo != null,
      shiftInfo,
    })
  }

  return rows.sort((a, b) => {
    const totalA = a.amounts.reduce((s, v) => s + v, 0)
    const totalB = b.amounts.reduce((s, v) => s + v, 0)
    return totalB - totalA
  })
}

export default function MonthlySummaryTable({ monthlyTotals, months, income, summaryByMonth, categoryLookup }: Props) {
  const sorted = useMemo(() => [...months].sort(), [months])

  const rows = useMemo(() => {
    const totalsByMonth = new Map(monthlyTotals.map(t => [t.billing_month, t]))
    return sorted.map(m => {
      const data = totalsByMonth.get(m)
      const expenses = data ? Number(data.total_amount) : 0
      const txCount = data ? Number(data.tx_count) : 0
      const net = income != null && income > 0 ? income - expenses : null
      const savingsRate = income != null && income > 0 ? ((income - expenses) / income) * 100 : null
      return { month: m, expenses, txCount, net, savingsRate }
    })
  }, [sorted, monthlyTotals, income])

  const billingShifts = useMemo(
    () => findBillingShifts(sorted, summaryByMonth, categoryLookup),
    [sorted, summaryByMonth, categoryLookup],
  )

  const fixedCostRows = useMemo(
    () => buildFixedCostRows(sorted, summaryByMonth, categoryLookup),
    [sorted, summaryByMonth, categoryLookup],
  )

  if (rows.length === 0) return null

  const hasIncome = income != null && income > 0

  return (
    <motion.div
      className={ui.chartCard}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">
        Monthly Overview
      </p>
      {hasIncome && (
        <p className="mt-0.5 text-[10px] text-surface-600">
          Income: {formatCurrency(income!, false)}/mo (set)
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="pb-2 text-left font-semibold text-surface-500">Month</th>
              <th className="pb-2 text-right font-semibold text-surface-500">Expenses</th>
              {hasIncome && (
                <>
                  <th className="pb-2 text-right font-semibold text-surface-500">Net</th>
                  <th className="pb-2 text-right font-semibold text-surface-500">Saved</th>
                </>
              )}
              <th className="pb-2 text-right font-semibold text-surface-500">Txns</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isNegative = row.net != null && row.net < 0
              return (
                <motion.tr
                  key={row.month}
                  className="border-b border-white/[0.04]"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <td className="py-2 font-medium text-surface-200">
                    {formatMonthLabel(row.month)}
                  </td>
                  <td className="py-2 text-right tabular-nums font-semibold text-surface-100">
                    {formatCurrency(row.expenses, false)}
                  </td>
                  {hasIncome && (
                    <>
                      <td className={`py-2 text-right tabular-nums font-bold ${isNegative ? 'text-red-400' : 'text-emerald-400'}`}>
                        {row.net != null ? formatCurrency(row.net, false) : '—'}
                      </td>
                      <td className={`py-2 text-right tabular-nums font-medium ${isNegative ? 'text-red-400/80' : 'text-emerald-400/80'}`}>
                        {row.savingsRate != null ? `${Math.round(row.savingsRate)}%` : '—'}
                      </td>
                    </>
                  )}
                  <td className="py-2 text-right tabular-nums text-surface-500">
                    {row.txCount}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {fixedCostRows.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-2">
            Fixed Costs by Month
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="pb-1.5 text-left font-medium text-surface-600" />
                  {sorted.map(m => (
                    <th key={m} className="pb-1.5 text-right font-medium text-surface-600">
                      {formatMonthShort(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fixedCostRows.map(row => (
                  <tr
                    key={row.category}
                    className={`border-b border-white/[0.03] ${row.hasShift ? 'bg-amber-500/[0.03]' : ''}`}
                  >
                    <td className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        {row.hasShift && <span className="text-[8px] text-amber-400">⇄</span>}
                        <span className="text-xs">{row.icon}</span>
                        <span className="text-[11px] font-medium text-surface-300 truncate max-w-[120px]">{row.label}</span>
                      </div>
                    </td>
                    {row.amounts.map((amt, i) => {
                      const isZeroShift = row.shiftInfo?.gapMonth === i
                      const isSpikeShift = row.shiftInfo?.spikeMonth === i
                      let color = 'text-surface-200'
                      if (isZeroShift) color = 'text-surface-600'
                      else if (isSpikeShift) color = 'text-amber-400'
                      else if (amt === 0) color = 'text-surface-700'
                      return (
                        <td key={i} className={`py-1.5 text-right tabular-nums font-medium ${color}`}>
                          {amt > 0 ? formatCurrency(amt, false) : '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {billingShifts.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-500/[0.04] px-3 py-2">
          {billingShifts.map((shift, i) => (
            <p key={i} className="text-[11px] leading-relaxed text-amber-300/80">
              <span className="mr-1">⇄</span>
              {shift.categoryLabel}: {shift.gapMonthLabel} charge likely shifted to {shift.spikeMonthLabel}
            </p>
          ))}
        </div>
      )}
    </motion.div>
  )
}
