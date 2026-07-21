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
  lowActual: number
  medianActual: number
  highActual: number
  target: number
  is_discretionary: boolean
  subject_to_inflation: boolean
  notes: string
  spendingFrequency: SpendingFrequency
  detailOpen: boolean
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function sliderMax(row: DraftRow): number {
  return Math.max(Math.round(row.highActual * 1.3), Math.round(row.medianActual * 2), 100)
}

function deltaLabel(target: number, median: number): { text: string; color: string } {
  if (median === 0) return { text: '', color: 'text-surface-500' }
  const pct = Math.round(((target - median) / median) * 100)
  if (pct === 0) return { text: 'at median', color: 'text-surface-500' }
  if (pct > 0) return { text: `+${pct}% above median`, color: 'text-amber-400' }
  return { text: `${pct}% below median`, color: 'text-emerald-400' }
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

    const nonZero = monthlyAmounts.filter(v => v > 0)
    const medianActual = computeMedian(monthlyAmounts)
    const lowActual = nonZero.length > 0 ? Math.min(...nonZero) : 0
    const highActual = nonZero.length > 0 ? Math.max(...nonZero) : 0
    const existing = budgetMap.get(catId)

    rows.push({
      category_id: catId,
      icon: info.icon,
      label: info.label,
      lowActual,
      medianActual,
      highActual,
      target: existing ? Math.round(Number(existing.monthly_target)) : Math.round(medianActual),
      is_discretionary: existing?.is_discretionary ?? true,
      subject_to_inflation: existing?.subject_to_inflation ?? true,
      notes: existing?.notes ?? '',
      spendingFrequency: freq,
      detailOpen: false,
    })
  }

  return rows.sort((a, b) => b.medianActual - a.medianActual)
}

function BudgetSliderRow({
  row,
  onTargetChange,
  onToggleField,
  onToggleDetail,
}: {
  row: DraftRow
  onTargetChange: (catId: string, value: number) => void
  onToggleField: (catId: string, field: 'is_discretionary' | 'subject_to_inflation') => void
  onToggleDetail: (catId: string) => void
}) {
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const max = sliderMax(row)
  const medianPct = row.medianActual > 0 ? Math.min((row.medianActual / max) * 100, 100) : 50
  const delta = deltaLabel(row.target, row.medianActual)
  const isAnnual = row.spendingFrequency === 'annual'
  const displayTarget = isAnnual ? row.target * 12 : row.target
  const displayMedian = isAnnual ? row.medianActual * 12 : row.medianActual
  const displayLow = isAnnual ? row.lowActual * 12 : row.lowActual
  const displayHigh = isAnnual ? row.highActual * 12 : row.highActual

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 pt-3 pb-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{row.icon}</span>
        <span className="flex-1 truncate text-xs font-medium text-surface-200">{row.label}</span>
        {isAnnual && <span className="shrink-0 rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300">Annual</span>}
        {editingValue !== null ? (
          <input
            type="number"
            autoFocus
            value={editingValue}
            onChange={e => setEditingValue(e.target.value)}
            onBlur={() => {
              const v = Number(editingValue) || 0
              onTargetChange(row.category_id, isAnnual ? Math.round(v / 12) : v)
              setEditingValue(null)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            className="w-20 rounded-lg border border-teal-500/30 bg-surface-950/70 px-2 py-0.5 text-right text-xs tabular-nums text-surface-50 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingValue(String(Math.round(displayTarget)))}
            className="text-sm font-semibold tabular-nums text-surface-100 hover:text-teal-300 transition-colors"
          >
            {formatCurrency(displayTarget, false)}
          </button>
        )}

        <button
          type="button"
          onClick={() => onToggleDetail(row.category_id)}
          className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-surface-500 hover:text-surface-300 hover:bg-white/[0.05] transition-colors"
          aria-label="Category settings"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>
      </div>

      <div className="relative mt-1 mb-1 px-0.5">
        <div className="absolute top-1/2 -translate-y-1/2 h-4 border-l border-dashed border-surface-500/50" style={{ left: `${medianPct}%` }} />
        <input
          type="range"
          min={0}
          max={max}
          step={Math.max(1, Math.round(max / 200))}
          value={row.target}
          onChange={e => onTargetChange(row.category_id, Number(e.target.value))}
          className="budget-slider"
          style={{ '--median-pct': `${medianPct}%` } as React.CSSProperties}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-[10px] ${delta.color}`}>{delta.text}</span>
        <span className="text-[9px] text-surface-600 tabular-nums">
          Low {formatCurrency(displayLow, false)} · Med {formatCurrency(displayMedian, false)} · High {formatCurrency(displayHigh, false)}
        </span>
      </div>

      <AnimatePresence>
        {row.detailOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex items-center gap-4 border-t border-white/[0.04] pt-2">
              <button
                type="button"
                onClick={() => onToggleField(row.category_id, 'is_discretionary')}
                className="flex items-center gap-1.5"
              >
                <div className={`h-4 w-7 rounded-full transition-colors ${row.is_discretionary ? 'bg-teal-500' : 'bg-surface-700'}`}>
                  <div className={`h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform ${row.is_discretionary ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-[10px] text-surface-400">Discretionary</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleField(row.category_id, 'subject_to_inflation')}
                className="flex items-center gap-1.5"
              >
                <div className={`h-4 w-7 rounded-full transition-colors ${row.subject_to_inflation ? 'bg-teal-500' : 'bg-surface-700'}`}>
                  <div className={`h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform ${row.subject_to_inflation ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-[10px] text-surface-400">Inflation-adjusted</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function BudgetEditorModal({ open, onClose, budgets, summaryByMonth, months, income, categoryLookup, onSave }: Props) {
  const [rows, setRows] = useState<DraftRow[]>([])
  const [saving, setSaving] = useState(false)
  const [targetSpending, setTargetSpending] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')

  useEffect(() => {
    if (open) {
      setRows(buildDraftRows(summaryByMonth, months, categoryLookup, budgets))
      setShowAll(false)
      setShowAdvanced(false)
      const totalExisting = budgets.reduce((s, b) => s + Number(b.monthly_target), 0)
      if (totalExisting > 0) {
        setTargetSpending(String(Math.round(totalExisting)))
      } else if (income && income > 0) {
        setTargetSpending(String(Math.round(income * 0.9)))
      }
    }
  }, [open, summaryByMonth, months, categoryLookup, budgets, income])

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

  const visibleRows = showAll ? rows : rows.filter(r => suggestedIds.has(r.category_id) || r.target > 0)

  const totalAllocated = useMemo(
    () => rows.reduce((s, r) => s + r.target, 0),
    [rows],
  )

  const envelope = Number(targetSpending) || 0
  const remaining = envelope - totalAllocated
  const envelopePct = envelope > 0 ? Math.min((totalAllocated / envelope) * 100, 100) : 0
  const savingsFromIncome = income && income > 0 ? income - envelope : null

  const onTargetChange = useCallback((catId: string, value: number) => {
    setRows(prev => prev.map(r => r.category_id === catId ? { ...r, target: Math.max(0, Math.round(value)) } : r))
  }, [])

  const onToggleField = useCallback((catId: string, field: 'is_discretionary' | 'subject_to_inflation') => {
    setRows(prev => prev.map(r => r.category_id === catId ? { ...r, [field]: !r[field] } : r))
  }, [])

  const onToggleDetail = useCallback((catId: string) => {
    setRows(prev => prev.map(r => r.category_id === catId ? { ...r, detailOpen: !r.detailOpen } : r))
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const params: UpsertBudgetParams[] = rows
        .filter(r => r.target > 0 || !r.is_discretionary || !r.subject_to_inflation)
        .map(r => ({
          category_id: r.category_id,
          monthly_target: r.target || Math.round(r.medianActual),
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
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <h2 className="text-sm font-bold text-surface-100">Budget Targets</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[10px] text-surface-500 hover:text-surface-300"
              >
                {showAdvanced ? 'Hide advanced' : 'Advanced'}
              </button>
              <button type="button" onClick={onClose} className="text-xs text-surface-500 hover:text-surface-300">
                Close
              </button>
            </div>
          </div>

          <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(85vh - 140px)' }}>
            {/* Budget envelope */}
            <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-surface-400">Monthly income</span>
                <span className="text-xs tabular-nums text-surface-300">
                  {income && income > 0 ? formatCurrency(income, false) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-surface-400 shrink-0">Target spending</span>
                <input
                  type="number"
                  value={targetSpending}
                  onChange={e => setTargetSpending(e.target.value)}
                  placeholder={income ? String(Math.round(income * 0.9)) : '0'}
                  className="w-24 rounded-lg border border-white/[0.08] bg-surface-950/55 px-2 py-1 text-right text-xs tabular-nums text-surface-50 outline-none placeholder:text-surface-600"
                />
              </div>
              {savingsFromIncome !== null && envelope > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-surface-400">Savings goal</span>
                  <span className={`text-xs font-medium tabular-nums ${savingsFromIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(savingsFromIncome, false)}/mo
                    {income && income > 0 && ` (${Math.round((savingsFromIncome / income) * 100)}%)`}
                  </span>
                </div>
              )}

              {envelope > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-surface-500">Allocated</span>
                    <span className={`text-[10px] tabular-nums font-medium ${remaining >= 0 ? 'text-surface-400' : 'text-red-400'}`}>
                      {formatCurrency(totalAllocated, false)} / {formatCurrency(envelope, false)}
                      {remaining !== 0 && (
                        <span className={remaining > 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {' '}({remaining > 0 ? '+' : ''}{formatCurrency(remaining, false)} left)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${remaining >= 0 ? 'bg-teal-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(envelopePct, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Collapsed advanced: date range */}
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filter toggle */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] text-surface-500">
                {showAll ? 'All categories' : `Top ${suggestedIds.size} categories`}
              </span>
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="text-[10px] font-medium text-teal-400 hover:text-teal-300"
              >
                {showAll ? 'Show suggested' : 'Show all'}
              </button>
            </div>

            {/* Category slider rows */}
            <div className="space-y-2">
              {visibleRows.map(row => (
                <BudgetSliderRow
                  key={row.category_id}
                  row={row}
                  onTargetChange={onTargetChange}
                  onToggleField={onToggleField}
                  onToggleDetail={onToggleDetail}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.06] px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-surface-400">
                Total: {formatCurrency(totalAllocated, false)}/mo
              </span>
              {income != null && income > 0 && (
                <span className={`text-xs font-bold ${income - totalAllocated >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {income - totalAllocated >= 0 ? 'Surplus' : 'Deficit'}: {formatCurrency(Math.abs(income - totalAllocated), false)}/mo
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
