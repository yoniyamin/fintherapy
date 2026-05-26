import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { CategorySummary, MonthlyTotal } from './useReveal'
import type { ExportRow } from './useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID } from '../lib/constants'

export interface DailyTotal {
  date: string
  amount: number
  count: number
}

export interface CategoryTrendPoint {
  month: string
  category: string
  amount: number
  count: number
}

export interface MultiMonthData {
  summaryByMonth: Map<string, CategorySummary[]>
  aggregatedSummary: CategorySummary[]
  categoryTrend: CategoryTrendPoint[]
  monthlyTotals: MonthlyTotal[]
  dailyTotals: DailyTotal[]
  allTransactions: ExportRow[]
  householdIncome: number | null
}

export function useMultiMonthReveal(householdId: string | null | undefined) {
  const [data, setData] = useState<MultiMonthData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(0)

  const fetch = useCallback(async (
    months: string[],
    accountLast4s?: string[] | null,
    includeOwnTransfers = false,
  ) => {
    if (!householdId || months.length === 0) return

    const ticket = ++abortRef.current
    setLoading(true)
    setError(null)

    try {
      const acctFilter = accountLast4s && accountLast4s.length > 0 ? accountLast4s : null

      const [summaryResults, totalsRes, incomeRes, exportResults] = await Promise.all([
        Promise.all(
          months.map(m =>
            supabase.rpc('get_monthly_summary', {
              p_household_id: householdId,
              p_billing_month: m,
              p_account_last4s: acctFilter,
            }).then(res => ({ month: m, data: res.data as CategorySummary[] | null, error: res.error }))
          )
        ),
        supabase.rpc('get_monthly_totals', {
          p_household_id: householdId,
          p_include_own_transfers: includeOwnTransfers,
        }),
        supabase.rpc('get_household_income', {
          p_household_id: householdId,
        }),
        Promise.all(
          months.map(m =>
            supabase.rpc('get_classified_transactions_export', {
              p_household_id: householdId,
              p_billing_month: m,
            }).then(res => ({ month: m, data: res.data as ExportRow[] | null, error: res.error }))
          )
        ),
      ])

      if (ticket !== abortRef.current) return

      const summaryByMonth = new Map<string, CategorySummary[]>()
      for (const r of summaryResults) {
        if (!r.error && r.data) {
          summaryByMonth.set(r.month, r.data)
        }
      }

      const aggregatedSummary = aggregateCategories(summaryByMonth, includeOwnTransfers)

      const categoryTrend = buildCategoryTrend(summaryByMonth, includeOwnTransfers)

      const selectedSet = new Set(months)
      const monthlyTotals: MonthlyTotal[] = (totalsRes.data as MonthlyTotal[] ?? [])
        .filter(t => selectedSet.has(t.billing_month))

      const allTransactions: ExportRow[] = []
      for (const r of exportResults) {
        if (!r.error && r.data) {
          allTransactions.push(...r.data)
        }
      }

      const dailyTotals = buildDailyTotals(allTransactions, includeOwnTransfers)

      const householdIncome = (incomeRes.data as number | null) ?? null

      setData({
        summaryByMonth,
        aggregatedSummary,
        categoryTrend,
        monthlyTotals,
        dailyTotals,
        allTransactions,
        householdIncome,
      })
    } catch (e) {
      if (ticket === abortRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load analysis data')
      }
    } finally {
      if (ticket === abortRef.current) {
        setLoading(false)
      }
    }
  }, [householdId])

  return { data, loading, error, fetch }
}

function aggregateCategories(
  byMonth: Map<string, CategorySummary[]>,
  includeOwnTransfers: boolean,
): CategorySummary[] {
  const agg = new Map<string, { total_amount: number; tx_count: number }>()

  for (const summaries of byMonth.values()) {
    for (const s of summaries) {
      if (!includeOwnTransfers && s.category === OWN_TRANSFERS_CATEGORY_ID) continue
      const existing = agg.get(s.category)
      if (existing) {
        existing.total_amount += Number(s.total_amount)
        existing.tx_count += Number(s.tx_count)
      } else {
        agg.set(s.category, {
          total_amount: Number(s.total_amount),
          tx_count: Number(s.tx_count),
        })
      }
    }
  }

  return Array.from(agg.entries())
    .map(([category, vals]) => ({
      category,
      total_amount: vals.total_amount,
      tx_count: vals.tx_count,
    }))
    .sort((a, b) => b.total_amount - a.total_amount)
}

function buildCategoryTrend(
  byMonth: Map<string, CategorySummary[]>,
  includeOwnTransfers: boolean,
): CategoryTrendPoint[] {
  const points: CategoryTrendPoint[] = []

  const sortedMonths = Array.from(byMonth.keys()).sort()
  for (const month of sortedMonths) {
    const summaries = byMonth.get(month) ?? []
    for (const s of summaries) {
      if (!includeOwnTransfers && s.category === OWN_TRANSFERS_CATEGORY_ID) continue
      points.push({
        month,
        category: s.category,
        amount: Number(s.total_amount),
        count: Number(s.tx_count),
      })
    }
  }

  return points
}

export function buildDailyTotals(
  transactions: ExportRow[],
  includeOwnTransfers: boolean,
): DailyTotal[] {
  const map = new Map<string, { amount: number; count: number }>()

  for (const tx of transactions) {
    if (!includeOwnTransfers && (tx.category === OWN_TRANSFERS_CATEGORY_ID || tx.status === 'transfer' || tx.status === 'offset')) continue
    const d = tx.tx_date
    const existing = map.get(d)
    if (existing) {
      existing.amount += Number(tx.amount)
      existing.count += 1
    } else {
      map.set(d, { amount: Number(tx.amount), count: 1 })
    }
  }

  return Array.from(map.entries())
    .map(([date, vals]) => ({ date, amount: vals.amount, count: vals.count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
