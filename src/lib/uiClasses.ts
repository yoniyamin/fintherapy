/** Shared glass / jewel-tone styling for Option 1+3 consistency across screens */
export const ui = {
  screen: 'relative z-10',
  page: 'mx-auto max-w-lg px-5 py-8 pb-8',
  pageNoBottomPad: 'mx-auto max-w-lg px-5 py-8',
  heroTitle:
    'bg-gradient-to-r from-surface-100 via-ice to-gem-light bg-clip-text text-transparent text-xl font-bold tracking-tight',
  heroSub: 'mt-0.5 text-sm text-surface-400',
  glass:
    'rounded-[24px] border border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent backdrop-blur-xl shadow-[0_24px_56px_-28px_rgba(0,0,0,0.55)]',
  glassFlat:
    'rounded-2xl border border-white/[0.07] bg-white/[0.04] backdrop-blur-md shadow-[0_16px_40px_-24px_rgba(0,0,0,0.45)]',
  glassInset: 'rounded-2xl border border-white/[0.06] bg-surface-950/45',
  input:
    'rounded-xl border border-white/[0.08] bg-surface-950/55 px-4 py-3 text-sm text-surface-50 placeholder-surface-500 outline-none transition-colors focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20',
  select:
    'rounded-xl border border-white/[0.08] bg-surface-950/55 px-3 py-2.5 text-sm text-surface-50 outline-none transition-colors focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20',
  tabShell: 'flex gap-1 rounded-xl border border-white/[0.06] bg-surface-950/45 p-1 backdrop-blur-sm',
  tabActive: 'rounded-lg bg-white/[0.1] text-surface-50 shadow-sm',
  tabIdle: 'rounded-lg text-surface-500 hover:text-surface-300',
  dangerBanner: 'rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger',
  chartCard: 'rounded-[24px] border border-white/[0.07] bg-white/[0.04] p-4 backdrop-blur-md shadow-[0_16px_40px_-24px_rgba(0,0,0,0.4)]',
  sheet: 'border-t border-white/10 bg-surface-950/95 backdrop-blur-xl',
} as const
