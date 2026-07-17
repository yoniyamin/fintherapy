import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchPendingTransactionsShared,
  invalidatePendingTransactionsInflight,
} from '../lib/pendingTransactionsCache'
import type { AccountType, Transaction } from '../types/database'

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

/** Per household member: how many txs they classified on a given card (last4). */
export interface AccountClassifiedBreakdownRow {
  user_id: string
  display_name: string
  classified_count: number
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

/** Peak single-day activity per household member (all-time). */
export interface MemberDailyRecord {
  user_id: string
  display_name: string
  peak_classified: number
  peak_classified_date: string | null
  peak_uploads: number
  peak_uploads_date: string | null
  peak_bets: number
  peak_bets_date: string | null
}

export interface ExportRow {
  tx_date: string
  merchant_raw: string
  merchant_clean: string | null
  amount: number
  normalized_amount: number
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

  const fetchPending = useCallback(async (options?: { silent?: boolean }) => {
    if (!householdId) {
      setLoading(false)
      loadedKeyRef.current = null
      return
    }
    const key = `${householdId}:${deck}`
    const blocking = loadedKeyRef.current !== key
    if (blocking && !options?.silent) setLoading(true)
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
      if (blocking && !options?.silent) setLoading(false)
    }
  }, [householdId, deck])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  /** Clears shared cache and refetches — use on classify mount and before deck-cleared verification. */
  const refetchFresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!householdId) return
    invalidatePendingTransactionsInflight(householdId)
    loadedKeyRef.current = null
    await fetchPending(options)
  }, [householdId, fetchPending])

  useEffect(() => {
    if (!householdId) return
    invalidatePendingTransactionsInflight(householdId)
    loadedKeyRef.current = null
  }, [householdId, deck])

  const removeTransactions = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    setTransactions((prev) => prev.filter((t) => !idSet.has(t.id)))
    setAutoClassified((prev) => prev.filter((t) => !idSet.has(t.id)))
  }, [])

  /** Re-add (or prepend) transactions to the pending state, e.g. after an Undo / revert-to-pending.
   *  Existing rows with matching ids are replaced so callers can patch status/category. */
  const addPendingTransactions = useCallback((txns: Transaction[]) => {
    if (txns.length === 0) return
    setTransactions((prev) => {
      const idSet = new Set(txns.map((t) => t.id))
      const without = prev.filter((t) => !idSet.has(t.id))
      return [...txns, ...without]
    })
    setAutoClassified((prev) => {
      const idSet = new Set(txns.map((t) => t.id))
      return prev.filter((t) => !idSet.has(t.id))
    })
  }, [])

  const classifyTransaction = async (
    txId: string,
    category: string,
  ) => {
    if (!householdId) return { error: new Error('No household') }

    const { error } = await supabase.rpc('classify_transaction', {
      p_household_id: householdId,
      p_tx_id: txId,
      p_category: category,
      p_classified_by: '00000000-0000-0000-0000-000000000000',
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

  const markTransfer = async (txId: string) => {
    if (!householdId) return { error: new Error('No household') }

    const { error } = await supabase.rpc('mark_as_transfer', {
      p_household_id: householdId,
      p_tx_id: txId,
      p_classified_by: '00000000-0000-0000-0000-000000000000',
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

  const awardXp = async (xp: number) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }
    const { error } = await supabase.rpc('award_xp', {
      p_user_id: user.id,
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
  ) => {
    if (!householdId) return { error: new Error('No household') }

    const { error } = await supabase.rpc('reclassify_transaction', {
      p_household_id: householdId,
      p_tx_id: txId,
      p_new_category: newCategory,
      p_classified_by: '00000000-0000-0000-0000-000000000000',
    })

    return { error }
  }

  const revertToPending = async (txId: string) => {
    if (!householdId) return { error: new Error('No household') }
    const { error } = await supabase.rpc('revert_to_pending', {
      p_household_id: householdId,
      p_tx_id: txId,
    })
    return { error }
  }

  /** Transactions classified between inclusive calendar dates (by classified_at). Optional card filter (last 4). */
  const getTransactionsClassifiedInDateRange = useCallback(
    async (
      fromIsoDate: string,
      toIsoDate: string,
      accountLast4?: string | null,
    ): Promise<{ txs: Transaction[]; error: Error | null }> => {
      if (!householdId) return { txs: [], error: new Error('No household') }

      const last4 = accountLast4?.trim() ?? ''

      const { data, error } = await supabase.rpc('get_transactions_classified_in_date_range', {
        p_household_id: householdId,
        p_from: fromIsoDate,
        p_to: toIsoDate,
        p_account_last4: last4 === '' ? null : last4,
      })

      if (error) return { txs: [], error: new Error(error.message) }
      return { txs: (data as Transaction[]) ?? [], error: null }
    },
    [householdId],
  )

  /** Rewrites billing_month from tx_date wherever they differ (RPC returns rows updated). */
  const syncBillingMonthFromTxDate = useCallback(async (): Promise<{
    error: Error | null
    updatedCount: number
  }> => {
    if (!householdId) return { error: new Error('No household'), updatedCount: 0 }

    const { data, error } = await supabase.rpc('sync_billing_month_from_tx_date', {
      p_household_id: householdId,
    })

    if (error) return { error: new Error(error.message), updatedCount: 0 }
    const n = typeof data === 'number' ? data : Number(data ?? 0)
    return { error: null, updatedCount: Number.isFinite(n) ? n : 0 }
  }, [householdId])

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

  const getMemberDailyRecords = useCallback(async (): Promise<MemberDailyRecord[]> => {
    if (!householdId) return []

    const { data, error } = await supabase.rpc('get_household_member_daily_records', {
      p_household_id: householdId,
    })

    if (error || !data) return []
    return (data as MemberDailyRecord[]).map((row) => ({
      user_id: row.user_id,
      display_name: row.display_name,
      peak_classified: Number(row.peak_classified),
      peak_classified_date: row.peak_classified_date,
      peak_uploads: Number(row.peak_uploads),
      peak_uploads_date: row.peak_uploads_date,
      peak_bets: Number(row.peak_bets),
      peak_bets_date: row.peak_bets_date,
    }))
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

  const getAccountAliases = useCallback(async (): Promise<
    { last4: string; label: string; account_type: AccountType | null }[]
  > => {
    if (!householdId) return []
    const { data, error } = await supabase.rpc('get_account_aliases', {
      p_household_id: householdId,
    })
    if (error || !data) return []
    return (data as { last4: string; label: string; account_type: AccountType | null }[]).map(
      (r) => ({
        last4: r.last4,
        label: r.label,
        account_type: r.account_type ?? null,
      }),
    )
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

  const upsertAccountAlias = useCallback(async (
    last4: string,
    label: string,
    accountType: AccountType | null = null,
  ) => {
    if (!householdId) return { error: new Error('No household') }
    return supabase.rpc('upsert_account_alias', {
      p_household_id: householdId,
      p_last4: last4,
      p_label: label,
      p_account_type: accountType,
    })
  }, [householdId])

  const setAccountType = useCallback(async (
    last4: string,
    accountType: AccountType | null,
  ) => {
    if (!householdId) return { error: new Error('No household') }
    return supabase.rpc('set_account_type', {
      p_household_id: householdId,
      p_last4: last4,
      p_account_type: accountType,
    })
  }, [householdId])

  const deleteAccountAlias = useCallback(async (last4: string) => {
    if (!householdId) return { error: new Error('No household') }
    return supabase.rpc('delete_account_alias', {
      p_household_id: householdId,
      p_last4: last4,
    })
  }, [householdId])

  /** Mark positive-amount pending tx on debit accounts as own_transfers.
   *  Pass last4 / billingMonth to scope; omit both for retroactive cleanup. */
  const autoMarkDebitLoads = useCallback(async (
    last4: string | null = null,
    billingMonth: string | null = null,
  ): Promise<number> => {
    if (!householdId) return 0
    const { data, error } = await supabase.rpc('auto_mark_debit_loads', {
      p_household_id: householdId,
      p_account_last4: last4,
      p_billing_month: billingMonth,
    })
    if (error) {
      console.warn('auto_mark_debit_loads failed:', error.message)
      return 0
    }
    return (data as number) ?? 0
  }, [householdId])

  const getClassifiedCountsForAccount = useCallback(async (
    accountLast4: string,
  ): Promise<AccountClassifiedBreakdownRow[]> => {
    if (!householdId) return []
    const { data, error } = await supabase.rpc('get_classified_counts_for_account', {
      p_household_id: householdId,
      p_account_last4: accountLast4.trim(),
    })
    if (error || !data) return []
    return (data as { user_id: string; display_name: string; classified_count: number | string }[]).map(
      (row) => ({
        user_id: row.user_id,
        display_name: row.display_name,
        classified_count: Number(row.classified_count),
      }),
    )
  }, [householdId])

  return {
    transactions,
    autoClassified,
    loading,
    fetchPending,
    refetchFresh,
    removeTransactions,
    addPendingTransactions,
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
    revertToPending,
    getTransactionsClassifiedInDateRange,
    syncBillingMonthFromTxDate,
    getExportData,
    getHouseholdInfo,
    getLeaderboard,
    getMemberDailyRecords,
    getAccountAliases,
    getDistinctAccountLast4ForMonth,
    getDistinctAccountLast4ForHousehold,
    upsertAccountAlias,
    setAccountType,
    deleteAccountAlias,
    autoMarkDebitLoads,
    getClassifiedCountsForAccount,
  }
}
