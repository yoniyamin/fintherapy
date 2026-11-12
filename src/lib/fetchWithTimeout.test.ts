import { createFetchWithTimeout } from './fetchWithTimeout'

/** A fetch stub that never responds and rejects with an AbortError once its signal aborts (immediately if it already has). */
function neverSettlingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'))
        if (init?.signal?.aborted) abort()
        else init?.signal?.addEventListener('abort', abort)
      }),
  )
}

describe('createFetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the response when the request settles before the timeout', async () => {
    // Arrange
    const response = new Response('ok')
    const baseFetch = vi.fn().mockResolvedValue(response)
    const timeoutFetch = createFetchWithTimeout(1000, baseFetch)

    // Act
    const result = await timeoutFetch('https://example.test/rpc')

    // Assert
    expect(result).toBe(response)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts a request that never settles once the timeout elapses', async () => {
    // Arrange
    const timeoutFetch = createFetchWithTimeout(1000, neverSettlingFetch())
    const pending = timeoutFetch('https://example.test/rpc')
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })

    // Act
    await vi.advanceTimersByTimeAsync(1000)

    // Assert
    await assertion
  })

  it('does not abort before the timeout elapses', async () => {
    // Arrange
    const baseFetch = neverSettlingFetch()
    const timeoutFetch = createFetchWithTimeout(1000, baseFetch)
    void timeoutFetch('https://example.test/rpc').catch(() => undefined)

    // Act
    await vi.advanceTimersByTimeAsync(999)

    // Assert
    const signal = baseFetch.mock.calls[0]![1]!.signal!
    expect(signal.aborted).toBe(false)
  })

  it('aborts when the caller signal aborts', async () => {
    // Arrange
    const caller = new AbortController()
    const timeoutFetch = createFetchWithTimeout(1000, neverSettlingFetch())
    const pending = timeoutFetch('https://example.test/rpc', { signal: caller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' })

    // Act
    caller.abort()

    // Assert
    await assertion
  })

  it('aborts immediately when the caller signal is already aborted', async () => {
    // Arrange
    const caller = new AbortController()
    caller.abort()
    const timeoutFetch = createFetchWithTimeout(1000, neverSettlingFetch())

    // Act & Assert
    await expect(
      timeoutFetch('https://example.test/rpc', { signal: caller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('keeps the original request options', async () => {
    // Arrange
    const baseFetch = vi.fn().mockResolvedValue(new Response('ok'))
    const timeoutFetch = createFetchWithTimeout(1000, baseFetch)

    // Act
    await timeoutFetch('https://example.test/rpc', { method: 'POST', body: '{}' })

    // Assert
    expect(baseFetch).toHaveBeenCalledWith(
      'https://example.test/rpc',
      expect.objectContaining({ method: 'POST', body: '{}', signal: expect.any(AbortSignal) }),
    )
  })
})
