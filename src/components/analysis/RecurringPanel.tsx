import { motion } from 'framer-motion'
import type { RecurringCharge } from '../../lib/recurringDetector'

interface Props {
  charges: RecurringCharge[]
  months: number
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

export default function RecurringPanel({ charges, months }: Props) {
  if (charges.length < 3) return null

  const total = charges.reduce((s, r) => s + r.monthlyEstimate, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Recurring Charges
        </h3>
        <span className="text-xs text-slate-300 font-medium">
          {fmt(total)}/mo ({fmt(total * 12)}/yr)
        </span>
      </div>

      <div className="space-y-1.5">
        {charges.slice(0, 6).map((charge) => (
          <div key={charge.merchantClean} className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-700/30">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-300 truncate max-w-[180px]">
                {charge.merchantClean}
              </span>
              <span className="text-[10px] text-slate-500 shrink-0">
                {charge.frequency}/{months}mo
              </span>
            </div>
            <span className="text-xs font-medium text-slate-200 shrink-0 ml-2">
              {fmt(charge.avgAmount)}
            </span>
          </div>
        ))}
      </div>

      {charges.length > 6 && (
        <p className="mt-2 text-[10px] text-slate-500">
          +{charges.length - 6} more recurring charges
        </p>
      )}
    </motion.div>
  )
}
