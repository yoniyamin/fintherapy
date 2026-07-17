import { describe, it, expect, beforeEach } from 'vitest'
import { useClassificationStore } from './classificationStore'
import type { Transaction } from '../types/database'

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    household_id: 'hh-1',
    merchant_raw: 'Starbucks',
    merchant_clean: null,
    amount: 5.5,
    tx_date: '2024-03-15',
    billing_month: '2024-03',
    category: null,
    status: 'pending',
    uploaded_by: 'u-1',
    classified_by: null,
    classified_at: null,
    created_at: '2024-03-15T10:00:00Z',
    account_last4: '1234',
    account_type: 'debit',
    user_note: null,
    ...overrides,
  } as Transaction
}

describe('classificationStore', () => {
  beforeEach(() => {
    useClassificationStore.getState().reset()
  })

  describe('load', () => {
    it('groups transactions by merchant + billing month', () => {
      // Arrange
      const txs = [
        makeTx({ merchant_raw: 'Starbucks', billing_month: '2024-03' }),
        makeTx({ merchant_raw: 'Starbucks', billing_month: '2024-03' }),
        makeTx({ merchant_raw: 'Amazon', billing_month: '2024-03' }),
      ]

      // Act
      useClassificationStore.getState().load(txs)

      // Assert
      const { groups } = useClassificationStore.getState()
      expect(groups.length).toBe(2)
      const starbucksGroup = groups.find((g) => g.merchantRaw === 'Starbucks')
      expect(starbucksGroup?.count).toBe(2)
    })

    it('does not merge same merchant across different billing months', () => {
      // Arrange
      const txs = [
        makeTx({ merchant_raw: 'Starbucks', billing_month: '2024-01' }),
        makeTx({ merchant_raw: 'Starbucks', billing_month: '2024-02' }),
      ]

      // Act
      useClassificationStore.getState().load(txs)

      // Assert
      const { groups } = useClassificationStore.getState()
      expect(groups.length).toBe(2)
    })

    it('resets counters on load', () => {
      // Arrange
      const store = useClassificationStore.getState()
      store.load([makeTx()])
      store.advance(1)
      store.addSessionXp(50)

      // Act
      store.load([makeTx()])

      // Assert
      const state = useClassificationStore.getState()
      expect(state.completedCount).toBe(0)
      expect(state.classifiedTxCount).toBe(0)
      expect(state.sessionXpEarned).toBe(0)
      expect(state.flaggedCount).toBe(0)
    })
  })

  describe('advance', () => {
    it('increments completedCount and classifiedTxCount', () => {
      // Arrange
      const txs = [makeTx(), makeTx({ merchant_raw: 'Amazon' })]
      useClassificationStore.getState().load(txs)

      // Act
      useClassificationStore.getState().advance(3)

      // Assert
      const state = useClassificationStore.getState()
      expect(state.completedCount).toBe(1)
      expect(state.classifiedTxCount).toBe(3)
      expect(state.currentIndex).toBe(1)
    })
  })

  describe('addSessionXp', () => {
    it('accumulates XP across multiple calls', () => {
      // Act
      useClassificationStore.getState().addSessionXp(10)
      useClassificationStore.getState().addSessionXp(5)
      useClassificationStore.getState().addSessionXp(20)

      // Assert
      expect(useClassificationStore.getState().sessionXpEarned).toBe(35)
    })
  })

  describe('flag', () => {
    it('increments flaggedCount and advances', () => {
      // Arrange
      useClassificationStore.getState().load([makeTx(), makeTx({ merchant_raw: 'X' })])

      // Act
      useClassificationStore.getState().flag()

      // Assert
      const state = useClassificationStore.getState()
      expect(state.flaggedCount).toBe(1)
      expect(state.currentIndex).toBe(1)
    })
  })

  describe('markTransfer', () => {
    it('increments transferCount and advances', () => {
      // Arrange
      useClassificationStore.getState().load([makeTx(), makeTx({ merchant_raw: 'X' })])

      // Act
      useClassificationStore.getState().markTransfer()

      // Assert
      expect(useClassificationStore.getState().transferCount).toBe(1)
    })
  })

  describe('predictedCategory', () => {
    it('sets predictedCategory when all txs in group are auto with same category', () => {
      // Arrange
      const txs = [
        makeTx({ status: 'auto', category: 'food' }),
        makeTx({ status: 'auto', category: 'food' }),
      ]

      // Act
      useClassificationStore.getState().load(txs)

      // Assert
      const { groups } = useClassificationStore.getState()
      expect(groups[0]!.predictedCategory).toBe('food')
    })

    it('sets predictedCategory to null when categories differ', () => {
      // Arrange
      const txs = [
        makeTx({ status: 'auto', category: 'food' }),
        makeTx({ status: 'auto', category: 'transport' }),
      ]

      // Act
      useClassificationStore.getState().load(txs)

      // Assert
      const { groups } = useClassificationStore.getState()
      expect(groups[0]!.predictedCategory).toBeNull()
    })

    it('sets predictedCategory to null when mix of pending and auto', () => {
      // Arrange
      const txs = [
        makeTx({ status: 'pending', category: null }),
        makeTx({ status: 'auto', category: 'food' }),
      ]

      // Act
      useClassificationStore.getState().load(txs)

      // Assert
      const { groups } = useClassificationStore.getState()
      expect(groups[0]!.predictedCategory).toBeNull()
    })
  })

  describe('recordAction / rollbackAction', () => {
    it('records and rolls back a classified action including XP', () => {
      // Arrange
      useClassificationStore.getState().load([makeTx()])
      useClassificationStore.getState().advance(2)
      useClassificationStore.getState().addSessionXp(20)

      // Act
      const action = useClassificationStore.getState().recordAction({
        kind: 'classified',
        category: 'food',
        merchantRaw: 'Starbucks',
        merchantClean: null,
        txSnapshots: [],
        totalAmount: 5.5,
        count: 2,
        xpEarned: 20,
      })
      useClassificationStore.getState().rollbackAction(action.id)

      // Assert
      const state = useClassificationStore.getState()
      expect(state.sessionHistory.length).toBe(0)
      expect(state.completedCount).toBe(0)
      expect(state.classifiedTxCount).toBe(0)
      expect(state.sessionXpEarned).toBe(0)
    })

    it('rollback deducts xpEarned from sessionXpEarned', () => {
      // Arrange
      useClassificationStore.getState().addSessionXp(50)
      const action = useClassificationStore.getState().recordAction({
        kind: 'auto-confirmed',
        category: 'transport',
        merchantRaw: 'Uber',
        merchantClean: 'Uber',
        txSnapshots: [],
        totalAmount: 12,
        count: 3,
        xpEarned: 15,
      })

      // Act
      useClassificationStore.getState().rollbackAction(action.id)

      // Assert
      expect(useClassificationStore.getState().sessionXpEarned).toBe(35)
    })
  })

  describe('reset', () => {
    it('clears all state including sessionXpEarned', () => {
      // Arrange
      useClassificationStore.getState().load([makeTx()])
      useClassificationStore.getState().advance(1)
      useClassificationStore.getState().addSessionXp(50)

      // Act
      useClassificationStore.getState().reset()

      // Assert
      const state = useClassificationStore.getState()
      expect(state.groups).toEqual([])
      expect(state.sessionXpEarned).toBe(0)
      expect(state.completedCount).toBe(0)
      expect(state.sessionHistory).toEqual([])
    })
  })
})
