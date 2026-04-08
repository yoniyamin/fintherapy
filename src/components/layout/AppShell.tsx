import { NavLink, Outlet } from 'react-router-dom'
import OrganicBackdrop from './OrganicBackdrop'

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon, activeIcon: HomeIconFilled },
  { to: '/classify', label: 'Classify', icon: SwipeIcon, activeIcon: SwipeIconFilled },
  { to: '/reveal', label: 'Reveal', icon: RevealIcon, activeIcon: RevealIconFilled },
  { to: '/bets', label: 'Bets', icon: BetsIcon, activeIcon: BetsIconFilled },
]

export default function AppShell() {
  return (
    <div className="relative flex h-full min-h-full flex-col bg-surface-900">
      <OrganicBackdrop />
      <main className="relative z-10 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="relative z-10 flex shrink-0 border-t border-white/[0.06] bg-surface-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 pb-3 pt-3 text-[11px] font-semibold transition-colors ${
                isActive
                  ? 'text-duo-green'
                  : 'text-surface-500 hover:text-surface-300'
              }`
            }
          >
            {({ isActive }) => (
              <div className="relative flex flex-col items-center gap-1">
                {isActive && (
                  <div
                    className="pointer-events-none absolute -bottom-1 left-1/2 h-10 w-10 -translate-x-1/2 rounded-full bg-duo-green/35 blur-xl"
                    aria-hidden
                  />
                )}
                <span className={isActive ? 'relative text-duo-green drop-shadow-[0_0_12px_rgba(88,204,2,0.55)]' : 'relative'}>
                  {isActive ? <item.activeIcon /> : <item.icon />}
                </span>
                <span className="relative">{item.label}</span>
                {isActive && (
                  <div className="relative h-[3px] w-5 rounded-full bg-duo-green shadow-[0_0_12px_rgba(88,204,2,0.6)]" />
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function HomeIconFilled() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

function SwipeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  )
}

function SwipeIconFilled() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" fill="none" />
      <path d="M12 17v4" />
    </svg>
  )
}

function RevealIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  )
}

function RevealIconFilled() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  )
}

function BetsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function BetsIconFilled() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" stroke="var(--color-surface-900)" fill="none" />
    </svg>
  )
}
