import { useCallback, useMemo, useState } from 'react'
import {
  ANIMATE_PRIORITY_LABEL,
  ANIMATE_SUGGESTION_GROUPS,
  type AnimateSuggestionPriority,
} from './animateImprovementSuggestions'
import { AnimateSuggestionDemo } from './AnimateMotionDemos'
import SkillAppAuditPanel from './SkillAppAuditPanel'
import { SKILL_APP_AUDITS } from './skillAppAudits'
import { FilterChip, LabIntro, MotionLabLayout } from './motionLabShared'

const PRIORITY_ORDER: AnimateSuggestionPriority[] = ['high', 'medium', 'low']

const DEMO_COUNT = ANIMATE_SUGGESTION_GROUPS.reduce((n, g) => n + g.suggestions.length, 0)

/**
 * Dev-only animate-skill comparisons — build sequence gates before curves.
 * URL: /dev/animate-improvements
 */
export default function AnimateImprovementsPage() {
  const [priorityFilter, setPriorityFilter] = useState<AnimateSuggestionPriority | 'all'>('all')
  const [replayKeys, setReplayKeys] = useState<Record<string, number>>({})

  const replay = useCallback((id: string) => {
    setReplayKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const visibleGroups = useMemo(() => {
    if (priorityFilter === 'all') return ANIMATE_SUGGESTION_GROUPS
    return ANIMATE_SUGGESTION_GROUPS.map((group) => ({
      ...group,
      suggestions: group.suggestions.filter((s) => s.priority === priorityFilter),
    })).filter((group) => group.suggestions.length > 0)
  }, [priorityFilter])

  return (
    <MotionLabLayout subtitle="Animate skill — build sequence gates before curves and springs.">
      <LabIntro>
        <p className="text-sm text-surface-300">
          {DEMO_COUNT} interactive comparisons from the animate skill build sequence. Frequency and purpose
          first — then tool, properties, curve, and accessibility gates.
        </p>
        <p className="text-xs text-surface-500">
          Pairs with Emil (polish) and Apple (gestures). Emil covers easing tokens; this tab covers whether
          to animate at all.
        </p>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')} label="All" />
          {PRIORITY_ORDER.map((priority) => (
            <FilterChip
              key={priority}
              active={priorityFilter === priority}
              onClick={() => setPriorityFilter(priority)}
              label={ANIMATE_PRIORITY_LABEL[priority]}
            />
          ))}
        </div>
      </LabIntro>

      <SkillAppAuditPanel audit={SKILL_APP_AUDITS.animate} />

      {visibleGroups.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-surface-200">{group.label}</h2>
            <p className="mt-0.5 text-xs text-surface-500">{group.summary}</p>
          </div>
          <div className="space-y-4">
            {group.suggestions.map((suggestion) => (
              <AnimateSuggestionDemo
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
