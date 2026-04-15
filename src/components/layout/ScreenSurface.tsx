import OrganicBackdrop from './OrganicBackdrop'

/** Full-screen organic backdrop + stacked content (login, signup, household setup). */
export default function ScreenSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full bg-surface-900">
      <OrganicBackdrop />
      <div className="relative z-10 min-h-full pb-[env(safe-area-inset-bottom)]">{children}</div>
    </div>
  )
}
