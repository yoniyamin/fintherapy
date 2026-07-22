import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { CategoryBudget } from '../../hooks/useCategoryBudgets'
import type { SavingsGoal } from '../../types/database'
import { formatCurrency } from '../../lib/formatCurrency'

const CUT_PRESETS = [5, 10, 15] as const
const MAX_SCENARIO_CATEGORIES = 6

interface Props {
  income: number | null
  budgets: CategoryBudget[]
  inflationRate: number
  savingsGoals: SavingsGoal[]
  months: number
  categoryLookup: Record<string, { icon?: string; label?: string; expenseType?: string; spendingFrequency?: string }>
  spendingCap?: number | null
  scenarioCategoryIds?: string[]
  onUpdateScenarioCategories?: (ids: string[]) => Promise<void>
  onEditBudgets?: () => void
  onManageGoals?: () => void
}

interface BudgetLine {
  categoryId: string
  icon: string
  label: string
  target: number
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
  goalAllocations: { name: string; target: number; monthlyNeeded: number; monthsToGoal: number; funded: boolean }[]
  freeSavings: number
}

function computeProjection(
  income: number,
  budgets: CategoryBudget[],
  inflationRate: number,
  savingsGoals: SavingsGoal[],
  categoryLookup: Record<string, { icon?: string; label?: string; expenseType?: string; spendingFrequency?: string }>,
): Projection {
  const monthlyInflation = inflationRate / 1200

  const lines: BudgetLine[] = budgets.map(b => {
    const info = categoryLookup[b.category_id]
    return {
      categoryId: b.category_id,
      icon: info?.icon ?? '📦',
      label: info?.label ?? b.category_id,
      target: Number(b.monthly_target),
      isFixed: info?.expenseType === 'fixed',
      spendingFrequency: info?.spendingFrequency ?? 'monthly',
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

  const goalAllocations = savingsGoals.map(goal => {
    const monthlyNeeded = goal.horizon_months > 0 ? goal.target / goal.horizon_months : goal.target
    const monthsToGoal = realMonthlySurplus > 0 ? Math.ceil(goal.target / realMonthlySurplus) : Infinity
    return { name: goal.name, target: goal.target, monthlyNeeded, monthsToGoal, funded: realMonthlySurplus >= monthlyNeeded }
  })

  return {
    fixedCosts,
    variableCosts,
    totalTarget,
    nominalSurplus,
    savingsRate,
    inflationPressure,
    inflationAdjustedSurplus: realMonthlySurplus,
    allVariableCategories,
    goalAllocations,
    freeSavings: realMonthlySurplus - goalAllocations.reduce((s, g) => s + g.monthlyNeeded, 0),
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
  open,
  onClose,
  allCategories,
  selectedIds,
  onToggle,
  onReset,
}: {
  open: boolean
  onClose: () => void
  allCategories: BudgetLine[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onReset: () => void
}) {
  const atLimit = selectedIds.size >= MAX_SCENARIO_CATEGORIES

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

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="scenario-picker-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 left-[var(--shell-nav-offset)] z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="scenario-picker-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg rounded-t-2xl border-t border-white/10 bg-surface-950/95 backdrop-blur-xl"
          style={{ maxHeight: '70vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-surface-100">Choose categories</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
                atLimit ? 'bg-amber-500/15 text-amber-300' : 'bg-teal-500/15 text-teal-300'
              }`}>
                {selectedIds.size}/{MAX_SCENARIO_CATEGORIES}
              </span>
            </div>
            <button type="button" onClick={onClose} className="text-xs text-surface-500 hover:text-surface-300">
              Done
            </button>
          </div>

          <p className="px-5 pt-2 text-[9px] text-surface-600 leading-relaxed">
            Suggested categories are recurring discretionary expenses with the highest budgets — where cutting a percentage saves the most each month.
          </p>

          <div className="overflow-y-auto px-5 py-3" style={{ maxHeight: 'calc(70vh - 120px)' }}>
            <div className="space-y-1">
              {sorted.map(cat => {
                const checked = selectedIds.has(cat.categoryId)
                const disabled = !checked && atLimit
                const tag = categoryTag(cat, suggestedIds.has(cat.categoryId))
                return (
                  <button
                    key={cat.categoryId}
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggle(cat.categoryId)}
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
              onClick={onReset}
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

// --- Main Panel -------------------------------------------------------------

export default function SavingsProjectionPanel({
  income, budgets, inflationRate, savingsGoals, months,
  categoryLookup, spendingCap, scenarioCategoryIds,
  onUpdateScenarioCategories, onEditBudgets, onManageGoals,
}: Props) {
  const [cutPct, setCutPct] = useState(10)
  const [customPct, setCustomPct] = useState('')
  const [isCustomActive, setIsCustomActive] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  const projection = useMemo(() => {
    if (!income || income <= 0 || budgets.length === 0) return null
    return computeProjection(income, budgets, inflationRate, savingsGoals, categoryLookup)
  }, [income, budgets, inflationRate, savingsGoals, categoryLookup])

  const isCustomList = !!scenarioCategoryIds && scenarioCategoryIds.length > 0
  const selectedSet = useMemo(
    () => new Set(scenarioCategoryIds ?? []),
    [scenarioCategoryIds],
  )

  const scenarioCategories = useMemo(() => {
    if (!projection) return []
    if (isCustomList) {
      const byId = new Map(projection.allVariableCategories.map(c => [c.categoryId, c]))
      return (scenarioCategoryIds ?? [])
        .map(id => byId.get(id))
        .filter((c): c is BudgetLine => !!c)
        .slice(0, MAX_SCENARIO_CATEGORIES)
    }
    return projection.allVariableCategories.slice(0, 5)
  }, [projection, isCustomList, scenarioCategoryIds])

  const handleToggle = useCallback((id: string) => {
    const current = scenarioCategoryIds ?? []
    const next = current.includes(id)
      ? current.filter(c => c !== id)
      : current.length < MAX_SCENARIO_CATEGORIES
        ? [...current, id]
        : current
    onUpdateScenarioCategories?.(next)
  }, [scenarioCategoryIds, onUpdateScenarioCategories])

  const handleReset = useCallback(() => {
    onUpdateScenarioCategories?.([])
    setShowPicker(false)
  }, [onUpdateScenarioCategories])

  if (!projection || months < 3) return null

  const surplusColor = projection.inflationAdjustedSurplus >= 0 ? 'text-emerald-400' : 'text-red-400'
  const rateColor = projection.savingsRate >= 20 ? 'text-emerald-400'
    : projection.savingsRate >= 10 ? 'text-amber-300'
      : projection.savingsRate >= 0 ? 'text-amber-400'
        : 'text-red-400'

  const scenarioTotal = Math.round(scenarioCategories.reduce((s, c) => s + c.target * cutPct / 100, 0))
  const capValue = spendingCap && spendingCap > 0 ? spendingCap : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
    >
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        Savings Projection
      </h3>

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

      {/* Scenario: segmented control */}
      {scenarioCategories.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-slate-500">If you cut these {scenarioCategories.length} categories by</p>
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

          {/* Category deltas */}
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

          <p className="mt-2 text-[9px] text-slate-600 italic leading-relaxed">
            Explore only — not saved to your budget.
          </p>

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

      {/* Goals */}
      {projection.goalAllocations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Goal Progress</p>
            {onManageGoals && (
              <button
                type="button"
                onClick={onManageGoals}
                className="text-[10px] font-medium text-teal-400 hover:text-teal-300 py-1"
              >
                Manage goals
              </button>
            )}
          </div>
          {projection.goalAllocations.map(goal => {
            const progress = projection.inflationAdjustedSurplus > 0
              ? Math.min(100, (projection.inflationAdjustedSurplus / goal.monthlyNeeded) * 100)
              : 0
            return (
              <div key={goal.name} className="rounded-lg bg-slate-700/20 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-300">{goal.name}</span>
                  <span className="text-[10px] tabular-nums text-slate-400">
                    {goal.monthsToGoal === Infinity ? '—' : `${goal.monthsToGoal}mo`} to goal
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6 }}
                      className={`h-full rounded-full ${goal.funded ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-slate-500">{formatCurrency(goal.target, false)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {projection.goalAllocations.length === 0 && onManageGoals && (
        <button
          type="button"
          onClick={onManageGoals}
          className="w-full rounded-lg border border-dashed border-slate-600/50 py-2 text-[10px] text-slate-500 hover:text-slate-400 hover:border-slate-500/50 transition-colors"
        >
          + Add savings goals
        </button>
      )}

      {/* Free savings after goals */}
      {projection.goalAllocations.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-700/40">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Free savings after goals</span>
            <span className={`text-xs font-bold tabular-nums ${projection.freeSavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(projection.freeSavings, false)}/mo
            </span>
          </div>
        </div>
      )}

      {/* Scenario category picker bottom sheet */}
      <ScenarioCategoryPicker
        open={showPicker}
        onClose={() => setShowPicker(false)}
        allCategories={projection.allVariableCategories}
        selectedIds={selectedSet}
        onToggle={handleToggle}
        onReset={handleReset}
      />
    </motion.div>
  )
}
