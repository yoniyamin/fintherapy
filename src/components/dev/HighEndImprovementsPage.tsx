import { useCallback, useMemo, useState } from 'react'
import { HighEndSuggestionDemo } from './HighEndMotionDemos'
import {
  HIGH_END_PRIORITY_LABEL,
  HIGH_END_SUGGESTION_GROUPS,
  type HighEndSuggestionPriority,
} from './highEndImprovementSuggestions'
import SkillAppAuditPanel from './SkillAppAuditPanel'
import { SKILL_APP_AUDITS } from './skillAppAudits'
import { FilterChip, LabIntro, MotionLabLayout } from './motionLabShared'

const PRIORITY_ORDER: HighEndSuggestionPriority[] = ['high', 'medium', 'low']

const LIVE_DEMO_COUNT = HIGH_END_SUGGESTION_GROUPS.reduce((n, g) => n + g.suggestions.length, 0)

/**
 * Dev-only high-end visual design comparisons — live before/after demos.
 * URL: /dev/high-end-improvements
 */
export default function HighEndImprovementsPage() {
  const [priorityFilter, setPriorityFilter] = useState<HighEndSuggestionPriority | 'all'>('all')
  const [replayKeys, setReplayKeys] = useState<Record<string, number>>({})

  const replay = useCallback((id: string) => {
    setReplayKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const visibleGroups = useMemo(() => {
    if (priorityFilter === 'all') return HIGH_END_SUGGESTION_GROUPS
    return HIGH_END_SUGGESTION_GROUPS.map((group) => ({
      ...group,
      suggestions: group.suggestions.filter((s) => s.priority === priorityFilter),
    })).filter((group) => group.suggestions.length > 0)
  }, [priorityFilter])

  return (
    <MotionLabLayout subtitle="High-end visual design — nested shells, island nav, choreographed motion.">
      <LabIntro>
        <p className="text-sm text-surface-300">
          {LIVE_DEMO_COUNT} interactive comparisons for agency-tier polish. Replay each pair, then decide what
          belongs in production chrome and analysis surfaces.
        </p>
        <p className="text-xs text-surface-500">
          Reference: high-end-visual-design skill — Double-Bezel, island nav, magnetic CTAs, scroll reveals.
        </p>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')} label="All" />
          {PRIORITY_ORDER.map((priority) => (
            <FilterChip
              key={priority}
              active={priorityFilter === priority}
              onClick={() => setPriorityFilter(priority)}
              label={HIGH_END_PRIORITY_LABEL[priority]}
            />
          ))}
        </div>
      </LabIntro>

      <SkillAppAuditPanel audit={SKILL_APP_AUDITS['high-end']} />

      {visibleGroups.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-surface-200">{group.label}</h2>
            <p className="mt-0.5 text-xs text-surface-500">{group.summary}</p>
          </div>

          <div className="space-y-4">
            {group.suggestions.map((suggestion) => (
              <HighEndSuggestionDemo
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
    </MotionLabLayout>
  )
}
