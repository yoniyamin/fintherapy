import { useMemo, useState } from 'react'
import CategoryIcon from '../common/CategoryIcon'
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

interface VendorAggregate {
  merchant: string
  total: number
  monthlyAvg: number
  txCount: number
}

interface CardPct {
  label: string
  pct: number
}

interface CategoryVendors {
  category: string
  icon: string
  label: string
  categoryTotal: number
  vendors: VendorAggregate[]
  paidFrom: CardPct[]
}

function buildVendorData(
  transactions: ExportRow[],
  months: number,
  categoryLookup: Record<string, { icon: string; label: string }>,
  accountAliases: Map<string, string>,
): CategoryVendors[] {
  const filtered = transactions.filter(
    tx => tx.category !== OWN_TRANSFERS_CATEGORY_ID && tx.status !== 'transfer' && tx.status !== 'offset',
  )

  const byCat = new Map<string, Map<string, { total: number; count: number }>>()
  const cardByCat = new Map<string, Map<string, number>>()

  for (const tx of filtered) {
    const cat = tx.category || 'uncategorized'
    const merchant = (tx.merchant_clean || tx.merchant_raw).trim()
    const amount = Math.abs(Number(tx.normalized_amount ?? tx.amount))
    const acct = tx.account_last4 || 'unknown'

    if (merchant) {
      if (!byCat.has(cat)) byCat.set(cat, new Map())
      const merchants = byCat.get(cat)!
      const existing = merchants.get(merchant)
      if (existing) {
        existing.total += amount
        existing.count++
      } else {
        merchants.set(merchant, { total: amount, count: 1 })
      }
    }

    if (!cardByCat.has(cat)) cardByCat.set(cat, new Map())
    const cards = cardByCat.get(cat)!
    cards.set(acct, (cards.get(acct) ?? 0) + amount)
  }

  const result: CategoryVendors[] = []

  for (const [cat, merchants] of byCat) {
    const info = categoryLookup[cat]
    if (!info) continue

    const vendors: VendorAggregate[] = Array.from(merchants.entries())
      .map(([merchant, data]) => ({
        merchant,
        total: data.total,
        monthlyAvg: months > 0 ? data.total / months : data.total,
        txCount: data.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    const categoryTotal = Array.from(merchants.values()).reduce((s, v) => s + v.total, 0)

    const cards = cardByCat.get(cat) ?? new Map()
    const cardTotal = Array.from(cards.values()).reduce((s, v) => s + v, 0)
    const paidFrom: CardPct[] = Array.from(cards.entries())
      .map(([acct, amt]) => ({
        label: accountAliases.get(acct) || `••${acct}`,
        pct: cardTotal > 0 ? Math.round((amt / cardTotal) * 100) : 0,
      }))
      .filter(c => c.pct > 0)
      .sort((a, b) => b.pct - a.pct)

    result.push({
      category: cat,
      icon: info.icon,
      label: info.label,
      categoryTotal,
      vendors,
      paidFrom,
    })
  }

  return result.sort((a, b) => b.categoryTotal - a.categoryTotal)
}

export default function TopVendorsPanel({ transactions, months, categoryLookup, accountAliases }: Props) {
  const data = useMemo(
    () => buildVendorData(transactions, months, categoryLookup, accountAliases),
    [transactions, months, categoryLookup, accountAliases],
  )

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (data.length === 0) return null

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
        Top Merchants by Category
      </h3>

      <div className="space-y-1.5">
        {data.map(cat => {
          const isOpen = expanded.has(cat.category)
          return (
            <div key={cat.category}>
              <button
                type="button"
                onClick={() => toggle(cat.category)}
                className="flex w-full items-center justify-between rounded-lg bg-slate-700/30 px-3 py-2 text-left transition-colors hover:bg-slate-700/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon categoryId={cat.category} emoji={cat.icon} size="sm" />
                  <span className="truncate text-xs font-medium text-slate-200">{cat.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-slate-300">{formatCurrency(cat.categoryTotal / Math.max(months, 1), false)}/mo</span>
                  <svg
                    className={`h-3.5 w-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
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
                    <div className="ml-6 mt-1 space-y-1 pb-1">
                      {cat.paidFrom.length > 1 && (
                        <div className="px-2 py-1 text-[10px] text-slate-500">
                          Paid from: {cat.paidFrom.map(c => `${c.label} ${c.pct}%`).join(' · ')}
                        </div>
                      )}
                      {cat.vendors.map((v, i) => (
                        <div key={v.merchant} className="flex items-center justify-between rounded-md px-2 py-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-medium text-slate-500 w-4 text-right shrink-0">{i + 1}.</span>
                            <span className="truncate text-xs text-slate-300">{v.merchant}</span>
                            <span className="text-[10px] text-slate-500 shrink-0">{v.txCount}tx</span>
                          </div>
                          <span className="text-xs font-medium tabular-nums text-slate-200 shrink-0 ml-2">
                            {formatCurrency(v.monthlyAvg, false)}/mo
                          </span>
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
