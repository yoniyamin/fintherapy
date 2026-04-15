import { useEffect, useRef, useState, type FC } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import OrganicBackdrop from './OrganicBackdrop'
import InstallPrompt from './InstallPrompt'

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon, activeIcon: HomeIconFilled },
  { to: '/classify', label: 'Classify', icon: SwipeIcon, activeIcon: SwipeIconFilled },
  { to: '/reveal', label: 'Reveal', icon: RevealIcon, activeIcon: RevealIconFilled },
  { to: '/bets', label: 'Bets', icon: BetsIcon, activeIcon: BetsIconFilled },
]

function TabBar() {
  return (
    <nav
      className="relative z-10 flex shrink-0 border-t border-white/[0.06] bg-surface-900/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md"
      aria-label="Main navigation"
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/classify' ? false : undefined}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 pb-3 pt-3 text-[11px] font-semibold transition-colors ${
              isActive ? 'text-duo-green' : 'text-surface-500 hover:text-surface-300'
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
  )
}

const SHOW_DEBUG_OVERLAY = false

const DebugOverlay: FC = () => {
  const shellRef = useRef<HTMLDivElement>(null)
  const [info, setInfo] = useState('')

  useEffect(() => {
    const update = () => {
      const root = document.getElementById('root')
      const rootRect = root?.getBoundingClientRect()
      const shellRect = shellRef.current?.parentElement?.getBoundingClientRect()
      const navEl = document.querySelector('nav[aria-label="Main navigation"]')
      const navRect = navEl?.getBoundingClientRect()
      const vv = window.visualViewport
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true

      const probe = document.createElement('div')
      probe.style.cssText =
        'position:fixed;top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);left:0;right:0;pointer-events:none;visibility:hidden;'
      document.body.appendChild(probe)
      const probeRect = probe.getBoundingClientRect()
      const saTop = probeRect.top
      const saBot = window.innerHeight - probeRect.bottom
      document.body.removeChild(probe)

      setInfo(
        [
          `standalone: ${isStandalone}`,
          `screen: ${screen.width}x${screen.height}`,
          `innerH: ${window.innerHeight}`,
          `vvH: ${vv?.height?.toFixed(0)} ofsY: ${vv?.offsetTop?.toFixed(0)}`,
          `rootRect: ${rootRect?.height?.toFixed(0)} (t:${rootRect?.top?.toFixed(0)} b:${rootRect?.bottom?.toFixed(0)})`,
          `shellRect: ${shellRect?.height?.toFixed(0)} (t:${shellRect?.top?.toFixed(0)} b:${shellRect?.bottom?.toFixed(0)})`,
          `navRect: ${navRect?.height?.toFixed(0)} (t:${navRect?.top?.toFixed(0)} b:${navRect?.bottom?.toFixed(0)})`,
          `saTop: ${saTop.toFixed(0)}  saBot: ${saBot.toFixed(0)}`,
          `dpr: ${devicePixelRatio}`,
        ].join('\n'),
      )
    }
    update()
    const id = setInterval(update, 3000)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      clearInterval(id)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  return (
    <pre
      ref={shellRef}
      className="fixed right-1 top-14 z-[9999] rounded bg-black/90 p-1.5 text-[8px] leading-tight text-green-400"
    >
      {info}
    </pre>
  )
}

export default function AppShell() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-surface-900 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <OrganicBackdrop />
      <InstallPrompt />
      {SHOW_DEBUG_OVERLAY && <DebugOverlay />}
      <main className="relative z-10 min-h-0 flex-1 overflow-y-auto pb-4">
        <Outlet />
      </main>
      <TabBar />
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
