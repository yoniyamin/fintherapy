import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { BudgetChangeLogEntry, BudgetSettings, CategoryBudget, UpsertBudgetParams } from '../../hooks/useCategoryBudgets'
import { buildBudgetSnapshot } from '../../hooks/useCategoryBudgets'
import type { SpendingFrequency } from '../../lib/constants'
import { formatCurrency } from '../../lib/formatCurrency'
import { buildDraftRows, computeSmartReductions, deltaLabel, sliderBounds, type DraftRow, type SmartReductionResult } from './budgetEditorUtils'
import type { CategorySummary } from '../../hooks/useReveal'

interface Props {
  open: boolean
  onClose: () => void
  budgets: CategoryBudget[]
  summaryByMonth: Map<string, CategorySummary[]>
  months: string[]
  income: number | null
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string; spendingFrequency?: SpendingFrequency }>
  inflationRate: number
  onSave: (upserts: UpsertBudgetParams[], deleteIds: string[]) => Promise<void>
  onSaveIncome?: (income: number) => Promise<void>
  budgetSettings?: BudgetSettings | null
  changeLog?: BudgetChangeLogEntry[]
  onSaveSettings?: (target: number) => Promise<void>
  onLogChange?: (action: 'save' | 'reset_medians', summary: string, snapshot: ReturnType<typeof buildBudgetSnapshot>) => Promise<void>
}

type ConfirmAction =
  | { type: 'close' }
  | { type: 'reset'; beforeTotal: number; afterTotal: number }
  | { type: 'distribute-cap'; suggestedTotal: number; capAmount: number }
  | { type: 'smart-adjust'; result: SmartReductionResult; capAmount: number; income: number }

interface UndoState {
  catId: string
  label: string
  prevTarget: number
}

// --- Savings Goal Bar -------------------------------------------------------

function SavingsGoalBar({ surplus, target }: { surplus: number; target: number }) {
  const pct = target > 0 ? Math.max(0, Math.min((surplus / target) * 100, 100)) : 0
  const barColor = pct >= 80 ? 'bg-emerald-500'
    : pct >= 50 ? 'bg-amber-500'
      : 'bg-red-500'
  const textColor = pct >= 80 ? 'text-emerald-400'
    : pct >= 50 ? 'text-amber-400'
      : 'text-red-400'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-surface-500">Savings</span>
        <span className={`text-[10px] tabular-nums font-medium ${textColor}`}>
          {formatCurrency(Math.max(0, surplus), false)} / {formatCurrency(target, false)} target
          {' '}({Math.round(pct)}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// --- Slider Row -------------------------------------------------------------

function BudgetSliderRow({
  row,
  onTargetChange,
  onClear,
}: {
  row: DraftRow
  onTargetChange: (catId: string, value: number) => void
  onClear: (catId: string) => void
}) {
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const bounds = sliderBounds(row)
  const clampedTarget = Math.min(Math.max(row.target, bounds.min), bounds.max)
  const isOutsideRange = row.target > 0 && (row.target < bounds.min || row.target > bounds.max)
  const delta = deltaLabel(row.target, row.medianActual)
  const isAnnual = row.spendingFrequency === 'annual'
  const displayTarget = isAnnual ? row.target * 12 : row.target
  const displaySuggested = isAnnual ? row.medianActual * 12 : row.medianActual
  const displayMin = isAnnual ? bounds.min * 12 : bounds.min
  const displayMax = isAnnual ? bounds.max * 12 : bounds.max

  const thumbPct = bounds.max > bounds.min
    ? ((clampedTarget - bounds.min) / (bounds.max - bounds.min)) * 100
    : 50

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
        {row.target > 0 && (
          <button
            type="button"
            onClick={() => onClear(row.category_id)}
            className="ml-0.5 text-[9px] text-surface-600 hover:text-red-400 transition-colors shrink-0"
            title="Sets to €0 until you save"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative mt-1 mb-1 px-0.5 py-2">
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 border-l border-dashed border-surface-500/50"
          style={{ left: '50%' }}
        />

        <AnimatePresence>
          {dragging && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.1 }}
              className="absolute -top-5 -translate-x-1/2 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-semibold text-surface-950 shadow-lg pointer-events-none whitespace-nowrap"
              style={{ left: `${thumbPct}%` }}
            >
              {formatCurrency(displayTarget, false)}
            </motion.div>
          )}
        </AnimatePresence>

        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={Math.max(1, Math.round((bounds.max - bounds.min) / 100))}
          value={clampedTarget}
          onChange={e => onTargetChange(row.category_id, Number(e.target.value))}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          className="budget-slider"
          aria-valuetext={`${formatCurrency(displayTarget, false)} target for ${row.label}`}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-[10px] ${delta.color}`}>{delta.text}</span>
        <span className="text-[9px] text-surface-600 tabular-nums">
          {formatCurrency(displayMin, false)} · Suggested {formatCurrency(displaySuggested, false)} · {formatCurrency(displayMax, false)}
        </span>
      </div>

      {isOutsideRange && (
        <p className="mt-0.5 text-[9px] text-amber-400/70 italic">Outside usual range (±30%)</p>
      )}
    </div>
  )
}

// --- History Entry ----------------------------------------------------------

function HistoryEntry({ entry }: { entry: BudgetChangeLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(entry.created_at)
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const snap = entry.snapshot

  return (
    <div className="rounded-lg bg-white/[0.02] px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex-1 min-w-0">
          <span className="text-[10px] text-surface-400">{dateStr} {timeStr}</span>
          {entry.display_name && (
            <span className="ml-1.5 text-[9px] text-surface-600">by {entry.display_name}</span>
          )}
          <p className="text-[10px] text-surface-300 truncate mt-0.5">{entry.summary}</p>
        </div>
        <span className={`text-[9px] text-surface-600 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </button>
      {expanded && snap && (
        <div className="mt-2 space-y-1 border-t border-white/[0.04] pt-2">
          <div className="flex justify-between text-[9px]">
            <span className="text-surface-600">Income</span>
            <span className="text-surface-400 tabular-nums">{snap.monthly_income != null ? formatCurrency(snap.monthly_income, false) : '—'}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-surface-600">Spending cap</span>
            <span className="text-surface-400 tabular-nums">{formatCurrency(snap.monthly_spending_target, false)}</span>
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-surface-600">Allocated</span>
            <span className="text-surface-400 tabular-nums">{formatCurrency(snap.total_allocated, false)}</span>
          </div>
          {snap.implied_savings_rate != null && (
            <div className="flex justify-between text-[9px]">
              <span className="text-surface-600">Savings rate</span>
              <span className="text-surface-400 tabular-nums">{Math.round(snap.implied_savings_rate * 100)}%</span>
            </div>
          )}
          {snap.categories && snap.categories.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {snap.categories.slice(0, 8).map(c => (
                <div key={c.category_id} className="flex justify-between text-[9px]">
                  <span className="text-surface-600 truncate">{c.category_id}</span>
                  <span className="text-surface-500 tabular-nums">{formatCurrency(c.monthly_target, false)}</span>
                </div>
              ))}
              {snap.categories.length > 8 && (
                <p className="text-[9px] text-surface-600 italic">and {snap.categories.length - 8} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Main Modal -------------------------------------------------------------

export default function BudgetEditorModal({
  open, onClose, budgets, summaryByMonth, months,
  income, categoryLookup, inflationRate, onSave, onSaveIncome,
  budgetSettings, changeLog, onSaveSettings, onLogChange,
}: Props) {
  const [rows, setRows] = useState<DraftRow[]>([])
  const [saving, setSaving] = useState(false)
  const [targetSpending, setTargetSpending] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [incomeDraft, setIncomeDraft] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [undo, setUndo] = useState<UndoState | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const initialRowsRef = useRef<DraftRow[]>([])
  const initialEnvelopeRef = useRef('')
  const undoTimerRef = useRef<number>(0)

  useEffect(() => {
    if (open) {
      const newRows = buildDraftRows(summaryByMonth, months, categoryLookup, budgets)
      setRows(newRows)
      initialRowsRef.current = newRows
      setShowAll(false)
      setShowAdvanced(false)
      setShowHistory(false)
      setIncomeDraft(income !== null && income > 0 ? String(income) : '')
      setConfirmAction(null)
      setUndo(null)
      setSaveError(null)

      let envValue: string
      if (budgetSettings?.monthly_spending_target) {
        envValue = String(Math.round(Number(budgetSettings.monthly_spending_target)))
      } else {
        const totalExisting = budgets.reduce((s, b) => s + Number(b.monthly_target), 0)
        if (totalExisting > 0) {
          envValue = String(Math.round(totalExisting))
        } else {
          const medianSum = newRows.reduce((s, r) => s + r.medianActual, 0)
          envValue = medianSum > 0 ? String(Math.round(medianSum)) : ''
        }
      }
      setTargetSpending(envValue)
      initialEnvelopeRef.current = envValue
    }
  }, [open, summaryByMonth, months, categoryLookup, budgets, income, budgetSettings])

  useEffect(() => {
    return () => { clearTimeout(undoTimerRef.current) }
  }, [])

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

  const visibleRows = showAll
    ? rows
    : rows.filter(r => suggestedIds.has(r.category_id))

  const hiddenWithTargetsCount = useMemo(
    () => rows.filter(r => r.target > 0 && !suggestedIds.has(r.category_id)).length,
    [rows, suggestedIds],
  )

  const totalAllocated = useMemo(
    () => rows.reduce((s, r) => s + r.target, 0),
    [rows],
  )

  const envelope = Number(targetSpending) || 0
  const remaining = envelope - totalAllocated
  const envelopePct = envelope > 0 ? Math.min((totalAllocated / envelope) * 100, 100) : 0

  const parsedIncome = Number(incomeDraft) || 0
  const effectiveIncome = parsedIncome > 0 ? parsedIncome : (income && income > 0 ? income : 0)
  const plannedSavings = effectiveIncome > 0 && envelope > 0 ? effectiveIncome - envelope : null
  const incomeChanged = parsedIncome > 0 && parsedIncome !== income

  const isDirty = useMemo(() => {
    if (incomeChanged) return true
    if (targetSpending !== initialEnvelopeRef.current) return true
    const initial = initialRowsRef.current
    if (rows.length !== initial.length) return true
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].target !== initial[i]?.target) return true
    }
    return false
  }, [rows, incomeChanged, targetSpending])

  const onTargetChange = useCallback((catId: string, value: number) => {
    setRows(prev => prev.map(r => r.category_id === catId ? { ...r, target: Math.max(0, Math.round(value)) } : r))
  }, [])

  const handleClearTarget = useCallback((catId: string) => {
    const row = rows.find(r => r.category_id === catId)
    if (!row || row.target === 0) return
    setUndo({ catId, label: row.label, prevTarget: row.target })
    setRows(prev => prev.map(r => r.category_id === catId ? { ...r, target: 0 } : r))
    clearTimeout(undoTimerRef.current)
    undoTimerRef.current = window.setTimeout(() => setUndo(null), 5000)
  }, [rows])

  const handleUndo = useCallback(() => {
    if (!undo) return
    setRows(prev => prev.map(r => r.category_id === undo.catId ? { ...r, target: undo.prevTarget } : r))
    setUndo(null)
    clearTimeout(undoTimerRef.current)
  }, [undo])

  const handleClose = useCallback(() => {
    if (isDirty) {
      setConfirmAction({ type: 'close' })
      return
    }
    onClose()
  }, [isDirty, onClose])

  const handleResetAll = useCallback(() => {
    const beforeTotal = totalAllocated
    const afterTotal = rows.reduce((s, r) => s + Math.round(r.medianActual), 0)
    setConfirmAction({ type: 'reset', beforeTotal, afterTotal })
  }, [totalAllocated, rows])

  const handleSmartAdjust = useCallback(() => {
    if (envelope <= 0) return
    const result = computeSmartReductions(rows, envelope, categoryLookup)
    setConfirmAction({
      type: 'smart-adjust',
      result,
      capAmount: envelope,
      income: effectiveIncome,
    })
  }, [rows, envelope, categoryLookup, effectiveIncome])

  const applySmartReductions = useCallback(() => {
    if (confirmAction?.type !== 'smart-adjust') return
    const reductionMap = new Map(
      confirmAction.result.reductions.map(r => [r.category_id, r.proposedTarget]),
    )
    const adjusted = rows.map(r => {
      const proposed = reductionMap.get(r.category_id)
      return proposed !== undefined ? { ...r, target: proposed } : r
    })
    setRows(adjusted)
    setConfirmAction(null)
  }, [confirmAction, rows])

  const confirmReset = useCallback(async () => {
    const resetRows = rows.map(r => ({ ...r, target: Math.round(r.medianActual) }))
    setRows(resetRows)
    const medianSum = resetRows.reduce((s, r) => s + r.target, 0)
    setTargetSpending(String(medianSum))
    setConfirmAction(null)
  }, [rows])

  const doSave = useCallback(async (overrideRows?: DraftRow[]) => {
    const saveRows = overrideRows ?? rows
    const allocated = saveRows.reduce((s, r) => s + r.target, 0)
    setSaving(true)
    setSaveError(null)
    try {
      const upserts: UpsertBudgetParams[] = saveRows
        .filter(r => r.target > 0)
        .map(r => ({
          category_id: r.category_id,
          monthly_target: r.target,
          is_discretionary: true,
          subject_to_inflation: true,
          valid_from: validFrom || null,
          valid_to: validTo || null,
          notes: null,
        }))

      const deleteIds = saveRows
        .filter(r => r.target === 0 && r.existingBudgetId !== null)
        .map(r => r.existingBudgetId!)

      await onSave(upserts, deleteIds)

      if (onSaveIncome && incomeChanged) {
        await onSaveIncome(parsedIncome)
      }

      if (onSaveSettings && envelope > 0) {
        await onSaveSettings(envelope)
      }

      if (onLogChange) {
        const snapshot = buildBudgetSnapshot(
          incomeChanged ? parsedIncome : income,
          envelope,
          saveRows.map(r => ({ category_id: r.category_id, target: r.target })),
        )
        const count = upserts.length
        const summary = `Saved ${count} target${count !== 1 ? 's' : ''}, cap ${formatCurrency(envelope, false)}, allocated ${formatCurrency(allocated, false)}`
        await onLogChange('save', summary, snapshot)
      }

      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.')
    } finally {
      setSaving(false)
      setConfirmAction(null)
    }
  }, [rows, validFrom, validTo, onSave, onSaveIncome, incomeChanged, parsedIncome, onClose, onSaveSettings, onLogChange, envelope, income])

  const confirmDistributeAndSave = useCallback(() => {
    if (envelope <= 0 || totalAllocated <= 0) return
    const ratio = envelope / totalAllocated
    const scaledRows = rows.map(r => ({
      ...r,
      target: Math.max(0, Math.round(r.target * ratio)),
    }))
    setRows(scaledRows)
    doSave(scaledRows)
  }, [envelope, totalAllocated, rows, doSave])

  const handleSave = useCallback(() => {
    if (envelope > 0 && totalAllocated > envelope) {
      setConfirmAction({ type: 'distribute-cap', suggestedTotal: totalAllocated, capAmount: envelope })
      return
    }
    doSave()
  }, [totalAllocated, envelope, doSave])

  if (!open) return null

  const saveBtnLabel = saving
    ? 'Saving...'
    : incomeChanged ? 'Save budgets & income' : 'Save budgets'

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="budget-editor-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 left-[var(--shell-nav-offset)] z-[9999] flex flex-col bg-surface-950/98 backdrop-blur-xl"
      >
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 pb-3 md:px-8 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
            <h2 className="text-sm font-bold text-surface-100">Budget Targets</h2>
            <div className="flex items-center gap-3">
              {changeLog && (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[10px] text-surface-500 hover:text-surface-300"
                >
                  {showHistory ? 'Hide history' : 'History'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[10px] text-surface-500 hover:text-surface-300"
              >
                {showAdvanced ? 'Hide advanced' : 'Advanced'}
              </button>
              <button type="button" onClick={handleClose} className="text-xs text-surface-500 hover:text-surface-300">
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8">
            <div className="mx-auto max-w-4xl">
            {/* Budget envelope */}
            <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-surface-400 shrink-0">Household net take-home (monthly)</span>
                {onSaveIncome ? (
                  <input
                    type="number"
                    value={incomeDraft}
                    onChange={e => setIncomeDraft(e.target.value)}
                    placeholder="0"
                    className="w-24 rounded-lg border border-white/[0.08] bg-surface-950/55 px-2 py-1 text-right text-xs tabular-nums text-surface-50 outline-none placeholder:text-surface-600"
                  />
                ) : (
                  <span className="text-xs tabular-nums text-surface-300">
                    {effectiveIncome > 0 ? formatCurrency(effectiveIncome, false) : '—'}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-surface-400 shrink-0">Monthly spending cap</span>
                <input
                  type="number"
                  value={targetSpending}
                  onChange={e => setTargetSpending(e.target.value)}
                  placeholder="0"
                  className="w-24 rounded-lg border border-white/[0.08] bg-surface-950/55 px-2 py-1 text-right text-xs tabular-nums text-surface-50 outline-none placeholder:text-surface-600"
                />
              </div>

              {plannedSavings !== null && envelope > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-surface-400">Planned savings</span>
                  <span className={`text-xs font-medium tabular-nums ${plannedSavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(plannedSavings, false)}/mo
                    {effectiveIncome > 0 && ` (${Math.round((plannedSavings / effectiveIncome) * 100)}%)`}
                  </span>
                </div>
              )}

              {envelope > 0 && (
                <div className="space-y-2">
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
                        className={`h-full rounded-full transition-[width] duration-200 ${remaining >= 0 ? 'bg-teal-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(envelopePct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {plannedSavings !== null && effectiveIncome > 0 && (
                    <SavingsGoalBar
                      surplus={effectiveIncome - totalAllocated}
                      target={plannedSavings}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Inflation advisor */}
            <div className="mb-4 rounded-lg border border-amber-500/10 bg-amber-500/[0.03] px-3 py-2">
              <p className="text-[10px] leading-relaxed text-surface-400">
                At <span className="font-medium text-amber-300">{inflationRate}%</span> annual inflation, your targets are in today's euros.
                {' '}Fixed costs (mortgage, loans) may stay flat; groceries & utilities tend to rise with prices.
              </p>
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

            {/* Budget history */}
            <AnimatePresence>
              {showHistory && changeLog && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-2">Budget history</p>
                    {changeLog.length === 0 ? (
                      <p className="text-[10px] text-surface-600 italic py-1">No changes yet</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {changeLog.map(entry => (
                          <HistoryEntry key={entry.id} entry={entry} />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filter toggle */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] text-surface-500">
                {showAll
                  ? `All categories (${rows.length})`
                  : `Top ${suggestedIds.size} categories`}
              </span>
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="text-[10px] font-medium text-teal-400 hover:text-teal-300"
              >
                {showAll
                  ? 'Top categories'
                  : hiddenWithTargetsCount > 0
                    ? `All categories (${rows.length}) — ${hiddenWithTargetsCount} with targets`
                    : `All categories (${rows.length})`}
              </button>
            </div>

            {/* Category slider rows */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {visibleRows.map(row => (
                <BudgetSliderRow
                  key={row.category_id}
                  row={row}
                  onTargetChange={onTargetChange}
                  onClear={handleClearTarget}
                />
              ))}
            </div>
            </div>{/* end max-w-4xl */}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.06] px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] md:px-8">
            <div className="mx-auto max-w-4xl">
              {saveError && (
                <p className="mb-2 text-[10px] text-red-400">{saveError}</p>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-surface-400">
                  Total: {formatCurrency(totalAllocated, false)}/mo
                </span>
                {effectiveIncome > 0 && plannedSavings !== null ? (
                  <span className={`text-xs font-bold ${effectiveIncome - totalAllocated >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {effectiveIncome - totalAllocated >= 0 ? 'Surplus' : 'Deficit'}: {formatCurrency(Math.abs(effectiveIncome - totalAllocated), false)}
                    /{formatCurrency(plannedSavings, false)}
                  </span>
                ) : effectiveIncome > 0 ? (
                  <span className={`text-xs font-bold ${effectiveIncome - totalAllocated >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {effectiveIncome - totalAllocated >= 0 ? 'Surplus' : 'Deficit'}: {formatCurrency(Math.abs(effectiveIncome - totalAllocated), false)}/mo
                  </span>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="rounded-xl border border-white/[0.06] px-3 py-2.5 text-xs font-medium text-surface-400 transition-colors hover:text-surface-200 hover:border-white/[0.12]"
                >
                  Reset to suggested
                </button>
                {envelope > 0 && totalAllocated > envelope && (
                  <button
                    type="button"
                    onClick={handleSmartAdjust}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/15"
                  >
                    Smart adjust
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-teal-500/20 py-2.5 text-sm font-medium text-teal-300 transition-colors hover:bg-teal-500/30 disabled:opacity-50"
                >
                  {saveBtnLabel}
                </button>
              </div>
            </div>
          </div>

          {/* Confirm overlay */}
          <AnimatePresence>
            {confirmAction && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              >
                <div className="mx-8 rounded-xl border border-white/[0.08] bg-surface-900 p-5 shadow-2xl">
                  {confirmAction.type === 'close' && (
                    <>
                      <p className="text-sm font-medium text-surface-100">Discard changes?</p>
                      <p className="mt-1 text-xs text-surface-400">Your unsaved edits will be lost.</p>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmAction(null)}
                          className="flex-1 rounded-lg border border-white/[0.08] py-2 text-xs font-medium text-surface-300 hover:bg-white/[0.04]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirmAction(null); onClose() }}
                          className="flex-1 rounded-lg bg-red-500/20 py-2 text-xs font-medium text-red-300 hover:bg-red-500/30"
                        >
                          Discard
                        </button>
                      </div>
                    </>
                  )}
                  {confirmAction.type === 'reset' && (
                    <>
                      <p className="text-sm font-medium text-surface-100">Reset all to suggested?</p>
                      <p className="mt-1 text-xs text-surface-400">
                        Targets reflect your recent spending and will be set to suggested amounts.
                      </p>
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                        <span className="text-[10px] text-surface-500">Total</span>
                        <span className="text-xs tabular-nums text-surface-300">
                          {formatCurrency(confirmAction.beforeTotal, false)} → {formatCurrency(confirmAction.afterTotal, false)}
                        </span>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmAction(null)}
                          className="flex-1 rounded-lg border border-white/[0.08] py-2 text-xs font-medium text-surface-300 hover:bg-white/[0.04]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={confirmReset}
                          className="flex-1 rounded-lg bg-amber-500/20 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/30"
                        >
                          Reset all
                        </button>
                      </div>
                    </>
                  )}
                  {confirmAction.type === 'distribute-cap' && (
                    <>
                      <p className="text-sm font-medium text-surface-100">Scale targets to fit your cap?</p>
                      <p className="mt-1 text-xs text-surface-400">
                        Your suggested spending totals {formatCurrency(confirmAction.suggestedTotal, false)}/mo but your cap is {formatCurrency(confirmAction.capAmount, false)}/mo.
                        Scaling will reduce each category proportionally to fit.
                      </p>
                      <div className="mt-3 space-y-1 rounded-lg bg-white/[0.03] px-3 py-2">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-surface-500">Suggested total</span>
                          <span className="tabular-nums text-surface-300">{formatCurrency(confirmAction.suggestedTotal, false)}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-surface-500">Your cap</span>
                          <span className="tabular-nums text-surface-300">{formatCurrency(confirmAction.capAmount, false)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] border-t border-white/[0.04] pt-1">
                          <span className="text-surface-500">Each category scaled to</span>
                          <span className="tabular-nums font-medium text-emerald-400">{Math.round((confirmAction.capAmount / confirmAction.suggestedTotal) * 100)}%</span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={confirmDistributeAndSave}
                          disabled={saving}
                          className="w-full rounded-lg bg-teal-500/20 py-2 text-xs font-medium text-teal-300 hover:bg-teal-500/30 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Scale to fit & save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => doSave()}
                          disabled={saving}
                          className="w-full rounded-lg border border-white/[0.08] py-2 text-xs font-medium text-surface-300 hover:bg-white/[0.04] disabled:opacity-50"
                        >
                          Save over cap
                        </button>
                        <button
                          type="button"
                          onClick={handleSmartAdjust}
                          className="w-full rounded-lg border border-amber-500/20 bg-amber-500/[0.04] py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/10"
                        >
                          Try Smart adjust
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction(null)}
                          className="w-full py-1.5 text-[10px] text-surface-500 hover:text-surface-300"
                        >
                          I'll set them manually
                        </button>
                      </div>
                    </>
                  )}
                  {confirmAction.type === 'smart-adjust' && (
                    <>
                      <p className="text-sm font-medium text-surface-100">Smart adjust</p>
                      <p className="mt-1 text-xs text-surface-400">
                        Weighted reductions across discretionary categories to fit your cap.
                        Larger categories absorb more; fixed costs are untouched.
                      </p>

                      {confirmAction.income > 0 && confirmAction.capAmount > 0 && (
                        <div className="mt-3">
                          <SavingsGoalBar
                            surplus={confirmAction.income - confirmAction.result.newTotal}
                            target={confirmAction.income - confirmAction.capAmount}
                          />
                        </div>
                      )}

                      <div className="mt-3 max-h-40 overflow-y-auto space-y-1 rounded-lg bg-white/[0.03] px-3 py-2">
                        {confirmAction.result.reductions.map(r => (
                          <div key={r.category_id} className="flex items-center justify-between text-[10px]">
                            <span className="text-surface-400 truncate">{r.icon} {r.label}</span>
                            <span className="tabular-nums text-surface-300 shrink-0 ml-2">
                              {formatCurrency(r.currentTarget, false)}
                              <span className="text-emerald-400"> → {formatCurrency(r.proposedTarget, false)}</span>
                              <span className="text-emerald-400/60 ml-1">(-{formatCurrency(r.reduction, false)})</span>
                            </span>
                          </div>
                        ))}
                        {confirmAction.result.reductions.length === 0 && (
                          <p className="text-[10px] text-surface-600 italic py-1">
                            No discretionary categories available to reduce.
                          </p>
                        )}
                      </div>

                      <div className="mt-2 flex justify-between text-[10px] px-1">
                        <span className="text-surface-500">Total reduction</span>
                        <span className="tabular-nums font-medium text-emerald-400">
                          -{formatCurrency(confirmAction.result.totalReduction, false)}/mo
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] px-1">
                        <span className="text-surface-500">New total</span>
                        <span className={`tabular-nums font-medium ${
                          confirmAction.result.newTotal <= confirmAction.capAmount ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {formatCurrency(confirmAction.result.newTotal, false)}/mo
                          {confirmAction.result.newTotal > confirmAction.capAmount && (
                            <span className="text-amber-400/60 ml-1">
                              (still {formatCurrency(confirmAction.result.newTotal - confirmAction.capAmount, false)} over)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={applySmartReductions}
                          disabled={confirmAction.result.reductions.length === 0}
                          className="w-full rounded-lg bg-teal-500/20 py-2 text-xs font-medium text-teal-300 hover:bg-teal-500/30 disabled:opacity-50"
                        >
                          Apply reductions
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction(null)}
                          className="w-full py-1.5 text-[10px] text-surface-500 hover:text-surface-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>{/* end flex container */}
      </motion.div>

      {/* Undo snackbar */}
      <AnimatePresence>
        {undo && (
          <motion.div
            key="budget-undo-snackbar"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-24 left-1/2 z-[10000] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-surface-900 px-4 py-2.5 shadow-2xl"
          >
            <span className="text-xs text-surface-300">{undo.label} target cleared</span>
            <button
              type="button"
              onClick={handleUndo}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>,
    document.body,
  )
}
