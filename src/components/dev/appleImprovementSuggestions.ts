export type AppleSuggestionPriority = 'high' | 'medium' | 'low'

export type AppleSuggestion = {
  id: string
  title: string
  priority: AppleSuggestionPriority
  files: string[]
  why: string
}

export type AppleSuggestionGroup = {
  id: string
  label: string
  summary: string
  suggestions: AppleSuggestion[]
}

export const APPLE_SUGGESTION_GROUPS: AppleSuggestionGroup[] = [
  {
    id: 'response',
    label: 'Response & feedback',
    summary: 'Kill latency — feedback on pointer-down, continuous tracking during gestures.',
    suggestions: [
      {
        id: 'pointer-down-feedback',
        title: 'Highlight on pointer-down, not click',
        priority: 'high',
        files: ['src/components/common/Button.tsx', 'app-wide pressables'],
        why: 'Waiting for click/touch-up to show feedback feels dead; direct manipulation starts instantly.',
      },
      {
        id: 'spring-damping',
        title: 'Critically damped springs by default',
        priority: 'high',
        files: ['EncouragementBurst.tsx', 'DeckClearedScreen.tsx', 'modals'],
        why: 'Bounce belongs on momentum interactions (flicks), not menus that simply appear.',
      },
    ],
  },
  {
    id: 'gestures',
    label: 'Gestures & sheets',
    summary: 'Swipe deck and bottom sheets — interruptible, velocity-aware, rubber-banded.',
    suggestions: [
      {
        id: 'interruptibility',
        title: 'Interruptible spring vs CSS transition',
        priority: 'high',
        files: ['src/hooks/useBottomSheetDrag.ts', 'SwipeCard.tsx'],
        why: 'Users must grab mid-flight and reverse without waiting for the animation to finish.',
      },
      {
        id: 'velocity-handoff',
        title: 'Velocity handoff on release',
        priority: 'medium',
        files: ['src/hooks/useBottomSheetDrag.ts'],
        why: 'The seam between dragging and animating disappears when release velocity carries through.',
      },
      {
        id: 'rubber-band',
        title: 'Rubber-band at boundaries',
        priority: 'medium',
        files: ['src/hooks/useBottomSheetDrag.ts', 'SwipeCard.tsx'],
        why: 'Hard stops feel frozen; progressive resistance feels responsive but bounded.',
      },
      {
        id: 'spatial-consistency',
        title: 'Symmetric enter/exit paths',
        priority: 'medium',
        files: ['CategoryEditorModal.tsx', 'UploadPage.tsx', 'EncouragementBurst.tsx'],
        why: 'If a sheet slides up, it should dismiss back down — not sideways or via a different curve.',
      },
    ],
  },
  {
    id: 'materials',
    label: 'Materials & depth',
    summary: 'Translucent layers, vibrancy, and hierarchy without stealing focus from content.',
    suggestions: [
      {
        id: 'frosted-chrome',
        title: 'Frosted toolbar vs opaque bar',
        priority: 'medium',
        files: ['src/components/layout/AppShell.tsx', 'NavRail.tsx', 'uiClasses.ts'],
        why: 'Content scrolling under translucent chrome reads as depth; opaque bars consume space.',
      },
      {
        id: 'popover-origin',
        title: 'Origin-aware popovers',
        priority: 'medium',
        files: ['CategoryPicker.tsx', 'MonthRangePicker.tsx'],
        why: 'Scaling from the trigger preserves spatial relationship; center-origin feels disconnected.',
      },
    ],
  },
  {
    id: 'typography',
    label: 'Typography',
    summary: 'Optical sizing — tracking and leading that change with text size.',
    suggestions: [
      {
        id: 'optical-type',
        title: 'Display tracking & leading',
        priority: 'low',
        files: ['src/index.css', 'src/lib/uiClasses.ts'],
        why: 'Large headings need tighter leading and negative tracking; body stays near zero.',
      },
    ],
  },
]

export const APPLE_PRIORITY_LABEL: Record<AppleSuggestionPriority, string> = {
  high: 'High impact',
  medium: 'Medium',
  low: 'Low / optional',
}

export const APPLE_PRIORITY_STYLE: Record<AppleSuggestionPriority, string> = {
  high: 'border-duo-green/30 bg-duo-green/10 text-duo-green',
  medium: 'border-ice/30 bg-ice/10 text-ice',
  low: 'border-surface-600/60 bg-surface-800/60 text-surface-400',
}

export type RecommendedDesignSkill = {
  id: string
  name: string
  installPath: string
  fit: 'primary' | 'secondary' | 'situational'
  reason: string
}

/** Global skills ranked for SpentWhatt — gesture-heavy Operate-mode finance app. */
export const RECOMMENDED_DESIGN_SKILLS: RecommendedDesignSkill[] = [
  {
    id: 'emil-design-eng',
    name: 'Emil design engineering',
    installPath: 'emilkowalski/skill@emil-design-eng',
    fit: 'primary',
    reason: 'Easing, duration, scale entrances, transition-all — motion craft for web UI.',
  },
  {
    id: 'apple-design',
    name: 'Apple fluid interfaces',
    installPath: 'emilkowalski/skill@apple-design',
    fit: 'primary',
    reason: 'Springs, interruptibility, velocity handoff, sheets/swipe — matches classify flow.',
  },
  {
    id: 'impeccable',
    name: 'Impeccable',
    installPath: 'pbakaus/impeccable@impeccable',
    fit: 'primary',
    reason: 'Operate-mode app polish: hierarchy, tokens, a11y, critique/audit before shipping.',
  },
  {
    id: 'animate',
    name: 'Animate (build sequence)',
    installPath: 'emilkowalski/skill@animate',
    fit: 'primary',
    reason: 'Whether to animate, tool choice, interruption — lab tab: Animate.',
  },
  {
    id: 'gpt-taste',
    name: 'GPT taste',
    installPath: 'leonxlnx/taste-skill@gpt-taste',
    fit: 'situational',
    reason: 'Landing/editorial anti-slop — lab tab: GPT. Not for classify UI.',
  },
  {
    id: 'high-end-visual-design',
    name: 'High-end visual design',
    installPath: 'leonxlnx/taste-skill@high-end-visual-design',
    fit: 'secondary',
    reason: 'Double-bezel, island nav, agency motion — lab tab: High-end.',
  },
  {
    id: 'imagegen-frontend-mobile',
    name: 'ImageGen mobile',
    installPath: 'leonxlnx/taste-skill@imagegen-frontend-mobile',
    fit: 'situational',
    reason: 'Premium mobile art direction for concepts — lab tab: ImageGen (CSS mockups).',
  },
  {
    id: 'improve-animations',
    name: 'Improve animations',
    installPath: 'emilkowalski/skill@improve-animations',
    fit: 'secondary',
    reason: 'Read-only motion audit roadmap — pairs with these lab tabs.',
  },
  {
    id: 'ask-sonner',
    name: 'Ask Sonner',
    installPath: 'emilkowalski/skill@ask-sonner',
    fit: 'situational',
    reason: 'If you add toast feedback — spacing, stacking, reduced-motion patterns.',
  },
  {
    id: 'design-taste-frontend',
    name: 'Design taste frontend',
    installPath: 'leonxlnx/taste-skill@design-taste-frontend',
    fit: 'situational',
    reason: 'Landing/marketing pages only — not dashboards or classify UI.',
  },
]
