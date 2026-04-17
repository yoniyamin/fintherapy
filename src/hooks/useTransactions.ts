import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchPendingTransactionsShared } from '../lib/pendingTransactionsCache'
import type { Transaction } from '../types/database'

/** `pending` = normal classify queue; `no-idea` = flagged transactions deck. */
export type ClassifyDeckMode = 'pending' | 'no-idea'

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
  user_note?: string | null
}

export function useTransactions(
  householdId: string | null | undefined,
  deck: ClassifyDeckMode = 'pending',
) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [autoClassified, setAutoClassified] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  /** Avoid full-screen spinner on background refetches (e.g. tab idle / token refresh). */
  const loadedKeyRef = useRef<string | null>(null)

  const fetchPending = useCallback(async () => {
    if (!householdId) {
      setLoading(false)
      loadedKeyRef.current = null
      return
    }
    const key = `${householdId}:${deck}`
    const blocking = loadedKeyRef.current !== key
    if (blocking) setLoading(true)
    try {
      if (deck === 'no-idea') {
        const { data, error } = await supabase.rpc('get_flagged_transactions', {
          p_household_id: householdId,
        })
        if (!error && data) setTransactions(data as Transaction[])
        else setTransactions([])
        setAutoClassified([])
      } else {
        const { pending, autoClassified: auto } = await fetchPendingTransactionsShared(householdId)
        setTransactions(pending)
        setAutoClassified(auto)
      }
      loadedKeyRef.current = key
    } finally {
      setLoading(false)
    }
  }, [householdId, deck])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  const removeTransactions = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    setTransactions((prev) => prev.filter((t) => !idSet.has(t.id)))
    setAutoClassified((prev) => prev.filter((t) => !idSet.has(t.id)))
  }, [])

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

  const setTransactionsUserNote = async (txIds: string[], note: string | null) => {
    if (!householdId) return { error: new Error('No household') }
    if (txIds.length === 0) return { error: null }

    const { error } = await supabase.rpc('set_transactions_user_note', {
      p_household_id: householdId,
      p_tx_ids: txIds,
      p_note: note,
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
    accountLast4s?: string[] | null,
  ): Promise<Transaction[]> => {
    if (!householdId) return []

    const { data, error } = await supabase.rpc('get_transactions_by_category', {
      p_household_id: householdId,
      p_billing_month: billingMonth,
      p_category: category,
      p_account_last4s:
        accountLast4s && accountLast4s.length > 0 ? accountLast4s : null,
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

  const getAccountAliases = useCallback(async (): Promise<{ last4: string; label: string }[]> => {
    if (!householdId) return []
    const { data, error } = await supabase.rpc('get_account_aliases', {
      p_household_id: householdId,
    })
    if (error || !data) return []
    return data as { last4: string; label: string }[]
  }, [householdId])

  const getDistinctAccountLast4ForMonth = useCallback(async (billingMonth: string): Promise<string[]> => {
    if (!householdId) return []
    const { data, error } = await supabase.rpc('get_distinct_account_last4_for_month', {
      p_household_id: householdId,
      p_billing_month: billingMonth,
    })
    if (error || !data) return []
    return (data as { account_last4: string }[]).map((r) => r.account_last4).filter(Boolean)
  }, [householdId])

  /** Every non-null last-4 ever seen in uploads (any billing month). */
  const getDistinctAccountLast4ForHousehold = useCallback(async (): Promise<string[]> => {
    if (!householdId) return []
    const { data, error } = await supabase.rpc('get_distinct_account_last4_for_household', {
      p_household_id: householdId,
    })
    if (error) {
      console.error('get_distinct_account_last4_for_household failed:', error.message)
      return []
    }
    if (!data) return []
    return (data as { account_last4: string }[]).map((r) => r.account_last4).filter(Boolean)
  }, [householdId])

  const upsertAccountAlias = useCallback(async (last4: string, label: string) => {
    if (!householdId) return { error: new Error('No household') }
    return supabase.rpc('upsert_account_alias', {
      p_household_id: householdId,
      p_last4: last4,
      p_label: label,
    })
  }, [householdId])

  const deleteAccountAlias = useCallback(async (last4: string) => {
    if (!householdId) return { error: new Error('No household') }
    return supabase.rpc('delete_account_alias', {
      p_household_id: householdId,
      p_last4: last4,
    })
  }, [householdId])

  return {
    transactions,
    autoClassified,
    loading,
    fetchPending,
    removeTransactions,
    classifyTransaction,
    flagTransaction,
    setTransactionsUserNote,
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
    getAccountAliases,
    getDistinctAccountLast4ForMonth,
    getDistinctAccountLast4ForHousehold,
    upsertAccountAlias,
    deleteAccountAlias,
  }
}
