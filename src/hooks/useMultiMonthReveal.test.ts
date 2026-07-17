import { describe, it, expect } from 'vitest'
import { buildDailyTotals, type DailyTotal } from './useMultiMonthReveal'
import type { ExportRow } from './useTransactions'

function makeTx(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    id: crypto.randomUUID(),
    merchant_raw: 'Shop',
    merchant_clean: 'Shop',
    amount: '-50',
    normalized_amount: '50',
    tx_date: '2024-03-15',
    billing_month: '2024-03',
    category: 'food',
    status: 'manual',
    account_last4: '1234',
    account_type: 'debit' as ExportRow['account_type'],
    classified_by: null,
    user_note: null,
    ...overrides,
  }
}

describe('buildDailyTotals', () => {
  it('aggregates amounts per date', () => {
    // Arrange
    const txs = [
      makeTx({ tx_date: '2024-03-01', normalized_amount: '10' }),
      makeTx({ tx_date: '2024-03-01', normalized_amount: '20' }),
      makeTx({ tx_date: '2024-03-02', normalized_amount: '5' }),
    ]

    // Act
    const result = buildDailyTotals(txs, false)

    // Assert
    expect(result.length).toBe(2)
    const march1 = result.find((d: DailyTotal) => d.date === '2024-03-01')
    expect(march1!.amount).toBe(30)
    expect(march1!.count).toBe(2)
  })

  it('excludes own_transfers when includeOwnTransfers is false', () => {
    // Arrange
    const txs = [
      makeTx({ tx_date: '2024-03-01', category: 'own_transfers' }),
      makeTx({ tx_date: '2024-03-01', category: 'food', normalized_amount: '15' }),
    ]

    // Act
    const result = buildDailyTotals(txs, false)

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.amount).toBe(15)
  })

  it('includes own_transfers when flag is true', () => {
    // Arrange
    const txs = [
      makeTx({ tx_date: '2024-03-01', category: 'own_transfers', normalized_amount: '100' }),
      makeTx({ tx_date: '2024-03-01', category: 'food', normalized_amount: '15' }),
    ]

    // Act
    const result = buildDailyTotals(txs, true)

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.amount).toBe(115)
  })

  it('excludes transfer and offset status', () => {
    // Arrange
    const txs = [
      makeTx({ tx_date: '2024-03-01', status: 'transfer' as ExportRow['status'], normalized_amount: '50' }),
      makeTx({ tx_date: '2024-03-01', status: 'offset' as ExportRow['status'], normalized_amount: '25' }),
      makeTx({ tx_date: '2024-03-01', normalized_amount: '10' }),
    ]

    // Act
    const result = buildDailyTotals(txs, false)

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.amount).toBe(10)
  })

  it('sorts results by date ascending', () => {
    // Arrange
    const txs = [
      makeTx({ tx_date: '2024-03-15' }),
      makeTx({ tx_date: '2024-03-01' }),
      makeTx({ tx_date: '2024-03-10' }),
    ]

    // Act
    const result = buildDailyTotals(txs, false)

    // Assert
    expect(result.map((d: DailyTotal) => d.date)).toEqual(['2024-03-01', '2024-03-10', '2024-03-15'])
  })

  it('returns empty array for no transactions', () => {
    expect(buildDailyTotals([], false)).toEqual([])
  })
})
