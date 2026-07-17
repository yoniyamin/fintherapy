import { formatCurrency } from '../../lib/formatCurrency'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { CategoryBudget } from '../../hooks/useCategoryBudgets'
import type { SavingsGoal } from '../../types/database'

interface Props {
  income: number | null
  budgets: CategoryBudget[]
  inflationRate: number
  savingsGoals: SavingsGoal[]
  months: number
}

interface Projection {
  fixedCosts: number
  variableCosts: number
  totalTarget: number
  nominalSurplus: number
  inflationAdjustedSurplus: number
  goalAllocations: { name: string; target: number; monthlyNeeded: number; monthsToGoal: number; funded: boolean }[]
  freeSavings: number
}

function computeProjection(
  income: number,
  budgets: CategoryBudget[],
  inflationRate: number,
  savingsGoals: SavingsGoal[],
): Projection {
  const monthlyInflation = inflationRate / 1200

  let fixedCosts = 0
  let variableCosts = 0

  for (const b of budgets) {
    const target = Number(b.monthly_target)
    if (b.subject_to_inflation) {
      variableCosts += target
    } else {
      fixedCosts += target
    }
  }

  const totalTarget = fixedCosts + variableCosts
  const nominalSurplus = income - totalTarget

  const realMonthlySurplus = income - fixedCosts - variableCosts * (1 + monthlyInflation)
  const goalAllocations = savingsGoals.map(goal => {
    const monthlyNeeded = goal.horizon_months > 0 ? goal.target / goal.horizon_months : goal.target
    const monthsToGoal = realMonthlySurplus > 0 ? Math.ceil(goal.target / realMonthlySurplus) : Infinity
    return {
      name: goal.name,
      target: goal.target,
      monthlyNeeded,
      monthsToGoal,
      funded: realMonthlySurplus >= monthlyNeeded,
    }
  })

  const totalGoalAllocation = goalAllocations.reduce((s, g) => s + g.monthlyNeeded, 0)
  const freeSavings = realMonthlySurplus - totalGoalAllocation

  return {
    fixedCosts,
    variableCosts,
    totalTarget,
    nominalSurplus,
    inflationAdjustedSurplus: realMonthlySurplus,
    goalAllocations,
    freeSavings,
  }
}

export default function SavingsProjectionPanel({ income, budgets, inflationRate, savingsGoals, months }: Props) {
  const projection = useMemo(() => {
    if (!income || income <= 0 || budgets.length === 0) return null
    return computeProjection(income, budgets, inflationRate, savingsGoals)
  }, [income, budgets, inflationRate, savingsGoals])

  if (!projection || months < 3) return null

  const surplusColor = projection.inflationAdjustedSurplus >= 0 ? 'text-emerald-400' : 'text-red-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
    >
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        Savings Projection
      </h3>

      {/* Pay Yourself First summary */}
      <div className="mb-3 rounded-lg bg-slate-700/30 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500">Income</span>
          <span className="text-xs font-medium tabular-nums text-slate-200">{formatCurrency(income!, false)}</span>
        </div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500">Fixed costs</span>
          <span className="text-xs tabular-nums text-slate-300">-{formatCurrency(projection.fixedCosts, false)}</span>
        </div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-500">Variable costs (adj. {inflationRate}% infl.)</span>
          <span className="text-xs tabular-nums text-slate-300">-{formatCurrency(projection.variableCosts * (1 + inflationRate / 1200), false)}</span>
        </div>
        <div className="border-t border-slate-600/40 pt-1.5 mt-1.5 flex items-center justify-between">
          <span className="text-[10px] font-medium text-slate-400">Monthly surplus (real)</span>
          <span className={`text-xs font-bold tabular-nums ${surplusColor}`}>{formatCurrency(projection.inflationAdjustedSurplus, false)}</span>
        </div>
      </div>

      {/* Goals */}
      {projection.goalAllocations.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Goal Progress</p>
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
    </motion.div>
  )
}
