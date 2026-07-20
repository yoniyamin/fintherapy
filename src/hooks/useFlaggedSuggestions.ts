import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeFlaggedCountInvalidate } from '../lib/flaggedCountInvalidate'

export interface FlaggedSuggestion {
  tx_id: string
  merchant_raw: string
  amount: number
  tx_date: string
  suggested_category: string
  confidence: number
}

/**
 * Fetches flagged transactions that now have a matching merchant_knowledge
 * entry, so the UI can offer one-tap reclassification.
 *
 * Re-fetches whenever the flagged-count invalidation fires (i.e. after
 * flag / reclassify mutations).
 */
export function useFlaggedSuggestions(householdId: string | null | undefined) {
  const [suggestions, setSuggestions] = useState<FlaggedSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!householdId) return
    let cancelled = false

    const load = () => {
      setLoading(true)
      supabase
        .rpc('suggest_flagged_resolutions', { p_household_id: householdId })
        .then(({ data, error }) => {
          if (cancelled) return
          if (!error && data) setSuggestions(data as FlaggedSuggestion[])
          else setSuggestions([])
          setLoading(false)
        })
    }

    load()
    const unsub = subscribeFlaggedCountInvalidate(load)
    return () => {
      cancelled = true
      unsub()
    }
  }, [householdId])

  const removeSuggestion = useCallback((txId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.tx_id !== txId))
  }, [])

  return { suggestions, suggestionCount: suggestions.length, loading, removeSuggestion }
}
