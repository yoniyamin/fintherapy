import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface CategorySummary {
  category: string
  total_amount: number
  tx_count: number
}

export interface LeaderboardEntry {
  user_id: string
  display_name: string
  avatar_url: string | null
  total_xp: number
  classified_count: number
}

export interface MonthlyTotal {
  billing_month: string
  total_amount: number
  tx_count: number
}

export function useReveal(householdId: string | null | undefined) {
  const [summary, setSummary] = useState<CategorySummary[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([])
  const [householdIncome, setHouseholdIncome] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchSummary = useCallback(async (
    billingMonth: string,
    accountLast4s?: string[] | null,
    includeOwnTransfersInTrend = false,
  ) => {
    if (!householdId) return
    setLoading(true)

    // Always pass p_account_last4s (null = no filter) so PostgREST targets the 3-arg function.
    // If both 2-arg and 3-arg overloads exist in Postgres, omitting the 3rd arg causes
    // "Could not choose the best candidate function" — fixed by migration_010_drop_duplicate_rpc_signatures.sql.
    const [sumRes, lbRes, totalsRes, incomeRes] = await Promise.all([
      supabase.rpc('get_monthly_summary', {
        p_household_id: householdId,
        p_billing_month: billingMonth,
        p_account_last4s:
          accountLast4s && accountLast4s.length > 0 ? accountLast4s : null,
      }),
      supabase.rpc('get_household_leaderboard', {
        p_household_id: householdId,
      }),
      supabase.rpc('get_monthly_totals', {
        p_household_id: householdId,
        p_include_own_transfers: includeOwnTransfersInTrend,
      }),
      supabase.rpc('get_household_income', {
        p_household_id: householdId,
      }),
    ])

    if (sumRes.error) {
      console.error('get_monthly_summary failed:', sumRes.error.message)
    }
    if (!sumRes.error && sumRes.data) {
      setSummary(sumRes.data as CategorySummary[])
    }
    if (!lbRes.error && lbRes.data) {
      setLeaderboard(lbRes.data as LeaderboardEntry[])
    }
    if (!totalsRes.error && totalsRes.data) {
      setMonthlyTotals(totalsRes.data as MonthlyTotal[])
    }
    if (!incomeRes.error && incomeRes.data !== null) {
      setHouseholdIncome(incomeRes.data as number | null)
    }
    setLoading(false)
  }, [householdId])

  const setIncome = useCallback(async (income: number) => {
    if (!householdId) return
    const { error } = await supabase.rpc('set_household_income', {
      p_household_id: householdId,
      p_income: income,
    })
    if (!error) {
      setHouseholdIncome(income)
    }
  }, [householdId])

  return { summary, leaderboard, monthlyTotals, householdIncome, loading, fetchSummary, setIncome }
}
