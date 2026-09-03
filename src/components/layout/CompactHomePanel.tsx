import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useFlaggedCount } from '../../hooks/useFlaggedCount'
import { useFlaggedSuggestions } from '../../hooks/useFlaggedSuggestions'
import {
  useTransactions,
  type DailyActivity,
  type HomeLeaderboardEntry,
  type MemberDailyRecord,
} from '../../hooks/useTransactions'
import { ui } from '../../lib/uiClasses'
import { xpProgress } from '../../lib/xpLevels'
import Skeleton from '../common/Skeleton'
import Leaderboard from '../reveal/Leaderboard'

type AccordionKey = 'activity' | 'leaderboard' | 'invite' | null

function CompactSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/[0.06] bg-surface-800/40 p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-5 w-40" />
        <Skeleton className="mt-1 h-3 w-28" />
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-surface-950/40 px-3 py-2.5">
        <div className="flex gap-2.5">
          <div className="h-9 w-9 animate-pulse rounded-full bg-surface-700/50" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-1 h-1 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

interface ActivityLine {
  userId: string
  displayName: string
  summary: string
}

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
    lines.push({ userId: row.user_id, displayName: row.display_name, summary: parts.join(' · ') })
  }
  return lines
}

function AccordionToggle({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-surface-500 transition-colors hover:bg-surface-800/40 hover:text-surface-300"
    >
      {label}
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-transform ${open ? 'rotate-180' : ''}`}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
}

export default function CompactHomePanel() {
  const { profile } = useAuth()
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
  const { suggestionCount: noIdeaSuggestionCount } = useFlaggedSuggestions(profile?.household_id)

  const [householdInfo, setHouseholdInfo] = useState<{ name: string; invite_code: string } | null>(null)
  const [leaderboard, setLeaderboard] = useState<HomeLeaderboardEntry[]>([])
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([])
  const [memberRecords, setMemberRecords] = useState<MemberDailyRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [expanded, setExpanded] = useState<AccordionKey>(null)

  useEffect(() => {
    if (!profile?.household_id) return
    let cancelled = false
    void Promise.all([
      getHouseholdInfo(),
      getLeaderboard(),
      getDailyActivity(),
      getMemberDailyRecords(),
    ]).then(([info, lb, activity, records]) => {
      if (cancelled) return
      if (info) setHouseholdInfo(info)
      setLeaderboard(lb)
      setDailyActivity(activity)
      setMemberRecords(records)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [profile?.household_id, getHouseholdInfo, getLeaderboard, getDailyActivity, getMemberDailyRecords])

  const toggle = (key: AccordionKey) => setExpanded(prev => (prev === key ? null : key))

  const xp = profile
    ? xpProgress(profile.total_xp)
    : { level: 1, progress: 0, toNext: 80, title: 'Receipt Rookie', nextTitle: 'Envelope Explorer' as string | null }

  const teamXp = useMemo(() => leaderboard.reduce((sum, e) => sum + e.total_xp, 0), [leaderboard])
  const memberCount = Math.max(leaderboard.length, profile ? 1 : 0)
  const activityLines = useMemo(() => buildActivityLines(dailyActivity), [dailyActivity])

  const copyInviteCode = async () => {
    if (!householdInfo) return
    await navigator.clipboard.writeText(householdInfo.invite_code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  if (!profile) return null

  return (
    <div className="flex h-full flex-col px-4 pb-4 pt-5" data-testid="compact-home-panel">
      {/* --- Top: original compact content --- */}
      <div className="flex-1">
        {!loaded && !householdInfo && <CompactSkeleton />}

        {householdInfo && (
          <motion.section
            className={`overflow-hidden ${ui.glass}`}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 22 }}
          >
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">Household</p>
              <h2 className="mt-1 truncate text-lg font-extrabold tracking-tight text-surface-50">
                {householdInfo.name}
              </h2>
              <p className="mt-0.5 text-xs text-surface-400">
                {memberCount} member{memberCount === 1 ? '' : 's'}
                {teamXp > 0 && (
                  <>
                    <span className="text-surface-600"> · </span>
                    <span className="tabular-nums text-gem">{teamXp.toLocaleString()} team XP</span>
                  </>
                )}
              </p>

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
            </div>
          </motion.section>
        )}

        <section className="mt-4 space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">Needs attention</h2>
          <Link
            to="/classify"
            className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-900/55 ${ui.glassInset}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-surface-100">Classify queue</p>
              <p className="text-[11px] text-surface-500">
                {classifyQueueCount > 0
                  ? `${classifyQueueCount} transaction${classifyQueueCount === 1 ? '' : 's'} waiting`
                  : 'Queue is clear'}
              </p>
            </div>
            {classifyQueueCount > 0 && (
              <span className="shrink-0 rounded-full bg-duo-green px-2 py-0.5 text-[10px] font-bold tabular-nums text-white">
                {classifyQueueCount}
              </span>
            )}
            <span className="shrink-0 text-surface-500" aria-hidden>›</span>
          </Link>
          {noIdeaCount > 0 && (
            <Link
              to="/classify/no-idea"
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-900/55 ${ui.glassInset}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-surface-100">No idea queue</p>
                <p className="text-[11px] text-surface-500">
                  {noIdeaSuggestionCount > 0
                    ? `${noIdeaSuggestionCount} may now be resolvable`
                    : 'Flagged for partner review'}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums text-white ${noIdeaSuggestionCount > 0 ? 'bg-duo-green' : 'bg-flame'}`}>
                {noIdeaCount}
              </span>
              <span className="shrink-0 text-surface-500" aria-hidden>›</span>
            </Link>
          )}
          <Link
            to="/reveal"
            className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-900/55 ${ui.glassInset}`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-surface-100">Reveal</p>
              <p className="text-[11px] text-surface-500">Check monthly progress and reveal totals</p>
            </div>
            <span className="shrink-0 text-surface-500" aria-hidden>›</span>
          </Link>
        </section>
      </div>

      {/* --- Bottom: accordion sections --- */}
      <div className="mt-auto shrink-0 pt-2" data-testid="accordion-sections">
        {activityLines.length > 0 && (
          <div>
            <AccordionToggle label="Activity today" open={expanded === 'activity'} onToggle={() => toggle('activity')} />
            <div className={`grid transition-[grid-template-rows] duration-200 ease-[var(--ease-out)] ${expanded === 'activity' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <div className={`mx-1 mb-2 space-y-2 p-3 ${ui.glassFlat}`}>
                  {activityLines.map((line) => (
                    <div key={line.userId} className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gem/15 text-[10px] font-bold text-gem ring-2 ring-surface-900">
                        {line.displayName.charAt(0).toUpperCase()}
                      </div>
                      <p className="min-w-0 text-xs text-surface-300">
                        <span className="font-semibold text-surface-100">{line.displayName}</span>{' '}
                        {line.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {leaderboard.length > 1 && (
          <div>
            <AccordionToggle label="Leaderboard" open={expanded === 'leaderboard'} onToggle={() => toggle('leaderboard')} />
            <div className={`grid transition-[grid-template-rows] duration-200 ease-[var(--ease-out)] ${expanded === 'leaderboard' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <div className="mx-1 mb-2">
                  <Leaderboard entries={leaderboard} dailyActivity={dailyActivity} hideTitle memberRecords={memberRecords} />
                </div>
              </div>
            </div>
          </div>
        )}

        {householdInfo && (
          <div>
            <AccordionToggle label="Invite code" open={expanded === 'invite'} onToggle={() => toggle('invite')} />
            <div className={`grid transition-[grid-template-rows] duration-200 ease-[var(--ease-out)] ${expanded === 'invite' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <button
                  type="button"
                  onClick={copyInviteCode}
                  className="mx-1 mb-2 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-xl border border-white/[0.06] bg-surface-950/50 px-3 py-2 text-left transition hover:bg-surface-900/60"
                >
                  <p className="flex-1 font-mono text-xs font-bold tracking-[0.2em] text-surface-200">
                    {householdInfo.invite_code}
                  </p>
                  <span className="shrink-0 text-[11px] font-semibold text-duo-green">
                    {codeCopied ? 'Copied!' : 'Copy'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
