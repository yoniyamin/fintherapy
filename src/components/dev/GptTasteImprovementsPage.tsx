import { useCallback, useMemo, useState } from 'react'
import { GptTasteSuggestionDemo } from './GptTasteMotionDemos'
import {
  GPT_TASTE_PRIORITY_LABEL,
  GPT_TASTE_SUGGESTION_GROUPS,
  type GptTasteSuggestionPriority,
} from './gptTasteImprovementSuggestions'
import SkillAppAuditPanel from './SkillAppAuditPanel'
import { SKILL_APP_AUDITS } from './skillAppAudits'
import { FilterChip, LabIntro, MotionLabLayout } from './motionLabShared'

const PRIORITY_ORDER: GptTasteSuggestionPriority[] = ['high', 'medium', 'low']

const DEMO_COUNT = GPT_TASTE_SUGGESTION_GROUPS.reduce((n, g) => n + g.suggestions.length, 0)

/**
 * Dev-only gpt-taste design comparisons — live before/after demos for anti-slop UI patterns.
 * URL: /dev/gpt-taste-improvements
 */
export default function GptTasteImprovementsPage() {
  const [priorityFilter, setPriorityFilter] = useState<GptTasteSuggestionPriority | 'all'>('all')
  const [replayKeys, setReplayKeys] = useState<Record<string, number>>({})

  const replay = useCallback((id: string) => {
    setReplayKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const visibleGroups = useMemo(() => {
    if (priorityFilter === 'all') return GPT_TASTE_SUGGESTION_GROUPS
    return GPT_TASTE_SUGGESTION_GROUPS.map((group) => ({
      ...group,
      suggestions: group.suggestions.filter((s) => s.priority === priorityFilter),
    })).filter((group) => group.suggestions.length > 0)
  }, [priorityFilter])

  return (
    <MotionLabLayout subtitle="gpt-taste — editorial layout, dense grids, contrast, hover physics.">
      <LabIntro>
        <p className="text-sm text-surface-300">
          {DEMO_COUNT} visual comparisons for common LLM UI failures. Replay each pair, then decide what belongs
          in marketing surfaces versus the app chrome.
        </p>
        <p className="text-xs text-surface-500">
          Pairs with Emil (motion timing) and Apple (gesture physics) — gpt-taste covers layout and visual taste.
        </p>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')} label="All" />
          {PRIORITY_ORDER.map((priority) => (
            <FilterChip
              key={priority}
              active={priorityFilter === priority}
              onClick={() => setPriorityFilter(priority)}
              label={GPT_TASTE_PRIORITY_LABEL[priority]}
            />
          ))}
        </div>
      </LabIntro>

      <SkillAppAuditPanel audit={SKILL_APP_AUDITS['gpt-taste']} />

      {visibleGroups.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-surface-200">{group.label}</h2>
            <p className="mt-0.5 text-xs text-surface-500">{group.summary}</p>
          </div>

          <div className="space-y-4">
            {group.suggestions.map((suggestion) => (
              <GptTasteSuggestionDemo
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
