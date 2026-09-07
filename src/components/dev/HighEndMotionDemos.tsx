import { type ComponentProps } from 'react'
import { motion } from 'framer-motion'
import EmilCompareFrame from './EmilCompareFrame'
import type { HighEndSuggestion } from './highEndImprovementSuggestions'
import type { EmilSuggestion } from './emilImprovementSuggestions'

const HIGH_END_EASE = [0.32, 0.72, 0, 1] as const

interface DemoProps {
  replayKey: number
  suggestion: HighEndSuggestion
  onReplay: () => void
}

function HighEndCompareFrame(
  props: Omit<ComponentProps<typeof EmilCompareFrame>, 'afterLabel' | 'suggestion'> & {
    suggestion: HighEndSuggestion
  },
) {
  return (
    <EmilCompareFrame
      {...props}
      suggestion={props.suggestion as EmilSuggestion}
      afterLabel="After (high-end)"
    />
  )
}

/**
 * Routes high-end visual design demos to their before/after implementations.
 */
export function HighEndSuggestionDemo({ id, replayKey, suggestion, onReplay }: DemoProps & { id: string }) {
  switch (id) {
    case 'double-bezel-card':
      return <DoubleBezelDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'floating-island-nav':
      return <FloatingNavDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'cubic-bezier-motion':
      return <CubicBezierDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'magnetic-button':
      return <MagneticButtonDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    case 'scroll-fade-entry':
      return <ScrollFadeEntryDemo replayKey={replayKey} suggestion={suggestion} onReplay={onReplay} />
    default:
      return null
  }
}

function DemoCardContent() {
  return (
    <>
      <p className="text-[10px] font-medium uppercase tracking-widest text-surface-500">This month</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-surface-50">$2,847</p>
      <p className="mt-0.5 text-[10px] text-duo-green">↓ 12% vs last month</p>
    </>
  )
}

function DoubleBezelDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <HighEndCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <div key={`bezel-before-${replayKey}`} className="w-full rounded-xl bg-surface-800 p-4 shadow-md">
          <DemoCardContent />
        </div>
      }
      after={
        <div
          key={`bezel-after-${replayKey}`}
          className="w-full rounded-[2rem] bg-white/5 p-1.5 ring-1 ring-white/10"
        >
          <div className="rounded-[calc(2rem-0.375rem)] bg-surface-900 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
            <DemoCardContent />
          </div>
        </div>
      }
    />
  )
}

function FloatingNavDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  const tabs = ['Home', 'Classify', 'Reveal']

  return (
    <HighEndCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <div key={`nav-before-${replayKey}`} className="w-full overflow-hidden rounded-lg border border-surface-700">
          <div className="sticky top-0 w-full border-b border-surface-700 bg-surface-900">
            <div className="flex justify-around px-1 py-2">
              {tabs.map((tab, i) => (
                <span
                  key={tab}
                  className={`px-2 py-1 text-[10px] font-semibold ${i === 1 ? 'text-duo-green' : 'text-surface-500'}`}
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>
          <div className="h-8 bg-surface-950/60" />
        </div>
      }
      after={
        <div key={`nav-after-${replayKey}`} className="relative flex h-14 w-full items-start justify-center pt-1">
          <nav className="flex gap-1 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 backdrop-blur-xl">
            {tabs.map((tab, i) => (
              <span
                key={tab}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  i === 1 ? 'bg-white/10 text-surface-50' : 'text-surface-400'
                }`}
              >
                {tab}
              </span>
            ))}
          </nav>
        </div>
      }
    />
  )
}

function CubicBezierDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <HighEndCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <div key={`ease-before-${replayKey}`} className="relative h-8 w-full">
          <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-surface-700" />
          <motion.div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-flame"
            initial={{ left: '10%' }}
            animate={{ left: 'calc(100% - 1.5rem - 10%)' }}
            transition={{ duration: 0.7, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse', repeatDelay: 0.3 }}
          />
        </div>
      }
      after={
        <div key={`ease-after-${replayKey}`} className="relative h-8 w-full">
          <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-surface-700" />
          <motion.div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-ice"
            initial={{ left: '10%' }}
            animate={{ left: 'calc(100% - 1.5rem - 10%)' }}
            transition={{
              duration: 0.7,
              ease: HIGH_END_EASE,
              repeat: Infinity,
              repeatType: 'reverse',
              repeatDelay: 0.3,
            }}
          />
        </div>
      }
    />
  )
}

function MagneticButtonDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <HighEndCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <button
          key={`btn-before-${replayKey}`}
          type="button"
          className="rounded-xl bg-duo-green px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-duo-green-dark"
        >
          View report
        </button>
      }
      after={
        <button
          key={`btn-after-${replayKey}`}
          type="button"
          className="group flex items-center gap-2 rounded-full bg-surface-50 px-5 py-2.5 text-xs font-bold text-surface-950 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
        >
          View report
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105">
            ↗
          </span>
        </button>
      }
    />
  )
}

function ScrollFadeEntryDemo({ replayKey, suggestion, onReplay }: DemoProps) {
  return (
    <HighEndCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <div
          key={`scroll-before-${replayKey}`}
          className="w-full rounded-xl border border-surface-700 bg-surface-800/80 px-3 py-3 text-center"
        >
          <p className="text-xs font-semibold text-surface-200">Budget insight</p>
          <p className="mt-1 text-[10px] text-surface-500">Appears instantly on mount</p>
        </div>
      }
      after={
        <motion.div
          key={`scroll-after-${replayKey}`}
          className="w-full rounded-xl border border-white/10 bg-surface-800/80 px-3 py-3 text-center"
          initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.85, ease: HIGH_END_EASE }}
        >
          <p className="text-xs font-semibold text-surface-200">Budget insight</p>
          <p className="mt-1 text-[10px] text-surface-500">Fade-up blur on viewport entry</p>
        </motion.div>
      }
    />
  )
}
