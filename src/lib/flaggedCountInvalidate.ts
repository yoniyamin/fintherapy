/** Bump subscribed hooks (Home badge, Classify nav) after flagged-queue mutations. */

type InvalidateCb = () => void

const subscribers = new Set<InvalidateCb>()

export function subscribeFlaggedCountInvalidate(cb: InvalidateCb): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

export function invalidateFlaggedCount(): void {
  subscribers.forEach((cb) => cb())
}
