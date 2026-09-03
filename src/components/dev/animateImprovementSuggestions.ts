export type AnimateSuggestionPriority = 'high' | 'medium' | 'low'

export type AnimateSuggestion = {
  id: string
  title: string
  priority: AnimateSuggestionPriority
  files: string[]
  why: string
}

export type AnimateSuggestionGroup = {
  id: string
  label: string
  summary: string
  suggestions: AnimateSuggestion[]
}

export const ANIMATE_SUGGESTION_GROUPS: AnimateSuggestionGroup[] = [
  {
    id: 'gate-purpose',
    label: 'Gate & purpose',
    summary: 'Build sequence steps 1–2 — decide whether motion earns its cost before picking a curve.',
    suggestions: [
      {
        id: 'frequency-gate',
        title: 'Frequency gate — nav 100+/day',
        priority: 'high',
        files: ['src/components/layout/NavRail.tsx', 'src/components/dev/DevLabTabs.tsx'],
        why: 'Keyboard shortcuts and tab rails used hundreds of times per day should not animate — instant feedback wins.',
      },
      {
        id: 'purpose-decorative',
        title: 'Purpose — data vs press feedback',
        priority: 'high',
        files: ['src/components/analysis/KpiCards.tsx', 'src/components/analysis/CategoryTrendChart.tsx'],
        why: 'Numbers the user reads should stay still; motion budget belongs on feedback (press, toggle), not decorative drift.',
      },
    ],
  },
  {
    id: 'tool-properties',
    label: 'Tool & properties',
    summary: 'Build sequence steps 3–4 — cheapest tool that works, transform/opacity only.',
    suggestions: [
      {
        id: 'toast-interruptibility',
        title: 'Tool choice — transition vs keyframes',
        priority: 'high',
        files: ['toast / notification layer', 'Sonner or custom toast host'],
        why: 'Rapid toasts and toggles need CSS transitions that retarget mid-flight; keyframes restart from zero every trigger.',
      },
      {
        id: 'scale-entrance',
        title: 'scale(0) vs scale(0.95) + opacity',
        priority: 'high',
        files: ['src/components/swipe/SwipeCard.tsx', 'src/components/reveal/SlideDeckPreview.tsx'],
        why: 'Nothing in the real world pops from zero size — start at 0.9–0.97 with a fade.',
      },
    ],
  },
  {
    id: 'curve-accessibility',
    label: 'Curve & accessibility',
    summary: 'Build sequence steps 5 & 7 — ease-out entrances and ship reduced-motion / hover gates with the animation.',
    suggestions: [
      {
        id: 'ease-in-vs-out',
        title: 'ease-in vs ease-out entrance',
        priority: 'medium',
        files: ['modals, dropdowns, list items — app-wide entrances'],
        why: 'ease-in delays the moment the user is watching; ease-out at 200ms feels faster than ease-in at 200ms.',
      },
      {
        id: 'reduced-motion-hover',
        title: 'Reduced motion + hover gating',
        priority: 'high',
        files: ['src/index.css', 'app-wide interactive surfaces'],
        why: 'Keep opacity/color for comprehension; drop transform motion under prefers-reduced-motion. Gate :hover behind (hover: hover) and (pointer: fine).',
      },
    ],
  },
]

export const ANIMATE_PRIORITY_LABEL: Record<AnimateSuggestionPriority, string> = {
  high: 'High impact',
  medium: 'Medium',
  low: 'Low / optional',
}
