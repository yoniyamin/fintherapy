import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn().mockReturnValue({ marker: 'real-client' })
const timeoutFetch = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('./fetchWithTimeout', () => ({
  createFetchWithTimeout: () => timeoutFetch,
}))

describe('supabase client', () => {
  beforeEach(() => {
    vi.resetModules()
    mockCreateClient.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates the client with the request-timeout fetch so a stalled request cannot hang forever', async () => {
    // Arrange
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    // Act
    await import('./supabase')

    // Assert
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    const options = mockCreateClient.mock.calls[0]![2] as { global: { fetch: unknown } }
    expect(options.global.fetch).toBe(timeoutFetch)
  })
})
