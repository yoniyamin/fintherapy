import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
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
import { Link, useLocation } from 'react-router-dom'
import { useFlaggedCount } from '../../hooks/useFlaggedCount'
import { XP_VALUES } from '../../lib/constants'
import { ui } from '../../lib/uiClasses'
import { formatAccountLabel } from '../../lib/accountDisplay'
import type { Transaction } from '../../types/database'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function classifyAccountStorageKey(householdId: string) {
  return `spentwhatt:classifyAccountFilter:${householdId}`
}

/** Stable key for the deck actually loaded (household + filter + pending ids after filter). */
function makeDeckFingerprint(
  householdId: string,
  accountFilter: string | null,
  deckTxns: { id: string }[],
): string {
  const af = accountFilter ?? ''
  if (deckTxns.length === 0) return `${householdId}:acct=${af}:`
  const ids = deckTxns.map((t) => t.id).sort().join(',')
  return `${householdId}:acct=${af}:${ids}`
}

function filterTransactionsByAccount(
  txns: Transaction[],
  accountFilter: string | null,
): Transaction[] {
  if (accountFilter == null) return txns
  return txns.filter((t) => (t.account_last4?.trim() ?? '') === accountFilter)
}

function noteDraftFromGroup(txs: { user_note?: string | null }[]): string {
  const parts = txs.map((t) => t.user_note?.trim()).filter(Boolean) as string[]
  return parts[0] ?? ''
}

function notePreviewForGroup(txs: { user_note?: string | null }[]): string | null {
  const parts = txs.map((t) => t.user_note?.trim()).filter(Boolean) as string[]
  if (parts.length === 0) return null
  const first = parts[0]!
  if (parts.every((p) => p === first)) return first
  return 'Different notes per transaction — edit to set one note for all'
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
  const location = useLocation()
  const deckMode = location.pathname.includes('no-idea') ? 'no-idea' : 'pending'
  const { profile, user, refreshProfile } = useAuth()
  const flaggedQueueCount = useFlaggedCount(profile?.household_id)
  const {
    transactions: fetched, loading,
    classifyTransaction, flagTransaction, markTransfer,
    detectRefunds, awardXp, getMonthStats, getAccountAliases,
    setTransactionsUserNote,
  } = useTransactions(profile?.household_id, deckMode)
  const { learnMerchant } = useMerchantKnowledge(profile?.household_id)
  const { onlineUsers } = usePresence(profile?.household_id, user?.id, profile?.display_name)
  const store = useClassificationStore()
  const lastSyncedFingerprintRef = useRef<string | null>(null)
  const prevHouseholdIdRef = useRef<string | undefined>(undefined)
  const deckSyncGenerationRef = useRef(0)
  const [xpFloats, setXpFloats] = useState<{ id: number; amount: number }[]>([])
  const [groupToasts, setGroupToasts] = useState<{ id: number; count: number }[]>([])
  const xpCounter = useRef(0)
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null)
  const [refundsOffset, setRefundsOffset] = useState(0)
  const hasRefreshedProfile = useRef(false)
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [accountAliases, setAccountAliases] = useState<Map<string, string>>(new Map())
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  const distinctLast4InPending = useMemo(() => {
    const s = new Set<string>()
    for (const t of fetched) {
      const x = t.account_last4?.trim()
      if (x) s.add(x)
    }
    return Array.from(s).sort()
  }, [fetched])

  const deckFromFetched = useMemo(
    () => filterTransactionsByAccount(fetched, accountFilter),
    [fetched, accountFilter],
  )

  const setAccountFilterPersist = useCallback(
    (next: string | null) => {
      setAccountFilter(next)
      const hid = profile?.household_id
      if (!hid) return
      try {
        if (next == null) sessionStorage.removeItem(classifyAccountStorageKey(hid))
        else sessionStorage.setItem(classifyAccountStorageKey(hid), next)
      } catch {
        /* ignore */
      }
    },
    [profile?.household_id],
  )

  useEffect(() => {
    const hid = profile?.household_id
    if (!hid) return
    void getAccountAliases().then((rows) => {
      setAccountAliases(new Map(rows.map((r) => [r.last4.trim(), r.label.trim()])))
    })
  }, [profile?.household_id, getAccountAliases])

  useEffect(() => {
    const hid = profile?.household_id
    if (!hid) return
    try {
      const raw = sessionStorage.getItem(classifyAccountStorageKey(hid))
      if (raw === null || raw === '') setAccountFilter(null)
      else setAccountFilter(raw)
    } catch {
      setAccountFilter(null)
    }
  }, [profile?.household_id])

  useEffect(() => {
    if (fetched.length === 0) return
    if (accountFilter != null && !distinctLast4InPending.includes(accountFilter)) {
      setAccountFilterPersist(null)
    }
  }, [fetched.length, distinctLast4InPending, accountFilter, setAccountFilterPersist])

  const loadMonthStats = useCallback(async () => {
    const stats = await getMonthStats(getCurrentMonth())
    if (stats) setMonthStats(stats)
  }, [getMonthStats])

  useEffect(() => {
    if (loading) return
    const hid = profile?.household_id
    if (!hid) return

    if (prevHouseholdIdRef.current !== hid) {
      prevHouseholdIdRef.current = hid
      lastSyncedFingerprintRef.current = null
    }

    const deckFp = makeDeckFingerprint(hid, accountFilter, deckFromFetched)
    if (deckFp === lastSyncedFingerprintRef.current) {
      void loadMonthStats()
      return
    }

    const gen = ++deckSyncGenerationRef.current

    const init = async () => {
      store.load(deckFromFetched)
      let finalTxns = fetched

      if (fetched.length === 0) {
        if (gen !== deckSyncGenerationRef.current) return
        lastSyncedFingerprintRef.current = deckFp
        return
      }

      if (deckMode === 'no-idea') {
        if (gen !== deckSyncGenerationRef.current) return
        lastSyncedFingerprintRef.current = makeDeckFingerprint(
          hid,
          accountFilter,
          filterTransactionsByAccount(finalTxns, accountFilter),
        )
        return
      }

      try {
        const offsetCount = await detectRefunds()
        if (gen !== deckSyncGenerationRef.current) return
        setRefundsOffset(offsetCount)
        if (offsetCount > 0) {
          const { data } = await (await import('../../lib/supabase')).supabase.rpc(
            'get_pending_transactions',
            { p_household_id: hid },
          )
          if (gen !== deckSyncGenerationRef.current) return
          if (data && (data as typeof fetched).length > 0) {
            finalTxns = data as typeof fetched
            const deckAfter = filterTransactionsByAccount(finalTxns, accountFilter)
            store.load(deckAfter)
          }
        }
      } catch {
        // Refund detection failed; data is already loaded above
      }
      if (gen !== deckSyncGenerationRef.current) return
      lastSyncedFingerprintRef.current = makeDeckFingerprint(
        hid,
        accountFilter,
        filterTransactionsByAccount(finalTxns, accountFilter),
      )
    }

    void init()
    void loadMonthStats()
  }, [
    fetched,
    deckFromFetched,
    accountFilter,
    loading,
    profile?.household_id,
    store.load,
    detectRefunds,
    loadMonthStats,
    deckMode,
  ])

  const handleSwipeRight = () => {
    store.openCategoryPicker()
  }

  const handleSwipeLeft = async () => {
    if (deckMode === 'no-idea') {
      store.rotateCurrentToEnd()
      return
    }
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

  const openNoteModal = useCallback(() => {
    const g = useClassificationStore.getState().activeGroup
    if (!g) return
    setNoteDraft(noteDraftFromGroup(g.transactions))
    setNoteModalOpen(true)
  }, [])

  const handleSaveNote = useCallback(async () => {
    const g = useClassificationStore.getState().activeGroup
    if (!g) return
    const ids = g.transactions.map((t) => t.id)
    const trimmed = noteDraft.trim() ? noteDraft.trim() : null
    const { error } = await setTransactionsUserNote(ids, trimmed)
    if (error) return
    useClassificationStore.getState().setNotesOnTransactions(ids, trimmed)
    setNoteModalOpen(false)
  }, [noteDraft, setTransactionsUserNote])

  const total = store.groups.length
  const processed =
    deckMode === 'no-idea'
      ? store.completedCount + store.transferCount
      : store.completedCount + store.flaggedCount + store.transferCount
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

  if (fetched.length > 0 && deckFromFetched.length === 0 && accountFilter != null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className={`max-w-sm space-y-4 ${ui.glass} px-8 py-10`}>
          <div className="text-5xl">💳</div>
          <h2 className="bg-gradient-to-r from-surface-50 to-ice bg-clip-text text-xl font-bold text-transparent">
            Nothing pending for this card
          </h2>
          <p className="text-sm text-surface-400">
            There are no pending transactions for{' '}
            <span className="font-semibold text-surface-200">
              {formatAccountLabel(accountFilter, accountAliases)}
            </span>
            . Try another card or view all.
          </p>
          <button
            type="button"
            onClick={() => setAccountFilterPersist(null)}
            className="inline-block rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-6 py-2.5 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(88,204,2,0.45)] active:translate-y-[1px] active:border-b"
          >
            All cards
          </button>
        </div>
      </div>
    )
  }

  if (total === 0) {
    if (deckMode === 'no-idea') {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
          <div className={`max-w-sm space-y-4 ${ui.glass} px-8 py-10`}>
            <div className="text-5xl">✨</div>
            <h2 className="bg-gradient-to-r from-surface-50 to-ice bg-clip-text text-xl font-bold text-transparent">
              No idea queue is empty
            </h2>
            <p className="text-sm text-surface-400">
              Swipe left on the main classify deck when you’re unsure — items land here until you pick a category.
            </p>
            <Link
              to="/classify"
              className="inline-block rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-6 py-2.5 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(88,204,2,0.45)] active:translate-y-[1px] active:border-b"
            >
              Back to Classify
            </Link>
          </div>
        </div>
      )
    }
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
            {deckMode === 'pending' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">No idea</span>
                <span className="text-base font-bold tabular-nums text-flame">{store.flaggedCount}</span>
              </div>
            )}
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
        <div className="mb-3 flex items-center justify-center gap-2 text-[13px] font-semibold">
          <Link
            to="/classify"
            className={`rounded-full px-3 py-1.5 transition-colors ${
              deckMode === 'pending' ? 'bg-duo-green/20 text-duo-green' : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            Classify
          </Link>
          <Link
            to="/classify/no-idea"
            className={`rounded-full px-3 py-1.5 transition-colors ${
              deckMode === 'no-idea' ? 'bg-flame/25 text-flame' : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            No idea{flaggedQueueCount > 0 ? ` (${flaggedQueueCount})` : ''}
          </Link>
        </div>

        {/* Co-op presence */}
        {distinctLast4InPending.length > 1 && (
          <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-surface-950/35 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-surface-500">
              Card
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setAccountFilterPersist(null)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  accountFilter == null
                    ? 'bg-duo-green/25 text-duo-green'
                    : 'text-surface-500 hover:bg-surface-800/60 hover:text-surface-300'
                }`}
              >
                All
              </button>
              {distinctLast4InPending.map((last4) => (
                <button
                  key={last4}
                  type="button"
                  onClick={() => setAccountFilterPersist(last4)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    accountFilter === last4
                      ? 'bg-duo-green/25 text-duo-green'
                      : 'text-surface-500 hover:bg-surface-800/60 hover:text-surface-300'
                  }`}
                >
                  {formatAccountLabel(last4, accountAliases)}
                </button>
              ))}
            </div>
          </div>
        )}

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
        {deckMode === 'pending' && (
          <p className="mt-2 text-center text-[11px] leading-snug text-surface-500">
            Swipe right to categorize, or left if you have no idea — those go to the No idea tab.
          </p>
        )}
        {deckMode === 'no-idea' && (
          <p className="mt-2 text-center text-[11px] leading-snug text-surface-500">
            Swipe right to pick a category. Swipe left to skip for now (this card moves to the back).
          </p>
        )}
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
                  rightLabel={deckMode === 'no-idea' ? 'Pick category' : 'Categorize'}
                  leftLabel={deckMode === 'no-idea' ? 'Later' : 'No idea'}
                  showTransferButton={deckMode === 'pending'}
                  accountAliases={accountAliases}
                  showAccountPerLine={accountFilter == null}
                  notePreview={notePreviewForGroup(group.transactions)}
                  onOpenNote={i === 0 ? openNoteModal : undefined}
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

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {noteModalOpen && (
              <>
                <motion.div
                  className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setNoteModalOpen(false)}
                />
                <motion.div
                  className="fixed inset-x-0 bottom-0 z-[101] rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 px-4 pt-3 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl pb-[max(2.5rem,env(safe-area-inset-bottom))]"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                >
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
                  <h3 className="mb-3 text-center text-base font-bold text-surface-50">Note</h3>
                  <p className="mb-2 text-center text-[11px] text-surface-500">
                    Saved on {store.activeGroup?.count === 1 ? 'this transaction' : 'all transactions in this stack'}.
                  </p>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Why is this here? Context for later…"
                    maxLength={2000}
                    rows={4}
                    className="mb-4 w-full resize-none rounded-xl border border-white/[0.08] bg-surface-900/80 px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-600 focus:border-duo-green/40 focus:outline-none focus:ring-1 focus:ring-duo-green/30"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNoteModalOpen(false)}
                      className="flex-1 rounded-xl border border-white/[0.1] bg-surface-800/80 py-2.5 text-sm font-semibold text-surface-300 transition-colors hover:bg-surface-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveNote()}
                      className="flex-1 rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(88,204,2,0.4)] active:translate-y-[1px] active:border-b"
                    >
                      Save
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}
