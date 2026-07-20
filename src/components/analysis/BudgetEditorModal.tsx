import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { CategoryBudget, UpsertBudgetParams } from '../../hooks/useCategoryBudgets'
import type { CategorySummary } from '../../hooks/useReveal'
import { NO_IDEA_CATEGORY_ID, OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import type { SpendingFrequency } from '../../lib/constants'
import { formatCurrency } from '../../lib/formatCurrency'

interface Props {
  open: boolean
  onClose: () => void
  budgets: CategoryBudget[]
  summaryByMonth: Map<string, CategorySummary[]>
  months: string[]
  income: number | null
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string; spendingFrequency?: SpendingFrequency }>
  onSave: (params: UpsertBudgetParams[]) => Promise<void>
}

interface DraftRow {
  category_id: string
  icon: string
  label: string
  medianActual: number
  target: string
  is_discretionary: boolean
  subject_to_inflation: boolean
  notes: string
  spendingFrequency: SpendingFrequency
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function buildDraftRows(
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

    const medianActual = median(monthlyAmounts)
    const existing = budgetMap.get(catId)

    rows.push({
      category_id: catId,
      icon: info.icon,
      label: info.label,
      medianActual,
      target: existing ? String(Math.round(Number(existing.monthly_target))) : '',
      is_discretionary: existing?.is_discretionary ?? true,
      subject_to_inflation: existing?.subject_to_inflation ?? true,
      notes: existing?.notes ?? '',
      spendingFrequency: freq,
    })
  }

  return rows.sort((a, b) => b.medianActual - a.medianActual)
}

export default function BudgetEditorModal({ open, onClose, budgets, summaryByMonth, months, income, categoryLookup, onSave }: Props) {
  const [rows, setRows] = useState<DraftRow[]>([])
  const [saving, setSaving] = useState(false)
  const [scenarioPct, setScenarioPct] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (open) {
      setRows(buildDraftRows(summaryByMonth, months, categoryLookup, budgets))
      setShowAll(false)
    }
  }, [open, summaryByMonth, months, categoryLookup, budgets])

  const suggestedIds = useMemo(() => {
    const discretionary = rows
      .filter(r => {
        const info = categoryLookup[r.category_id]
        return info && (info as { expenseType?: string }).expenseType !== 'fixed'
      })
      .sort((a, b) => b.medianActual - a.medianActual)
      .slice(0, 6)
      .map(r => r.category_id)
    return new Set(discretionary)
  }, [rows, categoryLookup])

  const visibleRows = showAll ? rows : rows.filter(r => suggestedIds.has(r.category_id) || (r.target && Number(r.target) > 0))

  const totalTarget = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.target) || 0), 0),
    [rows],
  )

  const surplus = income != null && income > 0 ? income - totalTarget : null

  const applyScenario = useCallback(() => {
    const pct = Number(scenarioPct)
    if (!pct || pct <= 0 || pct > 100) return

    setRows(prev => prev.map(row => {
      if (!row.is_discretionary) {
        if (!row.target) return { ...row, target: String(Math.round(row.medianActual)) }
        return row
      }
      const base = row.target ? Number(row.target) : row.medianActual
      const reduced = Math.round(base * (1 - pct / 100))
      return { ...row, target: String(reduced) }
    }))
  }, [scenarioPct])

  const updateRow = useCallback((catId: string, field: keyof DraftRow, value: string | boolean) => {
    setRows(prev => prev.map(r => r.category_id === catId ? { ...r, [field]: value } : r))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const params: UpsertBudgetParams[] = rows
        .filter(r => (r.target && Number(r.target) > 0) || !r.is_discretionary || !r.subject_to_inflation)
        .map(r => ({
          category_id: r.category_id,
          monthly_target: Number(r.target) || Math.round(r.medianActual),
          is_discretionary: r.is_discretionary,
          subject_to_inflation: r.subject_to_inflation,
          valid_from: validFrom || null,
          valid_to: validTo || null,
          notes: r.notes || null,
        }))
      await onSave(params)
      onClose()
    } finally {
      setSaving(false)
    }
  }, [rows, validFrom, validTo, onSave, onClose])

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="budget-editor-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 left-[var(--shell-nav-offset)] z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="budget-editor-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="w-full max-w-lg rounded-t-2xl border-t border-white/10 bg-surface-950/95 backdrop-blur-xl"
          style={{ maxHeight: '85vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <h2 className="text-sm font-bold text-surface-100">Budget Targets</h2>
            <button type="button" onClick={onClose} className="text-xs text-surface-500 hover:text-surface-300">
              Close
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(85vh - 140px)' }}>
            {/* Scenario quick-apply */}
            <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2">
              <span className="text-[10px] text-surface-400 shrink-0">Cut discretionary by</span>
              <input
                type="number"
                value={scenarioPct}
                onChange={e => setScenarioPct(e.target.value)}
                placeholder="%"
                className="w-14 rounded-lg border border-white/[0.08] bg-surface-950/55 px-2 py-1 text-xs text-surface-50 outline-none"
              />
              <button
                type="button"
                onClick={applyScenario}
                className="rounded-lg bg-teal-500/10 px-2.5 py-1 text-[10px] font-medium text-teal-300 hover:bg-teal-500/20"
              >
                Apply
              </button>
              </div>
              <p className="mt-1.5 text-[9px] text-surface-600 leading-tight">Sets targets to median spend × (1 - %) for all categories marked discretionary.</p>
            </div>

            {/* Seasonal date range */}
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[10px] text-surface-500">Valid:</span>
              <input
                type="date"
                value={validFrom}
                onChange={e => setValidFrom(e.target.value)}
                className="input-date-dark rounded-lg border border-white/[0.08] bg-surface-950/55 px-2 py-1 text-[10px] text-surface-50 outline-none"
              />
              <span className="text-[10px] text-surface-500">to</span>
              <input
                type="date"
                value={validTo}
                onChange={e => setValidTo(e.target.value)}
                className="input-date-dark rounded-lg border border-white/[0.08] bg-surface-950/55 px-2 py-1 text-[10px] text-surface-50 outline-none"
              />
              <span className="text-[10px] text-surface-500 italic">(blank = year-round)</span>
            </div>

            {/* Legend + bulk toggles */}
            <div className="mb-3 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-surface-500"><span className="font-medium text-surface-400">Disc.</span> = Discretionary — scenario cuts apply here</p>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setRows(prev => prev.map(r => ({ ...r, is_discretionary: true })))} className="text-[8px] text-teal-400 hover:text-teal-300">all on</button>
                  <button type="button" onClick={() => setRows(prev => prev.map(r => ({ ...r, is_discretionary: false })))} className="text-[8px] text-surface-500 hover:text-surface-300">all off</button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-surface-500"><span className="font-medium text-surface-400">Infl.</span> = Subject to inflation — projections grow over time</p>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setRows(prev => prev.map(r => ({ ...r, subject_to_inflation: true })))} className="text-[8px] text-teal-400 hover:text-teal-300">all on</button>
                  <button type="button" onClick={() => setRows(prev => prev.map(r => ({ ...r, subject_to_inflation: false })))} className="text-[8px] text-surface-500 hover:text-surface-300">all off</button>
                </div>
              </div>
            </div>

            {/* Filter toggle */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] text-surface-500">
                {showAll ? 'All categories' : `Top ${suggestedIds.size} discretionary (biggest spend)`}
              </span>
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="text-[10px] font-medium text-teal-400 hover:text-teal-300"
              >
                {showAll ? 'Show suggested' : 'Show all'}
              </button>
            </div>

            {/* Category rows */}
            <div className="space-y-2">
              {visibleRows.map(row => {
                const isAnnual = row.spendingFrequency === 'annual'
                const annualDisplay = isAnnual && row.target ? Number(row.target) * 12 : 0
                return (
                <div key={row.category_id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{row.icon}</span>
                    <span className="flex-1 truncate text-xs font-medium text-surface-200">{row.label}</span>
                    {isAnnual && <span className="shrink-0 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300">Annual</span>}
                    <span className="text-[10px] text-surface-500">Median: {formatCurrency(row.medianActual, false)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAnnual ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={annualDisplay || ''}
                          onChange={e => {
                            const annual = Number(e.target.value) || 0
                            updateRow(row.category_id, 'target', String(Math.round(annual / 12)))
                          }}
                          placeholder={String(Math.round(row.medianActual * 12))}
                          className="w-20 rounded-lg border border-white/[0.08] bg-surface-950/55 px-2 py-1.5 text-xs tabular-nums text-surface-50 outline-none placeholder:text-surface-600"
                        />
                        <span className="text-[10px] text-surface-500">/yr</span>
                        {row.target && Number(row.target) > 0 && (
                          <span className="text-[10px] text-surface-500">({formatCurrency(Number(row.target), false)}/mo)</span>
                        )}
                      </div>
                    ) : (
                    <input
                      type="number"
                      value={row.target}
                      onChange={e => updateRow(row.category_id, 'target', e.target.value)}
                      placeholder={String(Math.round(row.medianActual))}
                      className="w-20 rounded-lg border border-white/[0.08] bg-surface-950/55 px-2 py-1.5 text-xs tabular-nums text-surface-50 outline-none placeholder:text-surface-600"
                    />
                    )}

                    <button
                      type="button"
                      onClick={() => updateRow(row.category_id, 'is_discretionary', !row.is_discretionary)}
                      className="flex items-center gap-1"
                    >
                      <div className={`h-4 w-7 rounded-full transition-colors ${row.is_discretionary ? 'bg-teal-500' : 'bg-surface-700'}`}>
                        <div className={`h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform ${row.is_discretionary ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-[10px] text-surface-400">Disc.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateRow(row.category_id, 'subject_to_inflation', !row.subject_to_inflation)}
                      className="flex items-center gap-1"
                    >
                      <div className={`h-4 w-7 rounded-full transition-colors ${row.subject_to_inflation ? 'bg-teal-500' : 'bg-surface-700'}`}>
                        <div className={`h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform ${row.subject_to_inflation ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-[10px] text-surface-400">Infl.</span>
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          </div>

          {/* Footer with totals */}
          <div className="border-t border-white/[0.06] px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-surface-400">Total target: {formatCurrency(totalTarget, false)}/mo</span>
              {surplus != null && (
                <span className={`text-xs font-bold ${surplus >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {surplus >= 0 ? 'Surplus' : 'Deficit'}: {formatCurrency(Math.abs(surplus), false)}/mo
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-teal-500/20 py-2.5 text-sm font-medium text-teal-300 transition-colors hover:bg-teal-500/30 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Budgets'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
