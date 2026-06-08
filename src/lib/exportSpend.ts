import type { ExportRow } from '../hooks/useTransactions'

/** Signed spend from export rows (positive = money out, after card-type normalization). */
export function exportSpendAmount(tx: ExportRow): number {
  return Number(tx.normalized_amount ?? tx.amount)
}

/** Magnitude for display (always non-negative). */
export function exportSpendMagnitude(tx: ExportRow): number {
  return Math.abs(exportSpendAmount(tx))
}

/** True when the row represents spending outflow (not cashback / card loads). */
export function isSpendingOutflow(tx: ExportRow): boolean {
  return exportSpendAmount(tx) > 0
}

/** Sort export rows by largest spending outflow first. */
export function compareExportSpendDesc(a: ExportRow, b: ExportRow): number {
  return exportSpendAmount(b) - exportSpendAmount(a)
}

/** Spending outflows only, largest first. */
export function topSpendingTransactions(transactions: ExportRow[], limit: number): ExportRow[] {
  return [...transactions].filter(isSpendingOutflow).sort(compareExportSpendDesc).slice(0, limit)
}
