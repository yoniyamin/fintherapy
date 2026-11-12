import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockRpc = vi.fn()
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } })

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
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

  describe('classifyTransactionsSplit', () => {
    const assignments = [
      { txId: 'a', category: 'food' },
      { txId: 'b', category: 'transport' },
    ]

    it('sends one JSON assignment per transaction and returns the ids the server updated', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: ['a', 'b'], error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedIds: string[] } | undefined
      await act(async () => {
        response = await result.current.classifyTransactionsSplit(assignments)
      })

      // Assert
      expect(mockRpc).toHaveBeenCalledWith('classify_transactions_split', {
        p_household_id: HOUSEHOLD_ID,
        p_assignments: [
          { tx_id: 'a', category: 'food' },
          { tx_id: 'b', category: 'transport' },
        ],
        p_reclassify: false,
      })
      expect(response!.error).toBeNull()
      expect(response!.updatedIds).toEqual(['a', 'b'])
    })

    it('passes the reclassify flag for Recent-panel edits', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: ['a', 'b'], error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      await act(async () => {
        await result.current.classifyTransactionsSplit(assignments, { reclassify: true })
      })

      // Assert
      expect(mockRpc).toHaveBeenCalledWith(
        'classify_transactions_split',
        expect.objectContaining({ p_reclassify: true }),
      )
    })

    it('returns only the updated ids when another member already classified some rows, without an error', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: ['a'], error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedIds: string[] } | undefined
      await act(async () => {
        response = await result.current.classifyTransactionsSplit(assignments)
      })

      // Assert
      expect(response!.error).toBeNull()
      expect(response!.updatedIds).toEqual(['a'])
    })

    it('returns an empty list when the RPC returns null data', async () => {
      // Arrange
      mockRpc.mockResolvedValue({ data: null, error: null })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedIds: string[] } | undefined
      await act(async () => {
        response = await result.current.classifyTransactionsSplit(assignments)
      })

      // Assert
      expect(response!.updatedIds).toEqual([])
    })

    it('returns the RPC error and no updated ids when the call fails', async () => {
      // Arrange
      const rpcError = { message: 'boom' }
      mockRpc.mockResolvedValue({ data: null, error: rpcError })
      const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

      // Act
      let response: { error: unknown; updatedIds: string[] } | undefined
      await act(async () => {
        response = await result.current.classifyTransactionsSplit(assignments)
      })

      // Assert
      expect(response!.error).toBe(rpcError)
      expect(response!.updatedIds).toEqual([])
    })

    it('returns an error without calling the RPC when there is no household', async () => {
      // Arrange
      const { result } = renderHook(() => useTransactions(null))

      // Act
      let response: { error: unknown; updatedIds: string[] } | undefined
      await act(async () => {
        response = await result.current.classifyTransactionsSplit(assignments)
      })

      // Assert
      expect(response!.error).toBeInstanceOf(Error)
      expect(mockRpc).not.toHaveBeenCalled()
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
      let payload: { pending: unknown[]; autoClassified: unknown[]; stale: boolean } | undefined
      await act(async () => {
        payload = await result.current.refetchFresh({ silent: true })
      })

      // Assert
      expect(payload!.pending).toEqual(mockPayload.pending)
      expect(payload!.autoClassified).toEqual(mockPayload.autoClassified)
      expect(payload!.stale).toBe(false)
    })
  })
})

describe('useTransactions load failures', () => {
  const loaded = {
    pending: [{ id: 'tx-1', status: 'pending' }],
    autoClassified: [{ id: 'tx-2', status: 'auto' }],
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    vi.mocked(fetchPendingTransactionsShared).mockReset().mockResolvedValue(loaded as never)
  })

  it('reports a failed first load instead of presenting an empty queue as loaded', async () => {
    // Arrange
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    vi.mocked(fetchPendingTransactionsShared).mockReset().mockRejectedValue(new Error('request timed out'))

    // Act
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Assert
    expect(result.current.loadError?.message).toBe('request timed out')
    expect(result.current.transactions).toEqual([])
  })

  it('keeps the previous queue when a later load fails, and clears the error once a load succeeds', async () => {
    // Arrange
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))
    await waitFor(() => expect(result.current.transactions).toEqual(loaded.pending))
    vi.mocked(fetchPendingTransactionsShared).mockRejectedValueOnce(new Error('offline'))

    // Act
    await act(async () => {
      await result.current.fetchPending({ silent: true })
    })

    // Assert
    expect(result.current.loadError?.message).toBe('offline')
    expect(result.current.transactions).toEqual(loaded.pending)

    // Act
    await act(async () => {
      await result.current.fetchPending({ silent: true })
    })

    // Assert
    expect(result.current.loadError).toBeNull()
  })

  it('propagates a failed refetchFresh and leaves the queue untouched', async () => {
    // Arrange
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))
    await waitFor(() => expect(result.current.transactions).toEqual(loaded.pending))
    vi.mocked(fetchPendingTransactionsShared).mockRejectedValueOnce(new Error('timeout'))

    // Act & Assert
    await act(async () => {
      await expect(result.current.refetchFresh({ silent: true })).rejects.toThrow('timeout')
    })
    expect(result.current.transactions).toEqual(loaded.pending)
  })

  it('reports a failed no-idea load instead of an empty flagged queue', async () => {
    // Arrange
    mockRpc.mockResolvedValue({ data: null, error: { message: 'request timed out' } })

    // Act
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID, 'no-idea'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Assert
    expect(result.current.loadError?.message).toBe('request timed out')
  })
})

describe('useTransactions stale refresh guard', () => {
  const loaded = {
    pending: [{ id: 'tx-1', status: 'pending' }, { id: 'tx-2', status: 'pending' }],
    autoClassified: [],
  }

  /** Returns a promise plus its resolver so a test controls when a fetch settles. */
  const deferred = <T,>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRpc.mockReset().mockResolvedValue({ data: 0, error: null })
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    vi.mocked(fetchPendingTransactionsShared).mockReset().mockResolvedValue(loaded as never)
  })

  it('discards a slower refetch that started before a local removal, but still returns its payload', async () => {
    // Arrange
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))
    await waitFor(() => expect(result.current.transactions).toEqual(loaded.pending))
    const slow = deferred<typeof loaded>()
    vi.mocked(fetchPendingTransactionsShared).mockReturnValueOnce(slow.promise as never)

    // Act
    let refetch!: Promise<{ pending: unknown[]; stale: boolean }>
    act(() => {
      refetch = result.current.refetchFresh({ silent: true })
    })
    act(() => {
      result.current.removeTransactions(['tx-1'])
    })
    let payload!: { pending: unknown[]; stale: boolean }
    await act(async () => {
      slow.resolve(loaded)
      payload = await refetch
    })

    // Assert
    expect(payload.stale).toBe(true)
    expect(payload.pending).toEqual(loaded.pending)
    expect(result.current.transactions.map((t) => t.id)).toEqual(['tx-2'])
  })

  it('marks an older detectRefundsAndRefresh as stale when a newer refetch finished first', async () => {
    // Arrange
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))
    await waitFor(() => expect(result.current.transactions).toEqual(loaded.pending))
    const older = deferred<typeof loaded>()
    const newer = { pending: [{ id: 'tx-2', status: 'pending' }], autoClassified: [] }
    vi.mocked(fetchPendingTransactionsShared)
      .mockReturnValueOnce(older.promise as never)
      .mockResolvedValueOnce(newer as never)

    // Act
    let detect!: Promise<{ stale: boolean }>
    act(() => {
      detect = result.current.detectRefundsAndRefresh()
    })
    await waitFor(() => expect(fetchPendingTransactionsShared).toHaveBeenCalledTimes(2))
    await act(async () => {
      await result.current.refetchFresh({ silent: true })
    })
    let detectResult!: { stale: boolean }
    await act(async () => {
      older.resolve(loaded)
      detectResult = await detect
    })

    // Assert
    expect(detectResult.stale).toBe(true)
    expect(result.current.transactions).toEqual(newer.pending)
  })

  it('propagates a failed detectRefundsAndRefresh and leaves the queue untouched', async () => {
    // Arrange
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))
    await waitFor(() => expect(result.current.transactions).toEqual(loaded.pending))
    vi.mocked(fetchPendingTransactionsShared).mockRejectedValueOnce(new Error('timeout'))

    // Act & Assert
    await act(async () => {
      await expect(result.current.detectRefundsAndRefresh()).rejects.toThrow('timeout')
    })
    expect(result.current.transactions).toEqual(loaded.pending)
  })

  it('applies detectRefundsAndRefresh when nothing superseded it', async () => {
    // Arrange
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))
    await waitFor(() => expect(result.current.transactions).toEqual(loaded.pending))
    const refreshed = { pending: [{ id: 'tx-2', status: 'pending' }], autoClassified: [] }
    vi.mocked(fetchPendingTransactionsShared).mockResolvedValueOnce(refreshed as never)

    // Act
    let detectResult!: { stale: boolean }
    await act(async () => {
      detectResult = await result.current.detectRefundsAndRefresh()
    })

    // Assert
    expect(detectResult.stale).toBe(false)
    expect(result.current.transactions).toEqual(refreshed.pending)
  })
})

describe('useTransactions awardXp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mockRpc.mockReset().mockResolvedValue({ data: null, error: null })
    mockGetSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } })
  })

  it('awards XP for the locally cached session user', async () => {
    // Arrange
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

    // Act
    let response!: { error: unknown }
    await act(async () => {
      response = await result.current.awardXp(10)
    })

    // Assert
    expect(response.error).toBeNull()
    expect(mockRpc).toHaveBeenCalledWith('award_xp', { p_user_id: 'u-1', p_xp: 10 })
  })

  it('returns an error instead of throwing when the session lookup fails', async () => {
    // Arrange
    mockGetSession.mockRejectedValueOnce(new Error('lock timeout'))
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))

    // Act
    let response!: { error: unknown }
    await act(async () => {
      response = await result.current.awardXp(10)
    })

    // Assert
    expect((response.error as Error).message).toBe('lock timeout')
    expect(mockRpc).not.toHaveBeenCalledWith('award_xp', expect.anything())
  })
})

describe('useTransactions refetchFresh spinner', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    vi.mocked(fetchPendingTransactionsShared).mockReset().mockResolvedValue({ pending: [{ id: 'tx-1' }], autoClassified: [] } as never)
  })

  it('does not show the blocking spinner when the same deck was already loaded', async () => {
    // Arrange
    const { fetchPendingTransactionsShared } = await import('../lib/pendingTransactionsCache')
    const { result } = renderHook(() => useTransactions(HOUSEHOLD_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let finish!: (value: never) => void
    vi.mocked(fetchPendingTransactionsShared).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }) as never)

    // Act
    let refetch!: Promise<unknown>
    act(() => {
      refetch = result.current.refetchFresh()
    })

    // Assert
    expect(result.current.loading).toBe(false)
    await act(async () => {
      finish({ pending: [], autoClassified: [] } as never)
      await refetch
    })
  })
})