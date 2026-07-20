import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCategoryBudgets } from '../../hooks/useCategoryBudgets'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import { useMultiMonthReveal } from '../../hooks/useMultiMonthReveal'
import { useTransactions } from '../../hooks/useTransactions'
import { useUiPrefs } from '../../hooks/useUiPrefs'
import { generateHeadline, type InsightInput } from '../../lib/advisorInsights'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import { downloadTransactionsCsv, multiMonthCsvLabel } from '../../lib/exportTransactionsCsv'
import { detectRecurring } from '../../lib/recurringDetector'
import { supabase } from '../../lib/supabase'
import type { MonthSelection } from '../common/MonthRangePicker'
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

/**
 * Shared data-fetching and computation for Analysis.
 * Used by both AnalysisPage (mobile) and AnalysisDesktopPage.
 */
export function useAnalysisData() {
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
    Object.fromEntries(catConfig.categories.map(c => [c.id, {
      icon: c.icon, label: c.label, expenseType: c.expenseType,
      spendingFrequency: c.spendingFrequency, parentCategoryId: c.parentCategoryId,
    }])),
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

  return {
    profile,
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
  }
}
