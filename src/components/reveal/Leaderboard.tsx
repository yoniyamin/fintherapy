import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LeaderboardEntry } from '../../hooks/useReveal'
import type { DailyActivity } from '../../hooks/useTransactions'
import { ui } from '../../lib/uiClasses'

interface Props {
  entries: LeaderboardEntry[]
  /** Pass from Home (even `[]`) so expanded rows show today vs all-time; omit on Reveal. */
  dailyActivity?: DailyActivity[]
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ entries, dailyActivity }: Props) {
  const [openUserId, setOpenUserId] = useState<string | null>(null)
  const todayByUser = useMemo(() => {
    const m = new Map<string, DailyActivity>()
    for (const d of dailyActivity ?? []) {
      m.set(d.user_id, d)
    }
    return m
  }, [dailyActivity])

  if (entries.length === 0) return null

  const homeMode = dailyActivity !== undefined

  return (
    <div className="mt-6 space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">Leaderboard</h2>
      {entries.map((entry, i) => {
        const isOpen = openUserId === entry.user_id
        const todayRow = todayByUser.get(entry.user_id)
        const classifiedToday = todayRow ? Number(todayRow.classified_today) : 0
        const uploadsToday = todayRow ? Number(todayRow.uploads_today) : 0
        const betsToday = todayRow ? Number(todayRow.bets_placed_today) : 0

        return (
          <motion.div
            key={entry.user_id}
            className={`overflow-hidden ${ui.glassFlat}`}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <button
              type="button"
              onClick={() => setOpenUserId(isOpen ? null : entry.user_id)}
              className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-white/[0.04]"
              aria-expanded={isOpen}
            >
              <span className="text-lg">{MEDALS[i] ?? `#${i + 1}`}</span>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gem/15 text-sm font-bold text-gem">
                {entry.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-surface-200">{entry.display_name}</p>
                <p className="text-xs text-surface-500">{entry.classified_count} classified · all-time</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold tabular-nums text-gem">{entry.total_xp}</p>
                <p className="text-[10px] text-surface-500">XP</p>
              </div>
              <span className="shrink-0 text-surface-500" aria-hidden>
                {isOpen ? '▾' : '▸'}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-white/[0.06]"
                >
                  <div
                    className={`grid gap-3 px-3.5 py-3 ${homeMode ? 'sm:grid-cols-2' : ''}`}
                  >
                    {homeMode && (
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                          Today
                        </p>
                        <ul className="space-y-1 text-[11px] text-surface-300">
                          <li className="flex justify-between gap-2 tabular-nums">
                            <span className="text-surface-500">Classified</span>
                            <span>{classifiedToday}</span>
                          </li>
                          <li className="flex justify-between gap-2 tabular-nums">
                            <span className="text-surface-500">Uploads</span>
                            <span>{uploadsToday}</span>
                          </li>
                          <li className="flex justify-between gap-2 tabular-nums">
                            <span className="text-surface-500">Bets placed</span>
                            <span>{betsToday}</span>
                          </li>
                        </ul>
                      </div>
                    )}
                    <div>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                        All-time
                      </p>
                      <ul className="space-y-1 text-[11px] text-surface-300">
                        <li className="flex justify-between gap-2 tabular-nums">
                          <span className="text-surface-500">Total XP</span>
                          <span className="font-semibold text-gem">{entry.total_xp}</span>
                        </li>
                        <li className="flex justify-between gap-2 tabular-nums">
                          <span className="text-surface-500">Classified</span>
                          <span>{entry.classified_count}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}
