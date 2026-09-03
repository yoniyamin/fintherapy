import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AuditMiniCompare } from './AuditMiniCompare'
import { EMIL_EASE_OUT } from './emilMotionConstants'
import {
  CrampedStatsScreen,
  GenericFintechScreen,
  SpentWhattClassifyScreen,
  SpentWhattHomeScreen,
  SpentWhattMiniPhone,
  SpentWhattRevealScreen,
  UnsafeAreaScreen,
} from './spentWhattPhoneMocks'
import { ui } from '../../lib/uiClasses'

export type AuditVisualId =
  | 'emil-button-press'
  | 'emil-scale-badge'
  | 'emil-easing'
  | 'emil-height-expand'
  | 'emil-reduced-motion'
  | 'apple-pointer-down'
  | 'apple-spring-damp'
  | 'apple-sheet-exit'
  | 'apple-frost-tab'
  | 'animate-page-stagger'
  | 'animate-progress-bar'
  | 'animate-nav-instant'
  | 'gpt-hero-lines'
  | 'gpt-grid-dense'
  | 'gpt-classify-focus'
  | 'gpt-button-contrast'
  | 'high-end-bezel'
  | 'high-end-island-nav'
  | 'high-end-magnetic-btn'
  | 'high-end-bezier'
  | 'high-end-scroll-entry'
  | 'imagegen-fintech'
  | 'imagegen-classify'
  | 'imagegen-backdrop'
  | 'imagegen-safe-area'
  | 'imagegen-density'

const HERO_COPY = 'Track every dollar without losing your weekend to spreadsheets'

/**
 * Renders a compact before/after visual for an audit recommendation.
 */
export function AuditVisualExample({
  id,
  replayKey,
  onReplay,
}: {
  id: AuditVisualId
  replayKey: number
  onReplay: () => void
}) {
  switch (id) {
    case 'emil-button-press':
      return (
        <AuditMiniCompare
          onReplay={onReplay}
          before={
            <button
              key={`ab-${replayKey}`}
              type="button"
              className="rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-2 text-xs font-bold text-white transition-all active:translate-y-[1px] active:border-b"
            >
              Press me
            </button>
          }
          after={
            <button
              key={`aa-${replayKey}`}
              type="button"
              className="rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-2 text-xs font-bold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              Press me
            </button>
          }
        />
      )
    case 'emil-scale-badge':
      return (
        <AuditMiniCompare
          onReplay={onReplay}
          before={<ScaleBadge replayKey={replayKey} variant="before" />}
          after={<ScaleBadge replayKey={replayKey} variant="after" />}
        />
      )
    case 'emil-easing':
      return (
        <AuditMiniCompare
          onReplay={onReplay}
          before={
            <motion.div
              key={`eb-${replayKey}`}
              className="h-2.5 w-2.5 rounded-full bg-flame"
              initial={{ x: -48 }}
              animate={{ x: 48 }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
            />
          }
          after={
            <motion.div
              key={`ea-${replayKey}`}
              className="h-2.5 w-2.5 rounded-full bg-duo-green"
              initial={{ x: -48 }}
              animate={{ x: 48 }}
              transition={{ duration: 0.45, ease: EMIL_EASE_OUT }}
            />
          }
        />
      )
    case 'emil-height-expand':
      return <HeightExpandVisual replayKey={replayKey} onReplay={onReplay} />
    case 'emil-reduced-motion':
      return (
        <AuditMiniCompare
          onReplay={onReplay}
          before={
            <motion.div
              key={`rmb-${replayKey}`}
              className="rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-[10px] font-semibold text-surface-200"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              y + opacity
            </motion.div>
          }
          after={
            <motion.div
              key={`rma-${replayKey}`}
              className="rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-[10px] font-semibold text-surface-200"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              opacity only
            </motion.div>
          }
        />
      )
    case 'apple-pointer-down':
      return <PointerDownVisual replayKey={replayKey} onReplay={onReplay} />
    case 'apple-spring-damp':
      return (
        <AuditMiniCompare
          onReplay={onReplay}
          before={
            <motion.div
              key={`sb-${replayKey}`}
              className="rounded-xl border border-gem/30 bg-surface-900 px-3 py-2 text-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 280 }}
            >
              <p className="text-sm">🎉</p>
              <p className="text-[10px] font-bold text-surface-100">Deck cleared</p>
            </motion.div>
          }
          after={
            <motion.div
              key={`sa-${replayKey}`}
              className="rounded-xl border border-gem/30 bg-surface-900 px-3 py-2 text-center"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            >
              <p className="text-sm">🎉</p>
              <p className="text-[10px] font-bold text-surface-100">Deck cleared</p>
            </motion.div>
          }
        />
      )
    case 'apple-sheet-exit':
      return <SheetExitVisual replayKey={replayKey} onReplay={onReplay} />
    case 'apple-frost-tab':
      return (
        <AuditMiniCompare
          before={
            <div key={`fb-${replayKey}`} className="w-full overflow-hidden rounded-lg">
              <div className="h-3 bg-gradient-to-r from-teal-700/40 to-violet-700/40" />
              <div className="border-t border-surface-700 bg-surface-900 px-2 py-1.5">
                <div className="flex justify-around text-[9px] font-semibold text-surface-500">
                  <span className="text-duo-green">Sort</span>
                  <span>Home</span>
                  <span>Reveal</span>
                </div>
              </div>
            </div>
          }
          after={
            <div key={`fa-${replayKey}`} className="relative w-full overflow-hidden rounded-lg">
              <div className="h-8 bg-gradient-to-r from-teal-700/40 to-violet-700/40" />
              <div className="absolute inset-x-1 bottom-0 border border-white/10 bg-surface-950/70 px-2 py-1.5 backdrop-blur-md">
                <div className="flex justify-around text-[9px] font-semibold text-surface-400">
                  <span className="text-duo-green">Sort</span>
                  <span>Home</span>
                  <span>Reveal</span>
                </div>
              </div>
            </div>
          }
        />
      )
    case 'animate-page-stagger':
      return (
        <AuditMiniCompare
          onReplay={onReplay}
          before={
            <StaggerRows replayKey={replayKey} variant="before" />
          }
          after={
            <StaggerRows replayKey={replayKey} variant="after" />
          }
        />
      )
    case 'animate-progress-bar':
      return (
        <AuditMiniCompare
          onReplay={onReplay}
          before={
            <div key={`pb-${replayKey}`} className="w-full px-1">
              <p className="mb-1 text-[9px] text-surface-500">width: 0 → 65%</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
                <motion.div
                  className="h-full rounded-full bg-gem"
                  initial={{ width: 0 }}
                  animate={{ width: '65%' }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          }
          after={
            <div key={`pa-${replayKey}`} className="w-full px-1">
              <p className="mb-1 text-[9px] text-surface-500">scaleX — GPU safe</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
                <motion.div
                  className="h-full w-full origin-left rounded-full bg-gem"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 0.65 }}
                  transition={{ duration: 0.6, ease: EMIL_EASE_OUT }}
                />
              </div>
            </div>
          }
        />
      )
    case 'animate-nav-instant':
      return <NavInstantVisual replayKey={replayKey} onReplay={onReplay} />
    case 'gpt-hero-lines':
      return (
        <AuditMiniCompare
          before={
            <h2 key={`hb-${replayKey}`} className="max-w-[7rem] text-sm font-bold leading-snug text-surface-100">
              {HERO_COPY}
            </h2>
          }
          after={
            <h2
              key={`ha-${replayKey}`}
              className="max-w-full text-balance text-sm font-bold leading-tight text-surface-50"
            >
              {HERO_COPY}
            </h2>
          }
        />
      )
    case 'gpt-grid-dense':
      return (
        <AuditMiniCompare
          before={
            <div key={`gb-${replayKey}`} className="grid w-full grid-cols-3 gap-1">
              <div className="col-span-2 row-span-2 rounded bg-flame/15 p-1 text-[9px] text-flame">Spend</div>
              <div className="rounded bg-surface-800 p-1 text-[9px] text-surface-400">Saved</div>
              <div className="rounded border border-dashed border-surface-600" />
            </div>
          }
          after={
            <div key={`ga-${replayKey}`} className="grid w-full grid-flow-dense grid-cols-3 gap-1">
              <div className="col-span-2 row-span-2 rounded bg-duo-green/15 p-1 text-[9px] text-duo-green">Spend</div>
              <div className="row-span-2 rounded bg-surface-800 p-1 text-[9px] text-surface-300">Trend</div>
              <div className="rounded bg-ice/10 p-1 text-[9px] text-ice">Saved</div>
            </div>
          }
        />
      )
    case 'gpt-classify-focus':
      return (
        <AuditMiniCompare
          before={
            <div key={`cfb-${replayKey}`} className="w-full space-y-1 px-0.5 text-left">
              <p className="text-[8px] font-bold uppercase tracking-widest text-flame/80">Unlock insights</p>
              <p className="text-[10px] font-bold text-surface-100">Sort smarter today</p>
              <p className="text-[8px] text-surface-500">CTA · testimonial · badge row</p>
            </div>
          }
          after={
            <SpentWhattMiniPhone key={`cfa-${replayKey}`}>
              <SpentWhattClassifyScreen />
            </SpentWhattMiniPhone>
          }
        />
      )
    case 'gpt-button-contrast':
      return (
        <AuditMiniCompare
          before={
            <button
              key={`ctb-${replayKey}`}
              type="button"
              className="rounded-xl bg-surface-800 px-4 py-2 text-xs font-bold text-surface-700"
            >
              Start sorting
            </button>
          }
          after={
            <button
              key={`cta-${replayKey}`}
              type="button"
              className="rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-2 text-xs font-bold text-white"
            >
              Start sorting
            </button>
          }
        />
      )
    case 'high-end-bezel':
      return (
        <AuditMiniCompare
          before={
            <div key={`bb-${replayKey}`} className="w-full rounded-lg bg-surface-800 p-2 shadow-md">
              <p className="text-[9px] text-surface-500">This month</p>
              <p className="text-sm font-bold text-surface-50">$2,847</p>
            </div>
          }
          after={
            <div key={`ba-${replayKey}`} className="w-full rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
              <div className="rounded-[calc(1rem-0.25rem)] bg-surface-900 p-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
                <p className="text-[9px] text-surface-500">This month</p>
                <p className="text-sm font-bold text-surface-50">$2,847</p>
              </div>
            </div>
          }
        />
      )
    case 'high-end-island-nav':
      return (
        <AuditMiniCompare
          before={
            <div key={`nb-${replayKey}`} className="w-full border-b border-surface-700 bg-surface-900 py-1">
              <div className="flex justify-around text-[9px] font-semibold">
                <span className="text-surface-500">Home</span>
                <span className="text-duo-green">Sort</span>
                <span className="text-surface-500">Reveal</span>
              </div>
            </div>
          }
          after={
            <div key={`na-${replayKey}`} className="flex w-full justify-center py-0.5">
              <nav className="flex gap-0.5 rounded-full border border-white/10 bg-white/10 px-2 py-1 backdrop-blur-xl">
                <span className="rounded-full px-2 py-0.5 text-[9px] text-surface-400">Home</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-surface-50">
                  Sort
                </span>
                <span className="rounded-full px-2 py-0.5 text-[9px] text-surface-400">Reveal</span>
              </nav>
            </div>
          }
        />
      )
    case 'high-end-magnetic-btn':
      return (
        <AuditMiniCompare
          before={
            <button
              key={`mb-${replayKey}`}
              type="button"
              className="inline-flex items-center gap-1 rounded-xl bg-duo-green px-3 py-1.5 text-xs font-bold text-white"
            >
              Continue
              <span>→</span>
            </button>
          }
          after={
            <button
              key={`ma-${replayKey}`}
              type="button"
              className="group inline-flex items-center gap-1 rounded-xl bg-duo-green px-3 py-1.5 text-xs font-bold text-white transition-transform active:scale-[0.98]"
            >
              Continue
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          }
        />
      )
    case 'high-end-bezier':
      return (
        <AuditMiniCompare
          onReplay={onReplay}
          before={
            <motion.div
              key={`beb-${replayKey}`}
              className="h-2 w-2 rounded-full bg-surface-400"
              initial={{ x: -40 }}
              animate={{ x: 40 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            />
          }
          after={
            <motion.div
              key={`bea-${replayKey}`}
              className="h-2 w-2 rounded-full bg-ice"
              initial={{ x: -40 }}
              animate={{ x: 40 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            />
          }
        />
      )
    case 'high-end-scroll-entry':
      return (
        <AuditMiniCompare
          onReplay={onReplay}
          before={
            <motion.div
              key={`seb-${replayKey}`}
              className={`${ui.glassInset} w-full p-2`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <p className="text-[10px] font-semibold text-surface-200">KPI panel</p>
            </motion.div>
          }
          after={
            <motion.div
              key={`sea-${replayKey}`}
              className={`${ui.glassInset} w-full p-2`}
              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
            >
              <p className="text-[10px] font-semibold text-surface-200">KPI panel</p>
            </motion.div>
          }
        />
      )
    case 'imagegen-fintech':
      return (
        <AuditMiniCompare
          before={
            <SpentWhattMiniPhone key={`ifb-${replayKey}`}>
              <GenericFintechScreen />
            </SpentWhattMiniPhone>
          }
          after={
            <SpentWhattMiniPhone key={`ifa-${replayKey}`}>
              <SpentWhattHomeScreen />
            </SpentWhattMiniPhone>
          }
        />
      )
    case 'imagegen-classify':
      return (
        <AuditMiniCompare
          before={
            <SpentWhattMiniPhone key={`icb-${replayKey}`}>
              <UnsafeAreaScreen />
            </SpentWhattMiniPhone>
          }
          after={
            <SpentWhattMiniPhone key={`ica-${replayKey}`}>
              <SpentWhattClassifyScreen />
            </SpentWhattMiniPhone>
          }
        />
      )
    case 'imagegen-backdrop':
      return (
        <AuditMiniCompare
          before={
            <div key={`ibb-${replayKey}`} className="h-full w-full rounded-lg bg-[#12141a] p-2">
              <p className="text-[9px] text-surface-400">Flat fill</p>
            </div>
          }
          after={
            <SpentWhattMiniPhone key={`iba-${replayKey}`}>
              <SpentWhattRevealScreen />
            </SpentWhattMiniPhone>
          }
        />
      )
    case 'imagegen-safe-area':
      return (
        <AuditMiniCompare
          before={
            <SpentWhattMiniPhone key={`isb-${replayKey}`}>
              <UnsafeAreaScreen />
            </SpentWhattMiniPhone>
          }
          after={
            <SpentWhattMiniPhone key={`isa-${replayKey}`}>
              <SpentWhattClassifyScreen />
            </SpentWhattMiniPhone>
          }
        />
      )
    case 'imagegen-density':
      return (
        <AuditMiniCompare
          before={
            <SpentWhattMiniPhone key={`idb-${replayKey}`}>
              <CrampedStatsScreen />
            </SpentWhattMiniPhone>
          }
          after={
            <SpentWhattMiniPhone key={`ida-${replayKey}`}>
              <SpentWhattHomeScreen />
            </SpentWhattMiniPhone>
          }
        />
      )
    default:
      return null
  }
}

function ScaleBadge({ replayKey, variant }: { replayKey: number; variant: 'before' | 'after' }) {
  const props =
    variant === 'before'
      ? {
          initial: { scale: 0, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { type: 'spring' as const, damping: 14, stiffness: 400 },
        }
      : {
          initial: { scale: 0.92, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          transition: { duration: 0.22, ease: EMIL_EASE_OUT },
        }

  return (
    <motion.span
      key={`badge-${variant}-${replayKey}`}
      className="inline-flex items-center gap-0.5 rounded-full border border-duo-green/40 bg-duo-green/15 px-2 py-0.5 text-[10px] font-semibold text-duo-green"
      {...props}
    >
      🛒 Groceries
    </motion.span>
  )
}

function StaggerRows({ replayKey, variant }: { replayKey: number; variant: 'before' | 'after' }) {
  const rows = ['XP hero', 'Queue', 'CTA']

  return (
    <div className="flex w-full flex-col gap-1">
      {rows.map((row, i) => (
        <motion.div
          key={`${variant}-${replayKey}-${row}`}
          className="rounded border border-surface-700 bg-surface-800/80 px-2 py-1 text-[9px] font-semibold text-surface-200"
          initial={variant === 'before' ? { opacity: 0, y: 12 } : { opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            variant === 'before'
              ? { duration: 0.35, delay: i * 0.08 }
              : { duration: 0.15, delay: i * 0.02 }
          }
        >
          {row}
        </motion.div>
      ))}
    </div>
  )
}

function PointerDownVisual({ replayKey, onReplay }: { replayKey: number; onReplay: () => void }) {
  const [pressedBefore, setPressedBefore] = useState(false)
  const [pressedAfter, setPressedAfter] = useState(false)

  return (
    <AuditMiniCompare
      onReplay={() => {
        onReplay()
        setPressedBefore(false)
        setPressedAfter(false)
      }}
      before={
        <button
          key={`pdb-${replayKey}`}
          type="button"
          className={`rounded-lg px-3 py-1.5 text-[10px] font-bold ${
            pressedBefore ? 'bg-duo-green text-white' : 'bg-surface-700 text-surface-200'
          }`}
          onClick={() => setPressedBefore((v) => !v)}
        >
          Click to highlight
        </button>
      }
      after={
        <button
          key={`pda-${replayKey}`}
          type="button"
          className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-transform duration-100 ${
            pressedAfter ? 'scale-[0.97] bg-duo-green text-white' : 'bg-surface-700 text-surface-200'
          }`}
          onPointerDown={() => setPressedAfter(true)}
          onPointerUp={() => setPressedAfter(false)}
          onPointerLeave={() => setPressedAfter(false)}
        >
          Press — instant
        </button>
      }
    />
  )
}

function SheetExitVisual({ replayKey, onReplay }: { replayKey: number; onReplay: () => void }) {
  const [openBefore, setOpenBefore] = useState(true)
  const [openAfter, setOpenAfter] = useState(true)

  return (
    <AuditMiniCompare
      onReplay={() => {
        onReplay()
        setOpenBefore(false)
        setOpenAfter(false)
        window.setTimeout(() => {
          setOpenBefore(true)
          setOpenAfter(true)
        }, 100)
      }}
      beforeLabel="Exit = enter (250ms)"
      afterLabel="Exit faster (180ms)"
      before={
        <div key={`seb-wrap-${replayKey}`} className="relative h-16 w-full overflow-hidden rounded-lg bg-surface-900">
          <AnimatePresence>
            {openBefore && (
              <motion.div
                key={`sheet-b-${replayKey}`}
                className="absolute inset-x-0 bottom-0 rounded-t-lg border border-white/10 bg-surface-800 px-2 py-1.5"
                initial={{ y: '100%' }}
                animate={{ y: 0, transition: { duration: 0.25, ease: 'easeInOut' } }}
                exit={{ y: '100%', transition: { duration: 0.25, ease: 'easeInOut' } }}
              >
                <p className="text-[9px] font-semibold text-surface-200">Category sheet</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      after={
        <div key={`sea-wrap-${replayKey}`} className="relative h-16 w-full overflow-hidden rounded-lg bg-surface-900">
          <AnimatePresence>
            {openAfter && (
              <motion.div
                key={`sheet-a-${replayKey}`}
                className="absolute inset-x-0 bottom-0 rounded-t-lg border border-white/10 bg-surface-800 px-2 py-1.5"
                initial={{ y: '100%' }}
                animate={{ y: 0, transition: { duration: 0.25, ease: 'easeOut' } }}
                exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
              >
                <p className="text-[9px] font-semibold text-surface-200">Category sheet</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
    />
  )
}

function HeightExpandVisual({ replayKey, onReplay }: { replayKey: number; onReplay: () => void }) {
  const [openBefore, setOpenBefore] = useState(true)
  const [openAfter, setOpenAfter] = useState(true)

  return (
    <AuditMiniCompare
      onReplay={() => {
        onReplay()
        setOpenBefore(false)
        setOpenAfter(false)
        window.setTimeout(() => {
          setOpenBefore(true)
          setOpenAfter(true)
        }, 100)
      }}
      before={
        <div className="w-full">
          <button
            type="button"
            onClick={() => setOpenBefore((v) => !v)}
            className="mb-1 w-full rounded border border-surface-600 bg-surface-800 py-0.5 text-[9px] text-surface-400"
          >
            Toggle
          </button>
          <AnimatePresence initial={false}>
            {openBefore && (
              <motion.div
                key={`hb-${replayKey}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden rounded border border-flame/30 bg-flame/10 px-2 py-1 text-[9px] text-surface-300"
              >
                height: auto
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
      after={
        <div className="w-full">
          <button
            type="button"
            onClick={() => setOpenAfter((v) => !v)}
            className="mb-1 w-full rounded border border-surface-600 bg-surface-800 py-0.5 text-[9px] text-surface-400"
          >
            Toggle
          </button>
          <div className={`grid transition-[grid-template-rows] duration-300 ${openAfter ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="rounded border border-duo-green/30 bg-duo-green/10 px-2 py-1 text-[9px] text-surface-300">
                grid 0fr → 1fr
              </div>
            </div>
          </div>
        </div>
      }
    />
  )
}

function NavInstantVisual({ replayKey, onReplay }: { replayKey: number; onReplay: () => void }) {
  const [activeBefore, setActiveBefore] = useState(0)
  const [activeAfter, setActiveAfter] = useState(0)
  const tabs = ['Home', 'Sort', 'Reveal']

  return (
    <AuditMiniCompare
      onReplay={() => {
        onReplay()
        setActiveBefore(0)
        setActiveAfter(0)
      }}
      before={
        <div key={`nib-${replayKey}`} className="flex w-full gap-0.5 rounded-lg border border-white/[0.06] bg-surface-950/60 p-0.5">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveBefore(i)}
              className={`relative flex-1 rounded py-1 text-[9px] font-semibold ${activeBefore === i ? 'text-duo-green' : 'text-surface-500'}`}
            >
              {activeBefore === i && (
                <motion.span
                  layoutId={`audit-nav-b-${replayKey}`}
                  className="absolute inset-0 rounded bg-white/[0.08]"
                  transition={{ duration: 0.25 }}
                />
              )}
              <span className="relative">{tab}</span>
            </button>
          ))}
        </div>
      }
      after={
        <div key={`nia-${replayKey}`} className="flex w-full gap-0.5 rounded-lg border border-white/[0.06] bg-surface-950/60 p-0.5">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveAfter(i)}
              className={`flex-1 rounded py-1 text-[9px] font-semibold ${
                activeAfter === i ? 'bg-white/[0.08] text-duo-green' : 'text-surface-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      }
    />
  )
}
