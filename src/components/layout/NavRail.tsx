import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useFlaggedCount } from '../../hooks/useFlaggedCount'
import { useTransactions } from '../../hooks/useTransactions'
import { desktopNavItems, desktopSecondaryItems, type NavItemDef } from './navItems'

function NavRailItem({ item, badge }: { item: NavItemDef; badge?: number }) {
  return (
    <NavLink
      to={item.to}
      end={item.end ?? undefined}
      className={({ isActive }) =>
        `group relative flex flex-col items-center gap-0.5 px-1 py-3 text-[10px] font-semibold leading-tight transition-colors ${
          isActive ? 'text-duo-green' : 'text-surface-500 hover:text-surface-300'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-duo-green shadow-[0_0_12px_rgba(88,204,2,0.55)]"
              aria-hidden
            />
          )}
          <span
            className={`relative ${isActive ? 'text-duo-green drop-shadow-[0_0_12px_rgba(88,204,2,0.55)]' : ''}`}
            aria-hidden
          >
            {isActive ? <item.activeIcon /> : <item.icon />}
            {badge != null && badge > 0 && (
              <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-duo-green px-1 text-[9px] font-bold tabular-nums text-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>
          <span className="relative">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

export default function NavRail() {
  const { profile } = useAuth()
  const { transactions: pending, autoClassified } = useTransactions(profile?.household_id)
  const classifyQueueCount = pending.length + autoClassified.length
  const noIdeaCount = useFlaggedCount(profile?.household_id)
  const classifyBadge = classifyQueueCount + noIdeaCount

  return (
    <nav
      className="flex w-[72px] shrink-0 flex-col border-x border-white/[0.06] bg-surface-900/90 backdrop-blur-md"
      aria-label="Desktop navigation"
      data-testid="nav-rail"
    >
      <div className="flex flex-1 flex-col items-stretch pt-4">
        {desktopNavItems.map((item) => (
          <NavRailItem
            key={item.to}
            item={item}
            badge={item.to === '/classify' ? classifyBadge : undefined}
          />
        ))}
      </div>
      <div className="flex flex-col items-stretch border-t border-white/[0.06] pb-4 pt-2">
        {desktopSecondaryItems.map((item) => (
          <NavRailItem key={item.to} item={item} />
        ))}
      </div>
    </nav>
  )
}
