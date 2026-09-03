/* eslint-disable react-refresh/only-export-components -- shared layout + lab types for dev motion tabs */
import type { ReactNode } from 'react'
import DevLabTabs from './DevLabTabs'
import { ui } from '../../lib/uiClasses'
import ScreenSurface from '../layout/ScreenSurface'

export type { LabPriority, LabSuggestion, LabSuggestionGroup } from './motionLabTypes'
export { LAB_PRIORITY_LABEL, LAB_PRIORITY_STYLE, toCompareSuggestion } from './motionLabTypes'

export function MotionLabLayout({
  subtitle,
  children,
}: {
  subtitle: string
  children: ReactNode
}) {
  return (
    <ScreenSurface>
      <div className="flex h-[100dvh] flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        <header className="shrink-0 border-b border-white/[0.06] px-4 py-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-surface-500">Dev only</p>
          <h1 className="text-xl font-bold text-surface-50">Animation lab</h1>
          <p className="mt-1 text-xs text-surface-400">{subtitle}</p>
          <DevLabTabs />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-2xl space-y-6 pb-[env(safe-area-inset-bottom,0px)]">{children}</div>
        </div>
      </div>
    </ScreenSurface>
  )
}

export function LabIntro({ children }: { children: ReactNode }) {
  return <section className={`${ui.glassFlat} space-y-3 p-4`}>{children}</section>
}

export function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border border-ice/40 bg-ice/15 text-ice'
          : 'border border-surface-600 bg-surface-800/80 text-surface-300'
      }`}
    >
      {label}
    </button>
  )
}
