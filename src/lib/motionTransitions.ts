/**
 * Reusable Framer Motion transition presets built from motionTokens.
 *
 * Hook-based so they integrate useReducedMotion for scoped accessibility.
 */
import { useReducedMotion } from 'framer-motion'
import { DURATION, EASE_DRAWER, EASE_IN, EASE_OUT } from './motionTokens'

/** Badge / chip scale(0.93) + opacity entrance. */
export function useBadgeTransition() {
  return {
    initial: { scale: 0.93, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { duration: DURATION.badge, ease: EASE_OUT },
  } as const
}

/** Sheet programmatic enter/exit — asymmetric durations, no spring. */
export function useSheetTransition() {
  return {
    initial: { y: '100%' },
    animate: {
      y: 0,
      transition: { duration: DURATION.sheetEnter, ease: EASE_DRAWER },
    },
    exit: {
      y: '100%',
      transition: { duration: DURATION.sheetExit, ease: EASE_IN },
    },
  } as const
}

/** Progress bar scaleX fill — GPU-safe, no layout thrash. */
export function useProgressTransition(progress: number) {
  return {
    initial: { scaleX: 0 },
    animate: { scaleX: Math.max(0, Math.min(1, progress)) },
    transition: { duration: DURATION.progress, ease: EASE_OUT },
  } as const
}

/**
 * Wraps any Framer transition: when OS prefers reduced motion,
 * strips transform properties and keeps only opacity.
 * Use on decorative motion — NOT on form feedback or interactive elements.
 */
export function useReducedMotionFallback<
  T extends { initial?: Record<string, unknown>; animate?: Record<string, unknown> },
>(transition: T): T {
  const prefersReduced = useReducedMotion()
  if (!prefersReduced) return transition

  const TRANSFORM_KEYS = new Set(['scale', 'scaleX', 'scaleY', 'x', 'y', 'rotate'])
  const stripTransform = (obj?: Record<string, unknown>) => {
    if (!obj) return obj
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !TRANSFORM_KEYS.has(k)))
  }

  return {
    ...transition,
    initial: stripTransform(transition.initial),
    animate: stripTransform(transition.animate),
  }
}
