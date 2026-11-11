import type { Transaction } from '../types/database'

/** Transaction id -> chosen category id; null means "not assigned yet / leave in deck". */
export type CategoryAssignments = Record<string, string | null>

/** Transaction id -> saved category id, for rows that were actually classified. */
export type TxCategories = Record<string, string>

export interface SplitAssignment {
  txId: string
  category: string
}

export interface CategorySummaryRow {
  category: string
  count: number
  total: number
}

/** Assignments for a group opened in the modal: every row starts on the group's category (or any per-row override). */
export function buildInitialAssignments(
  txs: readonly Pick<Transaction, 'id'>[],
  groupCategory: string | null,
  txCategories?: TxCategories,
): CategoryAssignments {
  const result: CategoryAssignments = {}
  for (const tx of txs) {
    result[tx.id] = txCategories?.[tx.id] ?? groupCategory
  }
  return result
}

/** Returns a copy of `assignments` with `category` applied to every id in `txIds`. */
export function applyCategory(
  assignments: CategoryAssignments,
  txIds: readonly string[],
  category: string | null,
): CategoryAssignments {
  const next = { ...assignments }
  for (const id of txIds) next[id] = category
  return next
}

/** Keeps only the assignments that belong to `txs` (rows may disappear while the modal is open). */
export function restrictAssignments(
  txs: readonly Pick<Transaction, 'id'>[],
  assignments: CategoryAssignments,
): CategoryAssignments {
  const result: CategoryAssignments = {}
  for (const tx of txs) result[tx.id] = assignments[tx.id] ?? null
  return result
}

/** Payload for the split RPC: only rows that have a category. */
export function toSplitAssignments(assignments: CategoryAssignments): SplitAssignment[] {
  return Object.entries(assignments)
    .filter((entry): entry is [string, string] => entry[1] != null)
    .map(([txId, category]) => ({ txId, category }))
}

/** Map of saved categories for the rows that have one. */
export function toTxCategories(assignments: CategoryAssignments): TxCategories {
  return Object.fromEntries(toSplitAssignments(assignments).map((a) => [a.txId, a.category]))
}

/** Number of rows whose category differs from where the modal started. */
export function countChanged(initial: CategoryAssignments, current: CategoryAssignments): number {
  return Object.keys(current).filter((id) => (initial[id] ?? null) !== (current[id] ?? null)).length
}

/** Number of rows without a category. */
export function countUnassigned(assignments: CategoryAssignments): number {
  return Object.values(assignments).filter((c) => c == null).length
}

/** Per-category counts and totals for the modal footer, biggest category first. */
export function summarizeByCategory(
  txs: readonly Pick<Transaction, 'id' | 'amount'>[],
  assignments: CategoryAssignments,
): CategorySummaryRow[] {
  const rows = new Map<string, CategorySummaryRow>()
  for (const tx of txs) {
    const category = assignments[tx.id]
    if (!category) continue
    const row = rows.get(category) ?? { category, count: 0, total: 0 }
    row.count += 1
    row.total += Number(tx.amount)
    rows.set(category, row)
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
}

/** Splits a group into rows that will be saved now and rows that stay in the deck. */
export function partitionByAssignment<T extends Pick<Transaction, 'id'>>(
  txs: readonly T[],
  assignments: CategoryAssignments,
): { assigned: T[]; left: T[] } {
  const assigned: T[] = []
  const left: T[] = []
  for (const tx of txs) {
    if (assignments[tx.id]) assigned.push(tx)
    else left.push(tx)
  }
  return { assigned, left }
}

/** The single category every row shares, or null when rows are mixed or any row is unassigned. */
export function uniformCategory(assignments: CategoryAssignments): string | null {
  const values = Object.values(assignments)
  if (values.length === 0 || values.some((c) => c == null)) return null
  const first = values[0]!
  return values.every((c) => c === first) ? first : null
}

/** True when the saved rows ended up in more than one category. */
export function isMixedCategories(txCategories: TxCategories | undefined): boolean {
  if (!txCategories) return false
  return new Set(Object.values(txCategories)).size > 1
}

/** Number of distinct categories among the saved rows. */
export function distinctCategoryCount(txCategories: TxCategories | undefined): number {
  if (!txCategories) return 0
  return new Set(Object.values(txCategories)).size
}
