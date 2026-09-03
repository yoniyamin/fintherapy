import { useCallback, useState, type ComponentProps } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import EmilCompareFrame from './EmilCompareFrame'
import type { AppleSuggestion } from './appleImprovementSuggestions'
import type { EmilSuggestion } from './emilImprovementSuggestions'

interface DemoProps {
  replayKey: number
  suggestion: EmilSuggestion
  onReplay: () => void
}

function AppleCompareFrame(
  props: Omit<ComponentProps<typeof EmilCompareFrame>, 'suggestion'> & { suggestion: EmilSuggestion },
) {
  return <EmilCompareFrame {...props} afterLabel="After (Apple)" />
}

function appleSuggestionAsEmil(s: AppleSuggestion) {
  return {
    ...s,
    before: 'Production pattern',
    after: 'Apple fluid pattern',
  }
}

export function AppleSuggestionDemo({
  id,
  replayKey,
  suggestion,
  onReplay,
}: {
  id: string
  replayKey: number
  suggestion: AppleSuggestion
  onReplay: () => void
}) {
  const frame = appleSuggestionAsEmil(suggestion)

  switch (id) {
    case 'pointer-down-feedback':
      return <PointerDownDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'spring-damping':
      return <SpringDampingDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'interruptibility':
      return <InterruptibilityDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'velocity-handoff':
      return <VelocityHandoffDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'rubber-band':
      return <RubberBandDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'spatial-consistency':
      return <SpatialConsistencyDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'frosted-chrome':
      return <FrostedChromeDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'popover-origin':
      return <PopoverOriginDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'optical-type':
      return <OpticalTypeDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    default:
      return null
  }
}

function PointerDownDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const [pressedBefore, setPressedBefore] = useState(false)
  const [pressedAfter, setPressedAfter] = useState(false)

  return (
    <AppleCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setPressedBefore(false)
        setPressedAfter(false)
      }}
      before={
        <button
          key={`pd-before-${replayKey}`}
          type="button"
          className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-colors duration-150 ${
            pressedBefore ? 'bg-duo-green text-white' : 'bg-surface-700 text-surface-200'
          }`}
          onClick={() => setPressedBefore((v) => !v)}
        >
          Tap (feedback on click)
        </button>
      }
      after={
        <button
          key={`pd-after-${replayKey}`}
          type="button"
          className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-[transform,background-color] duration-100 ease-out ${
            pressedAfter ? 'scale-[0.97] bg-duo-green text-white' : 'bg-surface-700 text-surface-200'
          }`}
          onPointerDown={() => setPressedAfter(true)}
          onPointerUp={() => setPressedAfter(false)}
          onPointerLeave={() => setPressedAfter(false)}
        >
          Press (instant on down)
        </button>
      }
    />
  )
}

function SpringDampingDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <AppleCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <motion.div
          key={`spring-before-${replayKey}`}
          className="rounded-xl border border-flame/40 bg-flame/15 px-4 py-3 text-xs font-semibold text-flame"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.45, duration: 0.55 }}
        >
          Bouncy menu enter
        </motion.div>
      }
      after={
        <motion.div
          key={`spring-after-${replayKey}`}
          className="rounded-xl border border-duo-green/40 bg-duo-green/15 px-4 py-3 text-xs font-semibold text-duo-green"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
        >
          Critically damped
        </motion.div>
      }
    />
  )
}

function InterruptibilityDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <AppleCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={<InterruptPanel key={`int-before-${replayKey}`} mode="css" />}
      after={<InterruptPanel key={`int-after-${replayKey}`} mode="spring" />}
    />
  )
}

function InterruptPanel({ mode }: { mode: 'css' | 'spring' }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const toggle = () => {
    if (mode === 'css') {
      setBusy(true)
      setOpen((v) => !v)
      window.setTimeout(() => setBusy(false), 400)
      return
    }
    setOpen((v) => !v)
  }

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={toggle}
        className="w-full rounded-lg border border-surface-600 bg-surface-800 px-2 py-1 text-[10px] font-semibold text-surface-300 disabled:opacity-50"
      >
        Tap fast to reverse
      </button>
      <div className="relative h-24 overflow-hidden rounded-lg bg-surface-900">
        {mode === 'css' ? (
          <div
            className="absolute inset-x-2 bottom-0 rounded-t-lg border border-white/10 bg-surface-700 px-3 py-2 text-[10px] text-surface-200 transition-transform duration-[400ms] ease-in-out"
            style={{ transform: open ? 'translateY(0)' : 'translateY(100%)' }}
          >
            CSS transition — locks mid-flight
          </div>
        ) : (
          <motion.div
            className="absolute inset-x-2 bottom-0 rounded-t-lg border border-white/10 bg-surface-700 px-3 py-2 text-[10px] text-surface-200"
            animate={{ y: open ? 0 : '100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          >
            Spring — retargets instantly
          </motion.div>
        )}
      </div>
    </div>
  )
}

function VelocityHandoffDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <AppleCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={<VelocitySheet key={`vel-before-${replayKey}`} withVelocity={false} />}
      after={<VelocitySheet key={`vel-after-${replayKey}`} withVelocity />}
    />
  )
}

function VelocitySheet({ withVelocity }: { withVelocity: boolean }) {
  const y = useMotionValue(0)
  const [dragging, setDragging] = useState(false)

  const onRelease = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      setDragging(false)
      const dismiss = info.offset.y > 40 || info.velocity.y > 300
      if (dismiss) {
        animate(
          y,
          120,
          withVelocity
            ? { type: 'spring', bounce: 0.15, duration: 0.35, velocity: info.velocity.y }
            : { duration: 0.35, ease: 'easeInOut' },
        )
      } else {
        animate(
          y,
          0,
          withVelocity
            ? { type: 'spring', bounce: 0, duration: 0.3, velocity: info.velocity.y }
            : { duration: 0.3, ease: 'easeInOut' },
        )
      }
    },
    [withVelocity, y],
  )

  return (
    <div className="relative h-32 w-full overflow-hidden rounded-lg bg-surface-900">
      <motion.div
        className="absolute inset-x-2 bottom-0 cursor-grab touch-none rounded-t-xl border border-white/10 bg-surface-800 px-3 py-4 active:cursor-grabbing"
        style={{ y }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 120 }}
        dragElastic={0}
        onDragStart={() => setDragging(true)}
        onDragEnd={onRelease}
      >
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-surface-600" />
        <p className="text-center text-[10px] font-semibold text-surface-300">
          {dragging ? 'Flick down fast' : 'Drag & flick'}
        </p>
        <p className="mt-1 text-center text-[9px] text-surface-500">
          {withVelocity ? 'Velocity carries through' : 'Fixed ease — seam visible'}
        </p>
      </motion.div>
    </div>
  )
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

function RubberBandDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <AppleCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={<RubberDrag key={`rb-before-${replayKey}`} soft={false} />}
      after={<RubberDrag key={`rb-after-${replayKey}`} soft />}
    />
  )
}

function RubberDrag({ soft }: { soft: boolean }) {
  const x = useMotionValue(0)
  const displayX = useTransform(x, (v) => {
    const max = 56
    if (!soft) return Math.max(-max, Math.min(max, v))
    if (v > max) return max + rubberband(v - max, max)
    if (v < -max) return -max - rubberband(-max - v, max)
    return v
  })

  return (
    <div className="relative h-24 w-full overflow-hidden rounded-lg bg-surface-900">
      <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-surface-700" />
      <motion.div
        className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full bg-ice active:cursor-grabbing"
        style={{ x: displayX }}
        drag="x"
        dragConstraints={soft ? false : { left: -56, right: 56 }}
        dragElastic={0}
        onDrag={(_, info) => {
          if (soft) x.set(info.offset.x)
        }}
      />
      <p className="absolute inset-x-0 bottom-2 text-center text-[9px] text-surface-500">
        {soft ? 'Rubber-band past edge' : 'Hard stop at edge'}
      </p>
    </div>
  )
}

function SpatialConsistencyDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const [resetBefore, setResetBefore] = useState(0)
  const [resetAfter, setResetAfter] = useState(0)

  return (
    <AppleCompareFrame
      suggestion={suggestion}
      onReplay={() => {
        onReplay()
        setResetBefore((n) => n + 1)
        setResetAfter((n) => n + 1)
      }}
      before={
        <SpatialPanel
          key={`sp-before-${replayKey}-${resetBefore}`}
          exitWrong
          onDismiss={() => {}}
        />
      }
      after={
        <SpatialPanel
          key={`sp-after-${replayKey}-${resetAfter}`}
          exitWrong={false}
          onDismiss={() => {}}
        />
      }
    />
  )
}

function SpatialPanel({
  exitWrong,
}: {
  exitWrong: boolean
  onDismiss: () => void
}) {
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>('in')

  if (phase === 'done') {
    return <p className="text-[10px] text-surface-500">Dismissed — replay to reset</p>
  }

  const target = phase === 'out' ? (exitWrong ? { x: '110%', y: 0 } : { y: '100%', x: 0 }) : { y: 0, x: 0 }

  return (
    <div className="relative h-28 w-full overflow-hidden rounded-lg bg-surface-900">
      <motion.div
        className="absolute inset-x-3 bottom-0 cursor-pointer rounded-t-lg border border-white/10 bg-surface-800 px-3 py-3"
        initial={{ y: '100%', x: 0 }}
        animate={target}
        transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
        onClick={() => {
          setPhase('out')
          window.setTimeout(() => setPhase('done'), 320)
        }}
        whileTap={{ scale: 0.98 }}
      >
        <p className="text-[10px] font-semibold text-surface-200">Tap to dismiss</p>
        <p className="mt-1 text-[9px] text-surface-500">
          {exitWrong ? 'Exits sideways' : 'Exits back down'}
        </p>
      </motion.div>
    </div>
  )
}

function FrostedChromeDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <AppleCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={<ChromeMock key={`chrome-before-${replayKey}`} frosted={false} />}
      after={<ChromeMock key={`chrome-after-${replayKey}`} frosted />}
    />
  )
}

function ChromeMock({ frosted }: { frosted: boolean }) {
  return (
    <div className="relative h-32 w-full overflow-hidden rounded-lg bg-gradient-to-b from-gem/20 via-surface-900 to-ice/20">
      <div className="absolute inset-0 flex flex-col justify-end gap-1 p-3 pb-12 text-[10px] text-surface-400">
        <p>Transaction row</p>
        <p>Transaction row</p>
        <p>Transaction row</p>
      </div>
      <div
        className={`absolute inset-x-0 bottom-0 border-t px-3 py-2 ${
          frosted
            ? 'border-white/10 bg-surface-950/55 backdrop-blur-xl'
            : 'border-surface-700 bg-surface-900'
        }`}
      >
        <p className="text-[10px] font-semibold text-surface-200">Tab bar</p>
      </div>
    </div>
  )
}

function PopoverOriginDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <AppleCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={<OriginPopover key={`origin-before-${replayKey}`} fromCenter />}
      after={<OriginPopover key={`origin-after-${replayKey}`} fromCenter={false} />}
    />
  )
}

function OriginPopover({ fromCenter }: { fromCenter: boolean }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="relative h-28 w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-[10px] font-semibold text-surface-200"
      >
        Trigger
      </button>
      {open && (
        <motion.div
          className="absolute bottom-10 left-1/2 w-32 -translate-x-1/2 rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-center text-[10px] text-surface-200"
          style={{ transformOrigin: fromCenter ? 'center center' : '50% 100%' }}
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
        >
          {fromCenter ? 'Scales from center' : 'Scales from trigger'}
        </motion.div>
      )}
    </div>
  )
}

function OpticalTypeDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <AppleCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <div key={`type-before-${replayKey}`} className="text-center">
          <p className="text-2xl font-bold leading-normal tracking-normal text-surface-100">Deck Cleared</p>
          <p className="mt-2 text-xs leading-snug tracking-normal text-surface-400">Fixed tracking at all sizes</p>
        </div>
      }
      after={
        <div key={`type-after-${replayKey}`} className="text-center">
          <p className="text-2xl font-bold leading-none tracking-tight text-surface-100">Deck Cleared</p>
          <p className="mt-2 text-xs leading-relaxed tracking-wide text-surface-400">Tight display · open body</p>
        </div>
      }
    />
  )
}
