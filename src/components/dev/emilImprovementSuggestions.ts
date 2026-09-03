export type EmilSuggestionPriority = 'high' | 'medium' | 'low'

export type EmilSuggestion = {
  id: string
  title: string
  priority: EmilSuggestionPriority
  files: string[]
  before: string
  after: string
  why: string
}

export type EmilSuggestionGroup = {
  id: string
  label: string
  summary: string
  suggestions: EmilSuggestion[]
}

export const EMIL_SUGGESTION_GROUPS: EmilSuggestionGroup[] = [
  {
    id: 'shared-primitives',
    label: 'Shared primitives',
    summary: 'Small changes that improve the whole app through shared components and tokens.',
    suggestions: [
      {
        id: 'button-transition-all',
        title: 'Button press & transitions',
        priority: 'high',
        files: ['src/components/common/Button.tsx'],
        before: 'transition-all + active:translate-y-[1px] only',
        after: 'transition-[transform,filter,opacity] duration-150 ease-out + active:scale-[0.97]',
        why: 'Specify exact properties; scale gives instant press feedback on every button.',
      },
      {
        id: 'easing-tokens',
        title: 'Custom easing tokens',
        priority: 'high',
        files: ['src/index.css'],
        before: 'Default CSS easings / generic spring defaults',
        after: '--ease-out: cubic-bezier(0.23, 1, 0.32, 1); --ease-in-out; --ease-drawer',
        why: 'Built-in easings feel weak; custom curves make motion feel intentional.',
      },
      {
        id: 'reduced-motion',
        title: 'Global prefers-reduced-motion',
        priority: 'high',
        files: ['src/index.css', 'shared motion hook'],
        before: 'Only Confetti.tsx uses useReducedMotion',
        after: 'Global hook + CSS overrides stripping transform motion',
        why: 'Keep opacity/color for comprehension; remove movement that can cause discomfort.',
      },
    ],
  },
  {
    id: 'classify',
    label: 'Classify & swipe',
    summary: 'High-frequency flow — keep drag springs, fix entrances and performance under load.',
    suggestions: [
      {
        id: 'swipe-scale-zero',
        title: 'Predicted badge & group count entrance',
        priority: 'high',
        files: ['src/components/swipe/SwipeCard.tsx'],
        before: 'initial={{ scale: 0, opacity: 0 }}',
        after: 'initial={{ scale: 0.95, opacity: 0 }}',
        why: 'Nothing in the real world pops from zero size.',
      },
      {
        id: 'swipe-transform-props',
        title: 'Hardware-accelerated drag transforms',
        priority: 'medium',
        files: ['src/components/swipe/SwipeCard.tsx'],
        before: 'Framer Motion x / y / rotate shorthand on style',
        after: 'transform: translateX(...) rotate(...) string under load',
        why: 'Shorthand props use rAF on the main thread; CSS transform stays GPU-smooth.',
      },
      {
        id: 'encouragement-overlay',
        title: 'Encouragement overlay timing',
        priority: 'medium',
        files: ['src/components/swipe/EncouragementBurst.tsx'],
        before: 'scale(0.88), y: 12 spring · symmetric 200ms fade',
        after: 'scale(0.95) + opacity enter 220ms ease-out · exit 160ms ease-out',
        why: 'Rare delight is fine; asymmetric exit should feel snappier than enter.',
      },
      {
        id: 'deck-cleared',
        title: 'Deck cleared screen entrance',
        priority: 'medium',
        files: ['src/components/swipe/DeckClearedScreen.tsx'],
        before: 'Shell scale(0.8) · XP counter scale(0)',
        after: 'Shell scale(0.95) + opacity · XP scale(0.92) + opacity',
        why: 'Celebration without cartoon bounce or pop-from-nothing.',
      },
    ],
  },
  {
    id: 'reveal',
    label: 'Reveal & analysis',
    summary: 'Occasional screens — stagger is fine; tighten scale entrances and duration.',
    suggestions: [
      {
        id: 'slide-deck-scale',
        title: 'Slide deck card & emoji entrances',
        priority: 'medium',
        files: [
          'src/components/reveal/SlideDeckPreview.tsx',
          'src/components/analysis/MultiMonthSlideDeckPreview.tsx',
        ],
        before: 'initial={{ scale: 0 }} on emoji · scale(0.6) on cards',
        after: 'scale(0.92–0.95) + opacity · keep subtle rotate only',
        why: 'Scale below 0.9 reads gimmicky; opacity completes the entrance naturally.',
      },
      {
        id: 'page-stagger',
        title: 'Daily page entrance stagger',
        priority: 'low',
        files: ['src/components/home/HomePage.tsx', 'src/components/settings/SettingsPage.tsx'],
        before: 'y slide + opacity stagger on every visit',
        after: 'Instant mount or opacity-only (no y) on high-frequency routes',
        why: 'Screens visited dozens of times per day should not feel delayed.',
      },
      {
        id: 'height-animate',
        title: 'Expand/collapse height animations',
        priority: 'medium',
        files: [
          'src/components/home/HomePage.tsx',
          'src/components/layout/CompactHomePanel.tsx',
          'src/components/analysis/BudgetEditorModal.tsx',
        ],
        before: 'animate={{ height: "auto", opacity: 1 }}',
        after: 'CSS grid 0fr → 1fr or clip-path reveal',
        why: 'Height animation triggers layout on every frame.',
      },
    ],
  },
  {
    id: 'modals-nav',
    label: 'Modals, sheets & navigation',
    summary: 'Bottom sheets are mostly correct; polish exits and touch hover states.',
    suggestions: [
      {
        id: 'bottom-sheet-exit',
        title: 'Asymmetric sheet exit',
        priority: 'medium',
        files: [
          'src/components/settings/CategoryEditorModal.tsx',
          'src/components/upload/UploadPage.tsx',
        ],
        before: 'Same speed enter and exit on y: 100%',
        after: 'Enter 250ms ease-out · exit 200ms ease-out (faster dismiss)',
        why: 'User decides slowly; system responds quickly on release/dismiss.',
      },
      {
        id: 'nav-no-motion',
        title: 'NavRail — no open animation',
        priority: 'low',
        files: ['src/components/layout/NavRail.tsx'],
        before: 'Color transition only (already good)',
        after: 'Keep as-is — do not add enter/exit animation',
        why: 'Navigation is used 100+ times/day; instant feedback wins.',
      },
      {
        id: 'hover-media-query',
        title: 'Touch-safe hover states',
        priority: 'medium',
        files: ['app-wide — UploadPage, CategoryEditorModal, buttons'],
        before: 'hover:brightness / hover:scale with no media query',
        after: '@media (hover: hover) and (pointer: fine) { … }',
        why: 'Prevents false hover sticking after tap on mobile.',
      },
      {
        id: 'transition-all-sweep',
        title: 'transition-all sweep',
        priority: 'medium',
        files: ['~40 components — grep transition-all'],
        before: 'transition-all on tabs, bars, links, modals',
        after: 'transition-[transform,opacity,colors] with explicit duration',
        why: 'all animates layout properties accidentally and feels mushy.',
      },
    ],
  },
]

export const EMIL_PRIORITY_LABEL: Record<EmilSuggestionPriority, string> = {
  high: 'High impact',
  medium: 'Medium',
  low: 'Low / optional',
}

export const EMIL_PRIORITY_STYLE: Record<EmilSuggestionPriority, string> = {
  high: 'border-duo-green/30 bg-duo-green/10 text-duo-green',
  medium: 'border-ice/30 bg-ice/10 text-ice',
  low: 'border-surface-600/60 bg-surface-800/60 text-surface-400',
}
