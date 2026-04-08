import { motion } from 'framer-motion'
import type { LeaderboardEntry } from '../../hooks/useReveal'
import { ui } from '../../lib/uiClasses'

interface Props {
  entries: LeaderboardEntry[]
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ entries }: Props) {
  if (entries.length === 0) return null

  return (
    <div className="mt-6 space-y-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">Leaderboard</h2>
      {entries.map((entry, i) => (
        <motion.div
          key={entry.user_id}
          className={`flex items-center gap-3 p-3.5 ${ui.glassFlat}`}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <span className="text-lg">{MEDALS[i] ?? `#${i + 1}`}</span>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gem/15 text-sm font-bold text-gem">
            {entry.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-surface-200">{entry.display_name}</p>
            <p className="text-xs text-surface-500">
              {entry.classified_count} classified
            </p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold tabular-nums text-gem">{entry.total_xp}</p>
            <p className="text-[10px] text-surface-500">XP</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
