import { motion } from 'framer-motion'
import type { DeltaDriver } from '../../lib/advisorInsights'
import { formatCurrency } from '../../lib/formatCurrency'

interface Props {
  drivers: DeltaDriver[]
}

export default function DeltaDrivers({ drivers }: Props) {
  if (drivers.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
        What Changed & Why
      </h3>

      <div className="space-y-3">
        {drivers.slice(0, 3).map((driver) => {
          const isUp = driver.delta >= 0
          return (
            <div key={driver.category} className="rounded-lg bg-slate-700/30 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-200">{driver.label}</span>
                <span className={`text-xs font-bold ${isUp ? 'text-red-400' : 'text-green-400'}`}>
                  {isUp ? '+' : ''}{Math.round(driver.pct)}% ({isUp ? '+' : ''}{formatCurrency(driver.delta, false)})
                </span>
              </div>
              {driver.topTransactions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {driver.topTransactions.map((tx, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md bg-slate-600/40 px-2 py-0.5 text-[10px] text-slate-300">
                      {tx.merchant.substring(0, 20)}
                      <span className="text-slate-400">{formatCurrency(tx.amount, false)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
