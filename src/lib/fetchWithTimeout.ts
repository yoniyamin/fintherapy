export const REQUEST_TIMEOUT_MS = 15_000

/** Wraps fetch so a request that never settles is aborted after `timeoutMs`; a caller-provided signal still aborts it too. */
export function createFetchWithTimeout(
  timeoutMs = REQUEST_TIMEOUT_MS,
  baseFetch: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const callerSignal = init?.signal
    const forwardAbort = () => controller.abort()

    if (callerSignal?.aborted) forwardAbort()
    else callerSignal?.addEventListener('abort', forwardAbort, { once: true })

    try {
      return await baseFetch(input, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', forwardAbort)
    }
  }
}
