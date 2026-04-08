import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Transaction } from '../types/database'

export interface MonthStats {
  total_count: number
  classified_count: number
  pending_count: number
  transfer_count: number
  offset_count: number
  flagged_count: number
}

export interface DailyCount {
  user_id: string
  display_name: string
  classified_today: number
}

export interface DailyActivity {
  user_id: string
  display_name: string
  classified_today: number
  uploads_today: number
  bets_placed_today: number
}

export interface HomeLeaderboardEntry {
  user_id: string
  display_name: string
  avatar_url: string | null
  total_xp: number
  classified_count: number
}

export interface ExportRow {
  tx_date: string
  merchant_raw: string
  merchant_clean: string | null
  amount: number
  category: string
  status: string
  billing_month: string
  account_last4: string | null
}

export function useTransactions(householdId: string | null | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [autoClassified, setAutoClassified] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPending = useCallback(async () => {
    if (!householdId) {
      setLoading(false)
      return
    }
    setLoading(true)

    const [pendingRes, autoRes] = await Promise.all([
      supabase.rpc('get_pending_transactions', { p_household_id: householdId }),
      supabase.rpc('get_auto_classified_transactions', { p_household_id: householdId }),
    ])

    if (!pendingRes.error && pendingRes.data) {
      setTransactions(pendingRes.data as Transaction[])
    }
    if (!autoRes.error && autoRes.data) {
      setAutoClassified(autoRes.data as Transaction[])
    }
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  const classifyTransaction = async (
    txId: string,
    category: string,
    userId: string,
  ) => {
    if (!householdId) return { error: new Error('No household') }

    const { error } = await supabase.rpc('classify_transaction', {
      p_household_id: householdId,
      p_tx_id: txId,
      p_category: category,
      p_classified_by: userId,
    })

    return { error }
  }

  const flagTransaction = async (txId: string) => {
    if (!householdId) return { error: new Error('No household') }

    const { error } = await supabase.rpc('flag_transaction', {
      p_household_id: householdId,
      p_tx_id: txId,
    })

    return { error }
  }

  const markTransfer = async (txId: string, userId: string) => {
    if (!householdId) return { error: new Error('No household') }

    const { error } = await supabase.rpc('mark_as_transfer', {
      p_household_id: householdId,
      p_tx_id: txId,
      p_classified_by: userId,
    })

    return { error }
  }

  const detectRefunds = useCallback(async () => {
    if (!householdId) return 0

    const { data, error } = await supabase.rpc('detect_and_offset_refunds', {
      p_household_id: householdId,
    })

    if (error) {
      console.warn('detect_and_offset_refunds failed:', error.message)
      return 0
    }
    return (data as number) ?? 0
  }, [householdId])

  const awardXp = async (userId: string, xp: number) => {
    const { error } = await supabase.rpc('award_xp', {
      p_user_id: userId,
      p_xp: xp,
    })
    return { error }
  }

  const getMonthStats = useCallback(async (billingMonth: string): Promise<MonthStats | null> => {
    if (!householdId) return null

    const { data, error } = await supabase.rpc('get_month_classification_stats', {
      p_household_id: householdId,
      p_billing_month: billingMonth,
    })

    if (error || !data) return null
    const rows = data as MonthStats[]
    return rows[0] ?? null
  }, [householdId])

  const getDailyCounts = useCallback(async (): Promise<DailyCount[]> => {
    if (!householdId) return []

    const { data, error } = await supabase.rpc('get_daily_classification_counts', {
      p_household_id: householdId,
    })

    if (error || !data) return []
    return data as DailyCount[]
  }, [householdId])

  const getTransactionsByCategory = useCallback(async (
    billingMonth: string,
    category: string,
  ): Promise<Transaction[]> => {
    if (!householdId) return []

    const { data, error } = await supabase.rpc('get_transactions_by_category', {
      p_household_id: householdId,
      p_billing_month: billingMonth,
      p_category: category,
    })

    if (error || !data) return []
    return data as Transaction[]
  }, [householdId])

  const reclassifyTransaction = async (
    txId: string,
    newCategory: string,
    userId: string,
  ) => {
    if (!householdId) return { error: new Error('No household') }

    const { error } = await supabase.rpc('reclassify_transaction', {
      p_household_id: householdId,
      p_tx_id: txId,
      p_new_category: newCategory,
      p_classified_by: userId,
    })

    return { error }
  }

  const getExportData = useCallback(async (billingMonth: string): Promise<ExportRow[]> => {
    if (!householdId) return []

    const { data, error } = await supabase.rpc('get_classified_transactions_export', {
      p_household_id: householdId,
      p_billing_month: billingMonth,
    })

    if (error || !data) return []
    return data as ExportRow[]
  }, [householdId])

  const getDailyActivity = useCallback(async (): Promise<DailyActivity[]> => {
    if (!householdId) return []

    const { data, error } = await supabase.rpc('get_daily_activity_summary', {
      p_household_id: householdId,
    })

    if (error || !data) return []
    return data as DailyActivity[]
  }, [householdId])

  const getLeaderboard = useCallback(async (): Promise<HomeLeaderboardEntry[]> => {
    if (!householdId) return []

    const { data, error } = await supabase.rpc('get_household_leaderboard', {
      p_household_id: householdId,
    })

    if (error || !data) return []
    return data as HomeLeaderboardEntry[]
  }, [householdId])

  const getHouseholdInfo = useCallback(async () => {
    if (!householdId) return null

    const { data, error } = await supabase.rpc('get_household_info', {
      p_household_id: householdId,
    })

    if (error || !data) return null
    const rows = data as { id: string; name: string; invite_code: string }[]
    return rows[0] ?? null
  }, [householdId])

  return {
    transactions,
    autoClassified,
    loading,
    fetchPending,
    classifyTransaction,
    flagTransaction,
    markTransfer,
    detectRefunds,
    awardXp,
    getMonthStats,
    getDailyCounts,
    getDailyActivity,
    getTransactionsByCategory,
    reclassifyTransaction,
    getExportData,
    getHouseholdInfo,
    getLeaderboard,
  }
}
