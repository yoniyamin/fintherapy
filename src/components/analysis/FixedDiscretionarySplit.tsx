import { formatCurrency } from '../../lib/formatCurrency'
import { motion } from 'framer-motion'

interface Props {
  fixedTotal: number
  discretionaryTotal: number
  months: number
  income: number | null
}

export default function FixedDiscretionarySplit({ fixedTotal, discretionaryTotal, months, income }: Props) {
  if (fixedTotal <= 0 && discretionaryTotal <= 0) return null

  const fixedMonthly = months > 0 ? fixedTotal / months : 0
  const discretionaryMonthly = months > 0 ? discretionaryTotal / months : 0
  const total = fixedMonthly + discretionaryMonthly
  const fixedPct = total > 0 ? (fixedMonthly / total) * 100 : 50
  const discretionaryBudget = income ? income - fixedMonthly : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
        Fixed vs Discretionary
      </h3>

      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-700/50">
        <div
          className="bg-purple-500/80 transition-all duration-500"
          style={{ width: `${fixedPct}%` }}
        />
        <div
          className="bg-cyan-500/80 transition-all duration-500"
          style={{ width: `${100 - fixedPct}%` }}
        />
      </div>

      <div className="mt-3 flex justify-between text-xs">
        <div>
          <span className="inline-block h-2 w-2 rounded-full bg-purple-500 mr-1.5" />
          <span className="text-slate-300 font-medium">Fixed: {formatCurrency(fixedMonthly, false)}/mo</span>
        </div>
        <div>
          <span className="inline-block h-2 w-2 rounded-full bg-cyan-500 mr-1.5" />
          <span className="text-slate-300 font-medium">Discretionary: {formatCurrency(discretionaryMonthly, false)}/mo</span>
        </div>
      </div>

      {discretionaryBudget != null && (
        <p className="mt-2 text-xs text-slate-400">
          After fixed costs, you have <span className="text-slate-200 font-medium">{formatCurrency(discretionaryBudget, false)}</span> for choices.
          {discretionaryMonthly > discretionaryBudget && (
            <span className="text-red-400 ml-1">
              ({formatCurrency(discretionaryMonthly - discretionaryBudget, false)} over)
            </span>
          )}
        </p>
      )}
    </motion.div>
  )
}
