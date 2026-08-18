import { describe, expect, it } from 'vitest'
import {
  createSessionTracker,
  durationSeconds,
  pathToRouteKey,
  sanitizeSectionSeconds,
  type SessionStatsStorage,
} from './sessionStats'

function memoryStorage(): SessionStatsStorage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: (key) => { data.delete(key) },
  }
}

describe('pathToRouteKey', () => {
  it('maps app paths to coarse route keys', () => {
    // Arrange & Act & Assert
    expect(pathToRouteKey('/')).toBe('home')
    expect(pathToRouteKey('/classify/no-idea')).toBe('classify')
    expect(pathToRouteKey('/analysis')).toBe('analysis')
    expect(pathToRouteKey('/dev')).toBeNull()
  })
})

describe('durationSeconds', () => {
  it('sums route keys and ignores analysis subsections', () => {
    // Arrange
    const sectionSeconds = { analysis: 190, overview: 42, trends: 61, classify: 240 }

    // Act
    const duration = durationSeconds(sectionSeconds)

    // Assert
    expect(duration).toBe(430)
  })
})

describe('sanitizeSectionSeconds', () => {
  it('drops unknown keys and non-positive values', () => {
    // Arrange
    const sectionSeconds = { home: 12.9, overview: 0, userId: 9, classify: -3 }

    // Act
    const clean = sanitizeSectionSeconds(sectionSeconds)

    // Assert
    expect(clean).toEqual({ home: 12 })
  })
})

describe('createSessionTracker', () => {
  it('accumulates route and analysis section time while visible', () => {
    // Arrange
    let now = 1_000_000
    const tracker = createSessionTracker({
      storage: memoryStorage(),
      now: () => now,
      createId: () => 'session-1',
    })
    tracker.beginNewSession('sign_in')
    tracker.start()
    tracker.setRoute('analysis')
    tracker.setAnalysisSection('overview')

    // Act
    now += 5_000
    tracker.setAnalysisSection('trends')
    now += 3_000
    const snapshot = tracker.getSnapshot()

    // Assert
    expect(snapshot.id).toBe('session-1')
    expect(snapshot.authAction).toBe('sign_in')
    expect(snapshot.sectionSeconds.analysis).toBe(8)
    expect(snapshot.sectionSeconds.overview).toBe(5)
    expect(snapshot.sectionSeconds.trends).toBe(3)
  })

  it('does not count time while paused', () => {
    // Arrange
    let now = 1_000_000
    const tracker = createSessionTracker({
      storage: memoryStorage(),
      now: () => now,
      createId: () => 'session-2',
    })
    tracker.beginNewSession('sign_up')
    tracker.start()
    tracker.setRoute('classify')
    now += 2_000
    tracker.setPaused(true)
    now += 10_000
    tracker.setPaused(false)
    now += 1_000

    // Act
    const snapshot = tracker.getSnapshot()

    // Assert
    expect(snapshot.sectionSeconds.classify).toBe(3)
    expect(snapshot.authAction).toBe('sign_up')
  })

  it('applies a queued password recovery action on the next session', () => {
    // Arrange
    const storage = memoryStorage()
    const tracker = createSessionTracker({
      storage,
      now: () => 1,
      createId: () => 'session-3',
    })

    // Act
    tracker.queueAuthAction('password_recovery')
    tracker.beginNewSession('sign_in')

    // Assert
    expect(tracker.getSnapshot().authAction).toBe('password_recovery')
  })
})
