import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockRpc = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u-1' } } }) },
  },
}))

vi.mock('../lib/pendingTransactionsCache', () => ({
  fetchPendingTransactionsShared: vi.fn().mockResolvedValue({ pending: [], autoClassified: [] }),
  invalidatePendingTransactionsInflight: vi.fn(),
}))

import { useTransactions } from './useTransactions'

const HOUSEHOLD_ID = 'hh-test-1'

describe('useTransactions batch RPCs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('classifyTransactionsBatch', () => {
    it('returns updatedCount from RPC data on success', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: 3, error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.classifyTransactionsBatch(['a', 'b', 'c'], 'food')
      })

      // Assert
      expect(response!.error).toBeNull()
      expect(response!.updatedCount).toBe(3)
    })

    it('returns updatedCount 0 when RPC returns null data', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: null, error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.classifyTransactionsBatch(['a'], 'food')
      })

      // Assert
      expect(response!.updatedCount).toBe(0)
    })

    it('returns error and updatedCount 0 when RPC fails', async () => {
      // Arrange
      const rpcError = { message: 'Batch classify partial: expected 3, updated 1' }
      mockRpc.mockResolvedValue({ data: null, error: rpcError })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.classifyTransactionsBatch(['a', 'b', 'c'], 'food')
      })

      // Assert
      expect(response!.error).toBe(rpcError)
      expect(response!.updatedCount).toBe(0)
    })

    it('returns error without householdId', async () => {
      // Arrange
      const { result } = renderHook(() => useTransactions(null))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.classifyTransactionsBatch(['a'], 'food')
      })

      // Assert
      expect(response!.error).toBeInstanceOf(Error)
      expect(response!.updatedCount).toBe(0)
    })
  })

  describe('flagTransactionsBatch', () => {
    it('returns updatedCount from RPC data', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: 2, error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.flagTransactionsBatch(['a', 'b'])
      })

      // Assert
      expect(response!.error).toBeNull()
      expect(response!.updatedCount).toBe(2)
    })
  })

  describe('markTransferBatch', () => {
    it('returns updatedCount from RPC data', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: 1, error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.markTransferBatch(['a'])
      })

      // Assert
      expect(response!.error).toBeNull()
      expect(response!.updatedCount).toBe(1)
    })
  })

  describe('reclassifyTransactionsBatch', () => {
    it('returns updatedCount from RPC data', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: 4, error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.reclassifyTransactionsBatch(['a', 'b', 'c', 'd'], 'transport')
      })

      // Assert
      expect(response!.error).toBeNull()
      expect(response!.updatedCount).toBe(4)
    })
  })

  describe('revertToPendingBatch', () => {
    it('returns updatedCount from RPC data', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: 2, error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.revertToPendingBatch(['a', 'b'])
      })

      // Assert
      expect(response!.error).toBeNull()
      expect(response!.updatedCount).toBe(2)
    })

    it('detects partial update when data < ids.length', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: 1, error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.revertToPendingBatch(['a', 'b', 'c'])
      })

      // Assert — no error but count mismatch signals partial failure to caller
      expect(response!.error).toBeNull()
      expect(response!.updatedCount).toBe(1)
      expect(response!.updatedCount).not.toBe(3)
    })
  })

  describe('refetchFresh', () => {
    it('returns payload with pending and autoClassified arrays', async () => {
      // Arrange
      const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
      const mockPayload = {
        pending: [{ id: 'tx-1', status: 'pending' }],
        autoClassified: [{ id: 'tx-2', status: 'auto' }],
      }
      vi.mocked(fetchPendingTransactionsShared).mockResolvedValue(mockPayload as never)
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let payload: { pending: unknown[]; autoClassified: unknown[] } | undefined
      await act(async () => {
        payload = await result.current.refetchFresh({ silent: true })
      })

      // Assert
      expect(payload!.pending).toEqual(mockPayload.pending)
      expect(payload!.autoClassified).toEqual(mockPayload.autoClassified)
    })
  })
})
