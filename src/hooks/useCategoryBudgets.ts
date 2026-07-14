import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CategoryBudget {
  id: string
  category_id: string
  monthly_target: number
  is_discretionary: boolean
  subject_to_inflation: boolean
  valid_from: string | null
  valid_to: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface UpsertBudgetParams {
  category_id: string
  monthly_target: number
  is_discretionary?: boolean
  subject_to_inflation?: boolean
  valid_from?: string | null
  valid_to?: string | null
  notes?: string | null
}

export function useCategoryBudgets(householdId: string | null | undefined) {
  const [budgets, setBudgets] = useState<CategoryBudget[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async (asOfDate?: string) => {
    if (!householdId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_category_budgets', {
        p_household_id: householdId,
        p_as_of_date: asOfDate ?? null,
      })
      if (!error && data) {
        setBudgets(data as CategoryBudget[])
      }
    } finally {
      setLoading(false)
    }
  }, [householdId])

  const upsert = useCallback(async (params: UpsertBudgetParams): Promise<string | null> => {
    if (!householdId) return null
    const { data, error } = await supabase.rpc('upsert_category_budget', {
      p_household_id: householdId,
      p_category_id: params.category_id,
      p_monthly_target: params.monthly_target,
      p_is_discretionary: params.is_discretionary ?? true,
      p_subject_to_inflation: params.subject_to_inflation ?? true,
      p_valid_from: params.valid_from ?? null,
      p_valid_to: params.valid_to ?? null,
      p_notes: params.notes ?? null,
    })
    if (error) return null
    await fetch()
    return data as string
  }, [householdId, fetch])

  const remove = useCallback(async (budgetId: string) => {
    if (!householdId) return
    await supabase.rpc('delete_category_budget', {
      p_household_id: householdId,
      p_budget_id: budgetId,
    })
    await fetch()
  }, [householdId, fetch])

  return { budgets, loading, fetch, upsert, remove }
}
