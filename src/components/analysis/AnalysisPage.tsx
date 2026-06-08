import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useMultiMonthReveal } from '../../hooks/useMultiMonthReveal'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import MonthRangePicker, { type MonthSelection } from '../common/MonthRangePicker'
import HeadlineBanner from './HeadlineBanner'
import KpiCards from './KpiCards'
import FixedDiscretionarySplit from './FixedDiscretionarySplit'
import CategoryTrendChart from './CategoryTrendChart'
import DeltaDrivers from './DeltaDrivers'
import MemberSpendingPanel from './MemberSpendingPanel'
import RecurringPanel from './RecurringPanel'
import ComparisonTable from './ComparisonTable'
import CalendarHeatmap from './CalendarHeatmap'
import AdvisorNotes from './AdvisorNotes'
import VelocityGauge from './VelocityGauge'
import MultiMonthSlideDeckPreview from './MultiMonthSlideDeckPreview'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import { detectRecurring } from '../../lib/recurringDetector'
import { generateHeadline, getDeltaDrivers, getHealthSummary, getSpendingVelocity, type InsightInput } from '../../lib/advisorInsights'
import type { MultiMonthData } from '../../hooks/useMultiMonthReveal'
import { ui } from '../../lib/uiClasses'
import { supabase } from '../../lib/supabase'
import type { MonthlyTotal } from '../../hooks/useReveal'

function getDefaultSelection(): MonthSelection {
  const now = new Date()
  const months: string[] = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return { mode: 'multi', months: months.sort() }
}

export default function AnalysisPage() {
  const { profile } = useAuth()
  const { data, loading, fetch } = useMultiMonthReveal(profile?.household_id)
  const catConfig = useCategoryConfig(profile?.household_id)
  const [selection, setSelection] = useState<MonthSelection>(getDefaultSelection)
  const [allMonthlyTotals, setAllMonthlyTotals] = useState<MonthlyTotal[]>([])
  const [showSlidePreview, setShowSlidePreview] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState<'mobile' | 'desktop' | null>(null)

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
        },
        mode,
      )
    } finally {
      setExportingPdf(null)
    }
  }, [data, selection.months, categoryLookup])

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
    </div>
  )
}

function AnalysisContent({ data, months, categoryLookup }: {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>
}) {
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
      <HeadlineBanner headline={headline} verdict={healthSummary.verdict} />

      <KpiCards data={data} months={months} categoryLookup={categoryLookup} />

      <FixedDiscretionarySplit
        fixedTotal={fixedTotal}
        discretionaryTotal={discretionaryTotal}
        months={months.length}
        income={data.householdIncome}
      />

      <CategoryTrendChart data={data} months={months} categoryLookup={categoryLookup} />

      <DeltaDrivers drivers={deltaDrivers} />

      <MemberSpendingPanel spendingByAccount={data.spendingByAccount} months={months.length} />

      <RecurringPanel charges={recurringCharges} months={months.length} />

      <ComparisonTable data={data} months={months} categoryLookup={categoryLookup} />

      <CalendarHeatmap dailyTotals={data.dailyTotals} months={months} />

      <AdvisorNotes data={data} months={months} categoryLookup={categoryLookup} />

      <VelocityGauge velocity={velocity} />
    </div>
  )
}
