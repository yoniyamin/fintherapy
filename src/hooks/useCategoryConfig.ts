import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_CATEGORIES, type CategoryDef, type ExpenseType } from '../lib/constants'

export interface CategoryOverride {
  id: string
  label: string
  icon: string
  color: string
  previous_ids: string[]
  sort_order: number
  expense_type?: string
}

/**
 * Merges per-household overrides on top of the hard-coded defaults.
 * Returns a stable `categories` array that every UI component should use
 * instead of importing `CATEGORIES` directly.
 */
export function useCategoryConfig(householdId: string | null | undefined) {
  const [overrides, setOverrides] = useState<CategoryOverride[]>([])
  const [loadedHouseholdId, setLoadedHouseholdId] = useState<string | null>(null)
  const loaded = !householdId || loadedHouseholdId === householdId

  const fetchOverrides = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase.rpc('get_category_overrides', {
      p_household_id: householdId,
    })
    if (!error && data) setOverrides(data as CategoryOverride[])
    setLoadedHouseholdId(householdId)
  }, [householdId])

  useEffect(() => {
    if (!householdId) return
    let cancelled = false
    void supabase.rpc('get_category_overrides', {
      p_household_id: householdId,
    }).then(({ data, error }) => {
      if (cancelled) return
      if (!error && data) setOverrides(data as CategoryOverride[])
      setLoadedHouseholdId(householdId)
    })
    return () => {
      cancelled = true
    }
  }, [householdId])

  const categories: CategoryDef[] = useMemo(() => {
    if (overrides.length === 0) return DEFAULT_CATEGORIES as unknown as CategoryDef[]

    const overrideMap = new Map(overrides.map((o) => [o.id, o]))

    const merged: CategoryDef[] = DEFAULT_CATEGORIES.map((d) => {
      const o = overrideMap.get(d.id)
      if (o) {
        overrideMap.delete(d.id)
        const expenseType = (o.expense_type === 'fixed' || o.expense_type === 'discretionary'
          ? o.expense_type
          : d.expenseType) as ExpenseType
        return { id: o.id, label: o.label, icon: o.icon, color: o.color, expenseType }
      }
      return { ...d }
    })

    for (const o of overrideMap.values()) {
      const prevIdx = merged.findIndex((m) =>
        o.previous_ids.includes(m.id),
      )
      const expenseType = (o.expense_type === 'fixed' || o.expense_type === 'discretionary'
        ? o.expense_type
        : 'discretionary') as ExpenseType
      if (prevIdx >= 0) {
        merged[prevIdx] = { id: o.id, label: o.label, icon: o.icon, color: o.color, expenseType }
      } else {
        merged.push({ id: o.id, label: o.label, icon: o.icon, color: o.color, expenseType })
      }
    }

    return merged
  }, [overrides])

  const categoryLookup: Record<string, CategoryDef> = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  )

  const upsertCategory = useCallback(async (cat: CategoryDef, sortOrder = 999) => {
    if (!householdId) return
    await supabase.rpc('upsert_category_override', {
      p_household_id: householdId,
      p_id: cat.id,
      p_label: cat.label,
      p_icon: cat.icon,
      p_color: cat.color,
      p_sort_order: sortOrder,
    })
    await fetchOverrides()
  }, [householdId, fetchOverrides])

  const renameCategory = useCallback(async (
    oldId: string, newId: string, label: string, icon: string, color: string,
  ) => {
    if (!householdId) return { error: null as string | null }
    const { error } = await supabase.rpc('rename_category', {
      p_household_id: householdId,
      p_old_id: oldId,
      p_new_id: newId,
      p_new_label: label,
      p_new_icon: icon,
      p_new_color: color,
    })
    if (error) return { error: error.message }
    await fetchOverrides()
    return { error: null }
  }, [householdId, fetchOverrides])

  const deleteCategory = useCallback(async (categoryId: string) => {
    if (!householdId) return { error: null as string | null }
    const { error } = await supabase.rpc('delete_category', {
      p_household_id: householdId,
      p_category_id: categoryId,
    })
    if (error) return { error: error.message }
    await fetchOverrides()
    return { error: null }
  }, [householdId, fetchOverrides])

  /** Returns transaction count, or `null` when the RPC call fails (e.g. migration not deployed). */
  const countTransactions = useCallback(async (categoryId: string): Promise<number | null> => {
    if (!householdId) return 0
    const { data, error } = await supabase.rpc('count_transactions_for_category', {
      p_household_id: householdId,
      p_category_id: categoryId,
    })
    if (error) {
      console.warn('count_transactions_for_category failed:', error.message)
      return null
    }
    return Number(data) || 0
  }, [householdId])

  interface SampleTx { merchant_raw: string; merchant_clean: string | null; amount: number; tx_date: string }

  const sampleTransactions = useCallback(async (categoryId: string, limit = 5): Promise<SampleTx[]> => {
    if (!householdId) return []
    const { data, error } = await supabase.rpc('sample_transactions_for_category', {
      p_household_id: householdId,
      p_category_id: categoryId,
      p_limit: limit,
    })
    if (error) {
      console.warn('sample_transactions_for_category failed:', error.message)
      return []
    }
    return (data as SampleTx[]) ?? []
  }, [householdId])

  return {
    categories,
    categoryLookup,
    overrides,
    loaded,
    upsertCategory,
    renameCategory,
    deleteCategory,
    countTransactions,
    sampleTransactions,
    refresh: fetchOverrides,
  }
}
