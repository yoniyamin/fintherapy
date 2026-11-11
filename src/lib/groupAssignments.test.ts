import { describe, it, expect } from 'vitest'
import {
  applyCategory,
  buildInitialAssignments,
  countChanged,
  countUnassigned,
  distinctCategoryCount,
  isMixedCategories,
  partitionByAssignment,
  restrictAssignments,
  summarizeByCategory,
  toSplitAssignments,
  toTxCategories,
  uniformCategory,
} from './groupAssignments'

const txs = [
  { id: 'a', amount: 10 },
  { id: 'b', amount: 5.5 },
  { id: 'c', amount: 4.5 },
]

describe('groupAssignments', () => {
  describe('buildInitialAssignments', () => {
    it('starts every row on the group category', () => {
      // Arrange & Act
      const result = buildInitialAssignments(txs, 'food')

      // Assert
      expect(result).toEqual({ a: 'food', b: 'food', c: 'food' })
    })

    it('starts every row unassigned when the group has no category', () => {
      // Arrange & Act
      const result = buildInitialAssignments(txs, null)

      // Assert
      expect(result).toEqual({ a: null, b: null, c: null })
    })

    it('prefers per-row categories over the group category', () => {
      // Arrange & Act
      const result = buildInitialAssignments(txs, null, { a: 'food', c: 'transport' })

      // Assert
      expect(result).toEqual({ a: 'food', b: null, c: 'transport' })
    })
  })

  describe('applyCategory', () => {
    it('applies a category to the given ids without mutating the input', () => {
      // Arrange
      const original = { a: 'food', b: 'food', c: 'food' }

      // Act
      const result = applyCategory(original, ['b', 'c'], 'transport')

      // Assert
      expect(result).toEqual({ a: 'food', b: 'transport', c: 'transport' })
      expect(original.b).toBe('food')
    })

    it('can clear rows back to unassigned', () => {
      // Arrange & Act
      const result = applyCategory({ a: 'food' }, ['a'], null)

      // Assert
      expect(result.a).toBeNull()
    })
  })

  describe('toSplitAssignments / toTxCategories', () => {
    it('only includes rows that have a category', () => {
      // Arrange
      const assignments = { a: 'food', b: null, c: 'transport' }

      // Act & Assert
      expect(toSplitAssignments(assignments)).toEqual([
        { txId: 'a', category: 'food' },
        { txId: 'c', category: 'transport' },
      ])
      expect(toTxCategories(assignments)).toEqual({ a: 'food', c: 'transport' })
    })
  })

  describe('restrictAssignments', () => {
    it('drops ids that are no longer part of the rows and fills missing ones with null', () => {
      // Arrange
      const assignments = { a: 'food', gone: 'food' }

      // Act
      const result = restrictAssignments([{ id: 'a' }, { id: 'b' }], assignments)

      // Assert
      expect(result).toEqual({ a: 'food', b: null })
    })
  })

  describe('countChanged / countUnassigned', () => {
    it('counts rows that differ from the starting values', () => {
      // Arrange
      const initial = { a: 'food', b: 'food', c: 'food' }
      const current = { a: 'food', b: 'transport', c: null }

      // Act & Assert
      expect(countChanged(initial, current)).toBe(2)
      expect(countUnassigned(current)).toBe(1)
    })

    it('reports zero changes when nothing was touched', () => {
      // Arrange
      const initial = { a: 'food', b: null }

      // Act & Assert
      expect(countChanged(initial, { ...initial })).toBe(0)
    })
  })

  describe('summarizeByCategory', () => {
    it('totals count and amount per category, biggest category first, skipping unassigned rows', () => {
      // Arrange
      const assignments = { a: 'transport', b: 'food', c: 'food' }

      // Act
      const result = summarizeByCategory(txs, assignments)

      // Assert
      expect(result).toEqual([
        { category: 'food', count: 2, total: 10 },
        { category: 'transport', count: 1, total: 10 },
      ])
    })

    it('ignores unassigned rows', () => {
      // Arrange & Act
      const result = summarizeByCategory(txs, { a: null, b: null, c: 'food' })

      // Assert
      expect(result).toEqual([{ category: 'food', count: 1, total: 4.5 }])
    })
  })

  describe('partitionByAssignment', () => {
    it('separates rows to save now from rows that stay in the deck', () => {
      // Arrange
      const assignments = { a: 'food', b: null, c: 'food' }

      // Act
      const { assigned, left } = partitionByAssignment(txs, assignments)

      // Assert
      expect(assigned.map((t) => t.id)).toEqual(['a', 'c'])
      expect(left.map((t) => t.id)).toEqual(['b'])
    })
  })

  describe('uniformCategory', () => {
    it('returns the shared category when every row matches', () => {
      expect(uniformCategory({ a: 'food', b: 'food' })).toBe('food')
    })

    it('returns null when rows are mixed', () => {
      expect(uniformCategory({ a: 'food', b: 'transport' })).toBeNull()
    })

    it('returns null when any row is unassigned, so a partial save never teaches the merchant', () => {
      expect(uniformCategory({ a: 'food', b: null })).toBeNull()
    })

    it('returns null for an empty set', () => {
      expect(uniformCategory({})).toBeNull()
    })
  })

  describe('isMixedCategories / distinctCategoryCount', () => {
    it('is mixed only when more than one category was saved', () => {
      expect(isMixedCategories({ a: 'food', b: 'transport' })).toBe(true)
      expect(isMixedCategories({ a: 'food', b: 'food' })).toBe(false)
      expect(isMixedCategories(undefined)).toBe(false)
    })

    it('counts distinct categories', () => {
      expect(distinctCategoryCount({ a: 'food', b: 'transport', c: 'food' })).toBe(2)
      expect(distinctCategoryCount(undefined)).toBe(0)
    })
  })
})
