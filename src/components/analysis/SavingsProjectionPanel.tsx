import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { CategoryBudget } from '../../hooks/useCategoryBudgets'
import type { SavedProjection } from '../../types/database'
import { formatCurrency } from '../../lib/formatCurrency'

import type { CategorySummary } from '../../hooks/useReveal'
import { computeMedian } from './budgetEditorUtils'

const CUT_PRESETS = [5, 10, 15] as const
const MAX_SCENARIO_CATEGORIES = 6
const VISIBLE_SCENARIO_COUNT = 6

type PanelMode = 'projection' | 'budget-goals'

interface Props {
  income: number | null
  budgets: CategoryBudget[]
  summaryByMonth: Map<string, CategorySummary[]>
  months: string[]
  inflationRate: number
  categoryLookup: Record<string, { icon?: string; label?: string; expenseType?: string; spendingFrequency?: string }>
  spendingCap?: number | null
  scenarioCategoryIds?: string[]
  onUpdateScenarioCategories?: (ids: string[]) => Promise<void>
  onEditBudgets?: () => void
  savedProjection?: SavedProjection
  onSaveProjection?: (proj: SavedProjection) => void
}

interface BudgetLine {
  categoryId: string
  icon: string
  label: string
  target: number
  medianActual: number
  isFixed: boolean
  spendingFrequency: string
}

interface Projection {
  fixedCosts: number
  variableCosts: number
  totalTarget: number
  nominalSurplus: number
  savingsRate: number
  inflationPressure: number
  inflationAdjustedSurplus: number
  allVariableCategories: BudgetLine[]
}

function computeProjection(
  income: number,
  budgets: CategoryBudget[],
  summaryByMonth: Map<string, CategorySummary[]>,
  months: string[],
  inflationRate: number,
  categoryLookup: Record<string, { icon?: string; label?: string; expenseType?: string; spendingFrequency?: string }>,
): Projection {
  const monthlyInflation = inflationRate / 1200

  const lines: BudgetLine[] = budgets.map(b => {
    const info = categoryLookup[b.category_id]
    
    // Calculate median using the exported helper
    const monthlyAmounts = months.map(m => {
      const summary = summaryByMonth.get(m)
      const cat = summary?.find(c => c.category === b.category_id)
      return cat ? Math.abs(Number(cat.total_amount)) : 0
    })
    
    let medianActual = 0
    const freq = info?.spendingFrequency ?? 'monthly'
    if (freq === 'annual') {
      const totalSpent = monthlyAmounts.reduce((s, v) => s + v, 0)
      const yearsOfData = Math.max(months.length / 12, 1)
      medianActual = Math.round(totalSpent / yearsOfData / 12)
    } else {
      medianActual = computeMedian(monthlyAmounts)
    }

    return {
      categoryId: b.category_id,
      icon: info?.icon ?? '📦',
      label: info?.label ?? b.category_id,
      target: Number(b.monthly_target),
      medianActual,
      isFixed: info?.expenseType === 'fixed',
      spendingFrequency: freq,
    }
  })

  let fixedCosts = 0
  let variableCosts = 0
  for (const l of lines) {
    if (l.isFixed) fixedCosts += l.target
    else variableCosts += l.target
  }

  const totalTarget = fixedCosts + variableCosts
  const nominalSurplus = income - totalTarget
  const savingsRate = income > 0 ? (nominalSurplus / income) * 100 : 0
  const inflationPressure = variableCosts * monthlyInflation
  const realMonthlySurplus = nominalSurplus - inflationPressure

  const allVariableCategories = lines
    .filter(l => l.target > 0)
    .sort((a, b) => b.target - a.target)

  return {
    fixedCosts,
    variableCosts,
    totalTarget,
    nominalSurplus,
    savingsRate,
    inflationPressure,
    inflationAdjustedSurplus: realMonthlySurplus,
    allVariableCategories,
  }
}

// --- Category Picker Bottom Sheet -------------------------------------------

function categoryTag(cat: BudgetLine, isSuggested: boolean): { label: string; color: string } | null {
  if (isSuggested) return { label: 'Suggested', color: 'bg-emerald-500/15 text-emerald-300' }
  if (cat.isFixed) return { label: 'Fixed', color: 'bg-slate-500/15 text-slate-400' }
  if (cat.spendingFrequency === 'annual') return { label: 'Annual', color: 'bg-cyan-500/15 text-cyan-300' }
  if (cat.spendingFrequency === 'one_off') return { label: 'One-off', color: 'bg-purple-500/15 text-purple-300' }
  return null
}

function ScenarioCategoryPicker({
  onClose,
  allCategories,
  initialIds,
  onSave,
}: {
  onClose: () => void
  allCategories: BudgetLine[]
  initialIds: string[]
  onSave: (ids: string[]) => void
}) {
  const [localIds, setLocalIds] = useState<Set<string>>(() => new Set(initialIds))

  const atLimit = localIds.size >= MAX_SCENARIO_CATEGORIES

  const suggestedIds = useMemo(() => {
    const monthlyCuttable = allCategories
      .filter(c => !c.isFixed && c.spendingFrequency === 'monthly')
      .sort((a, b) => b.target - a.target)
      .slice(0, 5)
      .map(c => c.categoryId)
    return new Set(monthlyCuttable)
  }, [allCategories])

  const sorted = useMemo(() => {
    return [...allCategories].sort((a, b) => {
      const aS = suggestedIds.has(a.categoryId) ? 0 : 1
      const bS = suggestedIds.has(b.categoryId) ? 0 : 1
      if (aS !== bS) return aS - bS
      const aF = a.isFixed ? 1 : 0
      const bF = b.isFixed ? 1 : 0
      if (aF !== bF) return aF - bF
      return b.target - a.target
    })
  }, [allCategories, suggestedIds])

  const handleToggle = useCallback((id: string) => {
    setLocalIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < MAX_SCENARIO_CATEGORIES) next.add(id)
      return next
    })
  }, [])

  const handleDone = useCallback(() => {
    onSave([...localIds])
    onClose()
  }, [localIds, onSave, onClose])

  const handleReset = useCallback(() => {
    onSave([])
    onClose()
  }, [onSave, onClose])

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="scenario-picker-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 left-[var(--shell-nav-offset)] z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleDone}
      >
        <motion.div
          key="scenario-picker-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg rounded-t-2xl border-t border-white/10 bg-surface-950/95 backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
          style={{ maxHeight: '70vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-surface-100">Choose categories</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                atLimit ? 'bg-amber-500/15 text-amber-300' : 'bg-teal-500/15 text-teal-300'
              }`}>
                {localIds.size}/{MAX_SCENARIO_CATEGORIES}
              </span>
            </div>
            <button type="button" onClick={handleDone} className="text-xs text-surface-500 hover:text-surface-300">
              Done
            </button>
          </div>

          <p className="px-5 pt-2 text-[9px] text-surface-600 leading-relaxed">
            Suggested categories are recurring discretionary expenses with the highest budgets — where cutting a percentage saves the most each month.
          </p>

          <div className="overflow-y-auto px-5 py-3" style={{ maxHeight: 'calc(70vh - 120px)' }}>
            <div className="space-y-1">
              {sorted.map(cat => {
                const checked = localIds.has(cat.categoryId)
                const disabled = !checked && atLimit
                const tag = categoryTag(cat, suggestedIds.has(cat.categoryId))
                return (
                  <button
                    key={cat.categoryId}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleToggle(cat.categoryId)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      checked
                        ? 'bg-teal-500/10 border border-teal-500/20'
                        : disabled
                          ? 'opacity-40 cursor-not-allowed border border-transparent'
                          : 'border border-transparent hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="text-sm shrink-0">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs text-surface-200">{cat.label}</span>
                        {tag && (
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${tag.color}`}>
                            {tag.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] tabular-nums text-surface-500 shrink-0">
                      {formatCurrency(cat.target, false)}/mo
                    </span>
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      checked
                        ? 'border-teal-400 bg-teal-500/20'
                        : 'border-surface-600'
                    }`}>
                      {checked && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-teal-300">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {atLimit && (
              <p className="mt-2 text-center text-[9px] text-amber-400/70 italic">
                Maximum {MAX_SCENARIO_CATEGORIES} categories reached
              </p>
            )}
          </div>

          <div className="border-t border-white/[0.06] px-5 py-3">
            <button
              type="button"
              onClick={handleReset}
              className="w-full py-1.5 text-[10px] text-surface-500 hover:text-surface-300 transition-colors"
            >
              Reset to auto (top by spend)
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

// --- Budget Goals View (read-only) ------------------------------------------

function BudgetGoalsView({
  projection,
  income,
  spendingCap,
  onEditBudgets,
}: {
  projection: Projection
  income: number
  spendingCap: number | null
  onEditBudgets?: () => void
}) {
  const [showFixed, setShowFixed] = useState(false)
  const plannedSavings = spendingCap && spendingCap > 0 ? income - spendingCap : null

  const fixed = projection.allVariableCategories.filter(c => c.isFixed)
  const discretionary = projection.allVariableCategories.filter(c => !c.isFixed)

  const savingsPct = plannedSavings !== null && plannedSavings > 0
    ? Math.max(0, Math.min((projection.nominalSurplus / plannedSavings) * 100, 100))
    : null

  const barColor = savingsPct === null ? ''
    : savingsPct >= 80 ? 'bg-emerald-500'
      : savingsPct >= 50 ? 'bg-amber-500'
        : 'bg-red-500'

  return (
    <div>
      {/* Savings goal progress */}
      {plannedSavings !== null && savingsPct !== null && (
        <div className="mb-3 rounded-lg bg-slate-700/20 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-500">Savings goal</span>
            <span className={`text-[10px] tabular-nums font-medium ${
              savingsPct >= 80 ? 'text-emerald-400' : savingsPct >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {formatCurrency(Math.max(0, projection.nominalSurplus), false)} / {formatCurrency(plannedSavings, false)}
              {' '}({Math.round(savingsPct)}%)
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${barColor}`}
              style={{ width: `${savingsPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Discretionary categories */}
      <div className="space-y-1">
        {discretionary.map(cat => {
          const isCut = cat.target < cat.medianActual
          const diff = Math.abs(cat.target - cat.medianActual)
          
          return (
            <div key={cat.categoryId} className="flex items-center gap-2 rounded-md px-2.5 py-2 bg-slate-700/15">
              <span className="text-xs shrink-0">{cat.icon}</span>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="truncate text-[11px] text-slate-300">{cat.label}</span>
                {cat.medianActual > 0 && (
                  <span className="truncate text-[9px] text-slate-500">
                    Suggested {formatCurrency(cat.medianActual, false)}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[11px] tabular-nums font-medium text-slate-200">
                  {formatCurrency(cat.target, false)}
                </span>
                {diff > 0 && cat.medianActual > 0 && (
                  <span className={`text-[9px] font-semibold tabular-nums ${isCut ? 'text-emerald-400/80' : 'text-amber-400/80'}`}>
                    {isCut ? `Save ${formatCurrency(diff, false)}/mo` : `+${formatCurrency(diff, false)}/mo`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Fixed costs (collapsed) */}
      {fixed.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowFixed(!showFixed)}
            className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
          >
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className={`text-[8px] transition-transform ${showFixed ? 'rotate-90' : ''}`}>▶</span>
              {fixed.length} fixed cost{fixed.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] tabular-nums text-slate-500">
              {formatCurrency(projection.fixedCosts, false)}
            </span>
          </button>
          <AnimatePresence>
            {showFixed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="mt-1 space-y-1">
                  {fixed.map(cat => (
                    <div key={cat.categoryId} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 bg-slate-700/10">
                      <span className="text-xs shrink-0">{cat.icon}</span>
                      <span className="flex-1 truncate text-[10px] text-slate-500">{cat.label}</span>
                      <span className="text-[10px] tabular-nums text-slate-500 shrink-0">
                        {formatCurrency(cat.target, false)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Footer totals */}
      <div className="mt-3 border-t border-slate-600/30 pt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-500">
          {projection.allVariableCategories.length} categories · {formatCurrency(projection.totalTarget, false)}/mo
        </span>
        {onEditBudgets && (
          <button
            type="button"
            onClick={onEditBudgets}
            className="text-[10px] font-medium text-teal-400 hover:text-teal-300 transition-colors"
          >
            Edit targets
          </button>
        )}
      </div>
    </div>
  )
}

// --- Main Panel -------------------------------------------------------------

export default function SavingsProjectionPanel({
  income, budgets, summaryByMonth, months, inflationRate,
  categoryLookup, spendingCap, scenarioCategoryIds,
  onUpdateScenarioCategories, onEditBudgets,
  savedProjection, onSaveProjection,
}: Props) {
  const savedPct = savedProjection?.cutPct
  const [cutPct, setCutPct] = useState(savedPct ?? 10)
  const [customPct, setCustomPct] = useState(() =>
    savedPct && !([5, 10, 15] as number[]).includes(savedPct) ? String(savedPct) : '',
  )
  const [isCustomActive, setIsCustomActive] = useState(() =>
    !!savedPct && !([5, 10, 15] as number[]).includes(savedPct),
  )
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showOverflow, setShowOverflow] = useState(false)
  const [panelMode, setPanelMode] = useState<PanelMode>(() =>
    budgets.length > 0 ? 'budget-goals' : 'projection',
  )

  const projection = useMemo(() => {
    if (!income || income <= 0 || budgets.length === 0) return null
    return computeProjection(income, budgets, summaryByMonth, months, inflationRate, categoryLookup)
  }, [income, budgets, summaryByMonth, months, inflationRate, categoryLookup])

  const isCustomList = !!scenarioCategoryIds && scenarioCategoryIds.length > 0

  const allScenarioCategories = useMemo(() => {
    if (!projection) return []
    if (isCustomList) {
      const byId = new Map(projection.allVariableCategories.map(c => [c.categoryId, c]))
      return (scenarioCategoryIds ?? [])
        .map(id => byId.get(id))
        .filter((c): c is BudgetLine => !!c)
    }
    return projection.allVariableCategories.slice(0, 5)
  }, [projection, isCustomList, scenarioCategoryIds])

  const scenarioCategories = useMemo(
    () => allScenarioCategories.slice(0, VISIBLE_SCENARIO_COUNT),
    [allScenarioCategories],
  )

  const overflowCategories = useMemo(
    () => allScenarioCategories.slice(VISIBLE_SCENARIO_COUNT),
    [allScenarioCategories],
  )

  const handlePickerSave = useCallback((ids: string[]) => {
    onUpdateScenarioCategories?.(ids)
  }, [onUpdateScenarioCategories])

  const isSaved = useMemo(() => {
    if (!savedProjection) return false
    const currentIds = allScenarioCategories.map(c => c.categoryId)
    return savedProjection.cutPct === cutPct
      && savedProjection.categoryIds.length === currentIds.length
      && savedProjection.categoryIds.every((id, i) => id === currentIds[i])
  }, [savedProjection, cutPct, allScenarioCategories])

  if (!projection || months.length < 3) return null

  const surplusColor = projection.inflationAdjustedSurplus >= 0 ? 'text-emerald-400' : 'text-red-400'
  const rateColor = projection.savingsRate >= 20 ? 'text-emerald-400'
    : projection.savingsRate >= 10 ? 'text-amber-300'
      : projection.savingsRate >= 0 ? 'text-amber-400'
        : 'text-red-400'

  const scenarioTotal = Math.round(allScenarioCategories.reduce((s, c) => s + c.target * cutPct / 100, 0))
  const overflowTotal = Math.round(overflowCategories.reduce((s, c) => s + c.target * cutPct / 100, 0))
  const capValue = spendingCap && spendingCap > 0 ? spendingCap : null
  const hasBudgets = budgets.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
    >
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Savings Projection
        </h3>
        {hasBudgets && (
          <div className="flex rounded-lg bg-slate-800/80 p-0.5">
            <button
              type="button"
              onClick={() => setPanelMode('budget-goals')}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-all ${
                panelMode === 'budget-goals'
                  ? 'bg-slate-700/60 text-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              Budget goals
            </button>
            <button
              type="button"
              onClick={() => setPanelMode('projection')}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-all ${
                panelMode === 'projection'
                  ? 'bg-teal-500/20 text-teal-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              Projection
            </button>
          </div>
        )}
      </div>

      {/* Summary waterfall */}
      <div className="mb-4 rounded-lg bg-slate-700/30 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-slate-500">Income</span>
          <span className="text-xs font-medium tabular-nums text-slate-200">{formatCurrency(income!, false)}</span>
        </div>

        {capValue && (
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-slate-500">Spending cap</span>
            <span className="text-xs tabular-nums text-slate-300">{formatCurrency(capValue, false)}</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-1.5">
          <button
            type="button"
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-400"
          >
            <span className={`text-[8px] transition-transform ${showBreakdown ? 'rotate-90' : ''}`}>▶</span>
            Allocated targets
          </button>
          <span className="text-xs tabular-nums text-slate-300">-{formatCurrency(projection.totalTarget, false)}</span>
        </div>

        {showBreakdown && (
          <div className="ml-3 mb-1.5 space-y-1">
            {projection.fixedCosts > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-600">Fixed (mortgage, loans…)</span>
                <span className="text-[10px] tabular-nums text-slate-500">-{formatCurrency(projection.fixedCosts, false)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-600">Discretionary</span>
              <span className="text-[10px] tabular-nums text-slate-500">-{formatCurrency(projection.variableCosts, false)}</span>
            </div>
            {projection.inflationPressure > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-600">Inflation ({inflationRate}%)</span>
                <span className="text-[10px] tabular-nums text-amber-400/60">-{formatCurrency(projection.inflationPressure, false)}</span>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-600/40 pt-1.5 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Monthly surplus</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-xs font-bold tabular-nums ${surplusColor}`}>{formatCurrency(projection.inflationAdjustedSurplus, false)}</span>
              <span className={`text-[10px] font-semibold tabular-nums ${rateColor}`}>{projection.savingsRate.toFixed(1)}% saved</span>
            </div>
          </div>
          <p className="mt-1 text-[9px] text-slate-600">
            Across all {budgets.length} categories.
            {capValue && projection.totalTarget > capValue
              ? ` ${formatCurrency(projection.totalTarget - capValue, false)} over cap.`
              : capValue ? ' Within cap.' : ''}
          </p>
        </div>
      </div>

      {/* ─── Budget Goals Mode ─── */}
      {panelMode === 'budget-goals' && (
        <BudgetGoalsView
          projection={projection}
          income={income!}
          spendingCap={capValue}
          onEditBudgets={onEditBudgets}
        />
      )}

      {/* ─── Projection Mode ─── */}
      {panelMode === 'projection' && scenarioCategories.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-slate-500">If you cut these {allScenarioCategories.length} categories by</p>
              {isCustomList && (
                <span className="rounded-full bg-teal-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-teal-400 uppercase tracking-wider">
                  Custom
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-400 font-semibold tabular-nums">+{formatCurrency(scenarioTotal, false)}/mo</span>
              {onUpdateScenarioCategories && (
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="rounded-md border border-teal-500/20 px-2.5 py-1 text-[10px] font-medium text-teal-400 hover:bg-teal-500/10 active:bg-teal-500/20 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Segmented control */}
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-800/80 p-1 mb-3">
            <div className={`flex items-center justify-center rounded-md transition-all ${
              isCustomActive ? 'bg-teal-500/20 shadow-sm' : 'hover:bg-white/[0.03]'
            }`}>
              <input
                type="number"
                min={1}
                max={100}
                value={customPct}
                placeholder="%"
                onFocus={() => setIsCustomActive(true)}
                onChange={e => {
                  const v = e.target.value
                  setCustomPct(v)
                  setIsCustomActive(true)
                  const n = Number(v)
                  if (n > 0 && n <= 100) setCutPct(n)
                }}
                className="w-full bg-transparent py-2 text-center text-xs font-medium outline-none tabular-nums placeholder:text-slate-600 text-teal-300"
              />
            </div>
            {CUT_PRESETS.map(pct => (
              <button
                key={pct}
                type="button"
                onClick={() => { setCutPct(pct); setIsCustomActive(false); setCustomPct('') }}
                className={`rounded-md py-2 text-xs font-medium transition-all ${
                  cutPct === pct && !isCustomActive
                    ? 'bg-teal-500/20 text-teal-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Category deltas — visible */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {scenarioCategories.map(cat => {
              const delta = Math.round(cat.target * cutPct / 100)
              return (
                <div key={cat.categoryId} className="flex items-center justify-between rounded-md px-2.5 py-2 bg-slate-700/15">
                  <span className="text-[11px] text-slate-400 truncate">{cat.label}</span>
                  <div className="flex flex-col items-end shrink-0 ml-2">
                    <span className="text-[11px] tabular-nums text-slate-300">{formatCurrency(cat.target, false)} target</span>
                    <span className="text-[9px] font-semibold tabular-nums text-emerald-400">+{formatCurrency(delta, false)}/mo saved</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Overflow categories */}
          {overflowCategories.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowOverflow(!showOverflow)}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className={`text-[8px] transition-transform ${showOverflow ? 'rotate-90' : ''}`}>▶</span>
                  +{overflowCategories.length} more categories
                </span>
                <span className="text-[10px] font-semibold tabular-nums text-emerald-400/70">
                  +{formatCurrency(overflowTotal, false)}/mo
                </span>
              </button>
              <AnimatePresence>
                {showOverflow && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {overflowCategories.map(cat => {
                        const delta = Math.round(cat.target * cutPct / 100)
                        return (
                          <div key={cat.categoryId} className="flex items-center justify-between rounded-md px-2.5 py-1.5 bg-slate-700/10">
                            <span className="text-[10px] text-slate-500 truncate">{cat.label}</span>
                            <div className="flex flex-col items-end shrink-0 ml-2">
                              <span className="text-[10px] tabular-nums text-slate-400">{formatCurrency(cat.target, false)}</span>
                              <span className="text-[8px] font-semibold tabular-nums text-emerald-400/70">+{formatCurrency(delta, false)}/mo</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            {isSaved
              ? <span className="text-[9px] text-emerald-500 font-medium">✓ Projection saved</span>
              : <span className="text-[9px] text-slate-600 italic">Explore only — not saved.</span>}
            {onSaveProjection && (
              <button
                type="button"
                onClick={() => onSaveProjection({
                  categoryIds: allScenarioCategories.map(c => c.categoryId),
                  cutPct,
                  savedAt: new Date().toISOString(),
                })}
                className="rounded-md border border-teal-500/20 px-2.5 py-1 text-[10px] font-medium text-teal-400 hover:bg-teal-500/10 active:bg-teal-500/20 transition-colors"
              >
                {isSaved ? 'Update' : 'Save projection'}
              </button>
            )}
          </div>

          {onEditBudgets && (
            <button
              type="button"
              onClick={onEditBudgets}
              className="mt-3 w-full rounded-xl border border-teal-500/20 bg-teal-500/[0.06] py-2.5 text-xs font-medium text-teal-300 transition-colors hover:bg-teal-500/15"
            >
              Edit budget targets
            </button>
          )}
        </div>
      )}

      {/* Scenario category picker bottom sheet — remounts on open to reset local state */}
      {showPicker && (
        <ScenarioCategoryPicker
          onClose={() => setShowPicker(false)}
          allCategories={projection.allVariableCategories}
          initialIds={scenarioCategoryIds ?? []}
          onSave={handlePickerSave}
        />
      )}
    </motion.div>
  )
}
