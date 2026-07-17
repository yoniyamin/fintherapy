import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useCategoryBudgets, type UpsertBudgetParams } from '../../hooks/useCategoryBudgets'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import { useMultiMonthReveal } from '../../hooks/useMultiMonthReveal'
import { useTransactions } from '../../hooks/useTransactions'
import { downloadTransactionsCsv, multiMonthCsvLabel } from '../../lib/exportTransactionsCsv'
import { useUiPrefs } from '../../hooks/useUiPrefs'
import MonthRangePicker, { type MonthSelection } from '../common/MonthRangePicker'
import HeadlineBanner from './HeadlineBanner'
import KpiCards from './KpiCards'
import FixedDiscretionarySplit from './FixedDiscretionarySplit'
import CategoryTrendChart from './CategoryTrendChart'
import DeltaDrivers from './DeltaDrivers'
import MemberSpendingPanel from './MemberSpendingPanel'
import CardCategorySplitPanel from './CardCategorySplitPanel'
import TopVendorsPanel from './TopVendorsPanel'
import RecurringPanel from './RecurringPanel'
import ReportConfigModal from './ReportConfigModal'
import ComparisonTable from './ComparisonTable'
import CalendarHeatmap from './CalendarHeatmap'
import AdvisorNotes from './AdvisorNotes'
import BudgetEditorModal from './BudgetEditorModal'
import BudgetVsActualPanel from './BudgetVsActualPanel'
import SavingsProjectionPanel from './SavingsProjectionPanel'
import VelocityGauge from './VelocityGauge'
import MultiMonthSlideDeckPreview from './MultiMonthSlideDeckPreview'
import { OWN_TRANSFERS_CATEGORY_ID, type CategoryDef } from '../../lib/constants'
import { detectRecurring } from '../../lib/recurringDetector'
import { generateHeadline, getDeltaDrivers, getHealthSummary, getSpendingVelocity, type InsightInput } from '../../lib/advisorInsights'
import type { MultiMonthData } from '../../hooks/useMultiMonthReveal'
import { ui } from '../../lib/uiClasses'
import { supabase } from '../../lib/supabase'
import type { MonthlyTotal } from '../../hooks/useReveal'

function getDefaultSelection(): MonthSelection {
  const now = new Date()
  const months: string[] = []
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return { mode: 'multi', months: months.sort() }
}

export default function AnalysisPage() {
  const { profile } = useAuth()
  const { data, loading, error: analysisError, fetch } = useMultiMonthReveal(profile?.household_id)
  const catConfig = useCategoryConfig(profile?.household_id)
  const [selection, setSelection] = useState<MonthSelection>(getDefaultSelection)
  const [allMonthlyTotals, setAllMonthlyTotals] = useState<MonthlyTotal[]>([])
  const [showSlidePreview, setShowSlidePreview] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState<'mobile' | 'desktop' | null>(null)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [aliasMap, setAliasMap] = useState<Map<string, string>>(new Map())
  const [showReportConfig, setShowReportConfig] = useState(false)
  const { getAccountAliases } = useTransactions(profile?.household_id)
  const budgetHook = useCategoryBudgets(profile?.household_id)
  const { prefs, updatePrefs } = useUiPrefs()

  const categoryLookup = useMemo(() =>
    Object.fromEntries(catConfig.categories.map(c => [c.id, { icon: c.icon, label: c.label, expenseType: c.expenseType }])),
    [catConfig.categories],
  )

  const monthsWithData = useMemo(
    () => allMonthlyTotals.map(t => t.billing_month),
    [allMonthlyTotals],
  )

  useEffect(() => {
    if (!profile?.household_id) return
    supabase.rpc('get_monthly_totals', {
      p_household_id: profile.household_id,
      p_include_own_transfers: false,
    }).then(res => {
      if (!res.error && res.data) {
        setAllMonthlyTotals(res.data as MonthlyTotal[])
      }
    })
  }, [profile?.household_id])

  useEffect(() => {
    if (selection.months.length > 0) {
      fetch(selection.months)
    }
  }, [selection, fetch])

  useEffect(() => {
    if (!profile?.household_id) return
    let cancelled = false
    getAccountAliases().then((aliases) => {
      if (cancelled) return
      setAliasMap(new Map(aliases.map((a) => [a.last4.trim(), a.label.trim()])))
    })
    return () => {
      cancelled = true
    }
  }, [profile?.household_id, getAccountAliases])

  const fetchBudgets = budgetHook.fetch
  useEffect(() => {
    if (profile?.household_id) fetchBudgets()
  }, [profile?.household_id, fetchBudgets])

  const handleRefreshData = useCallback(() => {
    if (selection.months.length > 0) {
      fetch(selection.months)
    }
  }, [selection.months, fetch])

  const handleExportCsv = useCallback(() => {
    if (!data || data.allTransactions.length === 0) return
    setExportingCsv(true)
    try {
      const labelLookup = Object.fromEntries(
        catConfig.categories.map((c) => [c.id, c.label]),
      )
      downloadTransactionsCsv(
        data.allTransactions,
        multiMonthCsvLabel(selection.months),
        labelLookup,
      )
    } finally {
      setExportingCsv(false)
    }
  }, [data, selection.months, catConfig.categories])

  const handleExportSlides = useCallback(async () => {
    if (!data) return
    setDownloading(true)
    try {
      const { generateMultiMonthSlideDeck, downloadBlob } = await import('../../lib/generateSlideDeck')
      const blob = await generateMultiMonthSlideDeck({
        months: selection.months,
        summaryByMonth: data.summaryByMonth,
        aggregatedSummary: data.aggregatedSummary,
        categoryTrend: data.categoryTrend,
        monthlyTotals: data.monthlyTotals,
        income: data.householdIncome,
        transactions: data.allTransactions,
        categoryLookup,
        spendingByAccount: data.spendingByAccount,
      })
      const sorted = [...selection.months].sort()
      downloadBlob(blob, `financial-health-check-${sorted[0]}-to-${sorted[sorted.length - 1]}.pptx`)
    } finally {
      setDownloading(false)
    }
  }, [data, selection.months, categoryLookup])

  const handleExportPdf = useCallback(async (mode: 'mobile' | 'desktop') => {
    if (!data) return
    setExportingPdf(mode)
    try {
      const { exportSummaryPdf } = await import('../../lib/generateDashboardPdf')

      const recurringCharges = detectRecurring(data.allTransactions, selection.months)

      const fixedTotal = data.aggregatedSummary
        .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && categoryLookup[c.category]?.expenseType === 'fixed')
        .reduce((s, c) => s + Number(c.total_amount), 0)
      const discretionaryTotal = data.aggregatedSummary
        .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && categoryLookup[c.category]?.expenseType !== 'fixed')
        .reduce((s, c) => s + Number(c.total_amount), 0)

      const insightInput: InsightInput = {
        months: selection.months,
        summaryByMonth: data.summaryByMonth,
        aggregatedSummary: data.aggregatedSummary,
        categoryTrend: data.categoryTrend,
        monthlyTotals: data.monthlyTotals,
        dailyTotals: data.dailyTotals,
        income: data.householdIncome,
        categoryLookup,
        transactions: data.allTransactions,
        recurringCharges,
        spendingByAccount: data.spendingByAccount,
        fixedTotal,
        discretionaryTotal,
      }
      const headline = generateHeadline(insightInput)

      await exportSummaryPdf(
        {
          months: selection.months,
          summaryByMonth: data.summaryByMonth,
          aggregatedSummary: data.aggregatedSummary,
          categoryTrend: data.categoryTrend,
          monthlyTotals: data.monthlyTotals,
          dailyTotals: data.dailyTotals,
          income: data.householdIncome,
          transactions: data.allTransactions,
          categoryLookup,
          recurringCharges,
          spendingByAccount: data.spendingByAccount,
          cardFunding: data.cardFunding,
          salaryDetected: data.salaryDetected,
          fixedTotal,
          discretionaryTotal,
          headline,
          reportConfig: prefs.analysisReportConfig as Record<string, boolean> | undefined,
          budgets: budgetHook.budgets.map(b => ({ category_id: b.category_id, monthly_target: Number(b.monthly_target), is_discretionary: b.is_discretionary, subject_to_inflation: b.subject_to_inflation })),
          inflationRate: prefs.assumedInflationRate ?? 3,
          savingsGoals: prefs.savingsGoals,
        },
        mode,
      )
    } finally {
      setExportingPdf(null)
    }
  }, [data, selection.months, categoryLookup, prefs, budgetHook.budgets])

  const noData = !loading && (!data || data.monthlyTotals.length === 0)

  return (
    <div className={`${ui.screen} ${ui.page}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className={ui.heroTitle}>Financial Health Check</h1>
        <p className={ui.heroSub}>
          Here's how your household is doing
        </p>
      </motion.div>

      <div className="mt-6">
        <MonthRangePicker
          value={selection}
          onChange={setSelection}
          monthsWithData={monthsWithData}
          allowSingle={true}
        />
      </div>

      {/* Export toolbar */}
      {data && !noData && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowSlidePreview(true)}
            className="flex items-center gap-1.5 rounded-xl border border-purple-400/20 bg-purple-500/5 px-3 py-2 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/10"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Slides
          </button>
          <button
            type="button"
            onClick={() => handleExportPdf('mobile')}
            disabled={!!exportingPdf}
            className="flex items-center gap-1.5 rounded-xl border border-blue-400/20 bg-blue-500/5 px-3 py-2 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/10 disabled:opacity-50"
          >
            {exportingPdf === 'mobile' ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <line x1="12" y1="18" x2="12" y2="18" />
              </svg>
            )}
            Mobile PDF
          </button>
          <button
            type="button"
            onClick={() => handleExportPdf('desktop')}
            disabled={!!exportingPdf}
            className="flex items-center gap-1.5 rounded-xl border border-teal-400/20 bg-teal-500/5 px-3 py-2 text-xs font-medium text-teal-300 transition-colors hover:bg-teal-500/10 disabled:opacity-50"
          >
            {exportingPdf === 'desktop' ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            )}
            Desktop PDF
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-surface-950/55 px-3 py-2 text-xs font-medium text-surface-300 transition-colors hover:bg-surface-900/70 disabled:opacity-50"
          >
            {exportingCsv ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-surface-400 border-t-transparent" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            CSV
          </button>
          <button
            type="button"
            onClick={() => setShowReportConfig(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-surface-950/55 px-3 py-2 text-xs font-medium text-surface-300 transition-colors hover:bg-surface-900/70"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      )}

      {analysisError && (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-flame/20 bg-flame/10 p-4 text-center text-sm font-semibold text-flame">
          {analysisError}
        </div>
      )}

      {loading ? (
        <div className="mt-12 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-duo-green border-t-transparent" />
        </div>
      ) : noData ? (
        <motion.div
          className="mt-8 flex flex-col items-center gap-4 px-4 py-8"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-surface-600/30 bg-surface-900/50">
            <span className="text-4xl">📊</span>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-surface-100">Not enough data yet</p>
            <p className="mt-2 text-sm text-surface-400 leading-relaxed">
              Select months with uploaded and classified transactions to see your analysis.
            </p>
          </div>
        </motion.div>
      ) : data && (
        <AnalysisContent
          data={data}
          months={selection.months}
          categoryLookup={categoryLookup}
          accountAliases={aliasMap}
          categories={catConfig.categories}
          budgets={budgetHook.budgets}
          inflationRate={prefs.assumedInflationRate ?? 3}
          savingsGoals={prefs.savingsGoals ?? []}
          reportConfig={prefs.analysisReportConfig ?? {}}
          onSaveBudgets={async (params) => { for (const p of params) await budgetHook.upsert(p) }}
          onDataChange={handleRefreshData}
        />
      )}

      {/* Slide deck preview overlay */}
      <AnimatePresence>
        {showSlidePreview && data && (
          <MultiMonthSlideDeckPreview
            data={data}
            months={selection.months}
            categoryLookup={categoryLookup}
            onClose={() => setShowSlidePreview(false)}
            onDownload={handleExportSlides}
            downloading={downloading}
          />
        )}
      </AnimatePresence>

      <ReportConfigModal
        open={showReportConfig}
        onClose={() => setShowReportConfig(false)}
        config={prefs.analysisReportConfig ?? {}}
        inflationRate={prefs.assumedInflationRate ?? 3}
        savingsGoals={prefs.savingsGoals ?? []}
        monthCount={selection.months.length}
        onSave={(config, inflRate, goals) => {
          updatePrefs({ analysisReportConfig: config, assumedInflationRate: inflRate, savingsGoals: goals })
        }}
      />
    </div>
  )
}

function AnalysisContent({ data, months, categoryLookup, accountAliases, categories, budgets, inflationRate, savingsGoals, reportConfig, onSaveBudgets, onDataChange }: {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>
  accountAliases: Map<string, string>
  categories: readonly CategoryDef[]
  budgets: import('../../hooks/useCategoryBudgets').CategoryBudget[]
  inflationRate: number
  savingsGoals: import('../../types/database').SavingsGoal[]
  reportConfig: import('../../types/database').AnalysisReportConfig
  onSaveBudgets: (params: UpsertBudgetParams[]) => Promise<void>
  onDataChange: () => void
}) {
  const [showBudgetEditor, setShowBudgetEditor] = useState(false)
  const rc = reportConfig
  const show = (key: keyof typeof rc, minMonths: number) => (rc[key] ?? true) && months.length >= minMonths
  const recurringCharges = useMemo(
    () => detectRecurring(data.allTransactions, months),
    [data.allTransactions, months],
  )

  const { fixedTotal, discretionaryTotal } = useMemo(() => {
    const fixed = data.aggregatedSummary
      .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && categoryLookup[c.category]?.expenseType === 'fixed')
      .reduce((s, c) => s + Number(c.total_amount), 0)
    const discretionary = data.aggregatedSummary
      .filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID && categoryLookup[c.category]?.expenseType !== 'fixed')
      .reduce((s, c) => s + Number(c.total_amount), 0)
    return { fixedTotal: fixed, discretionaryTotal: discretionary }
  }, [data.aggregatedSummary, categoryLookup])

  const insightInput: InsightInput = useMemo(() => ({
    months,
    summaryByMonth: data.summaryByMonth,
    aggregatedSummary: data.aggregatedSummary,
    categoryTrend: data.categoryTrend,
    monthlyTotals: data.monthlyTotals,
    dailyTotals: data.dailyTotals,
    income: data.householdIncome,
    categoryLookup,
    transactions: data.allTransactions,
    recurringCharges,
    spendingByAccount: data.spendingByAccount,
    fixedTotal,
    discretionaryTotal,
  }), [data, months, categoryLookup, recurringCharges, fixedTotal, discretionaryTotal])

  const headline = useMemo(() => generateHeadline(insightInput), [insightInput])
  const healthSummary = useMemo(() => getHealthSummary(insightInput), [insightInput])
  const deltaDrivers = useMemo(() => getDeltaDrivers(insightInput), [insightInput])

  const currentMonth = months.find(m => {
    const now = new Date()
    return m === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const velocity = useMemo(
    () => currentMonth ? getSpendingVelocity(data.dailyTotals, data.householdIncome, currentMonth) : null,
    [data.dailyTotals, data.householdIncome, currentMonth],
  )

  return (
    <div className="mt-4 space-y-5">
      {show('headline', 1) && <HeadlineBanner headline={headline} verdict={healthSummary.verdict} />}

      {show('kpiCards', 1) && <KpiCards data={data} months={months} categoryLookup={categoryLookup} />}

      {show('fixedDiscretionary', 1) && (
        <FixedDiscretionarySplit
          fixedTotal={fixedTotal}
          discretionaryTotal={discretionaryTotal}
          months={months.length}
          income={data.householdIncome}
        />
      )}

      {show('categoryTrend', 2) && <CategoryTrendChart data={data} months={months} categoryLookup={categoryLookup} />}

      {show('deltaDrivers', 2) && <DeltaDrivers drivers={deltaDrivers} />}

      {show('memberSpending', 1) && <MemberSpendingPanel spendingByAccount={data.spendingByAccount} months={months.length} />}

      {show('topVendors', 3) && <TopVendorsPanel transactions={data.allTransactions} months={months.length} categoryLookup={categoryLookup} accountAliases={accountAliases} />}

      {show('cardCategorySplit', 3) && <CardCategorySplitPanel transactions={data.allTransactions} months={months.length} categoryLookup={categoryLookup} accountAliases={accountAliases} />}

      {show('budgetVsActual', 3) && (
        <BudgetVsActualPanel
          budgets={budgets}
          summaryByMonth={data.summaryByMonth}
          months={months}
          income={data.householdIncome}
          categoryLookup={categoryLookup}
          onEditBudgets={() => setShowBudgetEditor(true)}
        />
      )}

      {show('savingsProjection', 3) && (
        <SavingsProjectionPanel
          income={data.householdIncome}
          budgets={budgets}
          inflationRate={inflationRate}
          savingsGoals={savingsGoals}
          months={months.length}
        />
      )}

      {show('recurring', 1) && <RecurringPanel charges={recurringCharges} months={months.length} />}

      {show('comparisonTable', 2) && (
        <ComparisonTable
          data={data}
          months={months}
          categoryLookup={categoryLookup}
          accountAliases={accountAliases}
          categories={categories}
          onDataChange={onDataChange}
        />
      )}

      {show('calendarHeatmap', 2) && <CalendarHeatmap dailyTotals={data.dailyTotals} months={months} />}

      {show('advisorNotes', 1) && <AdvisorNotes data={data} months={months} categoryLookup={categoryLookup} />}

      {show('velocityGauge', 1) && <VelocityGauge velocity={velocity} />}

      <BudgetEditorModal
        open={showBudgetEditor}
        onClose={() => setShowBudgetEditor(false)}
        budgets={budgets}
        summaryByMonth={data.summaryByMonth}
        months={months}
        income={data.householdIncome}
        categoryLookup={categoryLookup}
        onSave={onSaveBudgets}
      />
    </div>
  )
}
