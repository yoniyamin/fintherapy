import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPending = [{ id: 'tx-1', status: 'pending' }]
const mockAuto = [{ id: 'tx-2', status: 'auto' }]
const mockPendingFresh = [{ id: 'tx-3', status: 'pending' }]
const mockAutoFresh = [{ id: 'tx-4', status: 'auto' }]

let rpcCallCount = 0

vi.mock('./supabase', () => ({
  supabase: {
    rpc: vi.fn((name: string) => {
      rpcCallCount++
      const isFirstBatch = rpcCallCount <= 2
      if (name === 'get_pending_transactions') {
        return Promise.resolve({
          data: isFirstBatch ? mockPending : mockPendingFresh,
          error: null,
        })
      }
      return Promise.resolve({
        data: isFirstBatch ? mockAuto : mockAutoFresh,
        error: null,
      })
    }),
  },
}))

let fetchShared: typeof import('./pendingTransactionsCache').fetchPendingTransactionsShared
let invalidate: typeof import('./pendingTransactionsCache').invalidatePendingTransactionsInflight

beforeEach(async () => {
  rpcCallCount = 0
  vi.resetModules()
  const mod = await import('./pendingTransactionsCache')
  fetchShared = mod.fetchPendingTransactionsShared
  invalidate = mod.invalidatePendingTransactionsInflight
})

describe('pendingTransactionsCache', () => {
  it('deduplicates concurrent calls for same household', async () => {
    // Arrange & Act
    const p1 = fetchShared('hh-1')
    const p2 = fetchShared('hh-1')

    // Assert
    expect(p1).toBe(p2)
    const result = await p1
    expect(result.pending).toEqual(mockPending)
  })

  it('refetches after invalidation produces stale-then-fresh data', async () => {
    // Arrange
    const stalePromise = fetchShared('hh-1')

    // Act — invalidate while the first fetch is in-flight
    invalidate('hh-1')
    const result = await stalePromise

    // Assert — the generation check should detect staleness and refetch
    expect(result.pending).toEqual(mockPendingFresh)
    expect(result.autoClassified).toEqual(mockAutoFresh)
  })
})
