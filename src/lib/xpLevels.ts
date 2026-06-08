/** XP needed to advance from level N to level N+1 (modest early tiers, steeper later). */
export const LEVEL_XP_SEGMENTS = [
  80, 100, 120, 140, 160,
  200, 220, 250, 280, 300,
  350, 400, 450, 500, 550,
  600, 650, 700, 750, 800,
  850, 900, 950, 1000,
] as const

export const LEVEL_TITLES = [
  'Receipt Rookie',
  'Envelope Explorer',
  'Budget Buddy',
  'Category Curator',
  'Stack Slayer',
  'Penny Pincher',
  'Expense Tamer',
  'Ledger Learner',
  'Budget Ninja',
  'Spreadsheet Sprout',
  'Fiscal Scout',
  'Money Mapper',
  'Spreadsheet Sorcerer',
  'Balance Boss',
  'Fiscal Wizard',
  'Cashflow Captain',
  'Money Whisperer',
  'Household Hero',
  'Finance Sage',
  'Treasury Titan',
  'Gold Standard',
  'Platinum Planner',
  'Diamond Decoder',
  'Finance Overlord',
  'Legendary Accountant',
] as const

export interface XpProgress {
  level: number
  progress: number
  toNext: number
  title: string
  nextTitle: string | null
}

/** Returns 1-based level from cumulative XP (segment thresholds, not flat blocks). */
export function xpLevelFromTotal(totalXp: number): number {
  let remaining = Math.max(0, totalXp)
  let level = 1
  for (const segment of LEVEL_XP_SEGMENTS) {
    if (remaining < segment) break
    remaining -= segment
    level += 1
  }
  return level
}

/** XP threshold at the start of a 1-based level (level 1 starts at 0). */
export function xpFloorForLevel(level: number): number {
  const target = Math.max(1, level)
  let floor = 0
  for (let i = 0; i < target - 1 && i < LEVEL_XP_SEGMENTS.length; i++) {
    floor += LEVEL_XP_SEGMENTS[i]!
  }
  return floor
}

/**
 * Derives level, progress bar fill, and title copy from cumulative XP.
 */
export function xpProgress(totalXp: number): XpProgress {
  const level = xpLevelFromTotal(totalXp)
  const floor = xpFloorForLevel(level)
  const segmentSize =
    level <= LEVEL_XP_SEGMENTS.length ? LEVEL_XP_SEGMENTS[level - 1]! : LEVEL_XP_SEGMENTS[LEVEL_XP_SEGMENTS.length - 1]!
  const xpInSegment = totalXp - floor
  const progress = segmentSize > 0 ? Math.min(1, xpInSegment / segmentSize) : 1
  const toNext = segmentSize - xpInSegment
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]!
  const nextTitle = level < LEVEL_TITLES.length ? LEVEL_TITLES[level]! : null
  return { level, progress, toNext, title, nextTitle }
}

/** Title for a given 1-based level (clamped to known titles). */
export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(Math.max(1, level) - 1, LEVEL_TITLES.length - 1)]!
}
