/**
 * Client-side heuristic to detect recurring charges from transaction history.
 * Groups by merchant, splits distinct amount tiers, checks frequency and stability.
 */

import type { ExportRow } from '../hooks/useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID } from './constants'

export interface RecurringCharge {
  merchantClean: string
  avgAmount: number
  frequency: number
  monthlyEstimate: number
  category: string
  months: string[]
}

/** Max relative distance from cluster centroid to treat amounts as the same tier. */
const AMOUNT_CLUSTER_TOLERANCE = 0.12

interface MerchantTx {
  amt: number
  month: string
  category: string
}

interface AmountCluster {
  amounts: number[]
  months: Set<string>
  category: string
}

/**
 * Split one merchant's charges into amount tiers (e.g. two ~€1k school fees).
 */
function clusterMerchantTransactions(txs: MerchantTx[]): AmountCluster[] {
  const clusters: AmountCluster[] = []

  for (const tx of txs) {
    let matched: AmountCluster | undefined
    for (const cluster of clusters) {
      const centroid = cluster.amounts.reduce((s, v) => s + v, 0) / cluster.amounts.length
      if (Math.abs(tx.amt - centroid) / centroid <= AMOUNT_CLUSTER_TOLERANCE) {
        matched = cluster
        break
      }
    }

    if (matched) {
      matched.amounts.push(tx.amt)
      matched.months.add(tx.month)
    } else {
      clusters.push({
        amounts: [tx.amt],
        months: new Set([tx.month]),
        category: tx.category,
      })
    }
  }

  return clusters
}

/**
 * Build display label; disambiguate when one merchant has multiple amount tiers.
 */
function merchantLabel(merchant: string, avg: number, clusterCount: number): string {
  if (clusterCount <= 1) return merchant
  const rounded = Math.round(avg)
  return `${merchant} (~€${rounded.toLocaleString('en-US')})`
}

/**
 * Detect recurring charges from a multi-month transaction set.
 * A charge is "recurring" when the same merchant + amount tier appears in 3+
 * distinct months with similar amounts (coefficient of variation < 0.3).
 */
export function detectRecurring(
  transactions: ExportRow[],
  months: string[],
): RecurringCharge[] {
  if (months.length < 3) return []

  const merchantTxs = new Map<string, MerchantTx[]>()

  for (const tx of transactions) {
    if (tx.category === OWN_TRANSFERS_CATEGORY_ID) continue
    if (tx.status === 'transfer' || tx.status === 'offset') continue

    const merchant = (tx.merchant_clean || tx.merchant_raw).trim().toUpperCase()
    if (!merchant) continue

    const amt = Math.abs(Number(tx.normalized_amount ?? tx.amount))
    if (amt <= 0) continue

    const list = merchantTxs.get(merchant)
    const entry: MerchantTx = { amt, month: tx.billing_month, category: tx.category }
    if (list) list.push(entry)
    else merchantTxs.set(merchant, [entry])
  }

  const results: RecurringCharge[] = []
  const totalMonths = months.length

  for (const [merchant, txs] of merchantTxs) {
    const clusters = clusterMerchantTransactions(txs)

    for (const data of clusters) {
      if (data.months.size < 3) continue

      const avg = data.amounts.reduce((s, v) => s + v, 0) / data.amounts.length
      if (avg < 1) continue

      const variance = data.amounts.reduce((s, v) => s + (v - avg) ** 2, 0) / data.amounts.length
      const cv = Math.sqrt(variance) / avg

      if (cv > 0.3) continue

      results.push({
        merchantClean: merchantLabel(merchant, avg, clusters.length),
        avgAmount: Math.round(avg * 100) / 100,
        frequency: data.months.size,
        monthlyEstimate: Math.round((avg * data.months.size / totalMonths) * 100) / 100,
        category: data.category,
        months: Array.from(data.months).sort(),
      })
    }
  }

  return results.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate)
}
