import type { LabPriority, LabSuggestion, LabSuggestionGroup } from './motionLabShared'

export type ImagegenMobileSuggestion = LabSuggestion

export type ImagegenMobileSuggestionGroup = LabSuggestionGroup

export const IMAGEGEN_MOBILE_SUGGESTION_GROUPS: ImagegenMobileSuggestionGroup[] = [
  {
    id: 'anti-generic',
    label: 'Anti-generic mobile',
    summary:
      'Break default AI fintech tells — purple gradients, tiny type, widget clutter — in favor of SpentWhatt-native dark glass (ui.glass, duo-green, OrganicBackdrop).',
    suggestions: [
      {
        id: 'fintech-hierarchy',
        title: 'Generic fintech clutter vs dark glass hierarchy',
        priority: 'high',
        files: ['src/components/home/HomePage.tsx', 'src/components/analysis/KpiCards.tsx'],
        why: 'Purple-blue gradient dashboards with micro-labels read as template slop; SpentWhatt classify card on OrganicBackdrop matches production SwipeCard hierarchy.',
      },
      {
        id: 'pill-spam-classify',
        title: 'Floating pill spam vs controlled classify card',
        priority: 'high',
        files: ['src/components/swipe/SwipeCard.tsx', 'src/components/swipe/CategoryPicker.tsx'],
        why: 'Badge and chip spam fights for attention; a single classify card with restrained accent color keeps the swipe flow legible.',
      },
    ],
  },
  {
    id: 'platform-native',
    label: 'Platform-native structure',
    summary: 'Respect safe areas, atmosphere, and breathable density — not poster layouts inside a phone frame.',
    suggestions: [
      {
        id: 'safe-area-insets',
        title: 'Edge-to-edge poster vs safe-area insets',
        priority: 'high',
        files: ['src/components/layout/ScreenSurface.tsx', 'src/components/layout/AppShell.tsx'],
        why: 'Critical UI under the status bar or home indicator feels fake; inset padding makes screens believable on real devices.',
      },
      {
        id: 'texture-atmosphere',
        title: 'Sterile flat fill vs subtle texture',
        priority: 'medium',
        files: ['src/index.css', 'src/components/layout/ScreenSurface.tsx'],
        why: 'Perfectly flat #12141a fills feel off-brand; ScreenSurface + OrganicBackdrop teal/violet blobs match index.css production atmosphere.',
      },
      {
        id: 'visual-density',
        title: 'Cramped density vs breathable spacing (density 3)',
        priority: 'medium',
        files: ['app-wide spacing tokens', 'classify & home modules'],
        why: 'VISUAL_DENSITY 3 means airy major blocks — generous padding between sections, not jittery micro-widgets stacked edge to edge.',
      },
    ],
  },
]

export const IMAGEGEN_MOBILE_PRIORITY_LABEL: Record<LabPriority, string> = {
  high: 'High impact',
  medium: 'Medium',
  low: 'Low / optional',
}
