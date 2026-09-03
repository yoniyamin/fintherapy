import type { ReactNode } from 'react'

/**
 * Compact before/after strip for inline audit recommendation visuals.
 */
export function AuditMiniCompare({
  before,
  after,
  beforeLabel = 'Current',
  afterLabel = 'Proposed',
  onReplay,
}: {
  before: ReactNode
  after: ReactNode
  beforeLabel?: string
  afterLabel?: string
  onReplay?: () => void
}) {
  return (
    <div className="mt-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <AuditMiniCell label={beforeLabel} tone="before">
          {before}
        </AuditMiniCell>
        <AuditMiniCell label={afterLabel} tone="after">
          {after}
        </AuditMiniCell>
      </div>
      {onReplay ? (
        <button
          type="button"
          onClick={onReplay}
          className="rounded-md border border-surface-600 bg-surface-800/80 px-2.5 py-1 text-[10px] font-semibold text-surface-300 transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          Replay animation
        </button>
      ) : null}
    </div>
  )
}

function AuditMiniCell({
  label,
  tone,
  children,
}: {
  label: string
  tone: 'before' | 'after'
  children: ReactNode
}) {
  const labelClass = tone === 'before' ? 'text-flame/90' : 'text-duo-green/90'

  return (
    <div className="flex min-h-[5.5rem] flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-surface-950/60">
      <p
        className={`border-b border-white/[0.06] px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${labelClass}`}
      >
        {label}
      </p>
      <div className="flex flex-1 items-center justify-center overflow-hidden p-2">{children}</div>
    </div>
  )
}
