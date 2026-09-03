import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useReveal } from '../../hooks/useReveal'
import { useTransactions, type ExportRow, type MonthStats } from '../../hooks/useTransactions'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import { formatAccountLabel } from '../../lib/accountDisplay'
import { downloadTransactionsCsv } from '../../lib/exportTransactionsCsv'
import { supabase } from '../../lib/supabase'
import type { AccountType, Transaction } from '../../types/database'
import type { CategorySummary } from '../../hooks/useReveal'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function getMonthOptions(): { value: string; label: string }[] {
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
 * Shared data-fetching and state for Reveal.
 * Used by both RevealPage (mobile) and RevealDesktopPage.
 */
export function useRevealData() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const {
    summary, leaderboard, monthlyTotals, householdIncome,
    loading, fetchSummary, setIncome,
  } = useReveal(profile?.household_id)
  const {
    getTransactionsByCategory,
    reclassifyTransaction,
    markTransfer,
    setTransactionsUserNote,
    getExportData,
    getAccountAliases,
    getDistinctAccountLast4ForHousehold,
    upsertAccountAlias,
    autoMarkDebitLoads,
    getMonthStats,
  } = useTransactions(profile?.household_id)
  const [month, setMonth] = useState(getCurrentMonth())
  const resolvedMonthHouseholdRef = useRef<string | null>(null)
  const [monthResolutionTick, setMonthResolutionTick] = useState(0)
  const [accountFilter, setAccountFilter] = useState<string[] | null>(null)
  const [availableLast4s, setAvailableLast4s] = useState<string[]>([])
  const [aliasMap, setAliasMap] = useState<Map<string, string>>(new Map())
  const [accountTypeMap, setAccountTypeMap] = useState<Map<string, AccountType>>(new Map())
  const [aliasDraft, setAliasDraft] = useState<
    { last4: string; label: string; accountType: AccountType | null } | null
  >(null)
  const [retroBusy, setRetroBusy] = useState<string | null>(null)
  const [retroResult, setRetroResult] = useState<{ last4: string; count: number } | null>(null)
  const [cardsOpen, setCardsOpen] = useState(false)
  const cardsPanelRef = useRef<HTMLDivElement>(null)
  const [incomeDraft, setIncomeDraft] = useState<string | null>(null)
  const [editingIncome, setEditingIncome] = useState(false)
  const incomeRef = useRef<HTMLInputElement>(null)
  const monthOptions = getMonthOptions()
  const incomeInput = incomeDraft ?? (householdIncome !== null ? String(householdIncome) : '')

  const [drillCategory, setDrillCategory] = useState<string | null>(null)
  const [drillTxns, setDrillTxns] = useState<Transaction[]>([])
  const [drillLoading, setDrillLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [generatingPpt, setGeneratingPpt] = useState<'idle' | 'generating' | 'done'>('idle')
  const [showDeckPreview, setShowDeckPreview] = useState(false)
  const [previewTransactions, setPreviewTransactions] = useState<ExportRow[]>([])
  const [prevMonthSummary, setPrevMonthSummary] = useState<CategorySummary[] | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [includeOwnTransfers, setIncludeOwnTransfers] = useState(false)
  const [showTransfersHelp, setShowTransfersHelp] = useState(false)
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null)
  const [statsLoadedMonth, setStatsLoadedMonth] = useState<string | null>(null)
  const [completionDismissed, setCompletionDismissed] = useState(false)
  const celebrationFiredRef = useRef(false)
  const catConfig = useCategoryConfig(profile?.household_id)

  const UNCLASSIFIED_BLOCK_THRESHOLD = 0.2

  const hasTransactions = monthStats !== null && monthStats.total_count > 0
  const allClassified = hasTransactions && monthStats.pending_count === 0
  const noData = monthStats !== null && monthStats.total_count === 0
  const tooManyUnclassified = hasTransactions
    && (monthStats.pending_count / monthStats.total_count) > UNCLASSIFIED_BLOCK_THRESHOLD
  const monthStatsLoading = statsLoadedMonth !== month

  const celebrationStorageKey = profile?.household_id
    ? `revealCelebrated:${profile.household_id}:${month}`
    : null
  const alreadyCelebrated = celebrationStorageKey
    ? localStorage.getItem(celebrationStorageKey) === '1'
    : false
  const classifiedToday = monthStats?.last_classified_at
    ? new Date(monthStats.last_classified_at).toDateString() === new Date().toDateString()
    : false
  const showCompletionScreen = allClassified && classifiedToday
    && !completionDismissed && !alreadyCelebrated

  const markCelebrated = useCallback(() => {
    if (celebrationStorageKey) localStorage.setItem(celebrationStorageKey, '1')
    setCompletionDismissed(true)
  }, [celebrationStorageKey])

  const handleMonthChange = (value: string) => {
    setMonth(value)
    setCompletionDismissed(false)
    celebrationFiredRef.current = false
    setStatsLoadedMonth(null)
  }

  useEffect(() => {
    if (showCompletionScreen && !celebrationFiredRef.current) {
      celebrationFiredRef.current = true
      import('canvas-confetti').then(({ default: confetti }) => {
        const duration = 2000
        const end = Date.now() + duration
        const frame = () => {
          confetti({
            particleCount: 4,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.65 },
            colors: ['#58cc02', '#1cb0f6', '#ff9600', '#ce82ff', '#ffd700'],
          })
          confetti({
            particleCount: 4,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.65 },
            colors: ['#58cc02', '#1cb0f6', '#ff9600', '#ce82ff', '#ffd700'],
          })
          if (Date.now() < end) requestAnimationFrame(frame)
        }
        confetti({
          particleCount: 100,
          spread: 120,
          origin: { y: 0.5 },
          colors: ['#58cc02', '#1cb0f6', '#ff9600', '#ce82ff', '#ffd700'],
        })
        frame()
      })
    }
  }, [showCompletionScreen])

  useEffect(() => {
    const hid = profile?.household_id
    if (!hid || resolvedMonthHouseholdRef.current === hid) return
    let cancelled = false
    void (async () => {
      for (const opt of getMonthOptions()) {
        const stats = await getMonthStats(opt.value)
        if (cancelled) return
        if (stats && Number(stats.classified_count) > 0) {
          setMonth(opt.value)
          break
        }
      }
      if (!cancelled) {
        resolvedMonthHouseholdRef.current = hid
        setMonthResolutionTick((tick) => tick + 1)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.household_id, getMonthStats])

  useEffect(() => {
    const hid = profile?.household_id
    if (hid != null && resolvedMonthHouseholdRef.current !== hid) return
    let cancelled = false
    fetchSummary(month, accountFilter?.length ? accountFilter : null, includeOwnTransfers)
    void getMonthStats(month).then((stats) => {
      if (cancelled) return
      setMonthStats(stats)
      setStatsLoadedMonth(month)
    })
    return () => {
      cancelled = true
    }
  }, [month, monthResolutionTick, profile?.household_id, fetchSummary, accountFilter, includeOwnTransfers, getMonthStats])

  useEffect(() => {
    if (!profile?.household_id) return
    let cancelled = false
    Promise.all([getDistinctAccountLast4ForHousehold(), getAccountAliases()]).then(([last4s, aliases]) => {
      if (cancelled) return
      setAvailableLast4s(last4s)
      setAliasMap(new Map(aliases.map((a) => [a.last4.trim(), a.label.trim()])))
      const types = new Map<string, AccountType>()
      for (const a of aliases) {
        if (a.account_type) types.set(a.last4.trim(), a.account_type)
      }
      setAccountTypeMap(types)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.household_id, getDistinctAccountLast4ForHousehold, getAccountAliases, location.pathname])

  const mergedCardLast4s = useMemo(() => {
    const s = new Set<string>()
    for (const x of availableLast4s) {
      const t = String(x).trim()
      if (t) s.add(t)
    }
    for (const k of aliasMap.keys()) {
      const t = k.trim()
      if (t) s.add(t)
    }
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [availableLast4s, aliasMap])

  useEffect(() => {
    if (!cardsOpen) return
    const onDown = (e: MouseEvent) => {
      if (cardsPanelRef.current && !cardsPanelRef.current.contains(e.target as Node)) {
        setCardsOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [cardsOpen])

  const spendingSummary = summary.filter(
    (s) => includeOwnTransfers || s.category !== OWN_TRANSFERS_CATEGORY_ID,
  )
  const totalSpent = spendingSummary.reduce((sum, s) => sum + Number(s.total_amount), 0)
  const spendingTxCount = spendingSummary.reduce((sum, s) => sum + Number(s.tx_count), 0)
  const incomeNum = Number(incomeInput) || 0
  const freeIncome = incomeNum - totalSpent
  const savingsRate = incomeNum > 0 ? (freeIncome / incomeNum) * 100 : 0

  const categoryLookup = catConfig.categoryLookup

  const handleIncomeSave = async () => {
    const val = Number(incomeInput)
    if (val > 0) {
      await setIncome(val)
    }
    setIncomeDraft(null)
    setEditingIncome(false)
  }

  const handleIncomeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleIncomeSave()
    if (e.key === 'Escape') {
      setIncomeDraft(null)
      setEditingIncome(false)
    }
  }

  const accountRpcFilter = accountFilter?.length ? accountFilter : null

  const handleCategoryClick = async (categoryId: string) => {
    setDrillCategory(categoryId)
    setDrillLoading(true)
    const txns = await getTransactionsByCategory(month, categoryId, accountRpcFilter)
    setDrillTxns(txns)
    setDrillLoading(false)
  }

  const handleReclassify = useCallback(async (txId: string, newCategory: string) => {
    await reclassifyTransaction(txId, newCategory)
    setDrillTxns(prev => prev.filter(t => t.id !== txId))
    fetchSummary(month, accountRpcFilter, includeOwnTransfers)
  }, [reclassifyTransaction, fetchSummary, month, accountRpcFilter, includeOwnTransfers])

  const handleMarkTransfer = useCallback(async (txId: string) => {
    await markTransfer(txId)
    setDrillTxns(prev => prev.filter(t => t.id !== txId))
    fetchSummary(month, accountRpcFilter, includeOwnTransfers)
  }, [markTransfer, fetchSummary, month, accountRpcFilter, includeOwnTransfers])

  const handleSaveNote = useCallback(async (txId: string, note: string | null) => {
    await setTransactionsUserNote([txId], note)
    setDrillTxns(prev => prev.map(t => (t.id === txId ? { ...t, user_note: note } : t)))
  }, [setTransactionsUserNote])

  const isCardIncluded = (last4: string) =>
    accountFilter === null || accountFilter.includes(last4)

  const toggleAccountLast4 = (last4: string) => {
    setAccountFilter((prev) => {
      if (prev === null) {
        const next = mergedCardLast4s.filter((x) => x !== last4)
        return next.length === 0 ? null : next
      }
      if (prev.includes(last4)) {
        const next = prev.filter((x) => x !== last4)
        return next.length === 0 ? null : next
      }
      const next = [...prev, last4]
      if (next.length >= mergedCardLast4s.length) return null
      return next
    })
  }

  const selectAllCards = () => setAccountFilter(null)

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
    setAliasMap((m) => new Map(m).set(aliasDraft.last4, aliasDraft.label.trim()))
    setAccountTypeMap((m) => {
      const next = new Map(m)
      if (aliasDraft.accountType) next.set(aliasDraft.last4, aliasDraft.accountType)
      else next.delete(aliasDraft.last4)
      return next
    })
    setAliasDraft(null)
  }

  const handleMarkAllLoads = async (last4: string) => {
    if (retroBusy) return
    setRetroBusy(last4)
    setRetroResult(null)
    const count = await autoMarkDebitLoads(last4, null)
    setRetroResult({ last4, count })
    setRetroBusy(null)
    fetchSummary(month, accountRpcFilter, includeOwnTransfers)
  }

  const handleExport = async () => {
    setExporting(true)
    const rows = await getExportData(month)
    if (rows.length > 0) {
      const labelLookup = Object.fromEntries(
        catConfig.categories.map((c) => [c.id, c.label]),
      )
      downloadTransactionsCsv(rows, month, labelLookup)
    }
    setExporting(false)
  }

  const handleOpenPreview = async () => {
    if (loadingPreview) return
    setLoadingPreview(true)
    try {
      const [rows, prevSumRes] = await Promise.all([
        getExportData(month),
        (() => {
          const [y, m] = month.split('-').map(Number)
          const prev = new Date(y, m - 2)
          const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
          return profile?.household_id
            ? supabase.rpc('get_monthly_summary', {
                p_household_id: profile.household_id,
                p_billing_month: prevMonth,
                p_account_last4s: null,
              })
            : Promise.resolve({ data: null, error: null })
        })(),
      ])
      setPreviewTransactions(rows)
      if (prevSumRes.data && !prevSumRes.error) {
        setPrevMonthSummary(prevSumRes.data as CategorySummary[])
      } else {
        setPrevMonthSummary(null)
      }
      setShowDeckPreview(true)
    } catch (e) {
      console.error('Failed to load preview data:', e)
    }
    setLoadingPreview(false)
  }

  const handleGeneratePpt = async () => {
    if (generatingPpt === 'generating') return
    setGeneratingPpt('generating')
    try {
      const rows = previewTransactions.length > 0 ? previewTransactions : await getExportData(month)
      const catLookup: Record<string, { icon: string; label: string }> = Object.fromEntries(
        catConfig.categories.map((c) => [c.id, { icon: c.icon, label: c.label }]),
      )
      const { generateSlideDeck, downloadBlob } = await import('../../lib/generateSlideDeck')
      const blob = await generateSlideDeck({
        month,
        summary,
        prevMonthSummary,
        monthlyTotals,
        income: householdIncome,
        transactions: rows,
        categoryLookup: catLookup,
      })
      downloadBlob(blob, `spending-report-${month}.pptx`)
      setGeneratingPpt('done')
      setTimeout(() => setGeneratingPpt('idle'), 2000)
    } catch (e) {
      console.error('Slide deck generation failed:', e)
      setGeneratingPpt('idle')
    }
  }

  return {
    profile,
    summary,
    leaderboard,
    monthlyTotals,
    householdIncome,
    loading,
    month,
    handleMonthChange,
    monthOptions,
    accountFilter,
    mergedCardLast4s,
    aliasMap,
    accountTypeMap,
    aliasDraft,
    setAliasDraft,
    retroBusy,
    retroResult,
    cardsOpen,
    setCardsOpen,
    cardsPanelRef,
    incomeDraft,
    setIncomeDraft,
    editingIncome,
    setEditingIncome,
    incomeRef,
    incomeInput,
    drillCategory,
    setDrillCategory,
    drillTxns,
    drillLoading,
    exporting,
    showDeckPreview,
    setShowDeckPreview,
    previewTransactions,
    prevMonthSummary,
    loadingPreview,
    includeOwnTransfers,
    setIncludeOwnTransfers,
    showTransfersHelp,
    setShowTransfersHelp,
    monthStats,
    monthStatsLoading,
    completionDismissed,
    markCelebrated,
    noData,
    hasTransactions,
    allClassified,
    tooManyUnclassified,
    showCompletionScreen,
    spendingSummary,
    totalSpent,
    spendingTxCount,
    incomeNum,
    freeIncome,
    savingsRate,
    categoryLookup,
    catConfig,
    navigate,
    handleIncomeSave,
    handleIncomeKeyDown,
    handleCategoryClick,
    handleReclassify,
    handleMarkTransfer,
    handleSaveNote,
    isCardIncluded,
    toggleAccountLast4,
    selectAllCards,
    saveAlias,
    handleMarkAllLoads,
    handleExport,
    handleOpenPreview,
    handleGeneratePpt,
    generatingPpt,
    formatMonthLabel,
    formatAccountLabel,
  }
}
