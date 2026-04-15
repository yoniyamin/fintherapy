import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/** Lightweight count for Home / nav badges (not the full flagged list). */
export function useFlaggedCount(householdId: string | null | undefined) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!householdId) {
      setCount(0)
      return
    }
    let cancelled = false
    supabase.rpc('get_flagged_transactions_count', { p_household_id: householdId }).then(({ data, error }) => {
      if (cancelled || error) return
      setCount(Number(data ?? 0))
    })
    return () => {
      cancelled = true
    }
  }, [householdId])

  return count
}
