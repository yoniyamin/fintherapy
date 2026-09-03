import { useCallback, useMemo, useState } from 'react'
import { ImagegenMobileSuggestionDemo } from './ImagegenMobileDemos'
import {
  IMAGEGEN_MOBILE_PRIORITY_LABEL,
  IMAGEGEN_MOBILE_SUGGESTION_GROUPS,
  type ImagegenMobileSuggestion,
} from './imagegenMobileImprovementSuggestions'
import SkillAppAuditPanel from './SkillAppAuditPanel'
import { SKILL_APP_AUDITS } from './skillAppAudits'
import {
  FilterChip,
  LabIntro,
  LAB_PRIORITY_LABEL,
  type LabPriority,
  MotionLabLayout,
} from './motionLabShared'

const PRIORITY_ORDER: LabPriority[] = ['high', 'medium', 'low']

const DEMO_COUNT = IMAGEGEN_MOBILE_SUGGESTION_GROUPS.reduce((n, g) => n + g.suggestions.length, 0)

/**
 * Dev-only mobile visual direction comparisons — CSS phone mockups, not image generation.
 * URL: /dev/imagegen-mobile-improvements
 */
export default function ImagegenMobileImprovementsPage() {
  const [priorityFilter, setPriorityFilter] = useState<LabPriority | 'all'>('all')
  const [replayKeys, setReplayKeys] = useState<Record<string, number>>({})

  const replay = useCallback((id: string) => {
    setReplayKeys((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }, [])

  const visibleGroups = useMemo(() => {
    if (priorityFilter === 'all') return IMAGEGEN_MOBILE_SUGGESTION_GROUPS
    return IMAGEGEN_MOBILE_SUGGESTION_GROUPS.map((group) => ({
      ...group,
      suggestions: group.suggestions.filter((s) => s.priority === priorityFilter),
    })).filter((group) => group.suggestions.length > 0)
  }, [priorityFilter])

  return (
    <MotionLabLayout subtitle="Mobile visual direction — SpentWhatt tokens vs generic fintech slop.">
      <LabIntro>
        <p className="text-sm text-surface-300">
          {DEMO_COUNT} phone mockup comparisons. &ldquo;Before&rdquo; shows generic AI fintech; &ldquo;After&rdquo;
          uses real SpentWhatt tokens — <span className="font-mono text-[11px] text-ice">ui.glass</span>,{' '}
          <span className="font-mono text-[11px] text-duo-green">duo-green</span>, OrganicBackdrop blobs, and
          classify card hierarchy from production.
        </p>
        <p className="text-xs text-surface-500">
          Pairs with Emil (motion) and Apple (gestures). See the app audit below for file-specific advice.
        </p>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={priorityFilter === 'all'} onClick={() => setPriorityFilter('all')} label="All" />
          {PRIORITY_ORDER.map((priority) => (
            <FilterChip
              key={priority}
              active={priorityFilter === priority}
              onClick={() => setPriorityFilter(priority)}
              label={IMAGEGEN_MOBILE_PRIORITY_LABEL[priority] ?? LAB_PRIORITY_LABEL[priority]}
            />
          ))}
        </div>
      </LabIntro>

      <SkillAppAuditPanel audit={SKILL_APP_AUDITS['imagegen-mobile']} />

      {visibleGroups.map((group) => (
        <section key={group.id} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-surface-200">{group.label}</h2>
            <p className="mt-0.5 text-xs text-surface-500">{group.summary}</p>
          </div>
          <div className="space-y-4">
            {group.suggestions.map((suggestion: ImagegenMobileSuggestion) => (
              <ImagegenMobileSuggestionDemo
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
