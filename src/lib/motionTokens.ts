/**
 * Shared motion tokens — easing curves and durations for production animations.
 * CSS custom properties live in index.css; these JS constants mirror them for Framer Motion.
 *
 * Values validated in dev lab (src/components/dev/emilMotionConstants.ts).
 */

/** Fast deceleration — entrances, badge pops, feedback. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** Symmetric — rare, only for looping / decorative motion. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

/** Sheet / drawer open — quick launch, gentle settle. */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const

/** Sheet / drawer close — snappy dismiss. */
export const EASE_IN = [0.4, 0, 1, 0] as const

export const DURATION = {
  /** Button press feedback. */
  press: 0.15,
  /** Badge / chip entrance. */
  badge: 0.18,
  /** Toast / encouragement overlay enter. */
  overlay: 0.2,
  /** Sheet programmatic enter. */
  sheetEnter: 0.25,
  /** Sheet programmatic exit (faster than enter). */
  sheetExit: 0.18,
  /** Progress bar fill. */
  progress: 0.3,
} as const
