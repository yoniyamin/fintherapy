import { useCallback, useState } from 'react'
import { motion, AnimatePresence, type PanInfo, type TargetAndTransition } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ui } from '../../lib/uiClasses'

const STORAGE_KEY = 'classify_tutorial_dismissed'

const GESTURES = [
  {
    direction: 'right' as const,
    emoji: '🛒',
    label: 'Swipe Right',
    desc: 'Pick a spending category — or confirm when one is suggested',
    showSuggested: true,
    color: 'text-duo-green',
    bg: 'bg-duo-green/10 border-duo-green/25',
    arrow: 'M8 12h12m0 0l-4-4m4 4l-4 4',
  },
  {
    direction: 'left' as const,
    emoji: '🤷',
    label: 'Swipe Left',
    desc: 'Not sure? Flag it for later',
    color: 'text-flame',
    bg: 'bg-flame/10 border-flame/25',
    arrow: 'M20 12H4m0 0l4-4m-4 4l4 4',
  },
  {
    direction: 'up' as const,
    emoji: '📂',
    label: 'Swipe Up',
    desc: 'Change an auto-selected category — open the picker to choose another',
    showSuggested: true,
    color: 'text-gem',
    bg: 'bg-gem/10 border-gem/25',
    arrow: 'M12 20V4m0 0l-4 4m4-4l4 4',
  },
  {
    direction: 'transfer' as const,
    emoji: '🔁',
    label: 'Transfer Button',
    desc: 'Mark internal transfers between your own accounts',
    color: 'text-ice',
    bg: 'bg-ice/10 border-ice/25',
    arrow: 'M7 16V4m0 12l-3-3m3 3l3-3M17 8v12m0-12l3 3m-3-3l-3 3',
  },
]

function DemoCard({ step }: { step: number }) {
  const gesture = GESTURES[step]
  if (!gesture) return null

  const animateMap: Record<string, TargetAndTransition> = {
    right: { x: [0, 80, 0], rotate: [0, 8, 0] },
    left: { x: [0, -80, 0], rotate: [0, -8, 0] },
    up: { y: [0, -60, 0] },
    transfer: { scale: [1, 0.95, 1] },
  }

  return (
    <motion.div
      className={`relative mx-auto w-56 rounded-2xl border ${ui.glass} px-5 py-6 text-center`}
      animate={animateMap[gesture.direction]}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
    >
      <div className="text-3xl">{gesture.emoji}</div>
      <p className="mt-2 text-sm font-semibold text-surface-200">SUPERMARKET XYZ</p>
      <p className="text-xs tabular-nums text-surface-400">3 transactions · €127.50</p>
      {'showSuggested' in gesture && gesture.showSuggested && (
        <p className="mt-2 rounded-lg bg-duo-green/15 px-2 py-1 text-[11px] font-semibold text-duo-green">
          Suggested: Groceries
        </p>
      )}

      <motion.div
        className={`absolute inset-0 flex items-center justify-center rounded-2xl border ${gesture.bg}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.9, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
      >
        <span className={`text-sm font-bold ${gesture.color}`}>{gesture.label}</span>
      </motion.div>
    </motion.div>
  )
}

interface ClassifyTutorialProps {
  hasTransactions: boolean
  onDismiss?: () => void
}

const STEP_SWIPE_OFFSET_X = 60
const STEP_SWIPE_VELOCITY_X = 400

export default function ClassifyTutorial({ hasTransactions, onDismiss }: ClassifyTutorialProps) {
  const [step, setStep] = useState(0)

  const gesture = GESTURES[step]
  const isLast = step === GESTURES.length - 1

  const goNext = useCallback(
    () => setStep((current) => Math.min(GESTURES.length - 1, current + 1)),
    [],
  )
  const goPrev = useCallback(
    () => setStep((current) => Math.max(0, current - 1)),
    [],
  )

  const handleStepSwipe = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.x < -STEP_SWIPE_OFFSET_X || info.velocity.x < -STEP_SWIPE_VELOCITY_X) {
        goNext()
      } else if (info.offset.x > STEP_SWIPE_OFFSET_X || info.velocity.x > STEP_SWIPE_VELOCITY_X) {
        goPrev()
      }
    },
    [goNext, goPrev],
  )

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    onDismiss?.()
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className={`w-full max-w-sm space-y-5 ${ui.glass} px-6 py-8`}>
        <div>
          <h2 className="bg-gradient-to-r from-surface-50 via-ice to-gem-light bg-clip-text text-xl font-bold text-transparent">
            How Classification Works
          </h2>
          <p className="mt-1 text-sm text-surface-400">
            Transactions are grouped by merchant. Swipe to categorize them all at once.
          </p>
        </div>

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          dragMomentum={false}
          onDragEnd={handleStepSwipe}
          className="touch-pan-y"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <DemoCard step={step} />
            </motion.div>
          </AnimatePresence>

          {gesture && (
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                className={`mt-4 rounded-xl border ${gesture.bg} px-4 py-3`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-2.5">
                  <svg
                    width="20" height="20" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className={gesture.color}
                  >
                    <path d={gesture.arrow} />
                  </svg>
                  <div className="text-left">
                    <p className={`text-sm font-bold ${gesture.color}`}>{gesture.label}</p>
                    <p className="text-xs text-surface-400">{gesture.desc}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>

        <div className="flex items-center justify-center gap-1.5">
          {GESTURES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-[width,background-color] duration-200 ${
                i === step ? 'w-6 bg-duo-green' : 'w-2 bg-surface-700'
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {isLast ? (
            <>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-5 py-3 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(88,204,2,0.45)] transition-[transform,opacity,filter] duration-150 active:scale-[0.97]"
              >
                Got it!
              </button>
              {!hasTransactions && (
                <Link
                  to="/upload"
                  className="w-full rounded-xl border border-surface-600/60 bg-surface-800/50 px-5 py-2.5 text-center text-sm font-semibold text-surface-300 transition-colors hover:bg-surface-800"
                >
                  Upload a CSV to start
                </Link>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="flex-1 rounded-xl border border-surface-600/60 bg-surface-800/50 px-4 py-2.5 text-sm font-semibold text-surface-400 transition-colors hover:bg-surface-800"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex-1 rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgba(88,204,2,0.4)] transition-[transform,opacity,filter] duration-150 active:scale-[0.97]"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
