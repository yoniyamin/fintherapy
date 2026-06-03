import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeFlaggedCountInvalidate } from '../lib/flaggedCountInvalidate'

/** Lightweight count for Home / nav badges (not the full flagged list). */
export function useFlaggedCount(householdId: string | null | undefined) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!householdId) return
    let cancelled = false

    const load = () => {
      supabase.rpc('get_flagged_transactions_count', { p_household_id: householdId }).then(({ data, error }) => {
        if (cancelled || error) return
        setCount(Number(data ?? 0))
      })
    }

    load()
    const unsub = subscribeFlaggedCountInvalidate(load)
    return () => {
      cancelled = true
      unsub()
    }
  }, [householdId])

  return householdId ? count : 0
}
