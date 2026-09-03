import type { ReactNode } from 'react'
import {
  EMIL_PRIORITY_LABEL,
  EMIL_PRIORITY_STYLE,
  type EmilSuggestion,
} from './emilImprovementSuggestions'
import { ui } from '../../lib/uiClasses'

interface EmilCompareFrameProps {
  suggestion: EmilSuggestion
  onReplay: () => void
  before: ReactNode
  after: ReactNode
  beforeLabel?: string
  afterLabel?: string
}

/**
 * Side-by-side before/after frame for motion lab demos.
 */
export default function EmilCompareFrame({
  suggestion,
  onReplay,
  before,
  after,
  beforeLabel = 'Before (production)',
  afterLabel = 'After (polished)',
}: EmilCompareFrameProps) {
  return (
    <article className={`${ui.glassFlat} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0 text-left">
          <h3 className="text-sm font-semibold text-surface-50">{suggestion.title}</h3>
          <p className="mt-1 text-xs text-surface-400">{suggestion.why}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${EMIL_PRIORITY_STYLE[suggestion.priority]}`}
        >
          {EMIL_PRIORITY_LABEL[suggestion.priority]}
        </span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <DemoCell label={beforeLabel} tone="before">
          {before}
        </DemoCell>
        <DemoCell label={afterLabel} tone="after">
          {after}
        </DemoCell>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3">
        <p className="font-mono text-[10px] text-surface-500">{suggestion.files.join(' · ')}</p>
        <button
          type="button"
          onClick={onReplay}
          className="rounded-lg border border-surface-600 bg-surface-800/80 px-3 py-1.5 text-xs font-semibold text-surface-200 transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Replay both
        </button>
      </div>
    </article>
  )
}

function DemoCell({
  label,
  tone,
  children,
}: {
  label: string
  tone: 'before' | 'after'
  children: ReactNode
}) {
  const labelClass =
    tone === 'before'
      ? 'text-flame/90'
      : 'text-duo-green/90'

  return (
    <div className="flex min-h-[9rem] flex-col rounded-xl border border-white/[0.06] bg-surface-950/50">
      <p className={`border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${labelClass}`}>
        {label}
      </p>
      <div className="flex flex-1 items-center justify-center overflow-hidden p-3">{children}</div>
    </div>
  )
}
