import { describe, expect, it } from 'vitest'
import { classifyStackKey, defaultRefundMonth, isRefundAmount } from './refundDetection'

describe('refundDetection', () => {
  describe('isRefundAmount', () => {
    it('treats a positive amount on a credit card as a refund', () => {
      // Arrange & Act
      const result = isRefundAmount(392.36, ['credit'])

      // Assert
      expect(result).toBe(true)
    })

    it('treats a positive amount on an unknown account type as a refund', () => {
      // Arrange & Act
      const result = isRefundAmount(10, [undefined])

      // Assert
      expect(result).toBe(true)
    })

    it('does not treat a positive amount on debit-only cards as a refund (card load)', () => {
      // Arrange & Act
      const result = isRefundAmount(100, ['debit', 'debit'])

      // Assert
      expect(result).toBe(false)
    })

    it('does not treat spend (negative amount) as a refund', () => {
      // Arrange & Act
      const result = isRefundAmount(-25, ['credit'])

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('classifyStackKey', () => {
    const base = { merchant_raw: ' Amazon ', billing_month: '2026-10 ' }

    it('separates refunds from purchases of the same merchant and month', () => {
      // Arrange
      const purchase = { ...base, amount: -20 }
      const refund = { ...base, amount: 20 }

      // Act & Assert
      expect(classifyStackKey(purchase)).not.toBe(classifyStackKey(refund))
    })

    it('groups same-direction transactions together', () => {
      // Arrange
      const a = { ...base, amount: -20 }
      const b = { ...base, amount: -5 }

      // Act & Assert
      expect(classifyStackKey(a)).toBe(classifyStackKey(b))
    })
  })

  describe('defaultRefundMonth', () => {
    it('returns the trimmed billing month of the first transaction', () => {
      // Arrange & Act
      const result = defaultRefundMonth([{ billing_month: '2026-10 ' }])

      // Assert
      expect(result).toBe('2026-10')
    })

    it('returns null for an empty stack', () => {
      // Arrange & Act
      const result = defaultRefundMonth([])

      // Assert
      expect(result).toBeNull()
    })
  })
})
