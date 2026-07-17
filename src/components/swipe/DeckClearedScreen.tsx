import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import Confetti from '../common/Confetti'
import DeckClearedAnimation from './DeckClearedAnimation'
import { ui } from '../../lib/uiClasses'

export type DeckClearedViewport = 'in-app' | 'standalone'

interface Props {
  animationKey?: number
  classifiedTxCount: number
  completedCount: number
  deckMode?: 'pending' | 'no-idea'
  flaggedCount?: number
  refundsOffset?: number
  sessionXpEarned?: number
  showConfetti?: boolean
  transferCount?: number
  viewport?: DeckClearedViewport
}

const VIEWPORT_HEIGHT: Record<DeckClearedViewport, string> = {
  'in-app':
    'h-[calc(100dvh-var(--shell-tab-clearance)-env(safe-area-inset-top,0px)-1rem)]',
  standalone:
    'h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem)]',
}

/**
 * Full deck-cleared completion layout — shared by classify flow and dev animation lab.
 */
export default function DeckClearedScreen({
  animationKey = 0,
  classifiedTxCount,
  completedCount,
  deckMode = 'pending',
  flaggedCount = 0,
  refundsOffset = 0,
  sessionXpEarned = 0,
  showConfetti = true,
  transferCount = 0,
  viewport = 'in-app',
}: Props) {
  const totalXp = sessionXpEarned

  return (
    <>
      {showConfetti && <Confetti active count={60} />}
      <motion.div
        className={`mx-auto flex w-full max-w-sm min-h-0 flex-col items-center justify-center gap-2 overflow-hidden px-4 text-center ${VIEWPORT_HEIGHT[viewport]}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
      >
        <motion.div
          className="shrink-0"
          initial={{ scale: 0.88, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 16, stiffness: 320, delay: 0.1 }}
        >
          <DeckClearedAnimation
            key={animationKey}
            className="h-24 w-24 shrink-0 sm:h-28 sm:w-28"
          />
        </motion.div>
        <h2 className="shrink-0 text-xl font-bold text-surface-50">Deck Cleared!</h2>
        <p className="max-w-[16rem] shrink-0 text-xs leading-snug text-surface-400">
          Every transaction in the queue is classified — time to see where the money went.
        </p>

        <div className={`w-full shrink-0 space-y-1.5 p-3 ${ui.glassFlat}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-surface-400">Classified</span>
            <span className="text-base font-bold tabular-nums text-duo-green">
              {classifiedTxCount} tx ({completedCount} card{completedCount !== 1 ? 's' : ''})
            </span>
          </div>
          {classifiedTxCount > completedCount && completedCount > 0 && (
            <p className="-mt-1 text-[11px] text-surface-500">
              Smart Stacks saved you {classifiedTxCount - completedCount} swipe
              {classifiedTxCount - completedCount !== 1 ? 's' : ''} 🎯
            </p>
          )}
          {deckMode === 'pending' && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-surface-400">No idea</span>
              <span className="text-base font-bold tabular-nums text-flame">{flaggedCount}</span>
            </div>
          )}
          {transferCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-surface-400">Transfers</span>
              <span className="text-base font-bold tabular-nums text-ice">{transferCount}</span>
            </div>
          )}
          {refundsOffset > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-surface-400">Refunds offset</span>
              <span className="text-base font-bold tabular-nums text-gem">
                {refundsOffset} pair{refundsOffset > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="border-t border-surface-700/50 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-surface-400">XP Earned</span>
              <motion.span
                className="text-lg font-extrabold tabular-nums text-gem"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.4 }}
              >
                +{totalXp}
              </motion.span>
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2">
          <Link
            to="/reveal"
            className="rounded-xl border-b-[3px] border-gem-dark bg-gem px-5 py-2 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(28,176,246,0.45)] active:translate-y-[1px] active:border-b"
          >
            Reveal your spending
          </Link>
          <Link
            to="/"
            className="rounded-xl border border-surface-600/60 bg-surface-800/50 px-5 py-2 text-sm font-semibold text-surface-300 transition-colors hover:bg-surface-800"
          >
            Continue
          </Link>
        </div>
      </motion.div>
    </>
  )
}
