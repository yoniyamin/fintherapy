export type LabPriority = 'high' | 'medium' | 'low'

export const LAB_PRIORITY_LABEL: Record<LabPriority, string> = {
  high: 'High impact',
  medium: 'Medium',
  low: 'Low / optional',
}

export const LAB_PRIORITY_STYLE: Record<LabPriority, string> = {
  high: 'border-duo-green/30 bg-duo-green/10 text-duo-green',
  medium: 'border-ice/30 bg-ice/10 text-ice',
  low: 'border-surface-600/60 bg-surface-800/60 text-surface-400',
}

export type LabSuggestion = {
  id: string
  title: string
  priority: LabPriority
  files: string[]
  why: string
}

export type LabSuggestionGroup = {
  id: string
  label: string
  summary: string
  suggestions: LabSuggestion[]
}

export function toCompareSuggestion(s: LabSuggestion) {
  return {
    ...s,
    before: 'Before',
    after: 'After',
  }
}
