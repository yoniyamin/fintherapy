import { describe, it, expect } from 'vitest'
import {
  xpLevelFromTotal,
  xpFloorForLevel,
  xpProgress,
  levelTitle,
  LEVEL_XP_SEGMENTS,
  LEVEL_TITLES,
} from './xpLevels'

describe('xpLevelFromTotal', () => {
  it('returns level 1 for 0 XP', () => {
    expect(xpLevelFromTotal(0)).toBe(1)
  })

  it('returns level 1 for XP just below first threshold', () => {
    expect(xpLevelFromTotal(79)).toBe(1)
  })

  it('returns level 2 at exactly the first threshold (80)', () => {
    expect(xpLevelFromTotal(80)).toBe(2)
  })

  it('returns level 3 at cumulative threshold (80 + 100 = 180)', () => {
    expect(xpLevelFromTotal(180)).toBe(3)
  })

  it('handles negative XP gracefully', () => {
    expect(xpLevelFromTotal(-50)).toBe(1)
  })

  it('caps at max level when XP exceeds all segments', () => {
    const totalAllSegments = LEVEL_XP_SEGMENTS.reduce((s, v) => s + v, 0)
    expect(xpLevelFromTotal(totalAllSegments + 10000)).toBe(LEVEL_XP_SEGMENTS.length + 1)
  })
})

describe('xpFloorForLevel', () => {
  it('returns 0 for level 1', () => {
    expect(xpFloorForLevel(1)).toBe(0)
  })

  it('returns first segment for level 2', () => {
    expect(xpFloorForLevel(2)).toBe(80)
  })

  it('returns cumulative segments for level 3', () => {
    expect(xpFloorForLevel(3)).toBe(180)
  })

  it('clamps to level 1 for invalid levels', () => {
    expect(xpFloorForLevel(0)).toBe(0)
    expect(xpFloorForLevel(-5)).toBe(0)
  })
})

describe('xpProgress', () => {
  it('returns correct progress at 0 XP', () => {
    // Arrange
    const result = xpProgress(0)

    // Assert
    expect(result.level).toBe(1)
    expect(result.progress).toBe(0)
    expect(result.toNext).toBe(80)
    expect(result.title).toBe('Receipt Rookie')
    expect(result.nextTitle).toBe('Envelope Explorer')
  })

  it('returns progress midway through level 1', () => {
    // Arrange
    const result = xpProgress(40)

    // Assert
    expect(result.level).toBe(1)
    expect(result.progress).toBe(0.5)
    expect(result.toNext).toBe(40)
  })

  it('returns full progress at level boundary', () => {
    // Arrange
    const result = xpProgress(80)

    // Assert
    expect(result.level).toBe(2)
    expect(result.progress).toBe(0)
    expect(result.title).toBe('Envelope Explorer')
  })

  it('nextTitle is null at max level', () => {
    const totalAllSegments = LEVEL_XP_SEGMENTS.reduce((s, v) => s + v, 0)
    const result = xpProgress(totalAllSegments + 5000)
    expect(result.nextTitle).toBeNull()
  })
})

describe('levelTitle', () => {
  it('returns first title for level 1', () => {
    expect(levelTitle(1)).toBe('Receipt Rookie')
  })

  it('returns last title for levels beyond the array', () => {
    expect(levelTitle(999)).toBe(LEVEL_TITLES[LEVEL_TITLES.length - 1])
  })

  it('clamps negative levels to level 1', () => {
    expect(levelTitle(-3)).toBe('Receipt Rookie')
  })
})

describe('level data integrity', () => {
  it('has the same number of titles as segments + 1', () => {
    expect(LEVEL_TITLES.length).toBe(LEVEL_XP_SEGMENTS.length + 1)
  })

  it('all segments are positive integers', () => {
    for (const seg of LEVEL_XP_SEGMENTS) {
      expect(seg).toBeGreaterThan(0)
      expect(Number.isInteger(seg)).toBe(true)
    }
  })

  it('segments are non-decreasing', () => {
    for (let i = 1; i < LEVEL_XP_SEGMENTS.length; i++) {
      expect(LEVEL_XP_SEGMENTS[i]).toBeGreaterThanOrEqual(LEVEL_XP_SEGMENTS[i - 1]!)
    }
  })
})
