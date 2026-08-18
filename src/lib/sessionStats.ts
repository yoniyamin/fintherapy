import { ANALYSIS_SECTION_IDS } from './analysisSections'

export const AUTH_ACTIONS = ['sign_in', 'sign_up', 'password_recovery'] as const
export type AuthAction = (typeof AUTH_ACTIONS)[number]

export const ROUTE_KEYS = [
  'home',
  'classify',
  'reveal',
  'analysis',
  'bets',
  'upload',
  'settings',
  'household',
] as const
export type RouteKey = (typeof ROUTE_KEYS)[number]

export const SECTION_KEYS = [...ROUTE_KEYS, ...ANALYSIS_SECTION_IDS] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

const STORAGE_KEY = 'spentwhatt.sessionStats'
const PENDING_AUTH_KEY = 'spentwhatt.sessionStats.pendingAuth'
const ROUTE_KEY_SET = new Set<string>(ROUTE_KEYS)
const SECTION_KEY_SET = new Set<string>(SECTION_KEYS)

export interface SessionStatsSnapshot {
  id: string
  authAction: AuthAction
  sectionSeconds: Record<string, number>
}

export interface SessionStatsStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

interface TrackerOptions {
  storage: SessionStatsStorage
  now: () => number
  createId: () => string
}

/** Maps an app pathname to a coarse stats route, or null when the page should not be timed. */
export function pathToRouteKey(pathname: string): RouteKey | null {
  if (pathname === '/' || pathname === '') return 'home'
  if (pathname.startsWith('/classify')) return 'classify'
  if (pathname.startsWith('/reveal')) return 'reveal'
  if (pathname.startsWith('/analysis')) return 'analysis'
  if (pathname.startsWith('/bets')) return 'bets'
  if (pathname.startsWith('/upload')) return 'upload'
  if (pathname.startsWith('/settings')) return 'settings'
  if (pathname.startsWith('/household')) return 'household'
  return null
}

/** Sums route-level seconds only so analysis subsections are not double-counted. */
export function durationSeconds(sectionSeconds: Record<string, number>): number {
  return ROUTE_KEYS.reduce((sum, key) => sum + Math.max(0, Math.floor(sectionSeconds[key] ?? 0)), 0)
}

/** Returns integer seconds for known keys only. */
export function sanitizeSectionSeconds(sectionSeconds: Record<string, number>): Record<string, number> {
  const clean: Record<string, number> = {}
  for (const [key, value] of Object.entries(sectionSeconds)) {
    if (!SECTION_KEY_SET.has(key)) continue
    const seconds = Math.max(0, Math.floor(value))
    if (seconds > 0) clean[key] = seconds
  }
  return clean
}

function isAuthAction(value: string): value is AuthAction {
  return (AUTH_ACTIONS as readonly string[]).includes(value)
}

function newSnapshot(id: string, authAction: AuthAction): SessionStatsSnapshot {
  return { id, authAction, sectionSeconds: {} }
}

/** Creates an in-memory session timer that persists snapshots to the given storage. */
export function createSessionTracker(options: TrackerOptions) {
  const { storage, now, createId } = options
  let snapshot = readSnapshot(storage) ?? newSnapshot(createId(), readPendingAuth(storage) ?? 'sign_in')
  let routeKey: RouteKey | null = null
  let analysisKey: string | null = null
  let lastTick = now()
  let paused = false
  let started = false

  /** Writes the current snapshot to session storage. */
  function persist() {
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  }

  /** Adds elapsed visible time to the active route and analysis section. */
  function commit() {
    const tick = now()
    const elapsed = Math.max(0, tick - lastTick)
    lastTick = tick
    if (paused || !started || elapsed <= 0) return

    const add = elapsed / 1000
    if (routeKey) {
      snapshot.sectionSeconds[routeKey] = (snapshot.sectionSeconds[routeKey] ?? 0) + add
    }
    if (routeKey === 'analysis' && analysisKey && SECTION_KEY_SET.has(analysisKey) && !ROUTE_KEY_SET.has(analysisKey)) {
      snapshot.sectionSeconds[analysisKey] = (snapshot.sectionSeconds[analysisKey] ?? 0) + add
    }
    persist()
  }

  /** Starts timing against the current snapshot, creating one if needed. */
  function start() {
    if (!started) {
      snapshot = readSnapshot(storage) ?? snapshot
      persist()
    }
    started = true
    paused = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    lastTick = now()
  }

  /** Commits remaining time and stops the clock. */
  function stop() {
    commit()
    started = false
  }

  /** Starts a new anonymous row after a fresh auth action. */
  function beginNewSession(action: AuthAction) {
    commit()
    const queued = readPendingAuth(storage)
    storage.removeItem(PENDING_AUTH_KEY)
    snapshot = newSnapshot(createId(), queued ?? action)
    routeKey = null
    analysisKey = null
    lastTick = now()
    persist()
  }

  /** Remembers an auth action to apply on the next new session (password recovery). */
  function queueAuthAction(action: AuthAction) {
    storage.setItem(PENDING_AUTH_KEY, action)
  }

  /** Sets the coarse route being viewed. */
  function setRoute(key: RouteKey | null) {
    commit()
    routeKey = key
    if (key !== 'analysis') analysisKey = null
  }

  /** Sets the analysis subsection being viewed. Ignored unless the route is analysis. */
  function setAnalysisSection(key: string | null) {
    commit()
    analysisKey = key
  }

  /** Pauses timing while the tab is hidden. */
  function setPaused(next: boolean) {
    commit()
    paused = next
    lastTick = now()
  }

  /** Returns a JSON-safe copy of the current snapshot. */
  function getSnapshot(): SessionStatsSnapshot {
    commit()
    return {
      id: snapshot.id,
      authAction: snapshot.authAction,
      sectionSeconds: sanitizeSectionSeconds(snapshot.sectionSeconds),
    }
  }

  /** Clears storage after a voluntary sign-out. */
  function clear() {
    started = false
    routeKey = null
    analysisKey = null
    storage.removeItem(STORAGE_KEY)
    snapshot = newSnapshot(createId(), 'sign_in')
  }

  return {
    start,
    stop,
    beginNewSession,
    queueAuthAction,
    setRoute,
    setAnalysisSection,
    setPaused,
    getSnapshot,
    clear,
  }
}

function readSnapshot(storage: SessionStatsStorage): SessionStatsSnapshot | null {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SessionStatsSnapshot>
    if (typeof parsed.id !== 'string' || !parsed.id) return null
    const authAction = typeof parsed.authAction === 'string' && isAuthAction(parsed.authAction)
      ? parsed.authAction
      : 'sign_in'
    const sectionSeconds = parsed.sectionSeconds && typeof parsed.sectionSeconds === 'object'
      ? sanitizeSectionSeconds(parsed.sectionSeconds)
      : {}
    return { id: parsed.id, authAction, sectionSeconds }
  } catch {
    return null
  }
}

function readPendingAuth(storage: SessionStatsStorage): AuthAction | null {
  const raw = storage.getItem(PENDING_AUTH_KEY)
  return raw && isAuthAction(raw) ? raw : null
}

function browserStorage(): SessionStatsStorage {
  try {
    return window.sessionStorage
  } catch {
    const memory = new Map<string, string>()
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => { memory.set(key, value) },
      removeItem: (key) => { memory.delete(key) },
    }
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export const sessionStats = createSessionTracker({
  storage: typeof window === 'undefined' ? { getItem: () => null, setItem: () => {}, removeItem: () => {} } : browserStorage(),
  now: () => Date.now(),
  createId,
})
