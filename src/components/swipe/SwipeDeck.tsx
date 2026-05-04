import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useClassificationStore } from '../../stores/classificationStore'
import { useTransactions, type MonthStats, type AccountClassifiedBreakdownRow } from '../../hooks/useTransactions'
import { useMerchantKnowledge } from '../../hooks/useMerchantKnowledge'
import { usePresence } from '../../hooks/usePresence'
import { useAuth } from '../../hooks/useAuth'
import SwipeCard from './SwipeCard'
import CategoryPicker from './CategoryPicker'
import CategoryEditorModal from '../settings/CategoryEditorModal'
import ProgressBar from '../common/ProgressBar'
import { AccountCardEditModal, type AccountCardEditDraft } from '../common/AccountCardEditModal'
import Confetti from '../common/Confetti'
import { Link, useLocation } from 'react-router-dom'
import { useFlaggedCount } from '../../hooks/useFlaggedCount'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import { XP_VALUES } from '../../lib/constants'
import { ui } from '../../lib/uiClasses'
import { formatAccountLabel } from '../../lib/accountDisplay'
import type { AccountType, Transaction } from '../../types/database'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function classifyAccountStorageKey(householdId: string) {
  return `spentwhatt:classifyAccountFilter:${householdId}`
}

/** Context key: changes when the user switches tab / card filter / household.
 *  Session counters reset only when this changes. */
function makeContextKey(
  householdId: string,
  accountFilter: string | null,
  deckMode: string,
): string {
  return `${householdId}:acct=${accountFilter ?? ''}:${deckMode}`
}

/** Full fingerprint including transaction ids — used to detect deck content changes. */
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
    transactions: fetched, autoClassified, loading,
    removeTransactions, classifyTransaction, flagTransaction, markTransfer,
    detectRefunds, awardXp, getMonthStats, getAccountAliases, upsertAccountAlias,
    setTransactionsUserNote,
    getDistinctAccountLast4ForHousehold,
    getClassifiedCountsForAccount,
  } = useTransactions(profile?.household_id, deckMode)
  const { learnMerchant, confirmAutoClassified } = useMerchantKnowledge(profile?.household_id)
  const { onlineUsers } = usePresence(profile?.household_id, user?.id, profile?.display_name)
  const catConfig = useCategoryConfig(profile?.household_id)
  const resolvedCategories = catConfig.categories
  const [catEditorOpen, setCatEditorOpen] = useState(false)
  const store = useClassificationStore()
  const lastSyncedFingerprintRef = useRef<string | null>(null)
  const lastContextKeyRef = useRef<string | null>(null)
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
  const [aliasDraft, setAliasDraft] = useState<AccountCardEditDraft | null>(null)
  const [accountTypes, setAccountTypes] = useState<Map<string, AccountType>>(new Map())
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [householdLast4List, setHouseholdLast4List] = useState<string[]>([])
  const [accountBreakdown, setAccountBreakdown] = useState<AccountClassifiedBreakdownRow[] | null>(null)
  const [breakdownLoading, setBreakdownLoading] = useState(false)

  /** All deck candidates: pending classify queue + already auto-classified items
   *  surfaced as confirmable "Predicted" cards. No-idea deck only uses `fetched`. */
  const allDeckTxns = useMemo(() => {
    if (deckMode === 'no-idea') return fetched
    return [...fetched, ...autoClassified]
  }, [fetched, autoClassified, deckMode])

  const distinctLast4InPending = useMemo(() => {
    const s = new Set<string>()
    for (const t of allDeckTxns) {
      const x = t.account_last4?.trim()
      if (x) s.add(x)
    }
    return Array.from(s).sort()
  }, [allDeckTxns])

  const last4WithPendingWork = useMemo(
    () => new Set(distinctLast4InPending),
    [distinctLast4InPending],
  )

  const deckFromFetched = useMemo(
    () => filterTransactionsByAccount(allDeckTxns, accountFilter),
    [allDeckTxns, accountFilter],
  )

  /** Cards to show in the classify picker: any household card + pending queue + aliases. */
  const classifyCardPicklist = useMemo(() => {
    const s = new Set<string>()
    for (const x of distinctLast4InPending) {
      if (x.trim()) s.add(x.trim())
    }
    for (const x of householdLast4List) {
      if (x?.trim()) s.add(x.trim())
    }
    for (const k of accountAliases.keys()) {
      if (k.trim()) s.add(k.trim())
    }
    return Array.from(s).sort()
  }, [distinctLast4InPending, householdLast4List, accountAliases])

  const showCardCaughtUp =
    deckMode === 'pending' && accountFilter != null && deckFromFetched.length === 0 && !loading

  useEffect(() => {
    const hid = profile?.household_id
    if (!hid) {
      setHouseholdLast4List([])
      return
    }
    void getDistinctAccountLast4ForHousehold().then(setHouseholdLast4List)
  }, [profile?.household_id, getDistinctAccountLast4ForHousehold])

  useEffect(() => {
    if (!showCardCaughtUp || !accountFilter) {
      setAccountBreakdown(null)
      setBreakdownLoading(false)
      return
    }
    let cancelled = false
    setBreakdownLoading(true)
    void getClassifiedCountsForAccount(accountFilter).then((rows) => {
      if (!cancelled) {
        setAccountBreakdown(rows)
        setBreakdownLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [showCardCaughtUp, accountFilter, getClassifiedCountsForAccount])

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
      const types = new Map<string, AccountType>()
      for (const r of rows) {
        if (r.account_type) types.set(r.last4.trim(), r.account_type)
      }
      setAccountTypes(types)
    })
  }, [profile?.household_id, getAccountAliases])

  const saveAlias = async () => {
    if (!aliasDraft?.label.trim() || !aliasDraft.last4) return
    const { error } = await upsertAccountAlias(
      aliasDraft.last4,
      aliasDraft.label.trim(),
      aliasDraft.accountType,
    )
    if (error) {
      console.error('upsert_account_alias', error.message)
      return
    }
    setAccountAliases((m) => new Map(m).set(aliasDraft.last4, aliasDraft.label.trim()))
    setAccountTypes((m) => {
      const next = new Map(m)
      if (aliasDraft.accountType) next.set(aliasDraft.last4, aliasDraft.accountType)
      else next.delete(aliasDraft.last4)
      return next
    })
    setAliasDraft(null)
  }

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

  // Auto-select the current user's own card when aliases are first loaded and
  // no filter has been manually set yet (session storage was empty).
  // Only pick a card that actually has pending/auto deck rows.
  useEffect(() => {
    if (accountAliases.size === 0 || distinctLast4InPending.length <= 1) return
    if (accountFilter !== null) return
    const displayName = profile?.display_name?.toLowerCase().trim()
    if (!displayName) return
    const pendingLast4 = new Set(distinctLast4InPending)
    for (const [last4, alias] of accountAliases.entries()) {
      if (!pendingLast4.has(last4)) continue
      const a = alias.toLowerCase().trim()
      if (a.includes(displayName) || displayName.includes(a)) {
        setAccountFilterPersist(last4)
        break
      }
    }
  }, [accountAliases, profile?.display_name, distinctLast4InPending, accountFilter, setAccountFilterPersist])

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
      lastContextKeyRef.current = null
    }

    const deckFp = makeDeckFingerprint(hid, accountFilter, deckFromFetched)
    if (deckFp === lastSyncedFingerprintRef.current) {
      void loadMonthStats()
      return
    }

    const ctxKey = makeContextKey(hid, accountFilter, deckMode)
    const contextChanged = ctxKey !== lastContextKeyRef.current
    lastContextKeyRef.current = ctxKey

    const gen = ++deckSyncGenerationRef.current

    const init = async () => {
      if (contextChanged) {
        store.load(deckFromFetched)
      } else {
        store.refreshDeck(deckFromFetched)
      }
      let finalTxns = allDeckTxns

      if (allDeckTxns.length === 0) {
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
          const supa = (await import('../../lib/supabase')).supabase
          const [pendingRes, autoRes] = await Promise.all([
            supa.rpc('get_pending_transactions', { p_household_id: hid }),
            supa.rpc('get_auto_classified_transactions', { p_household_id: hid }),
          ])
          if (gen !== deckSyncGenerationRef.current) return
          const refreshedPending =
            !pendingRes.error && pendingRes.data ? (pendingRes.data as typeof fetched) : []
          const refreshedAuto =
            !autoRes.error && autoRes.data ? (autoRes.data as typeof fetched) : []
          const merged = [...refreshedPending, ...refreshedAuto]
          if (merged.length > 0) {
            finalTxns = merged
            const deckAfter = filterTransactionsByAccount(finalTxns, accountFilter)
            if (contextChanged) {
              store.load(deckAfter)
            } else {
              store.refreshDeck(deckAfter)
            }
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
    allDeckTxns,
    deckFromFetched,
    accountFilter,
    loading,
    profile?.household_id,
    store.load,
    store.refreshDeck,
    detectRefunds,
    loadMonthStats,
    deckMode,
  ])

  const handleSwipeRight = async () => {
    const group = store.activeGroup
    if (!group || !user) {
      store.openCategoryPicker()
      return
    }
    // Predicted card → 1-tap confirm. No-prediction card → fall back to picker.
    if (deckMode === 'pending' && group.predictedCategory) {
      const predicted = group.predictedCategory
      for (const tx of group.transactions) {
        await confirmAutoClassified(tx.id, user.id)
      }
      // Boost the merchant→category mapping confidence so future uploads stick.
      learnMerchant(group.merchantRaw, predicted)
      removeTransactions(group.transactions.map((t) => t.id))

      const txCount = group.count
      const xpEarned = txCount * XP_VALUES.CLASSIFY_EASY
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
      return
    }
    store.openCategoryPicker()
  }

  const handleSwipeUp = () => {
    // Both decks: vertical swipe always opens the picker — useful to override a
    // prediction or pick fresh without going through swipe-right.
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
    removeTransactions(group.transactions.map((t) => t.id))
    store.flag()
  }

  const handleTransfer = async () => {
    const group = store.activeGroup
    if (!group || !user) return
    for (const tx of group.transactions) {
      await markTransfer(tx.id, user.id)
    }
    removeTransactions(group.transactions.map((t) => t.id))
    store.markTransfer()
  }

  const handleCategorySelect = async (categoryId: string) => {
    const group = store.activeGroup
    if (!group || !user) return

    store.closeCategoryPicker()

    for (const tx of group.transactions) {
      await classifyTransaction(tx.id, categoryId, user.id)
    }
    learnMerchant(group.merchantRaw, categoryId)
    removeTransactions(group.transactions.map((t) => t.id))

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

  if (total === 0 && !showCardCaughtUp) {
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
            {store.classifiedTxCount > store.completedCount && store.completedCount > 0 && (
              <p className="-mt-1 text-[11px] text-surface-500">
                Smart Stacks saved you {store.classifiedTxCount - store.completedCount} swipe
                {store.classifiedTxCount - store.completedCount !== 1 ? 's' : ''} 🎯
              </p>
            )}
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
  const cardChipList = deckMode === 'pending' ? classifyCardPicklist : distinctLast4InPending
  const cardChipShowAll =
    deckMode === 'pending' ? classifyCardPicklist.length > 1 : distinctLast4InPending.length > 1
  const breakdownTotal =
    accountBreakdown?.reduce((sum, row) => sum + row.classified_count, 0) ?? 0

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
          <button
            type="button"
            onClick={() => setCatEditorOpen(true)}
            className="ml-auto rounded-full p-1.5 text-surface-500 transition-colors hover:bg-white/[0.06] hover:text-surface-300"
            title="Edit categories"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Co-op presence */}
        {cardChipList.length >= 1 && (
          <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-surface-950/35 px-3 py-2.5 backdrop-blur-sm">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-surface-500">
              Card
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {cardChipShowAll && (
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
              )}
              {cardChipList.map((last4) => {
                const cardType = accountTypes.get(last4) ?? null
                const hasPendingHere = deckMode === 'pending' && last4WithPendingWork.has(last4)
                const isSelected = accountFilter === last4
                return (
                  <div key={last4} className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setAccountFilterPersist(last4)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-duo-green/25 text-duo-green'
                          : 'text-surface-500 hover:bg-surface-800/60 hover:text-surface-300'
                      }`}
                    >
                      {hasPendingHere && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-duo-green shadow-[0_0_8px_rgba(88,204,2,0.7)]"
                          title="Pending to classify"
                          aria-hidden
                        />
                      )}
                      {formatAccountLabel(last4, accountAliases)}
                    </button>
                    {isSelected && (
                      <button
                        type="button"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ice/70 transition-colors hover:bg-white/[0.08] hover:text-ice"
                        title="Edit display name and card type"
                        onClick={(e) => {
                          e.preventDefault()
                          setAliasDraft({
                            last4,
                            label: accountAliases.get(last4) ?? '',
                            accountType: cardType,
                          })
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                          <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                          <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
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
        {!showCardCaughtUp && (
          <div className="rounded-2xl border border-white/[0.06] bg-surface-950/35 px-3 py-2.5 backdrop-blur-sm">
            <ProgressBar current={processed} total={total} label="This session" />
          </div>
        )}
        {showCardCaughtUp && (
          <div className="rounded-2xl border border-duo-green/20 bg-duo-green/[0.07] px-3 py-2.5 backdrop-blur-sm">
            <p className="text-center text-xs font-semibold text-duo-green">
              This card is fully classified — enjoy the win below.
            </p>
          </div>
        )}
        {deckMode === 'pending' && !showCardCaughtUp && (
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
          {showCardCaughtUp && accountFilter ? (
            <>
              <Confetti key={`caught-${accountFilter}`} active={true} count={36} />
              <motion.div
                className="flex flex-col items-center gap-5 px-1 text-center"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 17 }}
              >
                <motion.div
                  className="text-6xl"
                  animate={{ rotate: [0, -8, 8, -8, 0], scale: [1, 1.08, 1] }}
                  transition={{ duration: 0.65, ease: 'easeInOut' }}
                >
                  ✨
                </motion.div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-surface-50">You're all caught up!</h2>
                  <p className="text-sm leading-relaxed text-surface-400">
                    Nothing left to classify for{' '}
                    <span className="font-semibold text-duo-green">
                      {formatAccountLabel(accountFilter, accountAliases)}
                    </span>
                    .
                    {allDeckTxns.length > 0
                      ? ' Other cards may still have items — check the dots above.'
                      : ' When new transactions arrive, they will show up here.'}
                  </p>
                </div>

                <div className={`w-full space-y-3 text-left ${ui.glassFlat} px-4 py-4`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-500">
                    Household effort · this card
                  </p>
                  {breakdownLoading ? (
                    <p className="text-sm text-surface-500">Loading who labeled what…</p>
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {(accountBreakdown ?? []).map((row) => (
                          <li
                            key={row.user_id}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="min-w-0 truncate text-surface-200">{row.display_name}</span>
                            <span className="shrink-0 tabular-nums font-bold text-duo-green">
                              {row.classified_count}{' '}
                              <span className="text-[11px] font-semibold text-surface-500">
                                labeled
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="border-t border-white/[0.06] pt-3 text-xs text-surface-500">
                        <span className="font-semibold text-surface-300">{breakdownTotal}</span> transaction
                        {breakdownTotal !== 1 ? 's' : ''} classified on this card in total (including transfers
                        you marked).
                      </p>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setAccountFilterPersist(null)}
                  className="rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-6 py-2.5 text-sm font-bold text-white shadow-[0_14px_36px_-10px_rgba(88,204,2,0.45)] active:translate-y-[1px] active:border-b"
                >
                  {classifyCardPicklist.length > 1 ? 'All cards' : 'Back to all'}
                </button>
              </motion.div>
            </>
          ) : (
            <>
              <AnimatePresence>
                {visibleCards
                  .map((group, i) => (
                    <SwipeCard
                      key={group.key}
                      group={group}
                      stackIndex={i}
                      onSwipeRight={handleSwipeRight}
                      onSwipeLeft={handleSwipeLeft}
                      onSwipeUp={i === 0 && !!group.predictedCategory ? handleSwipeUp : undefined}
                      onTransfer={handleTransfer}
                      rightLabel={
                        deckMode === 'no-idea'
                          ? 'Pick category'
                          : group.predictedCategory
                            ? 'Confirm'
                            : 'Categorize'
                      }
                      leftLabel={deckMode === 'no-idea' ? 'Later' : 'No idea'}
                      showTransferButton={deckMode === 'pending'}
                      accountAliases={accountAliases}
                      accountTypes={accountTypes}
                      showAccountPerLine={accountFilter == null}
                      notePreview={notePreviewForGroup(group.transactions)}
                      onOpenNote={i === 0 ? openNoteModal : undefined}
                      categories={resolvedCategories}
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
            </>
          )}
        </div>
      </div>

      <CategoryPicker
        open={store.showCategoryPicker}
        onSelect={handleCategorySelect}
        onClose={store.closeCategoryPicker}
        categories={resolvedCategories}
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

      <AccountCardEditModal
        draft={aliasDraft}
        onChange={setAliasDraft}
        onClose={() => setAliasDraft(null)}
        onSave={() => void saveAlias()}
      />

      <CategoryEditorModal
        open={catEditorOpen}
        onClose={() => setCatEditorOpen(false)}
        config={catConfig}
      />
    </div>
  )
}
