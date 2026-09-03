export type GptTasteSuggestionPriority = 'high' | 'medium' | 'low'

export type GptTasteSuggestion = {
  id: string
  title: string
  priority: GptTasteSuggestionPriority
  files: string[]
  why: string
}

export type GptTasteSuggestionGroup = {
  id: string
  label: string
  summary: string
  suggestions: GptTasteSuggestion[]
}

export const GPT_TASTE_SUGGESTION_GROUPS: GptTasteSuggestionGroup[] = [
  {
    id: 'typography-layout',
    label: 'Typography & layout',
    summary: 'Break LLM defaults — wide heroes, dense bento grids, no cheap meta-labels.',
    suggestions: [
      {
        id: 'hero-line-wrap',
        title: 'Hero: 2-line wide container vs 6-line wall',
        priority: 'high',
        files: ['landing pages', 'Reveal intro copy'],
        why: 'Narrow max-width forces headlines into five or six lines; wide containers keep editorial impact.',
      },
      {
        id: 'bento-grid-dense',
        title: 'Gapless bento with grid-flow-dense',
        priority: 'high',
        files: ['Analysis bento', 'Home dashboard grid'],
        why: 'LLM grids leave dead corners; dense flow plus interlocking spans fill every cell.',
      },
      {
        id: 'meta-label-ban',
        title: 'Clean headings vs "SECTION 01" labels',
        priority: 'medium',
        files: ['marketing copy', 'section headers'],
        why: 'Cheap meta-labels scream template; trust the typography hierarchy instead.',
      },
    ],
  },
  {
    id: 'interaction-polish',
    label: 'Contrast & motion',
    summary: 'Legible CTAs and hover physics on every clickable surface.',
    suggestions: [
      {
        id: 'button-contrast',
        title: 'High-contrast CTAs vs invisible button text',
        priority: 'high',
        files: ['Button.tsx', 'CTA sections'],
        why: 'Dark-on-dark or light-on-light text fails WCAG and kills conversion.',
      },
      {
        id: 'card-hover-physics',
        title: 'Card hover scale vs static tiles',
        priority: 'medium',
        files: ['KpiCards', 'CategoryPicker', 'SwipeCard'],
        why: 'Static surfaces feel dead; gentle scale inside overflow-hidden adds physical affordance.',
      },
    ],
  },
]

export const GPT_TASTE_PRIORITY_LABEL: Record<GptTasteSuggestionPriority, string> = {
  high: 'High impact',
  medium: 'Medium',
  low: 'Low / optional',
}
