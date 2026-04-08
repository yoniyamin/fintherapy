import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useReveal } from '../../hooks/useReveal'
import { useTransactions, type ExportRow } from '../../hooks/useTransactions'
import SpendingChart from './SpendingChart'
import MonthlyTrend from './MonthlyTrend'
import Leaderboard from './Leaderboard'
import CategoryDetail from './CategoryDetail'
import { CATEGORIES } from '../../lib/constants'
import type { Transaction } from '../../types/database'
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

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(v)

function downloadCSV(rows: ExportRow[], month: string) {
  const headers = ['Date', 'Merchant', 'Merchant (Clean)', 'Amount', 'Category', 'Status', 'Month', 'Account Last 4']
  const catLookup = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]))
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
  const { profile, user } = useAuth()
  const {
    summary, leaderboard, monthlyTotals, householdIncome,
    loading, fetchSummary, setIncome,
  } = useReveal(profile?.household_id)
  const { getTransactionsByCategory, reclassifyTransaction, markTransfer, getExportData } =
    useTransactions(profile?.household_id)
  const [month, setMonth] = useState(getCurrentMonth())
  const [incomeInput, setIncomeInput] = useState('')
  const [editingIncome, setEditingIncome] = useState(false)
  const incomeRef = useRef<HTMLInputElement>(null)
  const monthOptions = getMonthOptions()

  // Drill-down state
  const [drillCategory, setDrillCategory] = useState<string | null>(null)
  const [drillTxns, setDrillTxns] = useState<Transaction[]>([])
  const [drillLoading, setDrillLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchSummary(month)
  }, [month, fetchSummary])

  useEffect(() => {
    if (householdIncome !== null) {
      setIncomeInput(String(householdIncome))
    }
  }, [householdIncome])

  const totalSpent = summary.reduce((sum, s) => sum + Number(s.total_amount), 0)
  const incomeNum = Number(incomeInput) || 0
  const freeIncome = incomeNum - totalSpent
  const savingsRate = incomeNum > 0 ? (freeIncome / incomeNum) * 100 : 0

  const categoryLookup = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

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

  const handleCategoryClick = useCallback(async (categoryId: string) => {
    setDrillCategory(categoryId)
    setDrillLoading(true)
    const txns = await getTransactionsByCategory(month, categoryId)
    setDrillTxns(txns)
    setDrillLoading(false)
  }, [month, getTransactionsByCategory])

  const handleReclassify = useCallback(async (txId: string, newCategory: string) => {
    if (!user) return
    await reclassifyTransaction(txId, newCategory, user.id)
    setDrillTxns(prev => prev.filter(t => t.id !== txId))
    fetchSummary(month)
  }, [user, reclassifyTransaction, fetchSummary, month])

  const handleMarkTransfer = useCallback(async (txId: string) => {
    if (!user) return
    await markTransfer(txId, user.id)
    setDrillTxns(prev => prev.filter(t => t.id !== txId))
    fetchSummary(month)
  }, [user, markTransfer, fetchSummary, month])

  const handleExport = async () => {
    setExporting(true)
    const rows = await getExportData(month)
    if (rows.length > 0) {
      downloadCSV(rows, month)
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
              <span className="text-sm text-surface-400">Total Spent</span>
              <span className="text-sm font-bold tabular-nums text-primary-400">{fmt(totalSpent)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-1 text-xs text-surface-500/90">
              <span />
              <span>{summary.reduce((s, c) => s + Number(c.tx_count), 0)} transactions</span>
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
          />

          {/* Monthly trend */}
          <MonthlyTrend data={monthlyTotals} selectedMonth={month} income={householdIncome} />

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
          />
        )}
      </AnimatePresence>
    </div>
  )
}
