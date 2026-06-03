import type { Transaction } from '../types/database'

/** Billing months present on transactions (YYYY-MM), sorted ascending. */
export function distinctBillingMonthsFromTxns(txns: Transaction[]): string[] {
  const s = new Set<string>()
  for (const t of txns) {
    const bm = t.billing_month?.trim()
    if (bm) s.add(bm)
  }
  return Array.from(s).sort()
}

export function filterTransactionsByAccount(
  txns: Transaction[],
  accountFilter: string | null,
): Transaction[] {
  if (accountFilter == null) return txns
  return txns.filter((t) => (t.account_last4?.trim() ?? '') === accountFilter)
}

export function filterTransactionsByBillingMonth(
  txns: Transaction[],
  monthFilter: string | null,
): Transaction[] {
  if (monthFilter == null) return txns
  return txns.filter((t) => (t.billing_month?.trim() ?? '') === monthFilter)
}

/** Human label for YYYY-MM billing month. */
export function formatBillingMonthLabel(billingMonth: string): string {
  const [y, m] = billingMonth.split('-')
  if (!y || !m) return billingMonth
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/** Stack count per billing month for txs already scoped to a card (or all). */
export function countPendingStacksByMonth(txns: Transaction[]): Map<string, number> {
  const keys = new Map<string, Set<string>>()
  for (const t of txns) {
    const bm = t.billing_month?.trim()
    if (!bm) continue
    const stackKey = `${t.merchant_raw.toLowerCase().trim()}\u0000${bm}`
    let set = keys.get(bm)
    if (!set) {
      set = new Set()
      keys.set(bm, set)
    }
    set.add(stackKey)
  }
  const out = new Map<string, number>()
  for (const [bm, set] of keys) out.set(bm, set.size)
  return out
}

/** How many billing months still have pending stacks per card last4. */
export function countPendingMonthsPerCard(txns: Transaction[]): Map<string, number> {
  const byCard = new Map<string, Map<string, Set<string>>>()
  for (const t of txns) {
    const last4 = t.account_last4?.trim()
    const bm = t.billing_month?.trim()
    if (!last4 || !bm) continue
    const stackKey = `${t.merchant_raw.toLowerCase().trim()}\u0000${bm}`
    let cardMap = byCard.get(last4)
    if (!cardMap) {
      cardMap = new Map()
      byCard.set(last4, cardMap)
    }
    let stacks = cardMap.get(bm)
    if (!stacks) {
      stacks = new Set()
      cardMap.set(bm, stacks)
    }
    stacks.add(stackKey)
  }
  const out = new Map<string, number>()
  for (const [last4, cardMap] of byCard) out.set(last4, cardMap.size)
  return out
}

/** Oldest billing month that still has pending rows in `txns`. */
export function oldestPendingBillingMonth(txns: Transaction[]): string | null {
  const months = distinctBillingMonthsFromTxns(txns)
  return months[0] ?? null
}

/** Flagged tx count per billing month for txs scoped to card (or all). */
export function countFlaggedByMonth(
  flaggedTxns: Transaction[],
  accountFilter: string | null,
): Map<string, number> {
  const scoped = filterTransactionsByAccount(flaggedTxns, accountFilter)
  const out = new Map<string, number>()
  for (const t of scoped) {
    const bm = t.billing_month?.trim()
    if (!bm) continue
    out.set(bm, (out.get(bm) ?? 0) + 1)
  }
  return out
}

export function classifyAccountStorageKey(householdId: string) {
  return `spentwhatt:classifyAccountFilter:${householdId}`
}

export function classifyMonthStorageKey(householdId: string) {
  return `spentwhatt:classifyMonthFilter:${householdId}`
}
