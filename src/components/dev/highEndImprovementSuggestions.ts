export type HighEndSuggestionPriority = 'high' | 'medium' | 'low'

export type HighEndSuggestion = {
  id: string
  title: string
  priority: HighEndSuggestionPriority
  files: string[]
  before: string
  after: string
  why: string
}

export type HighEndSuggestionGroup = {
  id: string
  label: string
  summary: string
  suggestions: HighEndSuggestion[]
}

export const HIGH_END_SUGGESTION_GROUPS: HighEndSuggestionGroup[] = [
  {
    id: 'surface-architecture',
    label: 'Surface architecture',
    summary: 'Nested enclosures and floating chrome — depth without harsh drop shadows.',
    suggestions: [
      {
        id: 'double-bezel-card',
        title: 'Double-Bezel nested shell',
        priority: 'high',
        files: ['src/components/analysis/KpiCards.tsx', 'src/lib/uiClasses.ts'],
        before: 'shadow-md flat card on background',
        after: 'Outer shell + inner core with concentric radii and inset highlight',
        why: 'Premium surfaces read as machined hardware — a tray holding a glass plate, not a sticker on the page.',
      },
      {
        id: 'floating-island-nav',
        title: 'Floating glass island nav',
        priority: 'high',
        files: ['src/components/layout/NavRail.tsx', 'src/components/layout/AppShell.tsx'],
        before: 'Edge-sticky full-width bar glued to the top',
        after: 'Detached pill with backdrop-blur, hairline border, and breathing room',
        why: 'Edge-to-edge chrome feels like a template; a floating island signals intentional spatial rhythm.',
      },
    ],
  },
  {
    id: 'motion-choreography',
    label: 'Motion choreography',
    summary: 'Custom easing curves, magnetic CTAs, and scroll-driven reveals.',
    suggestions: [
      {
        id: 'cubic-bezier-motion',
        title: 'Choreographed cubic-bezier motion',
        priority: 'high',
        files: ['src/index.css', 'shared motion tokens'],
        before: 'ease-in-out on every transition',
        after: 'Custom cubic-bezier(0.32, 0.72, 0, 1) with mass-aware duration',
        why: 'Default easings feel mechanical; agency builds use curves that accelerate and settle like physical objects.',
      },
      {
        id: 'magnetic-button',
        title: 'Magnetic button with nested icon',
        priority: 'medium',
        files: ['src/components/common/Button.tsx'],
        before: 'Plain rounded rectangle, color-only hover',
        after: 'Pill CTA with nested icon circle and internal kinetic tension on hover',
        why: 'The button-in-button pattern creates micro-depth and directional affordance without extra chrome.',
      },
      {
        id: 'scroll-fade-entry',
        title: 'Scroll-style fade-up blur entry',
        priority: 'medium',
        files: ['src/components/home/HomePage.tsx', 'src/components/analysis/AnalysisPage.tsx'],
        before: 'Static mount — elements appear instantly',
        after: 'whileInView fade-up from blur + translate-y over 800ms+',
        why: 'Cinematic entry animations signal polish; nothing premium pops in without interpolation.',
      },
    ],
  },
]

export const HIGH_END_PRIORITY_LABEL: Record<HighEndSuggestionPriority, string> = {
  high: 'High impact',
  medium: 'Medium',
  low: 'Low / optional',
}
