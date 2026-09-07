import { type ComponentProps } from 'react'
import EmilCompareFrame from './EmilCompareFrame'
import type { EmilSuggestion } from './emilImprovementSuggestions'
import type { GptTasteSuggestion } from './gptTasteImprovementSuggestions'

interface DemoProps {
  replayKey: number
  suggestion: GptTasteSuggestion
  onReplay: () => void
}

const HERO_COPY = 'Track every dollar without losing your weekend to spreadsheets'

function GptTasteCompareFrame(
  props: Omit<ComponentProps<typeof EmilCompareFrame>, 'suggestion'> & { suggestion: EmilSuggestion },
) {
  return <EmilCompareFrame {...props} afterLabel="After (gpt-taste)" />
}

function gptTasteSuggestionAsEmil(s: GptTasteSuggestion): EmilSuggestion {
  return {
    ...s,
    before: 'LLM default pattern',
    after: 'gpt-taste pattern',
  }
}

export function GptTasteSuggestionDemo({ id, replayKey, suggestion, onReplay }: DemoProps & { id: string }) {
  const frame = gptTasteSuggestionAsEmil(suggestion)

  switch (id) {
    case 'hero-line-wrap':
      return <HeroLineWrapDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'bento-grid-dense':
      return <BentoGridDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'meta-label-ban':
      return <MetaLabelDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'button-contrast':
      return <ButtonContrastDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    case 'card-hover-physics':
      return <CardHoverDemo replayKey={replayKey} suggestion={frame} onReplay={onReplay} />
    default:
      return null
  }
}

function HeroLineWrapDemo({ replayKey, suggestion, onReplay }: DemoProps & { suggestion: EmilSuggestion }) {
  return (
    <GptTasteCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <div key={`hero-before-${replayKey}`} className="w-full px-1">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-flame/80">6 lines</p>
          <h2 className="max-w-[9rem] text-lg font-bold leading-snug text-surface-100">{HERO_COPY}</h2>
        </div>
      }
      after={
        <div key={`hero-after-${replayKey}`} className="w-full px-1">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-duo-green/80">2 lines</p>
          <h2
            className="max-w-full text-balance font-bold leading-[1.05] text-surface-50"
            style={{ fontSize: 'clamp(1.1rem, 4vw, 1.65rem)' }}
          >
            {HERO_COPY}
          </h2>
        </div>
      }
    />
  )
}

function BentoGridDemo({ replayKey, suggestion, onReplay }: DemoProps & { suggestion: EmilSuggestion }) {
  return (
    <GptTasteCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <div
          key={`bento-before-${replayKey}`}
          className="grid w-full grid-cols-3 grid-rows-2 gap-1.5"
          style={{ minHeight: '7.5rem' }}
        >
          <BentoCell className="col-span-2 row-span-2 bg-flame/15 text-flame" label="Spend" value="$2.4k" />
          <BentoCell className="bg-surface-800 text-surface-300" label="Saved" value="$420" />
          <div className="rounded-lg border border-dashed border-surface-600/80 bg-surface-900/40" aria-hidden />
        </div>
      }
      after={
        <div
          key={`bento-after-${replayKey}`}
          className="grid w-full grid-flow-dense grid-cols-3 grid-rows-2 gap-1.5"
          style={{ minHeight: '7.5rem' }}
        >
          <BentoCell className="col-span-2 row-span-2 bg-duo-green/15 text-duo-green" label="Spend" value="$2.4k" />
          <BentoCell className="row-span-2 bg-surface-800 text-surface-200" label="Trend" value="+12%" />
          <BentoCell className="bg-ice/10 text-ice" label="Saved" value="$420" />
        </div>
      }
    />
  )
}

function BentoCell({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className: string
}) {
  return (
    <div className={`flex flex-col justify-between rounded-lg border border-white/[0.06] p-2 ${className}`}>
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-80">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  )
}

function MetaLabelDemo({ replayKey, suggestion, onReplay }: DemoProps & { suggestion: EmilSuggestion }) {
  return (
    <GptTasteCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <div key={`meta-before-${replayKey}`} className="w-full space-y-1 px-1 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-surface-500">Section 01</p>
          <h3 className="text-sm font-semibold text-surface-200">Your spending breakdown</h3>
          <p className="text-[10px] leading-relaxed text-surface-500">
            Meta-labels add noise without meaning — they look like filler from a template.
          </p>
        </div>
      }
      after={
        <div key={`meta-after-${replayKey}`} className="w-full space-y-1.5 px-1 text-left">
          <h3 className="text-base font-bold text-surface-50">Your spending breakdown</h3>
          <p className="text-[10px] leading-relaxed text-surface-400">
            Let hierarchy do the work — one strong heading, no cheap section stamps.
          </p>
        </div>
      }
    />
  )
}

function ButtonContrastDemo({ replayKey, suggestion, onReplay }: DemoProps & { suggestion: EmilSuggestion }) {
  return (
    <GptTasteCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <button
          key={`cta-before-${replayKey}`}
          type="button"
          className="rounded-xl bg-surface-800 px-5 py-2.5 text-sm font-bold text-surface-700"
        >
          Start tracking
        </button>
      }
      after={
        <button
          key={`cta-after-${replayKey}`}
          type="button"
          className="rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_0_rgba(0,0,0,0.15)]"
        >
          Start tracking
        </button>
      }
    />
  )
}

function CardHoverDemo({ replayKey, suggestion, onReplay }: DemoProps & { suggestion: EmilSuggestion }) {
  return (
    <GptTasteCompareFrame
      suggestion={suggestion}
      onReplay={onReplay}
      before={
        <div key={`hover-before-${replayKey}`} className="w-full">
          <StaticCard label="Groceries" amount="$842" />
          <p className="mt-2 text-center text-[9px] text-surface-500">No hover response</p>
        </div>
      }
      after={
        <div key={`hover-after-${replayKey}`} className="w-full">
          <HoverCard label="Groceries" amount="$842" />
          <p className="mt-2 text-center text-[9px] text-surface-500">Hover to feel scale</p>
        </div>
      }
    />
  )
}

function StaticCard({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface-900">
      <div className="h-14 bg-gradient-to-br from-surface-800 to-surface-900" />
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-semibold text-surface-200">{label}</span>
        <span className="text-xs font-bold text-flame">{amount}</span>
      </div>
    </div>
  )
}

function HoverCard({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="group cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-surface-900">
      <div className="h-14 overflow-hidden">
        <div className="h-full bg-gradient-to-br from-duo-green/20 to-surface-900 transition-transform duration-700 ease-out group-hover:scale-105" />
      </div>
      <div className="flex items-center justify-between px-3 py-2 transition-colors duration-300 group-hover:bg-surface-800/60">
        <span className="text-xs font-semibold text-surface-100">{label}</span>
        <span className="text-xs font-bold text-duo-green">{amount}</span>
      </div>
    </div>
  )
}
