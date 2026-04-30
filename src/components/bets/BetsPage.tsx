import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useAuth } from '../../hooks/useAuth'
import { useBets } from '../../hooks/useBets'
import { useReveal } from '../../hooks/useReveal'
import { useTransactions, type MonthStats } from '../../hooks/useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID, type CategoryDef } from '../../lib/constants'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import Button from '../common/Button'
import { ui } from '../../lib/uiClasses'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    options.push({ value, label: formatMonthLabel(value) })
  }
  return options
}

/**
 * Deterministic pseudo-random shuffle seeded by a string.
 * All household members get the same result for the same seed.
 */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  const next = () => {
    h = (h * 1664525 + 1013904223) | 0
    return (h >>> 0) / 4294967296
  }
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const BET_CATEGORY_COUNT = 4

function pickBetCategories(
  categories: CategoryDef[],
  householdId: string,
  month: string,
): CategoryDef[] {
  const seed = `${householdId}:${month}`
  const shuffled = seededShuffle(categories, seed)
  return shuffled.slice(0, BET_CATEGORY_COUNT)
}

function fireConfetti() {
  const duration = 1500
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff'],
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff'],
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }

  confetti({
    particleCount: 80,
    spread: 100,
    origin: { y: 0.6 },
    colors: ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff'],
  })
  frame()
}

type Tab = 'predict' | 'results'

export default function BetsPage() {
  const { profile, user } = useAuth()
  const {
    myBets, householdBets, householdBetStatus,
    loading, fetchMyBets, fetchHouseholdBets, fetchHouseholdBetStatus, submitBets,
  } = useBets(profile?.household_id)
  const { summary, fetchSummary } = useReveal(profile?.household_id)
  const { getMonthStats } = useTransactions(profile?.household_id)
  const { categories: CATEGORIES } = useCategoryConfig(profile?.household_id)
  const [month, setMonth] = useState(getCurrentMonth())
  const [tab, setTab] = useState<Tab>('predict')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const monthOptions = getMonthOptions()

  const bettableCategories = CATEGORIES.filter((c) => c.id !== OWN_TRANSFERS_CATEGORY_ID)
  const allClassified = monthStats !== null && monthStats.total_count > 0 && monthStats.pending_count === 0
  const isMultiMember = householdBetStatus.length > 1

  const selectedCategories = useMemo(() => {
    if (!profile?.household_id || bettableCategories.length === 0) return []
    return pickBetCategories(bettableCategories, profile.household_id, month)
  }, [profile?.household_id, bettableCategories, month])

  const selectedCategoryIds = useMemo(
    () => new Set(selectedCategories.map((c) => c.id)),
    [selectedCategories],
  )

  const loadMonthStats = useCallback(async (m: string) => {
    setStatsLoading(true)
    const stats = await getMonthStats(m)
    setMonthStats(stats)
    setStatsLoading(false)
  }, [getMonthStats])

  useEffect(() => {
    fetchMyBets(month)
    fetchSummary(month)
    fetchHouseholdBetStatus(month)
    loadMonthStats(month)
  }, [month, fetchMyBets, fetchSummary, fetchHouseholdBetStatus, loadMonthStats])

  useEffect(() => {
    if (allClassified) {
      setTab('results')
      fetchHouseholdBets(month)
    }
  }, [allClassified, fetchHouseholdBets, month])

  useEffect(() => {
    if (myBets.length > 0) {
      const existing: Record<string, string> = {}
      myBets.forEach((b) => {
        existing[b.category] = String(b.predicted_amount)
      })
      setAmounts(existing)
    }
  }, [myBets])

  const handleSubmit = async () => {
    setSubmitting(true)
    setSuccess(false)
    const bets = selectedCategories
      .filter((cat) => amounts[cat.id] && Number(amounts[cat.id]) > 0)
      .map((cat) => ({
        category: cat.id,
        predicted_amount: Number(amounts[cat.id]),
      }))

    await submitBets(month, bets)
    fetchHouseholdBetStatus(month)
    setSubmitting(false)
    setSuccess(true)
    fireConfetti()
    setTimeout(() => setSuccess(false), 3000)
  }

  const hasBets = myBets.length > 0
  const actualLookup = Object.fromEntries(summary.map((s) => [s.category, Number(s.total_amount)]))

  // Build per-user bet lookups for the results view
  const householdBetsByUser = useMemo(() => {
    const map = new Map<string, { displayName: string; bets: Map<string, number> }>()
    for (const hb of householdBets) {
      if (!map.has(hb.user_id)) {
        map.set(hb.user_id, { displayName: hb.display_name, bets: new Map() })
      }
      map.get(hb.user_id)!.bets.set(hb.category, hb.predicted_amount)
    }
    return map
  }, [householdBets])

  const betUserIds = useMemo(() => [...householdBetsByUser.keys()], [householdBetsByUser])

  const categoryWinners = useMemo(() => {
    if (!allClassified || betUserIds.length < 2) return new Map<string, string>()
    const winners = new Map<string, string>()
    for (const cat of selectedCategories) {
      const actual = actualLookup[cat.id] ?? 0
      if (actual === 0) continue
      let bestUserId = ''
      let bestDiff = Infinity
      for (const uid of betUserIds) {
        const predicted = householdBetsByUser.get(uid)?.bets.get(cat.id)
        if (predicted == null) continue
        const diff = Math.abs(actual - predicted)
        if (diff < bestDiff) {
          bestDiff = diff
          bestUserId = uid
        }
      }
      if (bestUserId) winners.set(cat.id, bestUserId)
    }
    return winners
  }, [allClassified, betUserIds, selectedCategories, actualLookup, householdBetsByUser])

  const overallWinner = useMemo(() => {
    if (categoryWinners.size === 0) return null
    const counts = new Map<string, number>()
    for (const uid of categoryWinners.values()) {
      counts.set(uid, (counts.get(uid) ?? 0) + 1)
    }
    let bestUid = ''
    let bestCount = 0
    for (const [uid, count] of counts) {
      if (count > bestCount) {
        bestCount = count
        bestUid = uid
      }
    }
    return bestUid ? { userId: bestUid, displayName: householdBetsByUser.get(bestUid)?.displayName ?? '', wins: bestCount } : null
  }, [categoryWinners, householdBetsByUser])

  const isCurrentUser = (uid: string) => uid === user?.id

  return (
    <div className={`${ui.screen} ${ui.pageNoBottomPad}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className={ui.heroTitle}>Bets</h1>
        <p className={ui.heroSub}>
          Predict spending per category before classifying
        </p>
      </motion.div>

      {/* Month selector */}
      <div className="mt-6">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={`w-full ${ui.select}`}
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Household bet status — who has placed bets (before reveal) */}
      {isMultiMember && !allClassified && !loading && !statsLoading && (
        <motion.div
          className={`${ui.glassFlat} mt-4 px-4 py-3`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-xs font-semibold text-surface-400 mb-2">Household bets</p>
          <div className="space-y-2">
            {householdBetStatus.map((member) => (
              <div key={member.user_id} className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-800 text-xs font-bold text-surface-300">
                  {member.display_name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-sm text-surface-200">
                  {member.display_name}
                  {member.is_current_user && (
                    <span className="ml-1.5 text-[10px] text-surface-500">(you)</span>
                  )}
                </span>
                {member.category_count > 0 ? (
                  <span className="flex items-center gap-1 rounded-full bg-duo-green/10 px-2.5 py-1 text-xs font-semibold text-duo-green">
                    <span>🎲</span>
                    {member.is_current_user
                      ? `${member.category_count} bet${member.category_count === 1 ? '' : 's'}`
                      : 'Bets placed'
                    }
                  </span>
                ) : (
                  <span className="rounded-full bg-surface-800/60 px-2.5 py-1 text-xs text-surface-500">
                    No bets yet
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* All-classified banner */}
      <AnimatePresence>
        {!statsLoading && allClassified && (
          <motion.div
            className="mt-4 rounded-2xl border border-duo-green/25 bg-duo-green/10 px-4 py-4 text-center"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-lg">🎉</p>
            <p className="mt-1 text-sm font-semibold text-duo-green">
              All transactions classified!
            </p>
            <p className="mt-0.5 text-xs text-surface-400">
              Bets are locked for {formatMonthLabel(month)}. Check your results below.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className={`${ui.tabShell} mt-4`}>
        {(['predict', 'results'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => !allClassified || t === 'results' ? setTab(t) : undefined}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition-all ${
              tab === t ? ui.tabActive : ui.tabIdle
            } ${allClassified && t === 'predict' ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {t === 'predict' ? (allClassified ? '🔒 Place Bets' : 'Place Bets') : 'Results'}
          </button>
        ))}
      </div>

      {loading || statsLoading ? (
        <div className="mt-12 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-duo-green border-t-transparent" />
        </div>
      ) : tab === 'predict' && !allClassified ? (
        /* Bet amounts for the 4 randomly chosen categories */
        <div className="mt-6 space-y-2">
          <motion.div
            className={`${ui.glassFlat} px-3.5 py-3`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-xs text-surface-400">
              <span className="font-semibold text-ice">{BET_CATEGORY_COUNT} categories</span> randomly
              selected for {formatMonthLabel(month)} — same for all household members
            </p>
          </motion.div>

          {selectedCategories.map((cat, i) => (
            <motion.div
              key={cat.id}
              className={`flex items-center gap-3 px-3.5 py-3 ${ui.glassFlat}`}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.04 }}
            >
              <span className="text-xl">{cat.icon}</span>
              <span className="flex-1 text-sm font-medium text-surface-200">{cat.label}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-surface-500">€</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={amounts[cat.id] ?? ''}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                  className={`w-20 px-2.5 py-1.5 text-right text-sm tabular-nums ${ui.input}`}
                  placeholder="0"
                />
              </div>
            </motion.div>
          ))}

          <AnimatePresence>
            {success && (
              <motion.div
                className="rounded-xl border border-duo-green/20 bg-duo-green/10 p-3 text-center text-sm font-semibold text-duo-green shadow-[0_12px_28px_-12px_rgba(88,204,2,0.25)]"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                🎲 Bets placed!
              </motion.div>
            )}
          </AnimatePresence>

          <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : hasBets ? 'Update Bets' : 'Place Bets'}
          </Button>
        </div>
      ) : (
        /* Results tab */
        <div className="mt-6 space-y-3">
          {/* Overall winner banner (multi-member only) */}
          <AnimatePresence>
            {allClassified && isMultiMember && overallWinner && betUserIds.length > 1 && (
              <motion.div
                className="rounded-2xl border border-gem/25 bg-gradient-to-br from-gem/15 via-gem/5 to-transparent px-4 py-4 text-center"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 100 }}
              >
                <p className="text-2xl">🏆</p>
                <p className="mt-1 text-base font-bold text-gem-light">
                  {isCurrentUser(overallWinner.userId) ? 'You win!' : `${overallWinner.displayName} wins!`}
                </p>
                <p className="mt-0.5 text-xs text-surface-400">
                  Closest prediction in {overallWinner.wins} categor{overallWinner.wins === 1 ? 'y' : 'ies'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {selectedCategories.map((cat, i) => {
            const actual = actualLookup[cat.id] ?? 0
            const winnerId = categoryWinners.get(cat.id)
            const showMultiMember = allClassified && isMultiMember && betUserIds.length > 1

            return (
              <motion.div
                key={cat.id}
                className={`p-3.5 ${ui.glassFlat}`}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.02 }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{cat.icon}</span>
                  <span className="flex-1 text-sm font-medium text-surface-200">{cat.label}</span>
                  {showMultiMember && winnerId && (
                    <span className="text-[10px] font-semibold text-gem">
                      {isCurrentUser(winnerId) ? '🏆 You' : `🏆 ${householdBetsByUser.get(winnerId)?.displayName}`}
                    </span>
                  )}
                </div>

                {showMultiMember ? (
                  <MultiMemberResult
                    betUserIds={betUserIds}
                    householdBetsByUser={householdBetsByUser}
                    categoryId={cat.id}
                    actual={actual}
                    winnerId={winnerId}
                    isCurrentUser={isCurrentUser}
                  />
                ) : (
                  <SingleUserResult
                    predicted={Number(amounts[cat.id] ?? 0)}
                    actual={actual}
                  />
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SingleUserResult({ predicted, actual }: { predicted: number; actual: number }) {
  const diff = actual - predicted
  const hasPrediction = predicted > 0
  return (
    <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
      <div>
        <p className="text-[10px] text-surface-500">Predicted</p>
        <p className="mt-0.5 text-sm font-bold tabular-nums text-gem">
          {hasPrediction ? `€${predicted.toFixed(0)}` : '—'}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-surface-500">Actual</p>
        <p className="mt-0.5 text-sm font-bold tabular-nums text-ice">
          {actual > 0 ? `€${actual.toFixed(0)}` : '—'}
        </p>
      </div>
      <div>
        <p className="text-[10px] text-surface-500">Diff</p>
        <p className={`mt-0.5 text-sm font-bold tabular-nums ${
          !hasPrediction || actual === 0 ? 'text-surface-500'
            : Math.abs(diff) < predicted * 0.1 ? 'text-duo-green'
            : diff > 0 ? 'text-danger' : 'text-flame'
        }`}>
          {hasPrediction && actual > 0
            ? `${diff > 0 ? '+' : ''}€${diff.toFixed(0)}`
            : '—'}
        </p>
      </div>
    </div>
  )
}

function MultiMemberResult({
  betUserIds,
  householdBetsByUser,
  categoryId,
  actual,
  winnerId,
  isCurrentUser,
}: {
  betUserIds: string[]
  householdBetsByUser: Map<string, { displayName: string; bets: Map<string, number> }>
  categoryId: string
  actual: number
  winnerId: string | undefined
  isCurrentUser: (uid: string) => boolean
}) {
  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex items-center justify-between rounded-lg bg-surface-900/50 px-2.5 py-1.5">
        <span className="text-[11px] font-semibold text-surface-400">Actual</span>
        <span className="text-sm font-bold tabular-nums text-ice">
          {actual > 0 ? `€${actual.toFixed(0)}` : '—'}
        </span>
      </div>

      {betUserIds.map((uid) => {
        const userData = householdBetsByUser.get(uid)
        if (!userData) return null
        const predicted = userData.bets.get(categoryId)
        const hasPrediction = predicted != null && predicted > 0
        const diff = hasPrediction && actual > 0 ? actual - predicted : null
        const isWinner = winnerId === uid

        return (
          <div
            key={uid}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
              isWinner ? 'bg-duo-green/8 ring-1 ring-duo-green/20' : 'bg-white/[0.02]'
            }`}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-800 text-[10px] font-bold text-surface-300">
              {userData.displayName.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 text-[11px] text-surface-300">
              {userData.displayName}
              {isCurrentUser(uid) && (
                <span className="ml-1 text-[9px] text-surface-500">(you)</span>
              )}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${hasPrediction ? 'text-gem' : 'text-surface-600'}`}>
              {hasPrediction ? `€${predicted.toFixed(0)}` : '—'}
            </span>
            {diff !== null && (
              <span className={`min-w-[3.5rem] text-right text-[11px] font-semibold tabular-nums ${
                Math.abs(diff) < predicted * 0.1 ? 'text-duo-green'
                  : diff > 0 ? 'text-danger' : 'text-flame'
              }`}>
                {diff > 0 ? '+' : ''}€{diff.toFixed(0)}
              </span>
            )}
            {isWinner && <span className="text-xs">🏆</span>}
          </div>
        )
      })}
    </div>
  )
}
