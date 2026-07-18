import { useEffect, useRef, useState, type FC } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import CompactHomePanel from './CompactHomePanel'
import InstallPrompt from './InstallPrompt'
import { allNavItems } from './navItems'
import NavRail from './NavRail'
import OrganicBackdrop from './OrganicBackdrop'

function TabBar() {
  return (
    <footer
      className="relative z-10 shrink-0 border-t border-white/[0.06] bg-surface-900/90 backdrop-blur-md"
      style={{ paddingBottom: 'var(--pwa-tab-safe-bottom)' }}
    >
      <nav className="flex" aria-label="Main navigation">
        {allNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end ?? undefined}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center px-0.5 pb-1 pt-2.5 text-[10px] font-semibold leading-tight transition-colors ${
                isActive ? 'text-duo-green' : 'text-surface-500 hover:text-surface-300'
              }`
            }
          >
            {({ isActive }) => (
              <div className="relative flex flex-col items-center gap-0.5">
                {isActive && (
                  <div
                    className="pointer-events-none absolute -bottom-0.5 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-duo-green/35 blur-xl"
                    aria-hidden
                  />
                )}
                <span className={isActive ? 'relative text-duo-green drop-shadow-[0_0_12px_rgba(88,204,2,0.55)]' : 'relative'} aria-hidden>
                  {isActive ? <item.activeIcon /> : <item.icon />}
                </span>
                <span className="relative">{item.label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </footer>
  )
}

const SHOW_DEBUG_OVERLAY = false

const DebugOverlay: FC = () => {
  const shellRef = useRef<HTMLPreElement>(null)
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

function DesktopContentArea() {
  const { pathname } = useLocation()
  const scrollRef = useRef<HTMLElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo?.(0, 0)
  }, [pathname])

  return (
    <main
      ref={scrollRef}
      className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4"
    >
      <Outlet />
    </main>
  )
}

export default function AppShell() {
  const isDesktop = useIsDesktop()

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-surface-900 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <OrganicBackdrop />
      <InstallPrompt />
      {SHOW_DEBUG_OVERLAY && <DebugOverlay />}

      {isDesktop ? (
        <div className="relative z-10 flex min-h-0 flex-1">
          <aside className="w-[320px] shrink-0 overflow-y-auto overscroll-contain border-r border-white/[0.06]">
            <CompactHomePanel />
          </aside>
          <NavRail />
          <DesktopContentArea />
        </div>
      ) : (
        <>
          <main className="relative z-10 min-h-0 flex-1 overflow-y-auto pb-4">
            <Outlet />
          </main>
          <TabBar />
        </>
      )}
    </div>
  )
}

