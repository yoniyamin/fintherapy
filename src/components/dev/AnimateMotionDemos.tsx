import { useCallback, useState, type ComponentProps } from 'react'
import { motion } from 'framer-motion'
import EmilCompareFrame from './EmilCompareFrame'
import { EMIL_EASE_OUT, EMIL_EASE_OUT_CSS } from './emilMotionConstants'
import type { AnimateSuggestion } from './animateImprovementSuggestions'
import type { EmilSuggestion } from './emilImprovementSuggestions'

interface DemoProps {
  replayKey: number
  suggestion: EmilSuggestion
  onReplay: () => void
}

function AnimateCompareFrame(
  props: Omit<ComponentProps<typeof EmilCompareFrame>, 'suggestion' | 'afterLabel'> & {
    suggestion: EmilSuggestion
  },
) {
  return <EmilCompareFrame {...props} afterLabel="After (animate skill)" />
}

function animateSuggestionAsEmil(s: AnimateSuggestion): EmilSuggestion {
  return {
    ...s,
    before: 'Before',
    after: 'After',
  }
}

export function AnimateSuggestionDemo({
  id,
  replayKey,
  suggestion,
  onReplay,
}: {
  id: string
  replayKey: number
  suggestion: AnimateSuggestion
  onReplay: () => void
}) {
  const frame = animateSuggestionAsEmil(suggestion)

  switch (id) {
    case 'frequency-gate':
      return <FrequencyGateDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'purpose-decorative':
      return <PurposeDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'toast-interruptibility':
      return <ToastToolDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'scale-entrance':
      return <ScaleEntranceDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'ease-in-vs-out':
      return <EaseInVsOutDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'reduced-motion-hover':
      return <ReducedMotionHoverDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    default:
      return null
  }
}

function FrequencyGateDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const [tabBefore, setTabBefore] = useState(0)
  const [tabAfter, setTabAfter] = useState(0)
  const tabs = ['Home', 'Classify', 'Reveal']

  return (
    <AnimateCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setTabBefore(0)
        setTabAfter(0)
      }}
      before={
        <NavRailMini
          key={`nav-before-${replayKey}`}
          tabs={tabs}
          active={tabBefore}
          onSelect={setTabBefore}
          animated
        />
      }
      after={
        <NavRailMini
          key={`nav-after-${replayKey}`}
          tabs={tabs}
          active={tabAfter}
          onSelect={setTabAfter}
          animated={false}
        />
      }
    />
  )
}

function NavRailMini({
  tabs,
  active,
  onSelect,
  animated,
}: {
  tabs: string[]
  active: number
  onSelect: (i: number) => void
  animated: boolean
}) {
  return (
    <div className="relative w-full pb-5">
      <div className="flex w-full gap-1 rounded-xl border border-white/[0.06] bg-surface-950/60 p-1">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => onSelect(i)}
            className={`relative flex-1 rounded-lg py-2 text-[10px] font-semibold ${
              active === i ? 'text-duo-green' : 'text-surface-500'
            }`}
          >
            {active === i &&
              (animated ? (
                <motion.span
                  layoutId="animate-nav-pill"
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
      <p className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-surface-600">
        {animated ? '100+/day — animates every tap' : '100+/day — instant'}
      </p>
    </div>
  )
}

function PurposeDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <AnimateCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <KpiCardMini
          key={`purpose-before-${replayKey}`}
          variant="decorative"
          replayKey={replayKey}
        />
      }
      after={
        <KpiCardMini key={`purpose-after-${replayKey}`} variant="feedback" replayKey={replayKey} />
      }
    />
  )
}

function KpiCardMini({
  variant,
  replayKey,
}: {
  variant: 'decorative' | 'feedback'
  replayKey: number
}) {
  if (variant === 'decorative') {
    return (
      <motion.div
        key={replayKey}
        className="w-full rounded-xl border border-flame/30 bg-surface-900 px-4 py-3 text-center"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.p
          className="text-2xl font-extrabold text-flame"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          $4,280
        </motion.p>
        <p className="mt-1 text-[10px] text-surface-500">Spent this month — drifting</p>
      </motion.div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="w-full rounded-xl border border-duo-green/30 bg-surface-900 px-4 py-3 text-center">
        <p className="text-2xl font-extrabold text-surface-50">$4,280</p>
        <p className="mt-1 text-[10px] text-surface-500">Static data — readable</p>
      </div>
      <button
        type="button"
        className="rounded-lg border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-2 text-xs font-bold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        Press feedback only
      </button>
    </div>
  )
}

function ToastToolDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const [burstBefore, setBurstBefore] = useState(0)
  const [burstAfter, setBurstAfter] = useState(0)

  const fireBefore = useCallback(() => setBurstBefore((n) => n + 1), [])
  const fireAfter = useCallback(() => setBurstAfter((n) => n + 1), [])

  return (
    <AnimateCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setBurstBefore(0)
        setBurstAfter(0)
      }}
      before={
        <ToastPanel
          key={`toast-before-${replayKey}`}
          burst={burstBefore}
          onFire={fireBefore}
          mode="keyframes"
        />
      }
      after={
        <ToastPanel
          key={`toast-after-${replayKey}`}
          burst={burstAfter}
          onFire={fireAfter}
          mode="transition"
        />
      }
    />
  )
}

function ToastPanel({
  burst,
  onFire,
  mode,
}: {
  burst: number
  onFire: () => void
  mode: 'keyframes' | 'transition'
}) {
  const visible = burst > 0
  const progress = burst % 2

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button
        type="button"
        onClick={onFire}
        className="rounded-lg border border-surface-600 bg-surface-800 px-3 py-1 text-[10px] font-semibold text-surface-300"
      >
        Fire toast rapidly
      </button>
      <div className="relative h-16 w-full overflow-hidden rounded-lg bg-surface-900">
        {mode === 'keyframes' ? (
          <div
            key={burst}
            className={`toast-keyframes absolute inset-x-2 top-2 rounded-lg border px-3 py-2 text-[10px] font-semibold ${
              visible ? 'toast-keyframes-in' : ''
            } ${progress === 0 ? 'border-flame/40 bg-flame/15 text-flame' : 'border-ice/40 bg-ice/15 text-ice'}`}
          >
            Keyframes restart
          </div>
        ) : (
          <div
            className="absolute inset-x-2 top-2 rounded-lg border px-3 py-2 text-[10px] font-semibold transition-[transform,opacity] duration-200"
            style={{
              transform: visible ? 'translateY(0)' : 'translateY(-12px)',
              opacity: visible ? 1 : 0,
              transitionTimingFunction: EMIL_EASE_OUT_CSS,
              borderColor: progress === 0 ? 'rgb(255 120 80 / 0.4)' : 'rgb(120 200 255 / 0.4)',
              backgroundColor: progress === 0 ? 'rgb(255 120 80 / 0.15)' : 'rgb(120 200 255 / 0.15)',
              color: progress === 0 ? 'rgb(255 160 120)' : 'rgb(160 220 255)',
            }}
          >
            Transition retargets
          </div>
        )}
      </div>
      <p className="text-[9px] text-surface-600">
        {mode === 'keyframes' ? 'Each click restarts from 0' : 'Mid-flight retarget'}
      </p>
      <style>{`
        @keyframes toast-slide-in {
          from { transform: translateY(-16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .toast-keyframes-in {
          animation: toast-slide-in 0.35s ease-in forwards;
        }
      `}</style>
    </div>
  )
}

function ScaleEntranceDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <AnimateCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={<EntranceBadge replayKey={replayKey} variant="scale-zero" />}
      after={<EntranceBadge replayKey={replayKey} variant="scale-fade" />}
    />
  )
}

function EntranceBadge({ replayKey, variant }: { replayKey: number; variant: 'scale-zero' | 'scale-fade' }) {
  const props =
    variant === 'scale-zero'
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
      {...props}
    >
      🛒 Groceries
    </motion.span>
  )
}

function EaseInVsOutDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <AnimateCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <motion.div
          key={`easein-${replayKey}`}
          className="w-full rounded-xl border border-flame/30 bg-flame/10 px-4 py-3 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeIn' }}
        >
          <p className="text-xs font-bold text-surface-100">ease-in entrance</p>
          <p className="mt-1 text-[10px] text-surface-500">Slow start — user waits</p>
        </motion.div>
      }
      after={
        <motion.div
          key={`easeout-${replayKey}`}
          className="w-full rounded-xl border border-duo-green/30 bg-duo-green/10 px-4 py-3 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EMIL_EASE_OUT }}
        >
          <p className="text-xs font-bold text-surface-100">ease-out entrance</p>
          <p className="mt-1 text-[10px] text-surface-500">Snappy arrival — same duration feels faster</p>
        </motion.div>
      }
    />
  )
}

function ReducedMotionHoverDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const [stuck, setStuck] = useState(false)

  return (
    <AnimateCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setStuck(false)
      }}
      before={
        <div className="flex w-full flex-col items-center gap-3">
          <motion.div
            key={`rm-before-card-${replayKey}`}
            className="w-full rounded-xl border border-surface-600 bg-surface-800 px-3 py-2 text-center text-xs font-semibold text-surface-200"
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            Full transform entrance
          </motion.div>
          <button
            type="button"
            onClick={() => setStuck((v) => !v)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              stuck
                ? 'scale-105 bg-ice/30 text-ice'
                : 'bg-surface-800 text-surface-300 hover:scale-105 hover:bg-ice/30 hover:text-ice'
            }`}
          >
            Tap (stuck hover)
          </button>
        </div>
      }
      after={
        <div className="flex w-full flex-col items-center gap-3">
          <motion.div
            key={`rm-after-card-${replayKey}`}
            className="w-full rounded-xl border border-duo-green/30 bg-duo-green/10 px-3 py-2 text-center text-xs font-semibold text-surface-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            Opacity only (reduced motion)
          </motion.div>
          <button
            type="button"
            className="rounded-xl bg-surface-800 px-4 py-2 text-xs font-semibold text-surface-300 transition-transform duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-ice/30 [@media(hover:hover)_and_(pointer:fine)]:hover:text-ice"
          >
            Desktop hover only
          </button>
        </div>
      }
    />
  )
}
