import type { AuditVisualId } from './auditVisualExamples'

export type AppAuditPriority = 'high' | 'medium' | 'low'

export type AppAuditItem = {
  title: string
  files: string[]
  advice: string
  priority: AppAuditPriority
  visualId?: AuditVisualId
}

export type SkillAppAudit = {
  skillId: string
  skillName: string
  reviewed: string[]
  summary: string
  strengths: string[]
  recommendations: AppAuditItem[]
}

export const SKILL_APP_AUDITS: Record<string, SkillAppAudit> = {
  emil: {
    skillId: 'emil',
    skillName: 'Emil design engineering',
    reviewed: ['Button.tsx', 'SwipeCard.tsx', 'DeckClearedScreen.tsx', 'index.css', 'HomePage.tsx'],
    summary:
      'SpentWhatt already nails the Duolingo press language and glass cards. The biggest wins are shared tokens, killing scale-from-zero badges, and stopping layout-triggering height animations on daily screens.',
    strengths: [
      'SwipeCard stack uses scale(0.95) + y offset on enter — matches Emil entrance guidance.',
      'Primary buttons use border-b-[3px] + active:translate-y — distinctive, responsive press affordance.',
      'ui.glass / ui.glassFlat tokens give consistent jewel-tone surfaces across home, analysis, and auth.',
    ],
    recommendations: [
      {
        title: 'Replace transition-all on Button',
        files: ['src/components/common/Button.tsx'],
        advice:
          'Add active:scale-[0.97] and transition only transform/filter/opacity (~150ms ease-out). Every screen inherits this.',
        priority: 'high',
        visualId: 'emil-button-press',
      },
      {
        title: 'Fix scale(0) badge pops',
        files: ['src/components/swipe/SwipeCard.tsx', 'src/components/swipe/DeckClearedScreen.tsx'],
        advice:
          'Predicted category badge and +XP counter use scale(0). Use scale(0.92–0.95) + opacity — same fix as the Emil lab demo.',
        priority: 'high',
        visualId: 'emil-scale-badge',
      },
      {
        title: 'Add global easing tokens',
        files: ['src/index.css'],
        advice:
          'Ship --ease-out, --ease-in-out, --ease-drawer once; reference in modals and encouragement overlays instead of generic spring defaults.',
        priority: 'high',
        visualId: 'emil-easing',
      },
      {
        title: 'Height: auto expand on Home',
        files: ['src/components/home/HomePage.tsx', 'src/components/layout/CompactHomePanel.tsx'],
        advice:
          'AnimatePresence height animations fire layout every frame. Prefer grid 0fr→1fr for household activity expanders.',
        priority: 'medium',
        visualId: 'emil-height-expand',
      },
      {
        title: 'Global prefers-reduced-motion',
        files: ['src/index.css', 'shared motion hook'],
        advice: 'Only Confetti respects reduced motion today. Strip transform motion app-wide; keep opacity/color.',
        priority: 'medium',
        visualId: 'emil-reduced-motion',
      },
    ],
  },
  apple: {
    skillId: 'apple',
    skillName: 'Apple fluid interfaces',
    reviewed: ['useBottomSheetDrag.ts', 'SwipeCard.tsx', 'EncouragementBurst.tsx', 'AppShell.tsx', 'NavRail.tsx'],
    summary:
      'Classify is your strongest fluid surface — 1:1 drag, velocity dismiss on sheets. Gaps are pointer-down feedback, interruptible sheet exits, and toning down celebration springs.',
    strengths: [
      'SwipeCard tracks x/y/rotate 1:1 with pointer; only top card gets backdrop-blur — smart perf choice.',
      'useBottomSheetDrag checks velocity.y > 480 — velocity-aware dismiss matches Apple handoff thinking.',
      'NavRail uses color-only active state with no enter animation — correct for 100+/day navigation.',
    ],
    recommendations: [
      {
        title: 'Pointer-down on pressables',
        files: ['src/components/common/Button.tsx', 'classify icon buttons in SwipeCard.tsx'],
        advice:
          'Primary feedback still waits for click/active. Highlight on pointerdown with scale(0.97) for instant response.',
        priority: 'high',
        visualId: 'apple-pointer-down',
      },
      {
        title: 'Critically damp celebration springs',
        files: ['src/components/swipe/DeckClearedScreen.tsx', 'src/components/swipe/EncouragementBurst.tsx'],
        advice:
          'Deck cleared shell enters at scale(0.8) with low damping. Use bounce: 0 unless the user flicked — menus and celebrations should settle, not wobble.',
        priority: 'high',
        visualId: 'apple-spring-damp',
      },
      {
        title: 'Asymmetric sheet exit',
        files: ['CategoryEditorModal.tsx', 'UploadPage.tsx'],
        advice: 'Bottom sheets enter from y:100%. Exit should be faster (≈180ms) than enter (≈250ms) with same path.',
        priority: 'medium',
        visualId: 'apple-sheet-exit',
      },
      {
        title: 'Rubber-band at sheet top',
        files: ['src/hooks/useBottomSheetDrag.ts'],
        advice:
          'dragElastic 0.22 is a start; add progressive resistance when dragging up past rest — hard stops feel frozen on iOS.',
        priority: 'medium',
      },
      {
        title: 'Frost tab bar over scrolling content',
        files: ['src/components/layout/AppShell.tsx'],
        advice:
          'Tab bar is opaque surface-900. Translucent ui.sheet + backdrop-blur would let OrganicBackdrop show through on scroll.',
        priority: 'low',
        visualId: 'apple-frost-tab',
      },
    ],
  },
  animate: {
    skillId: 'animate',
    skillName: 'Animate (build sequence)',
    reviewed: ['HomePage.tsx', 'SettingsPage.tsx', 'EncouragementBurst.tsx', 'NavRail.tsx', 'ProgressBar.tsx'],
    summary:
      'The build-sequence gate says: classify gestures yes, daily page stagger no. You mostly obey that on nav; Home and Settings still animate on every visit.',
    strengths: [
      'Swipe deck correctly uses springs for interruptible gesture motion — right tool for the job.',
      'EncouragementBurst is occasional delight — passes the frequency gate.',
      'NavRail has no route transition animation — Raycast-correct for high-frequency switching.',
    ],
    recommendations: [
      {
        title: 'Remove daily page y-stagger',
        files: ['src/components/home/HomePage.tsx', 'src/components/settings/SettingsPage.tsx'],
        advice:
          'Sections slide in with y offset on every mount. Users hit Home dozens of times per week — opacity-only or instant.',
        priority: 'high',
        visualId: 'animate-page-stagger',
      },
      {
        title: 'ProgressBar width animation',
        files: ['src/components/common/ProgressBar.tsx'],
        advice:
          'initial={{ width: 0 }} triggers layout. Use transform: scaleX() from transform-origin left for GPU-safe fill.',
        priority: 'medium',
        visualId: 'animate-progress-bar',
      },
      {
        title: 'Toast-style overlays use transitions',
        files: ['src/components/swipe/EncouragementBurst.tsx'],
        advice:
          'Overlay card uses spring — good. Ensure exit is interruptible if user taps dismiss mid-enter (AnimatePresence mode).',
        priority: 'medium',
      },
      {
        title: 'Document “no motion” zones',
        files: ['src/components/layout/NavRail.tsx', 'src/components/swipe/ClassifyScopeBar.tsx'],
        advice:
          'Keep classify scope toggles instant. Any animation on filter chips adds perceived latency during sorting marathons.',
        priority: 'low',
        visualId: 'animate-nav-instant',
      },
    ],
  },
  'gpt-taste': {
    skillId: 'gpt-taste',
    skillName: 'GPT taste',
    reviewed: ['HomePage.tsx', 'LoginPage.tsx', 'AnalysisPage.tsx', 'HeadlineBanner.tsx'],
    summary:
      'SpentWhatt is Operate-mode finance — gpt-taste landing rules mostly do not apply. Auth and analysis headlines are where anti-slop rules still matter.',
    strengths: [
      'No “SECTION 01” meta-label spam in production screens — headings are functional.',
      'Home hero uses ui.heroTitle gradient clip — editorial without 6-line wall-of-text.',
      'Analysis uses real data density appropriate for dashboards, not fake bento filler.',
    ],
    recommendations: [
      {
        title: 'Auth hero width',
        files: ['src/components/auth/LoginPage.tsx', 'SignUpPage.tsx'],
        advice:
          'Auth titles animate y:20 on mount — fine once. Ensure H1 stays ≤2 lines on mobile (max-w-lg is ok; watch font size).',
        priority: 'low',
        visualId: 'gpt-hero-lines',
      },
      {
        title: 'Analysis grid gaps',
        files: ['src/components/analysis/AnalysisDesktopPage.tsx', 'gridAdaptive panels'],
        advice:
          'Desktop analysis uses auto-fit grids — verify no orphan empty cells when one panel is hidden; grid-flow-dense if needed.',
        priority: 'low',
        visualId: 'gpt-grid-dense',
      },
      {
        title: 'Do not apply AIDA to classify',
        files: ['src/components/swipe/SwipeDeck.tsx'],
        advice:
          'gpt-taste AIDA/marketing patterns would harm classify. Keep this skill off the swipe flow entirely.',
        priority: 'high',
        visualId: 'gpt-classify-focus',
      },
      {
        title: 'CTA contrast on gem/ice panels',
        files: ['src/components/home/HomePage.tsx'],
        advice:
          'Ice-bordered CTA cards use cyan accents — ensure button text stays white on duo-green, never surface-700 on surface-800.',
        priority: 'medium',
        visualId: 'gpt-button-contrast',
      },
    ],
  },
  'high-end': {
    skillId: 'high-end',
    skillName: 'High-end visual design',
    reviewed: ['uiClasses.ts', 'OrganicBackdrop.tsx', 'HomePage.tsx', 'AppShell.tsx', 'KpiCards.tsx'],
    summary:
      'You already sit above “template SaaS” thanks to OrganicBackdrop, jewel tokens, and rounded-[24px] swipe cards. Agency-tier polish would add nested bezels on chart cards and magnetic CTAs.',
    strengths: [
      'OrganicBackdrop — drifting blobs + dot grid + SVG flow lines = atmosphere without flat #0f172a slop.',
      'ui.glass gradient borders (white/[0.08]) match Ethereal Glass archetype from the skill.',
      'SwipeCard shadow-[0_28px_56px_-24px_...] is soft, diffused — not harsh shadow-md.',
    ],
    recommendations: [
      {
        title: 'Double-bezel on chartCard',
        files: ['src/lib/uiClasses.ts', 'src/components/analysis/KpiCards.tsx'],
        advice:
          'Wrap chartCard in outer p-1.5 shell + inner inset highlight — skill’s Doppelrand pattern for analysis KPIs.',
        priority: 'medium',
        visualId: 'high-end-bezel',
      },
      {
        title: 'Floating island tab bar (desktop)',
        files: ['src/components/layout/NavRail.tsx'],
        advice:
          'NavRail is edge-attached. A detached glass pill with mt-6 would read more agency — optional on xl breakpoint only.',
        priority: 'low',
        visualId: 'high-end-island-nav',
      },
      {
        title: 'Magnetic primary CTAs',
        files: ['src/components/common/Button.tsx', 'Reveal CTAs in DeckClearedScreen.tsx'],
        advice:
          'Add group-hover translate on trailing icons where buttons include arrows; active:scale-[0.98] on whole pill.',
        priority: 'medium',
        visualId: 'high-end-magnetic-btn',
      },
      {
        title: 'Custom cubic-bezier outside dev lab',
        files: ['src/index.css', 'modals'],
        advice:
          'Production still uses ease-in-out in places. Ship --ease-drawer for sheets to match high-end choreo table.',
        priority: 'medium',
        visualId: 'high-end-bezier',
      },
      {
        title: 'Scroll entry on analysis panels',
        files: ['src/components/analysis/ComparisonTable.tsx', 'KpiCards.tsx'],
        advice:
          'Panels mount with y:12 stagger — acceptable for occasional analysis visits. Add blur-md resolve for premium feel.',
        priority: 'low',
        visualId: 'high-end-scroll-entry',
      },
    ],
  },
  'imagegen-mobile': {
    skillId: 'imagegen-mobile',
    skillName: 'ImageGen mobile',
    reviewed: ['OrganicBackdrop.tsx', 'SwipeCard.tsx', 'uiClasses.ts', 'HomePage.tsx', 'ScreenSurface.tsx'],
    summary:
      'When generating mobile concept art for SpentWhatt, copy production tokens — not generic fintech purple. The lab “after” mocks must mirror SwipeCard glass, duo-green/flame/gem semantics, and OrganicBackdrop.',
    strengths: [
      'Production classify card is app-native: rounded-[24px], gradient glass, duo-green/flame/gem swipe hints.',
      'Palette is controlled: duo-green #58CC02, flame, gem, ice on surface-900 — never startup purple-blue.',
      'ScreenSurface + OrganicBackdrop already provide premium atmosphere without stock-photo hero clutter.',
    ],
    recommendations: [
      {
        title: 'Prompt with production tokens',
        files: ['docs/', 'design briefs for image gen'],
        advice:
          'Include: surface-900 bg, ui.glass borders white/8%, duo-green CTAs with 3px bottom border, Inter, classify swipe card centered.',
        priority: 'high',
        visualId: 'imagegen-backdrop',
      },
      {
        title: 'Never purple gradient fintech',
        files: ['external concept art only'],
        advice:
          'Generic NovaPay-style dashboards are anti-patterns for this brand. Use jewel tones from index.css @theme block.',
        priority: 'high',
        visualId: 'imagegen-fintech',
      },
      {
        title: 'Match SwipeCard hierarchy in mocks',
        files: ['src/components/swipe/SwipeCard.tsx'],
        advice:
          'Merchant name xl bold, date xs surface-500, amount prominent, category pills duo-green/flame — not floating tag spam.',
        priority: 'high',
        visualId: 'imagegen-classify',
      },
      {
        title: 'Safe area in concept frames',
        files: ['AppShell.tsx', 'ScreenSurface.tsx'],
        advice:
          'Show tab clearance (--shell-tab-clearance) and safe-area-inset in generated frames; classify CTAs above home indicator.',
        priority: 'medium',
        visualId: 'imagegen-safe-area',
      },
      {
        title: 'Density 3 on home, not widget wall',
        files: ['src/components/home/HomePage.tsx'],
        advice:
          'Home uses one XP hero block + optional expanders — not six stat rows. Concept art should show one focal metric per screen.',
        priority: 'medium',
        visualId: 'imagegen-density',
      },
    ],
  },
}

export const AUDIT_PRIORITY_LABEL: Record<AppAuditPriority, string> = {
  high: 'Do first',
  medium: 'Worth doing',
  low: 'Optional',
}

export const AUDIT_PRIORITY_STYLE: Record<AppAuditPriority, string> = {
  high: 'border-duo-green/30 bg-duo-green/10 text-duo-green',
  medium: 'border-ice/30 bg-ice/10 text-ice',
  low: 'border-surface-600/60 bg-surface-800/60 text-surface-400',
}
