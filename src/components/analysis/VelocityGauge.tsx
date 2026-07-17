import { motion } from 'framer-motion'
import type { VelocityInsight } from '../../lib/advisorInsights'
import { formatCurrency } from '../../lib/formatCurrency'

interface Props {
  velocity: VelocityInsight | null
}

export default function VelocityGauge({ velocity }: Props) {
  if (!velocity) return null

  const { dayOfMonth, daysInMonth, spentSoFar, budget, paceProjection, remainingPerDay } = velocity
  const pctSpent = Math.min((spentSoFar / budget) * 100, 150)
  const pctTime = (dayOfMonth / daysInMonth) * 100
  const onTrack = paceProjection <= budget

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
        Spending Pace (Current Month)
      </h3>

      <div className="relative h-3 w-full rounded-full bg-slate-700/50 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pctSpent, 100)}%` }}
          transition={{ duration: 0.8 }}
          className={`absolute inset-y-0 left-0 rounded-full ${onTrack ? 'bg-green-500/70' : 'bg-red-500/70'}`}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-slate-300/60"
          style={{ left: `${pctTime}%` }}
          title={`Day ${dayOfMonth} of ${daysInMonth}`}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Spent so far</p>
          <p className="text-sm font-bold text-slate-200">{formatCurrency(spentSoFar, false)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Projected</p>
          <p className={`text-sm font-bold ${onTrack ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(paceProjection, false)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Left/day</p>
          <p className={`text-sm font-bold ${remainingPerDay > 0 ? 'text-slate-200' : 'text-red-400'}`}>
            {formatCurrency(Math.max(remainingPerDay, 0), false)}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-slate-500 text-center">
        Day {dayOfMonth} of {daysInMonth} · Budget: {formatCurrency(budget, false)}
      </p>
    </motion.div>
  )
}
