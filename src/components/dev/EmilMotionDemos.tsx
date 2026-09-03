import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EMIL_EASE_OUT, EMIL_EASE_OUT_CSS } from './emilMotionConstants'
import EmilCompareFrame from './EmilCompareFrame'
import type { EmilSuggestion } from './emilImprovementSuggestions'

interface DemoProps {
  replayKey: number
  suggestion: EmilSuggestion
  onReplay: () => void
}

export function EmilSuggestionDemo({ id, replayKey, suggestion, onReplay }: DemoProps & { id: string }) {
  switch (id) {
    case 'button-transition-all':
      return <ButtonPressDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'easing-tokens':
      return <EasingDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'reduced-motion':
      return <ReducedMotionDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'swipe-scale-zero':
      return <ScaleEntranceDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'encouragement-overlay':
      return <OverlayDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'deck-cleared':
      return <DeckClearedDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'slide-deck-scale':
      return <SlideDeckDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'page-stagger':
      return <PageStaggerDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'height-animate':
      return <HeightExpandDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'bottom-sheet-exit':
      return <BottomSheetDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'nav-no-motion':
      return <NavSwitchDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'transition-all-sweep':
      return <TransitionAllDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'hover-media-query':
      return <HoverTouchDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    default:
      return (
        <EmilCompareFrame
          suggestion={suggestion}
          onReplay={onReplay}
          before={<FallbackNote before={suggestion.before} />}
          after={<FallbackNote before={suggestion.after} />}
        />
      )
  }
}

function FallbackNote({ before }: { before: string }) {
  return (
    <p className="px-2 text-center font-mono text-[10px] leading-relaxed text-surface-400">{before}</p>
  )
}

function DemoBadge({ replayKey, variant }: { replayKey: number; variant: 'before' | 'after' }) {
  const motionProps =
    variant === 'before'
      ? {
          initial: { scale: 0, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { type: 'spring' as const, damping: 14, stiffness: 400 },
        }
      : {
          initial: { scale: 0.95, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { duration: 0.22, ease: EMIL_EASE_OUT },
        }

  return (
    <motion.span
      key={replayKey}
      className="inline-flex items-center gap-1 rounded-full border border-duo-green/40 bg-duo-green/15 px-2.5 py-1 text-xs font-semibold text-duo-green"
      {...motionProps}
    >
      🛒 Groceries
    </motion.span>
  )
}

function ButtonPressDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <button
          key={`before-${replayKey}`}
          type="button"
          className="rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-5 py-2.5 text-sm font-bold text-white transition-all active:translate-y-[1px] active:border-b"
        >
          Press me
        </button>
      }
      after={
        <button
          key={`after-${replayKey}`}
          type="button"
          className="rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-5 py-2.5 text-sm font-bold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Press me
        </button>
      }
    />
  )
}

function EasingDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <motion.div
          key={`ease-before-${replayKey}`}
          className="h-3 w-3 rounded-full bg-flame"
          initial={{ x: -72 }}
          animate={{ x: 72 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
        />
      }
      after={
        <motion.div
          key={`ease-after-${replayKey}`}
          className="h-3 w-3 rounded-full bg-duo-green"
          initial={{ x: -72 }}
          animate={{ x: 72 }}
          transition={{ duration: 0.45, ease: EMIL_EASE_OUT }}
        />
      }
    />
  )
}

function ReducedMotionDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <motion.div
          key={`rm-before-${replayKey}`}
          className="rounded-xl border border-surface-600 bg-surface-800 px-4 py-3 text-xs font-semibold text-surface-200"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          Full motion
        </motion.div>
      }
      after={
        <motion.div
          key={`rm-after-${replayKey}`}
          className="rounded-xl border border-surface-600 bg-surface-800 px-4 py-3 text-xs font-semibold text-surface-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          Reduced motion
        </motion.div>
      }
    />
  )
}

function ScaleEntranceDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={<DemoBadge replayKey={replayKey} variant="before" />}
      after={<DemoBadge replayKey={replayKey} variant="after" />}
    />
  )
}

function OverlayDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <MiniOverlay
          replayKey={replayKey}
          cardInitial={{ scale: 0.88, y: 12 }}
          cardTransition={{ type: 'spring', damping: 16, stiffness: 320 }}
          backdropDuration={0.2}
        />
      }
      after={
        <MiniOverlay
          replayKey={replayKey}
          cardInitial={{ scale: 0.95, opacity: 0 }}
          cardTransition={{ duration: 0.22, ease: EMIL_EASE_OUT }}
          backdropDuration={0.18}
        />
      }
    />
  )
}

function MiniOverlay({
  replayKey,
  cardInitial,
  cardTransition,
  backdropDuration,
}: {
  replayKey: number
  cardInitial: Record<string, number>
  cardTransition: Record<string, unknown>
  backdropDuration: number
}) {
  return (
    <div className="relative h-36 w-full overflow-hidden rounded-lg bg-surface-900">
      <motion.div
        key={`backdrop-${replayKey}`}
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: backdropDuration }}
      />
      <div className="relative flex h-full items-center justify-center">
        <motion.div
          key={`card-${replayKey}`}
          className="rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-center"
          initial={cardInitial}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={cardTransition}
        >
          <p className="text-2xl">🏆</p>
          <p className="mt-1 text-xs font-bold text-surface-100">10 classified!</p>
        </motion.div>
      </div>
    </div>
  )
}

function DeckClearedDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={<DeckClearedMini replayKey={replayKey} variant="before" />}
      after={<DeckClearedMini replayKey={replayKey} variant="after" />}
    />
  )
}

function DeckClearedMini({ replayKey, variant }: { replayKey: number; variant: 'before' | 'after' }) {
  const shellProps =
    variant === 'before'
      ? {
          initial: { scale: 0.8, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { type: 'spring' as const, damping: 15 },
        }
      : {
          initial: { scale: 0.95, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { type: 'spring' as const, damping: 22, stiffness: 320 },
        }

  const xpProps =
    variant === 'before'
      ? {
          initial: { scale: 0 },
          animate: { scale: 1 },
          transition: { type: 'spring' as const, delay: 0.25 },
        }
      : {
          initial: { scale: 0.92, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { duration: 0.22, ease: EMIL_EASE_OUT, delay: 0.2 },
        }

  return (
    <motion.div
      key={`shell-${variant}-${replayKey}`}
      className="flex w-full flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-surface-900/80 p-4 text-center"
      {...shellProps}
    >
      <p className="text-lg">🎉</p>
      <p className="text-sm font-bold text-surface-50">Deck Cleared!</p>
      <motion.p className="text-base font-extrabold text-gem" {...xpProps}>
        +350 XP
      </motion.p>
    </motion.div>
  )
}

function SlideDeckDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <motion.div
          key={`slide-before-${replayKey}`}
          className="flex items-center gap-2 rounded-xl border border-flame/30 bg-flame/10 px-3 py-2"
          initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 14 }}
        >
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, delay: 0.08 }}
          >
            🍽️
          </motion.span>
          <span className="text-xs font-bold text-surface-100">Dining out</span>
        </motion.div>
      }
      after={
        <motion.div
          key={`slide-after-${replayKey}`}
          className="flex items-center gap-2 rounded-xl border border-duo-green/30 bg-duo-green/10 px-3 py-2"
          initial={{ scale: 0.95, opacity: 0, rotate: -2 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.28, ease: EMIL_EASE_OUT }}
        >
          <motion.span
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: EMIL_EASE_OUT, delay: 0.06 }}
          >
            🍽️
          </motion.span>
          <span className="text-xs font-bold text-surface-100">Dining out</span>
        </motion.div>
      }
    />
  )
}

function PageStaggerDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const rows = ['Budget', 'Classify', 'Reveal']

  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <div className="flex w-full flex-col gap-2">
          {rows.map((row, i) => (
            <motion.div
              key={`stagger-before-${replayKey}-${row}`}
              className="rounded-lg border border-surface-700 bg-surface-800/80 px-3 py-2 text-xs font-semibold text-surface-200"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08, ease: 'easeOut' }}
            >
              {row}
            </motion.div>
          ))}
        </div>
      }
      after={
        <div className="flex w-full flex-col gap-2">
          {rows.map((row, i) => (
            <motion.div
              key={`stagger-after-${replayKey}-${row}`}
              className="rounded-lg border border-surface-700 bg-surface-800/80 px-3 py-2 text-xs font-semibold text-surface-200"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, delay: i * 0.03, ease: EMIL_EASE_OUT }}
            >
              {row}
            </motion.div>
          ))}
        </div>
      }
    />
  )
}

function HeightExpandDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const [openBefore, setOpenBefore] = useState(true)
  const [openAfter, setOpenAfter] = useState(true)

  const toggleBefore = () => setOpenBefore((v) => !v)
  const toggleAfter = () => setOpenAfter((v) => !v)

  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setOpenBefore(false)
        setOpenAfter(false)
        window.setTimeout(() => {
          setOpenBefore(true)
          setOpenAfter(true)
        }, 80)
      }}
      before={
        <div className="w-full">
          <button
            type="button"
            onClick={toggleBefore}
            className="mb-2 w-full rounded-lg border border-surface-600 bg-surface-800 px-2 py-1 text-[10px] font-semibold text-surface-300"
          >
            Toggle
          </button>
          <AnimatePresence initial={false}>
            {openBefore && (
              <motion.div
                key={`height-before-${replayKey}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden rounded-lg border border-flame/30 bg-flame/10 px-3 py-2 text-xs text-surface-200"
              >
                Height: auto — layout on every frame
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      after={
        <div className="w-full">
          <button
            type="button"
            onClick={toggleAfter}
            className="mb-2 w-full rounded-lg border border-surface-600 bg-surface-800 px-2 py-1 text-[10px] font-semibold text-surface-300"
          >
            Toggle
          </button>
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: openAfter ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div
                key={`height-after-${replayKey}`}
                className="rounded-lg border border-duo-green/30 bg-duo-green/10 px-3 py-2 text-xs text-surface-200"
                style={{ transition: `opacity 300ms ${EMIL_EASE_OUT_CSS}`, opacity: openAfter ? 1 : 0 }}
              >
                Grid 0fr → 1fr — GPU-friendly
              </div>
            </div>
          </div>
        </div>
      }
    />
  )
}

function BottomSheetDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const [showBefore, setShowBefore] = useState(true)
  const [showAfter, setShowAfter] = useState(true)

  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setShowBefore(false)
        setShowAfter(false)
        window.setTimeout(() => {
          setShowBefore(true)
          setShowAfter(true)
        }, 400)
      }}
      before={
        <SheetMini
          key={`sheet-before-${replayKey}`}
          visible={showBefore}
          enterDuration={0.28}
          exitDuration={0.28}
          easing="easeInOut"
          onDismiss={() => setShowBefore(false)}
        />
      }
      after={
        <SheetMini
          key={`sheet-after-${replayKey}`}
          visible={showAfter}
          enterDuration={0.25}
          exitDuration={0.18}
          easing={EMIL_EASE_OUT_CSS}
          onDismiss={() => setShowAfter(false)}
        />
      }
    />
  )
}

function SheetMini({
  visible,
  enterDuration,
  exitDuration,
  easing,
  onDismiss,
}: {
  visible: boolean
  enterDuration: number
  exitDuration: number
  easing: string
  onDismiss: () => void
}) {
  const isCustomEase = easing === EMIL_EASE_OUT_CSS

  return (
    <div className="relative h-36 w-full overflow-hidden rounded-lg bg-surface-900">
      <AnimatePresence>
        {visible && (
          <motion.div
            key="sheet"
            className="absolute inset-x-2 bottom-0 cursor-pointer rounded-t-xl border border-white/10 bg-surface-800 px-3 py-4 text-center"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { duration: enterDuration, ease: isCustomEase ? EMIL_EASE_OUT : 'easeInOut' } }}
            exit={{ y: '100%', transition: { duration: exitDuration, ease: isCustomEase ? EMIL_EASE_OUT : 'easeInOut' } }}
            onClick={onDismiss}
          >
            <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-surface-600" />
            <p className="text-xs font-semibold text-surface-200">Tap to dismiss</p>
            <p className="mt-1 text-[10px] text-surface-500">
              {enterDuration * 1000}ms in · {exitDuration * 1000}ms out
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NavSwitchDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const [tabBefore, setTabBefore] = useState(0)
  const [tabAfter, setTabAfter] = useState(0)

  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setTabBefore(0)
        setTabAfter(0)
      }}
      before={
        <NavMini replayKey={replayKey} active={tabBefore} onSelect={setTabBefore} animated />
      }
      after={
        <NavMini replayKey={replayKey} active={tabAfter} onSelect={setTabAfter} animated={false} />
      }
    />
  )
}

function TransitionAllDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const [phase, setPhase] = useState(1)

  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setPhase(0)
        window.setTimeout(() => setPhase(1), 80)
      }}
      before={
        <motion.div
          key={`ta-before-${replayKey}-${phase}`}
          className={`h-14 rounded-lg border-2 bg-flame/20 transition-all duration-500 ${
            phase === 1 ? 'w-full border-flame bg-flame/40' : 'w-2/3 border-flame/40'
          }`}
        />
      }
      after={
        <motion.div
          key={`ta-after-${replayKey}-${phase}`}
          className={`h-14 rounded-lg border-2 border-duo-green/40 bg-duo-green/20 transition-[width,background-color,border-color] duration-500 ${
            phase === 1 ? 'w-full border-duo-green bg-duo-green/40' : 'w-2/3'
          }`}
        />
      }
    />
  )
}

function HoverTouchDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const [stuck, setStuck] = useState(false)

  return (
    <EmilCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setStuck(false)
      }}
      before={
        <button
          key={`hover-before-${replayKey}`}
          type="button"
          onClick={() => setStuck((v) => !v)}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            stuck ? 'scale-105 bg-ice/30 text-ice' : 'bg-surface-800 text-surface-300 hover:scale-105 hover:bg-ice/30 hover:text-ice'
          }`}
        >
          Tap me (stuck hover)
        </button>
      }
      after={
        <button
          key={`hover-after-${replayKey}`}
          type="button"
          className="rounded-xl bg-surface-800 px-4 py-2 text-xs font-semibold text-surface-300 transition-transform duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-ice/30 [@media(hover:hover)_and_(pointer:fine)]:hover:text-ice"
        >
          Desktop hover only
        </button>
      }
    />
  )
}

function NavMini({
  replayKey,
  active,
  onSelect,
  animated,
}: {
  replayKey: number
  active: number
  onSelect: (i: number) => void
  animated: boolean
}) {
  const tabs = ['Home', 'Classify', 'Reveal']
  const pillId = animated ? `nav-pill-animated-${replayKey}` : undefined

  return (
    <div className="flex w-full gap-1 rounded-xl border border-white/[0.06] bg-surface-950/60 p-1">
      {tabs.map((tab, i) => (
        <button
          key={`${replayKey}-${tab}`}
          type="button"
          onClick={() => onSelect(i)}
          className={`relative flex-1 rounded-lg py-2 text-[10px] font-semibold ${
            active === i ? 'text-duo-green' : 'text-surface-500'
          }`}
        >
          {active === i &&
            (animated ? (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-lg bg-white/[0.08]"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
              />
            ) : (
              <span className="absolute inset-0 rounded-lg bg-white/[0.08]" />
            ))}
          <span className="relative">{tab}</span>
        </button>
      ))}
    </div>
  )
}
