import { motion } from 'framer-motion'
import type { AccountSpending } from '../../hooks/useMultiMonthReveal'

interface Props {
  spendingByAccount: AccountSpending[]
  months: number
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

const BAR_COLORS = ['#22d3ee', '#a78bfa', '#f59e0b', '#58CC02', '#f472b6']

export default function MemberSpendingPanel({ spendingByAccount, months }: Props) {
  if (spendingByAccount.length < 2) return null

  const accountTotals = new Map<string, { label: string; amount: number; txCount: number }>()
  for (const row of spendingByAccount) {
    const key = row.account_last4 ?? 'unknown'
    const existing = accountTotals.get(key)
    if (existing) {
      existing.amount += Number(row.total_amount)
      existing.txCount += Number(row.tx_count)
    } else {
      accountTotals.set(key, { label: row.label, amount: Number(row.total_amount), txCount: Number(row.tx_count) })
    }
  }

  if (accountTotals.size < 2) return null

  const rows = Array.from(accountTotals.values()).sort((a, b) => b.amount - a.amount)
  const max = rows[0]?.amount ?? 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
    >
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
        Spending by Card
      </h3>

      <div className="space-y-2.5">
        {rows.slice(0, 5).map((row, i) => {
          const pct = (row.amount / max) * 100
          const monthly = months > 0 ? row.amount / months : row.amount
          return (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">{row.label}</span>
                <span className="text-slate-200 font-semibold">{fmt(monthly)}/mo</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-700/50 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
