import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useFlaggedCount } from '../../hooks/useFlaggedCount'
import {
  useTransactions,
  type DailyActivity,
  type HomeLeaderboardEntry,
  type MemberDailyRecord,
} from '../../hooks/useTransactions'
import { ui } from '../../lib/uiClasses'
import { xpProgress } from '../../lib/xpLevels'
import HouseholdPodium from './HouseholdPodium'
import Leaderboard from '../reveal/Leaderboard'

interface ActivityLine {
  userId: string
  displayName: string
  summary: string
}

/**
 * Builds human-readable activity lines for members with non-zero daily stats.
 */
function buildActivityLines(activity: DailyActivity[]): ActivityLine[] {
  const lines: ActivityLine[] = []
  for (const row of activity) {
    const parts: string[] = []
    const classified = Number(row.classified_today)
    const uploads = Number(row.uploads_today)
    const bets = Number(row.bets_placed_today)
    if (classified > 0) parts.push(`classified ${classified}`)
    if (uploads > 0) parts.push(`uploaded ${uploads}`)
    if (bets > 0) parts.push(`placed ${bets} bet${bets === 1 ? '' : 's'}`)
    if (parts.length === 0) continue
    lines.push({
      userId: row.user_id,
      displayName: row.display_name,
      summary: parts.join(' · '),
    })
  }
  return lines
}

function MemberAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gem/15 font-bold text-gem ring-2 ring-surface-900 ${dim}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

interface StatusRowProps {
  badge?: string
  badgeTone?: 'default' | 'warning'
  detail: string
  label: string
  to: string
}

/** Tappable row linking to a workflow that needs household attention. */
function StatusRow({ badge, badgeTone = 'default', detail, label, to }: StatusRowProps) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-xl border border-white/[0.06] bg-surface-950/45 px-3 py-2.5 transition-colors hover:bg-surface-900/55 ${ui.glassInset}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-surface-100">{label}</p>
        <p className="text-[11px] text-surface-500">{detail}</p>
      </div>
      {badge && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums text-white ${
            badgeTone === 'warning' ? 'bg-flame' : 'bg-duo-green'
          }`}
        >
          {badge}
        </span>
      )}
      <span className="shrink-0 text-surface-500" aria-hidden>
        ›
      </span>
    </Link>
  )
}

export default function HomePage() {
  const { profile, signOut } = useAuth()
  const {
    transactions: pending,
    autoClassified,
    getDailyActivity,
    getHouseholdInfo,
    getLeaderboard,
    getMemberDailyRecords,
  } = useTransactions(profile?.household_id)
  const classifyQueueCount = pending.length + autoClassified.length
  const noIdeaCount = useFlaggedCount(profile?.household_id)
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([])
  const [leaderboard, setLeaderboard] = useState<HomeLeaderboardEntry[]>([])
  const [memberRecords, setMemberRecords] = useState<MemberDailyRecord[]>([])
  const [householdInfo, setHouseholdInfo] = useState<{ name: string; invite_code: string } | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  useEffect(() => {
    const householdId = profile?.household_id
    if (!householdId) return
    let cancelled = false
    void Promise.all([
      getDailyActivity(),
      getHouseholdInfo(),
      getLeaderboard(),
      getMemberDailyRecords(),
    ]).then(([activity, info, lb, records]) => {
      if (cancelled) return
      setDailyActivity(activity)
      if (info) setHouseholdInfo(info)
      setLeaderboard(lb)
      setMemberRecords(records)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.household_id, getDailyActivity, getHouseholdInfo, getLeaderboard, getMemberDailyRecords])

  const copyInviteCode = async () => {
    if (!householdInfo) return
    await navigator.clipboard.writeText(householdInfo.invite_code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  const xp = profile
    ? xpProgress(profile.total_xp)
    : { level: 1, progress: 0, toNext: 80, title: 'Receipt Rookie', nextTitle: 'Envelope Explorer' as string | null }

  const teamXp = useMemo(() => leaderboard.reduce((sum, entry) => sum + entry.total_xp, 0), [leaderboard])
  const memberCount = Math.max(leaderboard.length, profile ? 1 : 0)
  const activityLines = useMemo(() => buildActivityLines(dailyActivity), [dailyActivity])

  return (
    <div className="relative z-10 mx-auto flex max-w-lg flex-col px-4 pb-4 pt-5">
      {householdInfo && profile && (
        <motion.section
          className={`overflow-hidden ${ui.glass}`}
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 22 }}
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Household</p>
                <h1 className="mt-1 truncate text-lg font-extrabold tracking-tight text-surface-50">
                  {householdInfo.name}
                </h1>
                <p className="mt-0.5 text-xs text-surface-400">
                  {memberCount} member{memberCount === 1 ? '' : 's'}
                  {teamXp > 0 && (
                    <>
                      <span className="text-surface-600"> · </span>
                      <span className="tabular-nums text-gem">{teamXp.toLocaleString()} team XP</span>
                    </>
                  )}
                </p>
              </div>
              {leaderboard.length >= 2 && (
                <HouseholdPodium
                  currentUserId={profile.id}
                  first={leaderboard[0]!}
                  second={leaderboard[1]!}
                />
              )}
            </div>

            <div className="mt-3 rounded-xl border border-white/[0.06] bg-surface-950/40 px-3 py-2.5">
              <div className="flex gap-2.5">
                <div
                  className="shrink-0 rounded-full p-[2px]"
                  style={{
                    background: `conic-gradient(from -90deg, #1CB0F6 0deg, #58CC02 ${xp.progress * 360}deg, rgba(255,255,255,0.1) ${xp.progress * 360}deg)`,
                  }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-900/95 text-xs font-bold text-gem">
                    {profile.display_name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-bold text-surface-50">{profile.display_name}</p>
                    <p className="text-sm font-extrabold tabular-nums text-gem">{profile.total_xp}</p>
                  </div>
                  <p className="text-[11px] font-semibold">
                    <span className="text-surface-400">Level {xp.level}</span>
                    <span className="text-surface-600"> · </span>
                    <span className="text-teal-400">{xp.title}</span>
                  </p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-800/90 ring-1 ring-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500/90 via-emerald-400/95 to-duo-green"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(4, xp.progress * 100)}%` }}
                      transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={copyInviteCode}
              className="mt-3 flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-surface-950/50 px-3 py-2 text-left transition hover:bg-surface-900/60"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Invite code</p>
              <p className="flex-1 text-right font-mono text-xs font-bold tracking-[0.2em] text-surface-200">
                {householdInfo.invite_code}
              </p>
              <span className="shrink-0 text-[11px] font-semibold text-duo-green">
                {codeCopied ? 'Copied!' : 'Copy'}
              </span>
            </button>

            <Link to="/upload" className="mt-3 block">
              <motion.div
                className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/15 bg-surface-950/45 px-4 py-3 transition-all active:scale-[0.98] shadow-[0_18px_44px_-14px_rgba(28,176,246,0.45)] hover:shadow-[0_22px_50px_-12px_rgba(28,176,246,0.55)]"
                whileTap={{ scale: 0.98 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ice">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-sm font-semibold text-surface-100">Upload statement</p>
              </motion.div>
            </Link>
          </div>
        </motion.section>
      )}

      <motion.section
        className="mt-4 space-y-2"
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">Needs attention</h2>
        <StatusRow
          badge={classifyQueueCount > 0 ? String(classifyQueueCount) : undefined}
          detail={
            classifyQueueCount > 0
              ? `${classifyQueueCount} transaction${classifyQueueCount === 1 ? '' : 's'} waiting`
              : 'Queue is clear'
          }
          label="Classify queue"
          to="/classify"
        />
        {noIdeaCount > 0 && (
          <StatusRow
            badge={String(noIdeaCount)}
            badgeTone="warning"
            detail="Flagged for partner review"
            label="No idea queue"
            to="/classify/no-idea"
          />
        )}
        <StatusRow detail="Check monthly progress and reveal totals" label="Reveal" to="/reveal" />
      </motion.section>

      {activityLines.length > 0 && (
        <motion.section
          className="mt-4 space-y-2"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.14 }}
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">Activity today</h2>
          <div className={`space-y-2 p-3 ${ui.glassFlat}`}>
            {activityLines.map((line) => (
              <div key={line.userId} className="flex items-center gap-2.5">
                <MemberAvatar name={line.displayName} size="sm" />
                <p className="min-w-0 text-xs text-surface-300">
                  <span className="font-semibold text-surface-100">{line.displayName}</span>{' '}
                  {line.summary}
                </p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {leaderboard.length > 1 && (
        <motion.div
          className="mt-4"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18 }}
        >
          <Leaderboard entries={leaderboard} dailyActivity={dailyActivity} memberRecords={memberRecords} />
        </motion.div>
      )}

      {profile && (
        <button
          type="button"
          onClick={signOut}
          className="mt-6 text-xs font-medium text-surface-500 transition-colors hover:text-surface-300"
        >
          Sign out
        </button>
      )}
    </div>
  )
}
