import { useCallback, useMemo, useState } from 'react'
import {
  EMIL_PRIORITY_LABEL,
  EMIL_SUGGESTION_GROUPS,
  type EmilSuggestionPriority,
} from './emilImprovementSuggestions'
import { EmilSuggestionDemo } from './EmilMotionDemos'
import DevLabTabs from './DevLabTabs'
import SkillAppAuditPanel from './SkillAppAuditPanel'
import { SKILL_APP_AUDITS } from './skillAppAudits'
import { ui } from '../../lib/uiClasses'
import ScreenSurface from '../layout/ScreenSurface'

const PRIORITY_ORDER: EmilSuggestionPriority[] = ['high', 'medium', 'low']

const LIVE_DEMO_COUNT = EMIL_SUGGESTION_GROUPS.reduce(
  (n, g) => n + g.suggestions.filter((s) => s.id !== 'swipe-transform-props').length,
  0,
)

/**
 * Dev-only motion comparisons — live before/after demos for Emil-style polish.
 * URL: /dev/emil-improvements
 */
export default function EmilImprovementsPage() {
  const [priorityFilter, setPriorityFilter] = useState<EmilSuggestionPriority | 'all'>('all')
  const [replayKeys, setReplayKeys] = useState<Record<string, number>>({})

  const replay = useCallback((id: string) => {
    setReplayKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const visibleGroups = useMemo(() => {
    if (priorityFilter === 'all') return EMIL_SUGGESTION_GROUPS
    return EMIL_SUGGESTION_GROUPS.map((group) => ({
      ...group,
      suggestions: group.suggestions.filter((s) => s.priority === priorityFilter),
    })).filter((group) => group.suggestions.length > 0)
  }, [priorityFilter])

  return (
    <ScreenSurface>
      <div className="flex h-[100dvh] flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        <header className="shrink-0 border-b border-white/[0.06] px-4 py-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-surface-500">Dev only</p>
          <h1 className="text-xl font-bold text-surface-50">Animation lab</h1>
          <p className="mt-1 text-xs text-surface-400">
            Live before/after demos — press, replay, and compare side by side.
          </p>
          <DevLabTabs />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-2xl space-y-6 pb-[env(safe-area-inset-bottom,0px)]">
            <section className={`${ui.glassFlat} space-y-3 p-4`}>
              <p className="text-sm text-surface-300">
                {LIVE_DEMO_COUNT} interactive comparisons mapped to real production patterns. Replay each pair,
                then pick what feels right before rolling changes into the app.
              </p>
              <p className="text-xs text-surface-500">
                Reference:{' '}
                <a
                  href="https://animations.dev/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-ice underline-offset-2 hover:underline"
                >
                  animations.dev
                </a>
              </p>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={priorityFilter === 'all'}
                  onClick={() => setPriorityFilter('all')}
                  label="All"
                />
                {PRIORITY_ORDER.map((priority) => (
                  <FilterChip
                    key={priority}
                    active={priorityFilter === priority}
                    onClick={() => setPriorityFilter(priority)}
                    label={EMIL_PRIORITY_LABEL[priority]}
                  />
                ))}
              </div>
            </section>

            <SkillAppAuditPanel audit={SKILL_APP_AUDITS.emil} />

            {visibleGroups.map((group) => (
              <section key={group.id} className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-surface-200">{group.label}</h2>
                  <p className="mt-0.5 text-xs text-surface-500">{group.summary}</p>
                </div>

                <div className="space-y-4">
                  {group.suggestions.map((suggestion) => (
                    <EmilSuggestionDemo
                      key={suggestion.id}
                      id={suggestion.id}
                      replayKey={replayKeys[suggestion.id] ?? 0}
                      suggestion={suggestion}
                      onReplay={() => replay(suggestion.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </ScreenSurface>
  )
}

function FilterChip({
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
