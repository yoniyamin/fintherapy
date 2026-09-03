import { useCallback, useMemo, useState } from 'react'
import {
  APPLE_PRIORITY_LABEL,
  APPLE_SUGGESTION_GROUPS,
  RECOMMENDED_DESIGN_SKILLS,
  type AppleSuggestionPriority,
} from './appleImprovementSuggestions'
import { AppleSuggestionDemo } from './AppleMotionDemos'
import DevLabTabs from './DevLabTabs'
import SkillAppAuditPanel from './SkillAppAuditPanel'
import { SKILL_APP_AUDITS } from './skillAppAudits'
import { ui } from '../../lib/uiClasses'
import ScreenSurface from '../layout/ScreenSurface'

const PRIORITY_ORDER: AppleSuggestionPriority[] = ['high', 'medium', 'low']

const FIT_LABEL = {
  primary: 'Primary for SpentWhatt',
  secondary: 'Secondary',
  situational: 'Situational',
} as const

const FIT_STYLE = {
  primary: 'border-duo-green/30 bg-duo-green/10 text-duo-green',
  secondary: 'border-ice/30 bg-ice/10 text-ice',
  situational: 'border-surface-600/60 bg-surface-800/60 text-surface-400',
} as const

/**
 * Dev-only Apple fluid-interface comparisons — live before/after demos.
 * URL: /dev/apple-improvements
 */
export default function AppleImprovementsPage() {
  const [priorityFilter, setPriorityFilter] = useState<AppleSuggestionPriority | 'all'>('all')
  const [replayKeys, setReplayKeys] = useState<Record<string, number>>({})

  const replay = useCallback((id: string) => {
    setReplayKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const visibleGroups = useMemo(() => {
    if (priorityFilter === 'all') return APPLE_SUGGESTION_GROUPS
    return APPLE_SUGGESTION_GROUPS.map((group) => ({
      ...group,
      suggestions: group.suggestions.filter((s) => s.priority === priorityFilter),
    })).filter((group) => group.suggestions.length > 0)
  }, [priorityFilter])

  const demoCount = APPLE_SUGGESTION_GROUPS.reduce((n, g) => n + g.suggestions.length, 0)

  return (
    <ScreenSurface>
      <div className="flex h-[100dvh] flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]">
        <header className="shrink-0 border-b border-white/[0.06] px-4 py-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-surface-500">Dev only</p>
          <h1 className="text-xl font-bold text-surface-50">Animation lab</h1>
          <p className="mt-1 text-xs text-surface-400">
            Apple fluid interfaces — springs, gestures, materials (WWDC 2018).
          </p>
          <DevLabTabs />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-2xl space-y-6 pb-[env(safe-area-inset-bottom,0px)]">
            <section className={`${ui.glassFlat} space-y-3 p-4`}>
              <p className="text-sm text-surface-300">
                {demoCount} live comparisons for classify sheets, swipe, and chrome. Pairs with the Emil tab —
                Emil covers easing and entrances; Apple covers interruptibility and gesture physics.
              </p>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')} label="All" />
                {PRIORITY_ORDER.map((priority) => (
                  <FilterChip
                    key={priority}
                    active={priorityFilter === priority}
                    onClick={() => setPriorityFilter(priority)}
                    label={APPLE_PRIORITY_LABEL[priority]}
                  />
                ))}
              </div>
            </section>

            <SkillAppAuditPanel audit={SKILL_APP_AUDITS.apple} />

            {visibleGroups.map((group) => (
              <section key={group.id} className="space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-surface-200">{group.label}</h2>
                  <p className="mt-0.5 text-xs text-surface-500">{group.summary}</p>
                </div>
                <div className="space-y-4">
                  {group.suggestions.map((suggestion) => (
                    <AppleSuggestionDemo
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

            <section className={`${ui.glassFlat} space-y-3 p-4`}>
              <h2 className="text-sm font-semibold text-surface-200">Recommended design skills</h2>
              <p className="text-xs text-surface-500">
                Other tabs in this lab map to installed global skills. Ranked for SpentWhatt — gesture-heavy
                Operate UI.
              </p>
              <ul className="space-y-2">
                {RECOMMENDED_DESIGN_SKILLS.map((skill) => (
                  <li
                    key={skill.id}
                    className="rounded-xl border border-white/[0.06] bg-surface-950/40 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-surface-100">{skill.name}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${FIT_STYLE[skill.fit]}`}
                      >
                        {FIT_LABEL[skill.fit]}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-surface-400">{skill.reason}</p>
                    <p className="mt-1 font-mono text-[10px] text-surface-600">{skill.installPath}</p>
                  </li>
                ))}
              </ul>
            </section>
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
