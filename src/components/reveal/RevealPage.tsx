import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useReveal } from '../../hooks/useReveal'
import { useTransactions, type ExportRow } from '../../hooks/useTransactions'
import SpendingChart from './SpendingChart'
import MonthlyTrend from './MonthlyTrend'
import Leaderboard from './Leaderboard'
import CategoryDetail from './CategoryDetail'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import type { AccountType, Transaction } from '../../types/database'
import { ui } from '../../lib/uiClasses'
import { formatAccountLabel } from '../../lib/accountDisplay'

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

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(v)

function downloadCSV(
  rows: ExportRow[],
  month: string,
  catLabelLookup: Record<string, string>,
) {
  const headers = [
    'Date',
    'Merchant',
    'Merchant (Clean)',
    'Amount',
    'Category',
    'Status',
    'Month',
    'Account Last 4',
    'Note',
  ]
  const catLookup = catLabelLookup
  const csvLines = [
    headers.join(','),
    ...rows.map(r => [
      r.tx_date,
      `"${(r.merchant_raw ?? '').replace(/"/g, '""')}"`,
      `"${(r.merchant_clean ?? '').replace(/"/g, '""')}"`,
      r.amount,
      catLookup[r.category] ?? r.category,
      r.status,
      r.billing_month,
      r.account_last4 ?? '',
      `"${(r.user_note ?? '').replace(/"/g, '""')}"`,
    ].join(','))
  ]
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `financial-therapy-${month}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RevealPage() {
  const location = useLocation()
  const { profile, user } = useAuth()
  const {
    summary, leaderboard, monthlyTotals, householdIncome,
    loading, fetchSummary, setIncome,
  } = useReveal(profile?.household_id)
  const {
    getTransactionsByCategory,
    reclassifyTransaction,
    markTransfer,
    getExportData,
    getAccountAliases,
    getDistinctAccountLast4ForHousehold,
    upsertAccountAlias,
    autoMarkDebitLoads,
  } = useTransactions(profile?.household_id)
  const [month, setMonth] = useState(getCurrentMonth())
  /** null = all cards; non-null = filter to these last-4 values */
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
  const [incomeInput, setIncomeInput] = useState('')
  const [editingIncome, setEditingIncome] = useState(false)
  const incomeRef = useRef<HTMLInputElement>(null)
  const monthOptions = getMonthOptions()

  // Drill-down state
  const [drillCategory, setDrillCategory] = useState<string | null>(null)
  const [drillTxns, setDrillTxns] = useState<Transaction[]>([])
  const [drillLoading, setDrillLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  /** When false, own_transfers are omitted from pie, “Total spent”, monthly trend bars, and tx counts. */
  const [includeOwnTransfers, setIncludeOwnTransfers] = useState(false)
  const [showTransfersHelp, setShowTransfersHelp] = useState(false)
  const catConfig = useCategoryConfig(profile?.household_id)

  useEffect(() => {
    fetchSummary(month, accountFilter?.length ? accountFilter : null, includeOwnTransfers)
  }, [month, fetchSummary, accountFilter, includeOwnTransfers])

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

  /** Cards with any uploaded activity ∪ saved aliases (names without tx yet still listed). */
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

  useEffect(() => {
    if (householdIncome !== null) {
      setIncomeInput(String(householdIncome))
    }
  }, [householdIncome])

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
    setEditingIncome(false)
  }

  const handleIncomeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleIncomeSave()
    if (e.key === 'Escape') setEditingIncome(false)
  }

  const accountRpcFilter = accountFilter?.length ? accountFilter : null

  const handleCategoryClick = useCallback(async (categoryId: string) => {
    setDrillCategory(categoryId)
    setDrillLoading(true)
    const txns = await getTransactionsByCategory(month, categoryId, accountRpcFilter)
    setDrillTxns(txns)
    setDrillLoading(false)
  }, [month, getTransactionsByCategory, accountRpcFilter])

  const handleReclassify = useCallback(async (txId: string, newCategory: string) => {
    if (!user) return
    await reclassifyTransaction(txId, newCategory, user.id)
    setDrillTxns(prev => prev.filter(t => t.id !== txId))
    fetchSummary(month, accountRpcFilter, includeOwnTransfers)
  }, [user, reclassifyTransaction, fetchSummary, month, accountRpcFilter, includeOwnTransfers])

  const handleMarkTransfer = useCallback(async (txId: string) => {
    if (!user) return
    await markTransfer(txId, user.id)
    setDrillTxns(prev => prev.filter(t => t.id !== txId))
    fetchSummary(month, accountRpcFilter, includeOwnTransfers)
  }, [user, markTransfer, fetchSummary, month, accountRpcFilter, includeOwnTransfers])

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
      downloadCSV(rows, month, labelLookup)
    }
    setExporting(false)
  }

  return (
    <div className={`${ui.screen} ${ui.page}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className={ui.heroTitle}>Reveal</h1>
        <p className={ui.heroSub}>
          Monthly spending breakdown & household leaderboard
        </p>
      </motion.div>

      {/* Month selector + Export */}
      <div className="mt-6 flex gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={`flex-1 ${ui.select}`}
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || summary.length === 0}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-surface-950/55 px-3 py-2.5 text-sm text-surface-300 transition-colors hover:bg-surface-900/70 disabled:opacity-40"
        >
          {exporting ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-surface-400 border-t-transparent" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          CSV
        </button>
      </div>

      {profile?.household_id && (
        <div className={`${ui.glassFlat} relative z-30 mt-3 px-3 py-3`} ref={cardsPanelRef}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-surface-400">Cards in this view</span>
            <button
              type="button"
              onClick={selectAllCards}
              className="text-xs font-medium text-ice hover:text-ice/90"
            >
              All cards
            </button>
          </div>
          <p className="mt-1 text-[10px] text-surface-500">
            Saved names apply everywhere (including upload). Open the list to filter Reveal by card.
          </p>
          <div className="relative mt-2">
            <button
              type="button"
              onClick={() => setCardsOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-surface-950/55 px-3 py-2.5 text-left text-sm text-surface-200 outline-none ring-1 ring-white/[0.06]"
            >
              <span>
                {accountFilter === null
                  ? 'All cards included'
                  : `${accountFilter.length} card${accountFilter.length !== 1 ? 's' : ''} selected`}
              </span>
              <span className="text-surface-500">{cardsOpen ? '▲' : '▼'}</span>
            </button>
            {cardsOpen && (
              <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-64 overflow-y-auto rounded-xl border border-white/[0.1] bg-surface-950 p-2 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)]">
                {mergedCardLast4s.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-surface-500">
                    No card last-4 in this month yet. Upload a CSV with an account, or add a name after data appears.
                  </p>
                ) : (
                  <>
                    {mergedCardLast4s.map((last4) => {
                      const cardType = accountTypeMap.get(last4) ?? null
                      const isDebit = cardType === 'debit'
                      return (
                        <label
                          key={last4}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/[0.04]"
                        >
                          <input
                            type="checkbox"
                            checked={isCardIncluded(last4)}
                            onChange={() => toggleAccountLast4(last4)}
                            className="h-4 w-4 rounded border-white/20 bg-surface-900 text-duo-green"
                          />
                          <span className="flex-1 text-sm text-surface-200">
                            {formatAccountLabel(last4, aliasMap)}
                            {cardType && (
                              <span
                                className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  isDebit
                                    ? 'bg-ice/15 text-ice'
                                    : 'bg-duo-green/10 text-duo-green'
                                }`}
                              >
                                {isDebit ? 'Debit' : 'Credit'}
                              </span>
                            )}
                          </span>
                          {isDebit && (
                            <button
                              type="button"
                              disabled={retroBusy === last4}
                              className="shrink-0 rounded-md px-2 py-1 text-xs text-ice hover:bg-white/[0.06] disabled:opacity-40"
                              onClick={(e) => {
                                e.preventDefault()
                                void handleMarkAllLoads(last4)
                              }}
                              title="Mark all positive-amount transactions on this card as own-account transfers"
                            >
                              {retroBusy === last4 ? '…' : 'Mark loads'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="shrink-0 rounded-md px-2 py-1 text-xs text-ice hover:bg-white/[0.06]"
                            onClick={(e) => {
                              e.preventDefault()
                              setAliasDraft({
                                last4,
                                label: aliasMap.get(last4) ?? '',
                                accountType: cardType,
                              })
                            }}
                          >
                            Name
                          </button>
                        </label>
                      )
                    })}
                    {retroResult && (
                      <p className="px-2 py-2 text-[11px] text-surface-500">
                        Marked {retroResult.count} load
                        {retroResult.count === 1 ? '' : 's'} on ···{retroResult.last4} as transfers.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {aliasDraft &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alias-card-title"
            onClick={() => setAliasDraft(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-950 p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p id="alias-card-title" className="text-xs text-surface-500">
                Card ···{aliasDraft.last4}
              </p>
              <input
                value={aliasDraft.label}
                onChange={(e) => setAliasDraft({ ...aliasDraft, label: e.target.value })}
                placeholder="Display name (e.g. Yonatan)"
                className={`mt-2 w-full ${ui.input}`}
                autoFocus
              />
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-surface-400">Card type</p>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-surface-900/60 p-1 ring-1 ring-white/[0.06]">
                  {(['credit', 'debit', null] as const).map((opt) => {
                    const active = aliasDraft.accountType === opt
                    const label = opt === null ? 'Unknown' : opt === 'credit' ? 'Credit' : 'Debit'
                    return (
                      <button
                        key={String(opt)}
                        type="button"
                        onClick={() => setAliasDraft({ ...aliasDraft, accountType: opt })}
                        className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                          active
                            ? opt === 'debit'
                              ? 'bg-ice/20 text-ice'
                              : opt === 'credit'
                                ? 'bg-duo-green/15 text-duo-green'
                                : 'bg-surface-700/70 text-surface-200'
                            : 'text-surface-500 hover:bg-white/[0.04]'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                {aliasDraft.accountType === 'debit' && (
                  <p className="mt-2 text-[11px] leading-snug text-surface-500">
                    Future uploads on this card will auto-mark positive-amount loads as own-account transfers.
                  </p>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm text-surface-400"
                  onClick={() => setAliasDraft(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-duo-green px-4 py-2 text-sm font-bold text-white"
                  onClick={() => void saveAlias()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {loading ? (
        <div className="mt-12 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-duo-green border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Income + Spending + Free Income summary */}
          <motion.div
            className={`${ui.glass} mt-6 overflow-hidden`}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
              <span className="text-sm text-surface-400">Household Income</span>
              {editingIncome ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-500">EUR</span>
                  <input
                    ref={incomeRef}
                    type="number"
                    min="0"
                    step="100"
                    value={incomeInput}
                    onChange={(e) => setIncomeInput(e.target.value)}
                    onBlur={handleIncomeSave}
                    onKeyDown={handleIncomeKeyDown}
                    autoFocus
                    className={`w-28 px-3 py-1.5 text-right text-sm font-bold tabular-nums ${ui.input}`}
                  />
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingIncome(true)
                    setTimeout(() => incomeRef.current?.focus(), 50)
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-surface-700/50"
                >
                  <span className="text-sm font-bold tabular-nums text-duo-green">
                    {incomeNum > 0 ? fmt(incomeNum) : 'Set income'}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-surface-500">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
              <span className="text-sm text-surface-400">Total spent</span>
              <span className="text-sm font-bold tabular-nums text-primary-400">{fmt(totalSpent)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-surface-300">Hide internal transfers</span>
                <button
                  type="button"
                  onClick={() => setShowTransfersHelp((v) => !v)}
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-surface-600 text-[10px] font-bold text-surface-400 transition-colors hover:border-surface-400 hover:text-surface-200"
                  aria-label="What does this do?"
                  aria-expanded={showTransfersHelp}
                >
                  ?
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIncludeOwnTransfers((v) => !v)}
                role="switch"
                aria-checked={!includeOwnTransfers}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${!includeOwnTransfers ? 'bg-duo-green' : 'bg-surface-700'}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${!includeOwnTransfers ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
            {showTransfersHelp && (
              <p className="border-b border-white/[0.06] bg-surface-950/40 px-4 py-2 text-[11px] leading-snug text-surface-400">
                {includeOwnTransfers
                  ? 'Own-account transfers (e.g. moving money between your cards) are counted in totals, the donut, and monthly bars.'
                  : 'Own-account transfers stay visible in the category list (for drill-down) but are excluded from totals and the donut so spending isn’t double-counted.'}
              </p>
            )}
            <div className="flex items-center justify-between px-4 py-1 text-xs text-surface-500/90">
              <span />
              <span>{spendingTxCount} spending tx</span>
            </div>

            {incomeNum > 0 && (
              <div className="border-t border-dashed border-white/[0.08] px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-surface-400">Free Income</span>
                  <span className={`text-xl font-extrabold tabular-nums ${freeIncome >= 0 ? 'text-duo-green' : 'text-danger'}`}>
                    {fmt(freeIncome)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-950/80 ring-1 ring-white/[0.06]">
                    <motion.div
                      className={`h-full rounded-full ${freeIncome >= 0 ? 'bg-duo-green' : 'bg-danger'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Math.max((totalSpent / incomeNum) * 100, 0), 100)}%` }}
                      transition={{ type: 'spring', stiffness: 60 }}
                    />
                  </div>
                  <span className={`text-xs font-semibold tabular-nums ${freeIncome >= 0 ? 'text-duo-green' : 'text-danger'}`}>
                    {savingsRate >= 0 ? `${savingsRate.toFixed(0)}% saved` : `${Math.abs(savingsRate).toFixed(0)}% over`}
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Pie chart — categories are clickable for drill-down */}
          <SpendingChart
            summary={summary}
            total={totalSpent}
            categoryLookup={categoryLookup}
            onCategoryClick={handleCategoryClick}
            excludeFromPieIds={includeOwnTransfers ? [] : [OWN_TRANSFERS_CATEGORY_ID]}
          />

          {/* Monthly trend */}
          <MonthlyTrend
            data={monthlyTotals}
            selectedMonth={month}
            income={householdIncome}
            subtitle={
              includeOwnTransfers ? undefined : 'Excludes own-account transfers (enable checkbox above to include).'
            }
          />

          {/* Leaderboard */}
          <Leaderboard entries={leaderboard} />
        </>
      )}

      {/* Category drill-down sheet */}
      <AnimatePresence>
        {drillCategory && (
          <CategoryDetail
            category={drillCategory}
            transactions={drillTxns}
            loading={drillLoading}
            onClose={() => setDrillCategory(null)}
            onReclassify={handleReclassify}
            onMarkTransfer={handleMarkTransfer}
            accountAliases={aliasMap}
            categories={catConfig.categories}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
