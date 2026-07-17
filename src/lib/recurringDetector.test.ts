import { describe, it, expect } from 'vitest'
import { detectRecurring, type RecurringCharge } from './recurringDetector'
import type { ExportRow } from '../hooks/useTransactions'

function makeTx(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    id: crypto.randomUUID(),
    merchant_raw: 'NETFLIX',
    merchant_clean: 'Netflix',
    amount: '-15.99',
    normalized_amount: '15.99',
    tx_date: '2024-01-15',
    billing_month: '2024-01',
    category: 'entertainment',
    status: 'manual',
    account_last4: '1234',
    account_type: 'debit' as ExportRow['account_type'],
    classified_by: null,
    user_note: null,
    ...overrides,
  }
}

function makeMonths(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(2024, i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

describe('detectRecurring', () => {
  it('returns empty when fewer than 3 months provided', () => {
    // Arrange
    const months = ['2024-01', '2024-02']
    const txs = months.map((m) => makeTx({ billing_month: m }))

    // Act
    const result = detectRecurring(txs, months)

    // Assert
    expect(result).toEqual([])
  })

  it('detects a charge appearing in 3+ months with similar amounts', () => {
    // Arrange
    const months = makeMonths(4)
    const txs = months.map((m) =>
      makeTx({ billing_month: m, amount: '-15.99', normalized_amount: '15.99' }),
    )

    // Act
    const result = detectRecurring(txs, months)

    // Assert
    expect(result.length).toBe(1)
    expect(result[0]!.merchantClean).toBe('NETFLIX')
    expect(result[0]!.frequency).toBe(4)
    expect(result[0]!.avgAmount).toBeCloseTo(15.99, 1)
  })

  it('excludes transfers and offset transactions', () => {
    // Arrange
    const months = makeMonths(4)
    const txs = months.map((m) =>
      makeTx({ billing_month: m, status: 'transfer' as ExportRow['status'] }),
    )

    // Act
    const result = detectRecurring(txs, months)

    // Assert
    expect(result).toEqual([])
  })

  it('excludes own_transfers category', () => {
    // Arrange
    const months = makeMonths(4)
    const txs = months.map((m) =>
      makeTx({ billing_month: m, category: 'own_transfers' }),
    )

    // Act
    const result = detectRecurring(txs, months)

    // Assert
    expect(result).toEqual([])
  })

  it('rejects highly variable amounts (CV > 0.3)', () => {
    // Arrange
    const months = makeMonths(4)
    const amounts = ['10', '50', '5', '80']
    const txs = months.map((m, i) =>
      makeTx({ billing_month: m, amount: `-${amounts[i]}`, normalized_amount: amounts[i] }),
    )

    // Act
    const result = detectRecurring(txs, months)

    // Assert
    expect(result).toEqual([])
  })

  it('splits same merchant into amount tiers', () => {
    // Arrange
    const months = makeMonths(4)
    const txs = [
      ...months.map((m) => makeTx({ billing_month: m, normalized_amount: '15.99' })),
      ...months.map((m) => makeTx({ billing_month: m, normalized_amount: '100.00' })),
    ]

    // Act
    const result = detectRecurring(txs, months)

    // Assert
    expect(result.length).toBe(2)
    const avgAmounts = result.map((r: RecurringCharge) => r.avgAmount).sort((a, b) => a - b)
    expect(avgAmounts[0]).toBeCloseTo(15.99, 1)
    expect(avgAmounts[1]).toBeCloseTo(100, 1)
  })

  it('sorts results by monthlyEstimate descending', () => {
    // Arrange
    const months = makeMonths(4)
    const txs = [
      ...months.map((m) =>
        makeTx({ merchant_raw: 'CHEAP', merchant_clean: 'Cheap', billing_month: m, normalized_amount: '5' }),
      ),
      ...months.map((m) =>
        makeTx({ merchant_raw: 'EXPENSIVE', merchant_clean: 'Expensive', billing_month: m, normalized_amount: '200' }),
      ),
    ]

    // Act
    const result = detectRecurring(txs, months)

    // Assert
    expect(result[0]!.merchantClean).toBe('EXPENSIVE')
    expect(result[1]!.merchantClean).toBe('CHEAP')
  })
})
