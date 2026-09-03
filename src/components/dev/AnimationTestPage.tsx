import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  encouragementDurationMs,
  levelUpMessage,
  milestoneMessage,
  rankUpMessage,
  timeMessage,
  type EncouragementAnimation as EncouragementAnimationKey,
  type EncouragementKind,
} from '../../lib/classifyEncouragement'
import type { ClassifyEncouragementBurst } from '../../hooks/useClassifyEncouragement'
import { ui } from '../../lib/uiClasses'
import ScreenSurface from '../layout/ScreenSurface'
import EncouragementAnimation from '../swipe/EncouragementAnimation'
import EncouragementBurst from '../swipe/EncouragementBurst'
import DeckClearedScreen, { type DeckClearedViewport } from '../swipe/DeckClearedScreen'
import DevLabTabs from './DevLabTabs'
import ScrollReportMockup from './ScrollReportMockup'

const INLINE_ANIMATIONS: EncouragementAnimationKey[] = ['high-five', 'medal', 'star', 'trophy']

const ENGINE_LABEL: Record<EncouragementAnimationKey, string> = {
  'high-five': 'anime.js',
  medal: 'anime.js',
  star: 'SMIL SVG',
  trophy: 'anime.js',
}

interface PreviewSpec {
  id: EncouragementAnimationKey
  label: string
  engine: string
  durationMs: number
  buildBurst: (burstId: number) => ClassifyEncouragementBurst
}

/** Builds overlay burst payloads for each encouragement animation variant. */
function buildInlinePreviewSpecs(): PreviewSpec[] {
  return INLINE_ANIMATIONS.map((animation) => ({
    id: animation,
    label: animation,
    engine: ENGINE_LABEL[animation],
    durationMs: encouragementDurationMs(animation),
    buildBurst: (burstId) => ({
      id: burstId,
      kind: 'milestone',
      animation,
      message: milestoneMessage(10, 0),
      showConfetti: true,
      durationMs: encouragementDurationMs(animation) + 4000,
    }),
  }))
}

const OVERLAY_KIND_SAMPLES: { kind: EncouragementKind; animation: EncouragementAnimationKey; message: string }[] = [
  { kind: 'milestone', animation: 'high-five', message: milestoneMessage(10, 0) },
  { kind: 'time', animation: 'star', message: timeMessage(0) },
  { kind: 'rank-up', animation: 'medal', message: rankUpMessage('Alex') },
  { kind: 'level-up', animation: 'trophy', message: levelUpMessage(5) },
]

const DECK_CLEARED_MOCK = {
  classifiedTxCount: 47,
  completedCount: 12,
  flaggedCount: 3,
  sessionXpEarned: 350,
  transferCount: 2,
  refundsOffset: 1,
} as const

/**
 * Hidden animation lab — standalone route outside AppShell (no tab bar).
 * URL: /dev/animations
 */
export default function AnimationTestPage() {
  const inlinePreviews = useMemo(() => buildInlinePreviewSpecs(), [])
  const [replayKeys, setReplayKeys] = useState<Record<string, number>>({})
  const [deckClearedKey, setDeckClearedKey] = useState(0)
  const [showDeckConfetti, setShowDeckConfetti] = useState(true)
  const [deckClearedViewport, setDeckClearedViewport] = useState<DeckClearedViewport>('standalone')
  const [overlayBurst, setOverlayBurst] = useState<ClassifyEncouragementBurst | null>(null)
  const [showScrollReportMockup, setShowScrollReportMockup] = useState(false)

  const replay = useCallback((id: string) => {
    setReplayKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const replayDeckCleared = useCallback(() => {
    setDeckClearedKey((k) => k + 1)
  }, [])

  const showOverlay = useCallback((build: (id: number) => ClassifyEncouragementBurst) => {
    setOverlayBurst(build(Date.now()))
  }, [])

  return (
    <ScreenSurface>
      <div className="flex h-[100dvh] flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        <header className="shrink-0 border-b border-white/[0.06] px-4 py-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-surface-500">Dev only</p>
          <h1 className="text-xl font-bold text-surface-50">Animation lab</h1>
          <p className="mt-1 text-xs text-surface-400">
            Standalone route — no tab bar. Bookmark{' '}
            <span className="font-mono text-ice">/dev/animations</span>
          </p>
          <DevLabTabs />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-lg space-y-8">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-surface-300">Encouragement bursts</h2>
              <p className="text-xs text-surface-500">
                Inline preview and full-screen overlay as shown during classify.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {inlinePreviews.map((spec) => (
                  <article key={spec.id} className={`${ui.glassFlat} space-y-3 p-4`}>
                    <div>
                      <p className="font-semibold capitalize text-surface-50">{spec.label}</p>
                      <p className="text-[11px] text-surface-500">
                        {spec.engine} · {spec.durationMs}ms
                      </p>
                    </div>
                    <EncouragementAnimation
                      key={`${spec.id}-${replayKeys[spec.id] ?? 0}`}
                      animation={spec.id}
                      className="mx-auto h-32 w-32"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => replay(spec.id)}
                        className="rounded-lg border border-surface-600 bg-surface-800/80 px-3 py-1.5 text-xs font-semibold text-surface-200"
                      >
                        Replay
                      </button>
                      <button
                        type="button"
                        onClick={() => showOverlay(spec.buildBurst)}
                        className="rounded-lg border border-duo-green/30 bg-duo-green/15 px-3 py-1.5 text-xs font-semibold text-duo-green"
                      >
                        Full overlay
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-surface-300">Deck cleared screen</h2>
              <p className="text-xs text-surface-500">
                Production layout with mock stats. Toggle viewport to simulate classify tab (tab bar) vs this
                standalone route.
              </p>
              <article className={`${ui.glassFlat} space-y-3 overflow-hidden p-3`}>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeckClearedViewport('standalone')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      deckClearedViewport === 'standalone'
                        ? 'border border-ice/40 bg-ice/15 text-ice'
                        : 'border border-surface-600 bg-surface-800/80 text-surface-300'
                    }`}
                  >
                    Standalone
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeckClearedViewport('in-app')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      deckClearedViewport === 'in-app'
                        ? 'border border-ice/40 bg-ice/15 text-ice'
                        : 'border border-surface-600 bg-surface-800/80 text-surface-300'
                    }`}
                  >
                    In-app (+ tab bar)
                  </button>
                  <button
                    type="button"
                    onClick={replayDeckCleared}
                    className="rounded-lg border border-surface-600 bg-surface-800/80 px-3 py-1.5 text-xs font-semibold text-surface-200"
                  >
                    Replay
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeckConfetti((v) => !v)}
                    className="rounded-lg border border-gem/30 bg-gem/10 px-3 py-1.5 text-xs font-semibold text-gem-light"
                  >
                    Confetti: {showDeckConfetti ? 'on' : 'off'}
                  </button>
                </div>
                <div className="overflow-hidden rounded-xl border border-surface-700/40 bg-surface-900/50">
                  <DeckClearedScreen
                    key={`${deckClearedKey}-${deckClearedViewport}`}
                    animationKey={deckClearedKey}
                    {...DECK_CLEARED_MOCK}
                    deckMode="pending"
                    showConfetti={showDeckConfetti}
                    viewport={deckClearedViewport}
                  />
                </div>
              </article>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-surface-300">Scroll report mockup</h2>
              <p className="text-xs text-surface-500">
                Prototype for Reveal / Analysis slide decks — vertical report, sticky nav shadow, smooth section
                anchors, scroll spy dots, and progress bar. No carousel arrows.
              </p>
              <article className={`${ui.glassFlat} space-y-3 p-4`}>
                <p className="text-[11px] text-surface-500">
                  Mock data only. Matches the slide-deck shell styling with scroll-down navigation.
                </p>
                <button
                  type="button"
                  onClick={() => setShowScrollReportMockup(true)}
                  className="rounded-lg border border-purple-400/30 bg-gradient-to-r from-purple-500/20 to-blue-500/20 px-4 py-2 text-xs font-semibold text-purple-200"
                >
                  Open full-screen mockup
                </button>
              </article>
            </section>

            <section className="space-y-3 pb-[env(safe-area-inset-bottom,0px)]">
              <h2 className="text-sm font-semibold text-surface-300">Overlay by encouragement kind</h2>
              <p className="text-xs text-surface-500">Sample bursts for milestone, time, rank-up, and level-up.</p>
              <div className="flex flex-wrap gap-2">
                {OVERLAY_KIND_SAMPLES.map((sample) => (
                  <button
                    key={sample.kind}
                    type="button"
                    onClick={() =>
                      showOverlay((id) => ({
                        id,
                        kind: sample.kind,
                        animation: sample.animation,
                        message: sample.message,
                        showConfetti: true,
                        durationMs: encouragementDurationMs(sample.animation) + 4000,
                      }))
                    }
                    className="rounded-lg border border-surface-600 bg-surface-800/80 px-3 py-2 text-xs font-semibold capitalize text-surface-200"
                  >
                    {sample.kind.replace('-', ' ')}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {overlayBurst && (
        <EncouragementBurst burst={overlayBurst} onDismiss={() => setOverlayBurst(null)} />
      )}

      <AnimatePresence>
        {showScrollReportMockup && (
          <ScrollReportMockup onClose={() => setShowScrollReportMockup(false)} />
        )}
      </AnimatePresence>
    </ScreenSurface>
  )
}
