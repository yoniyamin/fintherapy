import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockRpc = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

import { useMerchantKnowledge } from './useMerchantKnowledge'

const HOUSEHOLD_ID = 'hh-test-1'

describe('useMerchantKnowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('confirmAutoClassifiedBatch', () => {
    it('returns updatedCount from RPC data on success', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: 3, error: null })
      const { result } = renderHook(() => useMerchantKnowledge(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.confirmAutoClassifiedBatch(['a', 'b', 'c'])
      })

      // Assert
      expect(response!.error).toBeNull()
      expect(response!.updatedCount).toBe(3)
    })

    it('returns updatedCount 0 when RPC returns null data', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: null, error: null })
      const { result } = renderHook(() => useMerchantKnowledge(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.confirmAutoClassifiedBatch(['a'])
      })

      // Assert
      expect(response!.updatedCount).toBe(0)
    })

    it('returns error and updatedCount 0 without householdId', async () => {
      // Arrange
      const { result } = renderHook(() => useMerchantKnowledge(null))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.confirmAutoClassifiedBatch(['a'])
      })

      // Assert
      expect(response!.error).toBeInstanceOf(Error)
      expect(response!.updatedCount).toBe(0)
    })

    it('detects partial update via count mismatch', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: 1, error: null })
      const { result } = renderHook(() => useMerchantKnowledge(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedCount: number } | undefined
      await act(async () => {
        response = await result.current.confirmAutoClassifiedBatch(['a', 'b', 'c'])
      })

      // Assert — caller checks updatedCount !== ids.length
      expect(response!.error).toBeNull()
      expect(response!.updatedCount).toBe(1)
    })
  })
})
