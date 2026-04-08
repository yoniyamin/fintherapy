import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useClassificationStore } from '../../stores/classificationStore'
import { useTransactions, type MonthStats } from '../../hooks/useTransactions'
import { useMerchantKnowledge } from '../../hooks/useMerchantKnowledge'
import { usePresence } from '../../hooks/usePresence'
import { useAuth } from '../../hooks/useAuth'
import SwipeCard from './SwipeCard'
import CategoryPicker from './CategoryPicker'
import ProgressBar from '../common/ProgressBar'
import Confetti from '../common/Confetti'
import { Link } from 'react-router-dom'
import { XP_VALUES } from '../../lib/constants'
import { ui } from '../../lib/uiClasses'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function XpFloat({ id, amount }: { id: number; amount: number }) {
  return (
    <motion.div
      key={id}
      className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 text-lg font-bold text-duo-green"
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -80, scale: 1.4 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      +{amount} XP
    </motion.div>
  )
}

function GroupClassifiedToast({ id, count }: { id: number; count: number }) {
  if (count <= 1) return null
  return (
    <motion.div
      key={id}
      className="pointer-events-none absolute left-1/2 top-1/3 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gem/90 px-3 py-1.5 text-xs font-bold text-white"
      initial={{ opacity: 1, y: 0, scale: 0.8 }}
      animate={{ opacity: 0, y: -60, scale: 1.1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
    >
      {count} transactions classified!
    </motion.div>
  )
}

export default function SwipeDeck() {
  const { profile, user, refreshProfile } = useAuth()
  const {
    transactions: fetched, loading,
    classifyTransaction, flagTransaction, markTransfer,
    detectRefunds, awardXp, getMonthStats,
  } = useTransactions(profile?.household_id)
  const { learnMerchant } = useMerchantKnowledge(profile?.household_id)
  const { onlineUsers } = usePresence(profile?.household_id, user?.id, profile?.display_name)
  const store = useClassificationStore()
  const hasLoaded = useRef(false)
  const [xpFloats, setXpFloats] = useState<{ id: number; amount: number }[]>([])
  const [groupToasts, setGroupToasts] = useState<{ id: number; count: number }[]>([])
  const xpCounter = useRef(0)
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null)
  const [refundsOffset, setRefundsOffset] = useState(0)
  const hasRefreshedProfile = useRef(false)

  const loadMonthStats = useCallback(async () => {
    const stats = await getMonthStats(getCurrentMonth())
    if (stats) setMonthStats(stats)
  }, [getMonthStats])

  useEffect(() => {
    if (loading || hasLoaded.current) return

    const init = async () => {
      hasLoaded.current = true
      if (fetched.length > 0) {
        const offsetCount = await detectRefunds()
        setRefundsOffset(offsetCount)
        if (offsetCount > 0) {
          const { data } = await (await import('../../lib/supabase')).supabase.rpc(
            'get_pending_transactions',
            { p_household_id: profile?.household_id },
          )
          if (data) {
            store.load(data as typeof fetched)
          } else {
            store.load(fetched)
          }
        } else {
          store.load(fetched)
        }
      } else {
        store.load([])
      }
    }
    init()
    loadMonthStats()
  }, [fetched, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwipeRight = () => {
    store.openCategoryPicker()
  }

  const handleSwipeLeft = async () => {
    const group = store.activeGroup
    if (!group) return
    for (const tx of group.transactions) {
      await flagTransaction(tx.id)
    }
    store.flag()
  }

  const handleTransfer = async () => {
    const group = store.activeGroup
    if (!group || !user) return
    for (const tx of group.transactions) {
      await markTransfer(tx.id, user.id)
    }
    store.markTransfer()
  }

  const handleCategorySelect = async (categoryId: string) => {
    const group = store.activeGroup
    if (!group || !user) return

    for (const tx of group.transactions) {
      await classifyTransaction(tx.id, categoryId, user.id)
    }
    learnMerchant(group.merchantRaw, categoryId)

    const txCount = group.count
    const xpEarned = txCount * XP_VALUES.CLASSIFY_MANUAL
    await awardXp(user.id, xpEarned)

    store.advance(txCount)

    xpCounter.current += 1
    const floatId = xpCounter.current
    setXpFloats(prev => [...prev, { id: floatId, amount: xpEarned }])
    setTimeout(() => setXpFloats(prev => prev.filter(f => f.id !== floatId)), 900)

    if (txCount > 1) {
      const toastId = floatId
      setGroupToasts(prev => [...prev, { id: toastId, count: txCount }])
      setTimeout(() => setGroupToasts(prev => prev.filter(t => t.id !== toastId)), 1300)
    }
  }

  const total = store.groups.length
  const processed = store.completedCount + store.flaggedCount + store.transferCount
  const isDone = total > 0 && processed >= total
  const visibleCards = store.groups.slice(store.currentIndex, store.currentIndex + 3)

  useEffect(() => {
    if (isDone && !hasRefreshedProfile.current) {
      hasRefreshedProfile.current = true
      refreshProfile()
    }
  }, [isDone, refreshProfile])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-duo-green border-t-transparent" />
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className={`max-w-sm space-y-4 ${ui.glass} px-8 py-10`}>
          <motion.div
            className="text-5xl drop-shadow-[0_10px_28px_rgba(28,176,246,0.2)]"
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          >
            📭
          </motion.div>
          <h2 className="bg-gradient-to-r from-surface-50 to-ice bg-clip-text text-xl font-bold text-transparent">
            No transactions yet
          </h2>
          <p className="text-sm text-surface-400">
            Upload a CSV from the Upload tab to start your session!
          </p>
          {refundsOffset > 0 && (
            <p className="text-sm font-semibold text-gem">
              {refundsOffset} refund pair{refundsOffset > 1 ? 's' : ''} auto-offset
            </p>
          )}
          <Link
            to="/upload"
            className="inline-block rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-6 py-2.5 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(88,204,2,0.45)] active:translate-y-[1px] active:border-b"
          >
            Upload CSV
          </Link>
        </div>
      </div>
    )
  }

  if (isDone) {
    const totalXp = store.classifiedTxCount * XP_VALUES.CLASSIFY_MANUAL
    return (
      <>
        <Confetti active={true} count={60} />
        <motion.div
          className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
        >
          <motion.div
            className="text-6xl"
            animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            🎉
          </motion.div>
          <h2 className="text-2xl font-bold text-surface-50">Deck Cleared!</h2>

          <div className={`w-full max-w-xs space-y-2.5 p-5 ${ui.glassFlat}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-surface-400">Classified</span>
              <span className="text-base font-bold tabular-nums text-duo-green">
                {store.classifiedTxCount} tx ({store.completedCount} card{store.completedCount !== 1 ? 's' : ''})
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-surface-400">Flagged</span>
              <span className="text-base font-bold tabular-nums text-flame">{store.flaggedCount}</span>
            </div>
            {store.transferCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">Transfers</span>
                <span className="text-base font-bold tabular-nums text-ice">{store.transferCount}</span>
              </div>
            )}
            {refundsOffset > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">Refunds offset</span>
                <span className="text-base font-bold tabular-nums text-gem">{refundsOffset} pair{refundsOffset > 1 ? 's' : ''}</span>
              </div>
            )}
            <div className="border-t border-surface-700/50 pt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">XP Earned</span>
                <motion.span
                  className="text-xl font-extrabold tabular-nums text-gem"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.4 }}
                >
                  +{totalXp}
                </motion.span>
              </div>
            </div>
          </div>

          <Link
            to="/"
            className="mt-2 rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-6 py-2.5 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(88,204,2,0.45)] active:translate-y-[1px] active:border-b"
          >
            Continue
          </Link>
        </motion.div>
      </>
    )
  }

  const monthClassified = monthStats ? Number(monthStats.classified_count) : 0
  const monthTotal = monthStats ? Number(monthStats.total_count) : 0

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-5 pt-4">
        {/* Co-op presence */}
        {onlineUsers.length > 1 && (
          <div className={`mb-3 flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-surface-950/40 px-3 py-2 backdrop-blur-sm`}>
            <div className="flex -space-x-1.5">
              {onlineUsers.map((u) => (
                <div
                  key={u.userId}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-900 bg-gem/20 text-[10px] font-bold text-gem shadow-[0_4px_12px_rgba(165,96,232,0.25)]"
                  title={u.displayName}
                >
                  {u.displayName.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-xs text-surface-500">
              {onlineUsers.length} classifying together
            </span>
          </div>
        )}

        {/* Month-level progress */}
        {monthTotal > 0 && (
          <div className="mb-2 rounded-2xl border border-white/[0.06] bg-surface-950/35 px-3 py-2.5 backdrop-blur-sm">
            <ProgressBar
              current={monthClassified + store.classifiedTxCount}
              total={monthTotal}
              label={`${getCurrentMonth()} progress`}
            />
          </div>
        )}

        {/* Session progress */}
        <div className="rounded-2xl border border-white/[0.06] bg-surface-950/35 px-3 py-2.5 backdrop-blur-sm">
          <ProgressBar current={processed} total={total} label="This session" />
        </div>
      </div>

      <div className="relative flex-1 px-4 py-6">
        <div className="relative mx-auto h-full max-w-sm">
          <AnimatePresence>
            {visibleCards
              .map((group, i) => (
                <SwipeCard
                  key={group.key}
                  group={group}
                  stackIndex={i}
                  onSwipeRight={handleSwipeRight}
                  onSwipeLeft={handleSwipeLeft}
                  onTransfer={handleTransfer}
                />
              ))
              .reverse()}
          </AnimatePresence>

          <AnimatePresence>
            {xpFloats.map((f) => (
              <XpFloat key={f.id} id={f.id} amount={f.amount} />
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {groupToasts.map((t) => (
              <GroupClassifiedToast key={t.id} id={t.id} count={t.count} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <CategoryPicker
        open={store.showCategoryPicker}
        onSelect={handleCategorySelect}
        onClose={store.closeCategoryPicker}
      />
    </div>
  )
}
