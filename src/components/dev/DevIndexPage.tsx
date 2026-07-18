import { Link } from 'react-router-dom'
import { DEV_SCREENS } from './devScreens'
import { ui } from '../../lib/uiClasses'
import ScreenSurface from '../layout/ScreenSurface'

/**
 * Dev hub — links to all local-only sandboxes.
 * URL: /dev
 */
export default function DevIndexPage() {
  return (
    <ScreenSurface>
      <div className="flex min-h-[100dvh] flex-col pt-[env(safe-area-inset-top,0px)]">
        <header className="shrink-0 border-b border-white/[0.06] px-4 py-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/90">Dev only</p>
          <h1 className="text-xl font-bold text-surface-50">Developer screens</h1>
          <p className="mt-1 text-xs text-surface-400">
            Local sandboxes — not available in production builds.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ul className="mx-auto max-w-lg space-y-3">
            {DEV_SCREENS.map((screen) => (
              <li key={screen.path}>
                <Link
                  to={screen.path}
                  className={`block rounded-2xl border border-white/[0.08] ${ui.glassFlat} px-4 py-4 transition-colors hover:border-white/[0.14] hover:bg-surface-800/60`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-left">
                      <p className="font-semibold text-surface-50">{screen.title}</p>
                      <p className="mt-1 text-xs text-surface-400">{screen.description}</p>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="mt-0.5 h-4 w-4 shrink-0 text-surface-500"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-ice/80">{screen.path}</p>
                  {screen.inAppShell && (
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-surface-500">
                      Opens inside app shell (tab bar)
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <p className="mx-auto mt-8 max-w-lg text-center text-[11px] text-surface-600">
            Add new entries in{' '}
            <span className="font-mono text-surface-500">src/components/dev/devScreens.ts</span>
          </p>
        </div>
      </div>
    </ScreenSurface>
  )
}
