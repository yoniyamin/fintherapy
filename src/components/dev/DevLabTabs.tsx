import { NavLink } from 'react-router-dom'
import { ui } from '../../lib/uiClasses'

const TABS = [
  { to: '/dev/animations', label: 'Previews' },
  { to: '/dev/emil-improvements', label: 'Emil' },
  { to: '/dev/apple-improvements', label: 'Apple' },
  { to: '/dev/animate-improvements', label: 'Animate' },
  { to: '/dev/gpt-taste-improvements', label: 'GPT' },
  { to: '/dev/high-end-improvements', label: 'High-end' },
  { to: '/dev/imagegen-mobile-improvements', label: 'ImageGen' },
] as const

/**
 * Scrollable tab bar shared by dev animation lab routes.
 */
export default function DevLabTabs() {
  return (
    <nav
      className={`mx-auto mt-3 max-w-lg overflow-x-auto ${ui.tabShell}`}
      aria-label="Animation lab sections"
    >
      <div className="flex min-w-max gap-1">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              `shrink-0 rounded-lg px-2.5 py-2 text-center text-[11px] font-semibold transition-colors sm:px-3 sm:text-xs ${
                isActive ? ui.tabActive : ui.tabIdle
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
