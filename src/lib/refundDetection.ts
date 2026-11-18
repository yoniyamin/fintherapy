import type { AccountType, Transaction } from '../types/database'

type StackKeyTx = Pick<Transaction, 'amount' | 'billing_month' | 'merchant_raw'>

/**
 * True when a positive amount reduces spend (refund / credit) rather than being a debit-card load.
 * Credit and unknown-type accounts treat positives as credits; debit-only positives are card loads.
 */
export function isRefundAmount(
  totalAmount: number,
  accountTypes: readonly (AccountType | undefined)[],
): boolean {
  if (totalAmount <= 0) return false
  if (accountTypes.length === 0) return true
  return !accountTypes.every((type) => type === 'debit')
}

/**
 * Deck stack key: same merchant, same billing month, same direction.
 * Direction keeps refunds from netting silently against purchases of the same merchant.
 */
export function classifyStackKey(tx: StackKeyTx): string {
  const merchant = tx.merchant_raw.toLowerCase().trim()
  const billingMonth = tx.billing_month?.trim() ?? ''
  const direction = Number(tx.amount) > 0 ? 'in' : 'out'
  return `${merchant}\u0000${billingMonth}\u0000${direction}`
}

/** Default "counts toward" month (YYYY-MM) for a stack: the billing month of its first transaction. */
export function defaultRefundMonth(transactions: readonly Pick<Transaction, 'billing_month'>[]): string | null {
  return transactions[0]?.billing_month?.trim() || null
}
