import type { HomeLeaderboardEntry } from '../../hooks/useTransactions'

interface Props {
  currentUserId?: string
  first: HomeLeaderboardEntry
  second: HomeLeaderboardEntry
}

interface PodiumSlotProps {
  currentUserId?: string
  entry: HomeLeaderboardEntry
  rank: 1 | 2
}

/**
 * Single podium step: avatar perched on a ranked platform.
 */
function PodiumSlot({ currentUserId, entry, rank }: PodiumSlotProps) {
  const isYou = currentUserId === entry.user_id
  const platform =
    rank === 1
      ? 'h-8 w-[34px] border-amber-400/35 bg-amber-500/15'
      : 'h-5 w-[30px] border-white/[0.12] bg-white/[0.06]'
  const rankTone = rank === 1 ? 'text-amber-300' : 'text-surface-400'

  return (
    <div className="flex flex-col items-center" title={`${entry.display_name} · ${entry.total_xp} XP`}>
      <div
        className={`mb-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gem/15 text-[8px] font-bold text-gem ${
          isYou ? 'ring-1 ring-duo-green ring-offset-1 ring-offset-surface-900' : ''
        }`}
      >
        {entry.display_name.charAt(0).toUpperCase()}
      </div>
      <div className={`flex items-end justify-center rounded-t-md border border-b-0 ${platform}`}>
        <span className={`pb-0.5 text-[9px] font-extrabold tabular-nums ${rankTone}`}>{rank}</span>
      </div>
    </div>
  )
}

/**
 * Compact two-step XP podium for the household card header.
 */
export default function HouseholdPodium({ currentUserId, first, second }: Props) {
  return (
    <div className="flex shrink-0 items-end gap-0.5 pt-0.5" aria-label="Top two household members by XP">
      <PodiumSlot currentUserId={currentUserId} entry={second} rank={2} />
      <PodiumSlot currentUserId={currentUserId} entry={first} rank={1} />
    </div>
  )
}
