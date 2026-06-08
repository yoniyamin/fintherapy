import highFiveMarkup from '../assets/a63bbf6a-1166-11ee-a7f6-8b04d6898b9b.svg?raw'
import medalMarkup from '../assets/344670d6-1151-11ee-976c-a3fa3bf399db.svg?raw'
import starMarkup from '../assets/2ac71f3a-1163-11ee-8932-a35df5ec6a4f.svg?raw'
import trophyMarkup from '../assets/745fc364-117b-11ee-b7ec-9f18a8a356e0.svg?raw'
import { levelTitle } from './xpLevels'

export type EncouragementAnimation = 'high-five' | 'medal' | 'star' | 'trophy'

export type EncouragementKind = 'milestone' | 'time' | 'rank-up' | 'level-up'

export interface EncouragementPayload {
  kind: EncouragementKind
  message: string
  animation: EncouragementAnimation
  showConfetti: boolean
  durationMs: number
}

export const ENCOURAGEMENT_TIMING = {
  FIRST_MILESTONE_TX: 10,
  FIRST_INTERVAL_TX: 15,
  INTERVAL_GROWTH_TX: 5,
  MIN_GAP_MS: 45_000,
  ACTIVE_TIME_MS: 180_000,
  IDLE_GAP_MS: 45_000,
} as const

const ANIMATION_MARKUP: Record<EncouragementAnimation, string> = {
  'high-five': highFiveMarkup,
  medal: medalMarkup,
  star: starMarkup,
  trophy: trophyMarkup,
}

const ANIMATION_DURATION_MS: Record<EncouragementAnimation, number> = {
  'high-five': 1600,
  medal: 2000,
  star: 1800,
  trophy: 2200,
}

/** Inline SVG markup for an encouragement animation key. */
export function encouragementAnimationMarkup(animation: EncouragementAnimation): string {
  return ANIMATION_MARKUP[animation]
}

/** Default on-screen time for a burst (may be overridden per payload). */
export function encouragementDurationMs(animation: EncouragementAnimation): number {
  return ANIMATION_DURATION_MS[animation]
}

const MILESTONE_MESSAGES = [
  (n: number) => `${n} cleared — you're in the zone`,
  (n: number) => `${n} down — nice rhythm`,
  (n: number) => `${n} tagged — keep rolling`,
  (n: number) => `${n} this session — crushing it`,
  (n: number) => `${n} handled — household thanks you`,
]

const TIME_MESSAGES = [
  'Still at it — nice focus',
  'Deep work mode — respect',
  'Steady hands — keep going',
]

/** Picks a milestone caption from session totals. */
export function milestoneMessage(txAtMilestone: number, milestoneIndex: number): string {
  const fn = MILESTONE_MESSAGES[milestoneIndex % MILESTONE_MESSAGES.length]!
  return fn(txAtMilestone)
}

/** Picks a time-based caption. */
export function timeMessage(pulseIndex: number): string {
  return TIME_MESSAGES[pulseIndex % TIME_MESSAGES.length]!
}

/** Builds a rank-overtake caption. */
export function rankUpMessage(displayName: string): string {
  return `You passed ${displayName} on the board!`
}

/** Builds a level-up caption. */
export function levelUpMessage(level: number): string {
  return `Level ${level} — ${levelTitle(level)}!`
}

/** Maps milestone index to a playful animation (variety without noise). */
export function milestoneAnimation(milestoneIndex: number): EncouragementAnimation {
  if (milestoneIndex === 0) return 'high-five'
  if (milestoneIndex % 4 === 3) return 'trophy'
  return milestoneIndex % 2 === 0 ? 'star' : 'high-five'
}

/** Whether to sprinkle confetti (special moments always; others sometimes). */
export function shouldShowConfetti(kind: EncouragementKind, salt: number): boolean {
  if (kind === 'level-up' || kind === 'rank-up') return true
  if (kind === 'milestone' && salt % 4 === 0) return true
  if (kind === 'time') return salt % 3 === 0
  return salt % 5 === 0
}

/** Confetti particle count tuned for a quick speck, not a parade. */
export function confettiCount(kind: EncouragementKind): number {
  if (kind === 'level-up' || kind === 'rank-up') return 24
  return 14
}
