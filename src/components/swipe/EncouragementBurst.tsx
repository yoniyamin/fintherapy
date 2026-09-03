import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Confetti from '../common/Confetti'
import { confettiCount, type EncouragementKind } from '../../lib/classifyEncouragement'
import type { ClassifyEncouragementBurst } from '../../hooks/useClassifyEncouragement'
import EncouragementAnimation from './EncouragementAnimation'

interface Props {
  burst: ClassifyEncouragementBurst
  onDismiss: () => void
}

/**
 * Short full-screen encouragement overlay during classify sessions.
 * Auto-dismisses quickly; tap anywhere to skip.
 */
export default function EncouragementBurst({ burst, onDismiss }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, burst.durationMs)
    return () => window.clearTimeout(timer)
  }, [burst.durationMs, burst.id, onDismiss])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      <motion.button
        key={burst.id}
        type="button"
        aria-label={burst.message}
        className="fixed inset-0 z-[90] flex cursor-default flex-col items-center justify-center border-0 bg-black/35 p-6 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onDismiss}
      >
        {burst.showConfetti && (
          <Confetti active count={confettiCount(burst.kind as EncouragementKind)} />
        )}
        <motion.div
          className="pointer-events-none flex max-w-xs flex-col items-center gap-3 text-center"
          initial={{ scale: 0.93, y: 8 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.15, ease: [0.4, 0, 1, 0] } }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          <EncouragementAnimation
            animation={burst.animation}
            className="h-36 w-36 drop-shadow-lg sm:h-40 sm:w-40"
          />
          <p className="text-base font-bold leading-snug text-surface-50 sm:text-lg">{burst.message}</p>
        </motion.div>
      </motion.button>
    </AnimatePresence>,
    document.body,
  )
}
