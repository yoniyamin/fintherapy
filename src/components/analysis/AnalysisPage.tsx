import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { type UpsertBudgetParams } from '../../hooks/useCategoryBudgets'
import { useTrackVisibleAnalysisSection } from '../../hooks/useSessionStats'
import MonthRangePicker from '../common/MonthRangePicker'
import AdvisorNotes from './AdvisorNotes'
import BudgetEditorModal from './BudgetEditorModal'
import BudgetVsActualPanel from './BudgetVsActualPanel'
import CalendarHeatmap from './CalendarHeatmap'
import CardCategorySplitPanel from './CardCategorySplitPanel'
import CategoryTrendChart from './CategoryTrendChart'
import ComparisonTable from './ComparisonTable'
import DeltaDrivers from './DeltaDrivers'
import FixedDiscretionarySplit from './FixedDiscretionarySplit'
import HeadlineBanner from './HeadlineBanner'
import KpiCards from './KpiCards'
import MemberSpendingPanel from './MemberSpendingPanel'
import MonthlySummaryTable from './MonthlySummaryTable'
import MultiMonthSlideDeckPreview from './MultiMonthSlideDeckPreview'
import RecurringPanel from './RecurringPanel'
import ReportConfigModal from './ReportConfigModal'
import SavingsProjectionPanel from './SavingsProjectionPanel'
import TopVendorsPanel from './TopVendorsPanel'
import { useAnalysisData } from './useAnalysisData'
import VelocityGauge from './VelocityGauge'
import { OWN_TRANSFERS_CATEGORY_ID, type CategoryDef } from '../../lib/constants'
import { detectRecurring } from '../../lib/recurringDetector'
import { generateHeadline, getDeltaDrivers, getHealthSummary, getSpendingVelocity, type InsightInput } from '../../lib/advisorInsights'
import type { MultiMonthData } from '../../hooks/useMultiMonthReveal'
import { ui } from '../../lib/uiClasses'
import { SkeletonCard } from '../common/Skeleton'

export default function AnalysisPage() {
  const {
    data,
    loading,
    analysisError,
    catConfig,
    selection,
    setSelection,
    monthsWithData,
    aliasMap,
    categoryLookup,
    budgetHook,
    prefs,
    updatePrefs,
    noData,
    showSlidePreview,
    setShowSlidePreview,
    downloading,
    exportingPdf,
    exportingCsv,
    showReportConfig,
    setShowReportConfig,
    handleRefreshData,
    handleExportCsv,
    handleExportSlides,
    handleExportPdf,
    saveIncome,
  } = useAnalysisData()

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
        <div className="mt-6 space-y-3">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={5} />
          <SkeletonCard rows={3} />
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
          <Link
            to="/upload"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-duo-green/15 px-4 py-2.5 text-sm font-semibold text-duo-green transition-colors hover:bg-duo-green/25"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload a statement
          </Link>
        </motion.div>
      ) : data && (
        <AnalysisContent
          data={data}
          months={selection.months}
          categoryLookup={categoryLookup}
          accountAliases={aliasMap}
          categories={catConfig.categories}
          budgets={budgetHook.budgets}
          inflationRate={prefs.assumedInflationRate ?? 3.2}
          reportConfig={prefs.analysisReportConfig ?? {}}
          onSaveBudgets={async (upserts, deleteIds) => {
            for (const p of upserts) await budgetHook.upsert(p)
            for (const id of deleteIds) await budgetHook.remove(id)
          }}
          onSaveIncome={saveIncome}
          budgetSettings={budgetHook.settings}
          changeLog={budgetHook.changeLog}
          onSaveSettings={budgetHook.upsertSettings}
          onLogChange={budgetHook.logChange}
          onUpdateScenarioCategories={budgetHook.updateScenarioCategories}
          onDataChange={handleRefreshData}
          savedProjection={prefs.savedProjection}
          onSaveProjection={proj => {
            const old = prefs.savedProjection
            const history = prefs.savedProjectionHistory ?? []
            const nextHistory = old ? [...history, old] : history
            updatePrefs({ savedProjection: proj, savedProjectionHistory: nextHistory })
          }}
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
        inflationRate={prefs.assumedInflationRate ?? 3.2}
        monthCount={selection.months.length}
        onSave={(config, inflRate) => {
          updatePrefs({ analysisReportConfig: config, assumedInflationRate: inflRate })
        }}
      />
    </div>
  )
}

function AnalysisContent({ data, months, categoryLookup, accountAliases, categories, budgets, inflationRate, reportConfig, onSaveBudgets, onSaveIncome, budgetSettings, changeLog, onSaveSettings, onLogChange, onUpdateScenarioCategories, onDataChange, savedProjection, onSaveProjection }: {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>
  accountAliases: Map<string, string>
  categories: readonly CategoryDef[]
  budgets: import('../../hooks/useCategoryBudgets').CategoryBudget[]
  inflationRate: number
  reportConfig: import('../../types/database').AnalysisReportConfig
  onSaveBudgets: (upserts: UpsertBudgetParams[], deleteIds: string[]) => Promise<void>
  onSaveIncome: (income: number) => Promise<void>
  budgetSettings: import('../../hooks/useCategoryBudgets').BudgetSettings | null
  changeLog: import('../../hooks/useCategoryBudgets').BudgetChangeLogEntry[]
  onSaveSettings: (target: number) => Promise<void>
  onLogChange: (action: 'save' | 'reset_medians', summary: string, snapshot: import('../../hooks/useCategoryBudgets').BudgetSnapshot) => Promise<void>
  onUpdateScenarioCategories: (ids: string[]) => Promise<void>
  onDataChange: () => void
  savedProjection?: import('../../types/database').SavedProjection
  onSaveProjection: (proj: import('../../types/database').SavedProjection) => void
}) {
  const [showBudgetEditor, setShowBudgetEditor] = useState(false)
  useTrackVisibleAnalysisSection(true)
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
      {/* 1. Overview */}
      {(show('headline', 1) || show('kpiCards', 1) || show('fixedDiscretionary', 1)) && (
        <div className="space-y-5" data-analysis-section="overview">
          {show('headline', 1) && <HeadlineBanner headline={headline} verdict={healthSummary.verdict} />}
          {show('kpiCards', 1) && <KpiCards data={data} months={months} categoryLookup={categoryLookup} />}
          {months.length >= 1 && (
            <MonthlySummaryTable
              monthlyTotals={data.monthlyTotals}
              months={months}
              income={data.householdIncome}
              summaryByMonth={data.summaryByMonth}
              categoryLookup={categoryLookup}
            />
          )}
          {show('fixedDiscretionary', 1) && (
            <FixedDiscretionarySplit
              fixedTotal={fixedTotal}
              discretionaryTotal={discretionaryTotal}
              months={months.length}
              income={data.householdIncome}
            />
          )}
        </div>
      )}

      {/* 2. Trends — category trend chart + month-over-month comparison */}
      {(show('categoryTrend', 2) || show('comparisonTable', 2)) && (
        <div className="space-y-5" data-analysis-section="trends">
          {show('categoryTrend', 2) && <CategoryTrendChart data={data} months={months} categoryLookup={categoryLookup} />}
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
        </div>
      )}

      {/* 3. Advisor — surfaced early for critical/actionable insights */}
      {show('advisorNotes', 1) && (
        <div data-analysis-section="advisor">
          <AdvisorNotes data={data} months={months} categoryLookup={categoryLookup} />
        </div>
      )}

      {/* 4. Breakdown */}
      {(show('deltaDrivers', 2) || show('memberSpending', 1)) && (
        <div className="space-y-5" data-analysis-section="breakdown">
          {show('deltaDrivers', 2) && <DeltaDrivers drivers={deltaDrivers} />}
          {show('memberSpending', 1) && <MemberSpendingPanel spendingByAccount={data.spendingByAccount} months={months.length} />}
        </div>
      )}

      {/* 5. Calendar */}
      {show('calendarHeatmap', 2) && (
        <div data-analysis-section="calendar">
          <CalendarHeatmap dailyTotals={data.dailyTotals} months={months} />
        </div>
      )}

      {/* 6. Details */}
      {show('topVendors', 3) && (
        <div data-analysis-section="details">
          <TopVendorsPanel transactions={data.allTransactions} months={months.length} categoryLookup={categoryLookup} accountAliases={accountAliases} />
        </div>
      )}

      {show('cardCategorySplit', 3) && (
        <div data-analysis-section="details">
          <CardCategorySplitPanel transactions={data.allTransactions} months={months.length} categoryLookup={categoryLookup} accountAliases={accountAliases} />
        </div>
      )}

      {/* 7. Recurring */}
      {show('recurring', 1) && (
        <div data-analysis-section="recurring">
          <RecurringPanel charges={recurringCharges} months={months.length} />
        </div>
      )}

      {/* 8. Projections */}
      {show('savingsProjection', 3) && (
        <div data-analysis-section="projections">
          <SavingsProjectionPanel
            income={data.householdIncome}
            budgets={budgets}
            summaryByMonth={data.summaryByMonth}
            months={months}
            inflationRate={inflationRate}
            categoryLookup={categoryLookup}
            spendingCap={budgetSettings?.monthly_spending_target}
            scenarioCategoryIds={budgetSettings?.scenario_category_ids}
            onUpdateScenarioCategories={onUpdateScenarioCategories}
            onEditBudgets={() => setShowBudgetEditor(true)}
            savedProjection={savedProjection}
            onSaveProjection={onSaveProjection}
          />
        </div>
      )}

      {show('budgetVsActual', 3) && (
        <div data-analysis-section="projections">
          <BudgetVsActualPanel
            budgets={budgets}
            summaryByMonth={data.summaryByMonth}
            months={months}
            income={data.householdIncome}
            categoryLookup={categoryLookup}
            onEditBudgets={() => setShowBudgetEditor(true)}
          />
        </div>
      )}

      {show('velocityGauge', 1) && (
        <div data-analysis-section="projections">
          <VelocityGauge velocity={velocity} />
        </div>
      )}

      <BudgetEditorModal
        open={showBudgetEditor}
        onClose={() => setShowBudgetEditor(false)}
        budgets={budgets}
        summaryByMonth={data.summaryByMonth}
        months={months}
        income={data.householdIncome}
        categoryLookup={categoryLookup}
        inflationRate={inflationRate}
        onSave={onSaveBudgets}
        onSaveIncome={onSaveIncome}
        budgetSettings={budgetSettings}
        changeLog={changeLog}
        onSaveSettings={onSaveSettings}
        onLogChange={onLogChange}
      />
    </div>
  )
}
