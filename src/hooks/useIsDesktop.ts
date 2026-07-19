import { useSyncExternalStore } from 'react'

const DESKTOP_QUERY = '(min-width: 1024px)'

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener('change', onStoreChange)
  return () => mql.removeEventListener('change', onStoreChange)
}

function getSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches
}

function getServerSnapshot() {
  return false
}

/**
 * Returns `true` when the viewport is at least 1024px wide (Tailwind `lg:` breakpoint).
 * Listens for resize/orientation changes via `matchMedia`.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
