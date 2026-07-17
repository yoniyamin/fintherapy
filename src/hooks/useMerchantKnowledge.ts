import { useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useMerchantKnowledge(householdId: string | null | undefined) {
  const learnMerchant = useCallback(async (merchantRaw: string, category: string) => {
    if (!householdId) return
    await supabase.rpc('learn_merchant', {
      p_household_id: householdId,
      p_merchant_raw: merchantRaw,
      p_category: category,
    })
  }, [householdId])

  const autoClassify = useCallback(async (): Promise<number> => {
    if (!householdId) return 0
    const { data, error } = await supabase.rpc('auto_classify_transactions', {
      p_household_id: householdId,
    })
    if (error) return 0
    return (data as number) ?? 0
  }, [householdId])

  const confirmAutoClassified = useCallback(async (txId: string) => {
    if (!householdId) return
    await supabase.rpc('confirm_auto_classified', {
      p_household_id: householdId,
      p_tx_id: txId,
      p_classified_by: '00000000-0000-0000-0000-000000000000',
    })
  }, [householdId])

  const rejectAutoClassified = useCallback(async (txId: string) => {
    if (!householdId) return
    await supabase.rpc('reject_auto_classified', {
      p_household_id: householdId,
      p_tx_id: txId,
    })
  }, [householdId])

  return { learnMerchant, autoClassify, confirmAutoClassified, rejectAutoClassified }
}
