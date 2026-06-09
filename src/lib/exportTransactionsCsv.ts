import type { ExportRow } from '../hooks/useTransactions'

/** Downloads classified transactions as a CSV file. */
export function downloadTransactionsCsv(
  rows: ExportRow[],
  fileLabel: string,
  catLabelLookup: Record<string, string>,
): void {
  const headers = [
    'Date',
    'Merchant',
    'Merchant (Clean)',
    'Amount',
    'Category',
    'Status',
    'Month',
    'Account Last 4',
    'Note',
  ]
  const csvLines = [
    headers.join(','),
    ...rows.map(r => [
      r.tx_date,
      `"${(r.merchant_raw ?? '').replace(/"/g, '""')}"`,
      `"${(r.merchant_clean ?? '').replace(/"/g, '""')}"`,
      r.amount,
      catLabelLookup[r.category] ?? r.category,
      r.status,
      r.billing_month,
      r.account_last4 ?? '',
      `"${(r.user_note ?? '').replace(/"/g, '""')}"`,
    ].join(',')),
  ]
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `financial-therapy-${fileLabel}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Builds a file label for multi-month CSV export (e.g. `2025-04-to-2025-06`). */
export function multiMonthCsvLabel(months: string[]): string {
  const sorted = [...months].sort()
  if (sorted.length === 1) return sorted[0]
  return `${sorted[0]}-to-${sorted[sorted.length - 1]}`
}
