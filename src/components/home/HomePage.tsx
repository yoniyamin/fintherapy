import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useTransactions, type DailyActivity, type HomeLeaderboardEntry } from '../../hooks/useTransactions'
import { XP_VALUES } from '../../lib/constants'
import Leaderboard from '../reveal/Leaderboard'

const XP_PER_LEVEL_SEGMENT = 300

const LEVEL_TITLES = [
  'Novice Budgeter',
  'Receipt Hoarder',
  'Penny Pincher',
  'Expense Tamer',
  'Budget Ninja',
  'Spreadsheet Sorcerer',
  'Fiscal Wizard',
  'Money Whisperer',
  'Finance Overlord',
  'Legendary Accountant',
]

function xpProgress(totalXp: number) {
  const inSegment = totalXp % XP_PER_LEVEL_SEGMENT
  const progress = inSegment / XP_PER_LEVEL_SEGMENT
  const level = Math.floor(totalXp / XP_PER_LEVEL_SEGMENT) + 1
  const toNext = inSegment === 0 && totalXp > 0 ? XP_PER_LEVEL_SEGMENT : XP_PER_LEVEL_SEGMENT - inSegment
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]
  return { level, progress, toNext, title }
}

const actionGlow = {
  upload:
    'border-cyan-500/15 bg-surface-950/45 shadow-[0_18px_44px_-14px_rgba(28,176,246,0.45)] hover:shadow-[0_22px_50px_-12px_rgba(28,176,246,0.55)]',
  classify:
    'border-emerald-500/15 bg-surface-950/45 shadow-[0_18px_44px_-14px_rgba(88,204,2,0.35)] hover:shadow-[0_22px_50px_-12px_rgba(88,204,2,0.45)]',
  reveal:
    'border-violet-500/15 bg-surface-950/45 shadow-[0_18px_44px_-14px_rgba(165,96,232,0.4)] hover:shadow-[0_22px_50px_-12px_rgba(165,96,232,0.5)]',
  bets:
    'border-amber-500/15 bg-surface-950/45 shadow-[0_18px_44px_-14px_rgba(255,150,0,0.35)] hover:shadow-[0_22px_50px_-12px_rgba(255,150,0,0.48)]',
} as const

export default function HomePage() {
  const { profile, signOut, loading } = useAuth()
  const { transactions: pending, getDailyActivity, getHouseholdInfo, getLeaderboard } =
    useTransactions(profile?.household_id)
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([])
  const [leaderboard, setLeaderboard] = useState<HomeLeaderboardEntry[]>([])
  const [householdInfo, setHouseholdInfo] = useState<{ name: string; invite_code: string } | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)

  const loadExtras = useCallback(async () => {
    const [activity, info, lb] = await Promise.all([
      getDailyActivity(),
      getHouseholdInfo(),
      getLeaderboard(),
    ])
    setDailyActivity(activity)
    if (info) setHouseholdInfo(info)
    setLeaderboard(lb)
  }, [getDailyActivity, getHouseholdInfo, getLeaderboard])

  useEffect(() => {
    if (profile?.household_id) loadExtras()
  }, [profile?.household_id, loadExtras])

  const copyInviteCode = async () => {
    if (!householdInfo) return
    await navigator.clipboard.writeText(householdInfo.invite_code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="relative flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-duo-green border-t-transparent" />
      </div>
    )
  }

  const myToday = dailyActivity.find(d => d.user_id === profile?.id)
  const classifiedToday = myToday ? Number(myToday.classified_today) : 0
  const xp = profile ? xpProgress(profile.total_xp) : { level: 1, progress: 0, toNext: XP_PER_LEVEL_SEGMENT, title: LEVEL_TITLES[0] }

  return (
    <div className="relative z-10 mx-auto flex max-w-lg flex-col px-4 pb-4 pt-5">
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 22 }}
      >
        <h1 className="bg-gradient-to-r from-surface-100 via-ice to-gem-light bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
          Financial Therapy
        </h1>
        <p className="mt-0.5 text-xs text-surface-400">Turn expense chaos into a game</p>
      </motion.div>

      {profile && (
        <motion.section
          className="mt-4 overflow-hidden rounded-[22px] border border-white/[0.09] bg-gradient-to-br from-white/[0.09] via-white/[0.03] to-transparent shadow-[0_28px_60px_-28px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.06 }}
        >
          <div className="relative p-4">
            <div
              className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-teal-500/10 blur-3xl"
              aria-hidden
            />
            <div className="flex gap-3">
              <div className="relative shrink-0">
                <div
                  className="rounded-full p-[3px]"
                  style={{
                    background: `conic-gradient(from -90deg, #1CB0F6 0deg, #58CC02 ${xp.progress * 360}deg, rgba(255,255,255,0.1) ${xp.progress * 360}deg)`,
                  }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-900/95 text-sm font-bold text-gem shadow-inner">
                    {profile.display_name.charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-bold text-surface-50">{profile.display_name}</p>
                  <p className="text-base font-extrabold tabular-nums text-gem">{profile.total_xp}</p>
                </div>
                {householdInfo && (
                  <p className="truncate text-[11px] text-surface-400">{householdInfo.name}</p>
                )}
                <p className="mt-1.5 text-[10px] font-medium text-surface-500">
                  Level {xp.level}
                  <span className="text-surface-600"> · </span>
                  <span className="text-teal-400">{xp.title}</span>
                  <span className="text-surface-600"> · </span>
                  <span className="text-surface-500">{xp.toNext} to next</span>
                </p>
                <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-surface-800/90 ring-1 ring-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500/90 via-emerald-400/95 to-duo-green"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(4, xp.progress * 100)}%` }}
                    transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            </div>
          </div>

          {householdInfo && (
            <div className="border-t border-white/[0.06] bg-black/15 px-4 py-2.5 backdrop-blur-sm">
              <button
                type="button"
                onClick={copyInviteCode}
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-surface-950/50 px-3 py-2 text-left transition hover:bg-surface-900/60"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                  Invite code
                </p>
                <p className="flex-1 text-right font-mono text-xs font-bold tracking-[0.2em] text-surface-200">
                  {householdInfo.invite_code}
                </p>
                <span className="shrink-0 text-[11px] font-semibold text-duo-green">
                  {codeCopied ? 'Copied!' : 'Copy'}
                </span>
              </button>
            </div>
          )}
        </motion.section>
      )}

      <motion.div
        className="mt-4 rounded-[22px] border border-white/[0.07] bg-white/[0.03] p-1.5 backdrop-blur-xl"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.12 }}
      >
        <div className="grid grid-cols-4 gap-1.5">
          <Link to="/upload" className="block">
            <motion.div
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 transition-all active:scale-[0.98] ${actionGlow.upload}`}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-xl drop-shadow-[0_4px_12px_rgba(28,176,246,0.35)]">📄</span>
              <p className="text-center text-[11px] font-semibold text-surface-100">Upload</p>
            </motion.div>
          </Link>

          <Link to="/classify" className="relative block">
            <motion.div
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 transition-all active:scale-[0.98] ${actionGlow.classify}`}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-xl drop-shadow-[0_4px_12px_rgba(88,204,2,0.3)]">🃏</span>
              <p className="text-center text-[11px] font-semibold text-surface-100">Classify</p>
            </motion.div>
            {pending.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-duo-green px-1 text-[9px] font-bold text-white shadow-[0_4px_12px_rgba(88,204,2,0.45)]">
                {pending.length}
              </span>
            )}
          </Link>

          <Link to="/reveal" className="block">
            <motion.div
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 transition-all active:scale-[0.98] ${actionGlow.reveal}`}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-xl drop-shadow-[0_4px_12px_rgba(165,96,232,0.35)]">📊</span>
              <p className="text-center text-[11px] font-semibold text-surface-100">Reveal</p>
            </motion.div>
          </Link>

          <Link to="/bets" className="block">
            <motion.div
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 transition-all active:scale-[0.98] ${actionGlow.bets}`}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-xl drop-shadow-[0_4px_12px_rgba(255,150,0,0.32)]">🎰</span>
              <p className="text-center text-[11px] font-semibold text-surface-100">Bets</p>
            </motion.div>
          </Link>
        </div>
      </motion.div>

      {profile && (
        <motion.div
          className="mt-3 flex divide-x divide-white/[0.07] overflow-hidden rounded-[18px] border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] py-3 backdrop-blur-xl"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18 }}
        >
          <div className="flex min-w-0 flex-1 flex-col items-center px-1.5 text-center">
            <p className="text-lg font-extrabold tabular-nums text-ice">{pending.length}</p>
            <p className="mt-0.5 text-[9px] font-medium leading-tight text-surface-500">
              To classify
            </p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center px-1.5 text-center">
            <p className="text-lg font-extrabold tabular-nums text-duo-green">{classifiedToday}</p>
            <p className="mt-0.5 text-[9px] font-medium leading-tight text-surface-500">
              Today
            </p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center px-1.5 text-center">
            <p className="text-lg font-extrabold tabular-nums text-gem">{profile.total_xp}</p>
            <p className="mt-0.5 text-[9px] font-medium leading-tight text-surface-500">
              Total XP
            </p>
          </div>
        </motion.div>
      )}

      {dailyActivity.length > 0 && (
        <motion.div
          className="mt-3"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.22 }}
        >
          <h3 className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
            Today&apos;s activity
          </h3>
          <div className="space-y-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md">
            {dailyActivity.map((d, i) => {
              const estXp = Number(d.classified_today) * XP_VALUES.CLASSIFY_MANUAL
              return (
                <div
                  key={d.user_id}
                  className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2 last:border-b-0"
                >
                  <span className="text-xs">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-surface-200">
                      {d.display_name}
                    </span>
                    <div className="flex flex-wrap gap-x-2.5 text-[9px] text-surface-400">
                      {Number(d.classified_today) > 0 && (
                        <span>🏷️ {d.classified_today} classified</span>
                      )}
                      {Number(d.uploads_today) > 0 && (
                        <span>📄 {d.uploads_today} loaded</span>
                      )}
                      {Number(d.bets_placed_today) > 0 && (
                        <span>🎰 Bets placed</span>
                      )}
                    </div>
                  </div>
                  {estXp > 0 && (
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-duo-green">
                      +{estXp}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {leaderboard.length > 1 && (
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.26 }}
        >
          <Leaderboard entries={leaderboard} />
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
