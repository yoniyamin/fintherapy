import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ExportRow } from '../../hooks/useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import { formatCurrency } from '../../lib/formatCurrency'

interface Props {
  transactions: ExportRow[]
  months: number
  categoryLookup: Record<string, { icon: string; label: string }>
  accountAliases: Map<string, string>
}

interface CardAmount {
  account: string
  label: string
  amount: number
  pct: number
}

interface CategorySplit {
  category: string
  icon: string
  label: string
  total: number
  cards: CardAmount[]
}

const CARD_COLORS = ['#22d3ee', '#a78bfa', '#f59e0b', '#58CC02', '#f472b6', '#64748b']

function buildSplitData(
  transactions: ExportRow[],
  categoryLookup: Record<string, { icon: string; label: string }>,
  accountAliases: Map<string, string>,
): CategorySplit[] {
  const filtered = transactions.filter(
    tx => tx.category !== OWN_TRANSFERS_CATEGORY_ID && tx.status !== 'transfer' && tx.status !== 'offset',
  )

  const matrix = new Map<string, Map<string, number>>()

  for (const tx of filtered) {
    const cat = tx.category || 'uncategorized'
    const acct = tx.account_last4 || 'unknown'
    const amount = Math.abs(Number(tx.normalized_amount ?? tx.amount))

    if (!matrix.has(cat)) matrix.set(cat, new Map())
    const accounts = matrix.get(cat)!
    accounts.set(acct, (accounts.get(acct) ?? 0) + amount)
  }

  const result: CategorySplit[] = []

  for (const [cat, accounts] of matrix) {
    const info = categoryLookup[cat]
    if (!info) continue

    const total = Array.from(accounts.values()).reduce((s, v) => s + v, 0)
    if (total === 0) continue

    const cards: CardAmount[] = Array.from(accounts.entries())
      .map(([acct, amount]) => ({
        account: acct,
        label: accountAliases.get(acct) || `••${acct}`,
        amount,
        pct: (amount / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount)

    result.push({ category: cat, icon: info.icon, label: info.label, total, cards })
  }

  return result.sort((a, b) => b.total - a.total)
}

export default function CardCategorySplitPanel({ transactions, months, categoryLookup, accountAliases }: Props) {
  const data = useMemo(
    () => buildSplitData(transactions, categoryLookup, accountAliases),
    [transactions, categoryLookup, accountAliases],
  )

  const allAccounts = useMemo(() => {
    const set = new Set<string>()
    for (const cat of data) {
      for (const card of cat.cards) set.add(card.account)
    }
    return Array.from(set)
  }, [data])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (data.length === 0 || allAccounts.length < 2) return null

  const toggle = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4"
    >
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
        Who Pays What
      </h3>

      <div className="space-y-1.5">
        {data.map(cat => {
          const isOpen = expanded.has(cat.category)
          return (
            <div key={cat.category}>
              <button
                type="button"
                onClick={() => toggle(cat.category)}
                className="flex w-full items-center gap-2 rounded-lg bg-slate-700/30 px-3 py-2 text-left transition-colors hover:bg-slate-700/50"
              >
                <span className="text-sm shrink-0">{cat.icon}</span>
                <span className="truncate text-xs font-medium text-slate-200 flex-1">{cat.label}</span>
                <span className="text-xs tabular-nums text-slate-300 shrink-0">{formatCurrency(cat.total / Math.max(months, 1), false)}/mo</span>
                <svg
                  className={`h-3.5 w-3.5 text-slate-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-6 mt-1.5 space-y-1.5 pb-1">
                      {cat.cards.map((card, i) => (
                        <div key={card.account} className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-300">{card.label}</span>
                            <span className="text-xs tabular-nums text-slate-200">
                              {formatCurrency(card.amount / Math.max(months, 1), false)}/mo
                              <span className="ml-1.5 text-[10px] text-slate-500">{Math.round(card.pct)}%</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/50">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${card.pct}%` }}
                              transition={{ duration: 0.5, delay: i * 0.08 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: CARD_COLORS[i % CARD_COLORS.length] }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
