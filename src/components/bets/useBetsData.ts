import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useBets } from '../../hooks/useBets'
import { useReveal } from '../../hooks/useReveal'
import { useTransactions, type MonthStats } from '../../hooks/useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import { getCurrentMonth, getMonthOptions, pickBetCategories, fireConfetti } from './betsHelpers'

/**
 * Shared data-fetching and state for Bets.
 * Used by both BetsPage (mobile) and BetsDesktopPage.
 */
export function useBetsData() {
  const { profile, user } = useAuth()
  const {
    myBets, householdBets, householdBetStatus,
    loading, fetchMyBets, fetchHouseholdBets, fetchHouseholdBetStatus, submitBets,
  } = useBets(profile?.household_id)
  const { summary, fetchSummary } = useReveal(profile?.household_id)
  const { getMonthStats } = useTransactions(profile?.household_id)
  const { categories: CATEGORIES } = useCategoryConfig(profile?.household_id)
  const [month, setMonth] = useState(getCurrentMonth())
  const [userTab, setUserTab] = useState<'predict' | 'results'>('predict')
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null)
  const [statsLoadedMonth, setStatsLoadedMonth] = useState<string | null>(null)
  const monthOptions = getMonthOptions()

  const bettableCategories = CATEGORIES.filter((c) => c.id !== OWN_TRANSFERS_CATEGORY_ID)
  const allClassified = monthStats !== null && monthStats.total_count > 0 && monthStats.pending_count === 0
  const statsLoading = statsLoadedMonth !== month
  const tab = allClassified ? 'results' : userTab
  const isMultiMember = householdBetStatus.length > 1

  const persistedAmounts = useMemo(() => {
    const existing: Record<string, string> = {}
    myBets.forEach((b) => {
      existing[b.category] = String(b.predicted_amount)
    })
    return existing
  }, [myBets])

  const amounts = useMemo(
    () => ({ ...persistedAmounts, ...draftAmounts }),
    [persistedAmounts, draftAmounts],
  )

  const selectedCategories = useMemo(() => {
    if (!profile?.household_id || bettableCategories.length === 0) return []
    return pickBetCategories(bettableCategories, profile.household_id, month)
  }, [profile, bettableCategories, month])

  const handleMonthChange = (value: string) => {
    setMonth(value)
    setDraftAmounts({})
    setStatsLoadedMonth(null)
  }

  useEffect(() => {
    let cancelled = false
    fetchMyBets(month)
    fetchSummary(month)
    fetchHouseholdBetStatus(month)
    void getMonthStats(month).then((stats) => {
      if (cancelled) return
      setMonthStats(stats)
      setStatsLoadedMonth(month)
    })
    return () => {
      cancelled = true
    }
  }, [month, fetchMyBets, fetchSummary, fetchHouseholdBetStatus, getMonthStats])

  useEffect(() => {
    if (allClassified) {
      fetchHouseholdBets(month)
    }
  }, [allClassified, fetchHouseholdBets, month])

  const handleSubmit = async () => {
    setSubmitting(true)
    setSuccess(false)
    setSubmitError(null)
    const bets = selectedCategories
      .filter((cat) => amounts[cat.id] && Number(amounts[cat.id]) > 0)
      .map((cat) => ({
        category: cat.id,
        predicted_amount: Number(amounts[cat.id]),
      }))

    const { error } = await submitBets(month, bets)
    setSubmitting(false)
    if (error) {
      setSubmitError(error.message ?? 'Failed to place bets')
      return
    }
    fetchHouseholdBetStatus(month)
    setSuccess(true)
    fireConfetti()
    setTimeout(() => setSuccess(false), 3000)
  }

  const hasBets = myBets.length > 0
  const actualLookup = Object.fromEntries(summary.map((s) => [s.category, Number(s.total_amount)]))

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

  return {
    profile,
    user,
    month,
    handleMonthChange,
    monthOptions,
    loading,
    statsLoading,
    allClassified,
    tab,
    setUserTab,
    isMultiMember,
    householdBetStatus,
    selectedCategories,
    amounts,
    setDraftAmounts,
    submitting,
    success,
    submitError,
    hasBets,
    handleSubmit,
    actualLookup,
    householdBetsByUser,
    betUserIds,
    categoryWinners,
    overallWinner,
    isCurrentUser,
    monthStats,
  }
}
