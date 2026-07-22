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

export interface BudgetSettings {
  id: string
  monthly_spending_target: number
  scenario_category_ids: string[]
  updated_at: string
  updated_by: string | null
}

export interface BudgetChangeLogEntry {
  id: string
  created_at: string
  user_id: string | null
  display_name: string | null
  action: 'save' | 'reset_medians'
  summary: string
  snapshot: BudgetSnapshot
}

export interface BudgetSnapshot {
  v: number
  monthly_income: number | null
  monthly_spending_target: number
  total_allocated: number
  implied_savings_rate: number | null
  over_envelope_amount: number
  categories: { category_id: string; monthly_target: number }[]
}

export function useCategoryBudgets(householdId: string | null | undefined) {
  const [budgets, setBudgets] = useState<CategoryBudget[]>([])
  const [settings, setSettings] = useState<BudgetSettings | null>(null)
  const [changeLog, setChangeLog] = useState<BudgetChangeLogEntry[]>([])
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

  const fetchSettings = useCallback(async () => {
    if (!householdId) return
    const { data, error } = await supabase.rpc('get_household_budget_settings', {
      p_household_id: householdId,
    })
    if (!error && data) {
      const rows = data as BudgetSettings[]
      setSettings(rows.length > 0 ? rows[0] : null)
    }
  }, [householdId])

  const upsertSettings = useCallback(async (monthlySpendingTarget: number) => {
    if (!householdId) return
    const { error } = await supabase.rpc('upsert_household_budget_settings', {
      p_household_id: householdId,
      p_monthly_spending_target: monthlySpendingTarget,
      p_scenario_category_ids: settings?.scenario_category_ids ?? [],
    })
    if (error) throw new Error(error.message)
    await fetchSettings()
  }, [householdId, fetchSettings, settings?.scenario_category_ids])

  const updateScenarioCategories = useCallback(async (ids: string[]) => {
    if (!householdId) return
    const target = settings?.monthly_spending_target ?? 0
    const { error } = await supabase.rpc('upsert_household_budget_settings', {
      p_household_id: householdId,
      p_monthly_spending_target: target,
      p_scenario_category_ids: ids,
    })
    if (error) throw new Error(error.message)
    await fetchSettings()
  }, [householdId, settings?.monthly_spending_target, fetchSettings])

  const fetchChangeLog = useCallback(async (limit = 50) => {
    if (!householdId) return
    const { data, error } = await supabase.rpc('get_budget_change_log', {
      p_household_id: householdId,
      p_limit: limit,
    })
    if (!error && data) {
      setChangeLog(data as BudgetChangeLogEntry[])
    }
  }, [householdId])

  const logChange = useCallback(async (
    action: 'save' | 'reset_medians',
    summary: string,
    snapshot: BudgetSnapshot,
  ) => {
    if (!householdId) return
    const { error } = await supabase.rpc('insert_budget_change_log', {
      p_household_id: householdId,
      p_action: action,
      p_summary: summary,
      p_snapshot: snapshot,
    })
    if (error) throw new Error(error.message)
  }, [householdId])

  return {
    budgets, settings, changeLog, loading,
    fetch, upsert, remove,
    fetchSettings, upsertSettings, updateScenarioCategories,
    fetchChangeLog, logChange,
  }
}

/** Build a v1 snapshot for the change log. */
export function buildBudgetSnapshot(
  income: number | null,
  monthlySpendingTarget: number,
  rows: { category_id: string; target: number }[],
): BudgetSnapshot {
  const totalAllocated = rows.reduce((s, r) => s + r.target, 0)
  const impliedSavingsRate = income && income > 0
    ? (income - monthlySpendingTarget) / income
    : null
  const overEnvelopeAmount = Math.max(0, totalAllocated - monthlySpendingTarget)

  return {
    v: 1,
    monthly_income: income,
    monthly_spending_target: monthlySpendingTarget,
    total_allocated: totalAllocated,
    implied_savings_rate: impliedSavingsRate !== null ? Math.round(impliedSavingsRate * 1000) / 1000 : null,
    over_envelope_amount: overEnvelopeAmount,
    categories: rows.filter(r => r.target > 0).map(r => ({
      category_id: r.category_id,
      monthly_target: r.target,
    })),
  }
}
