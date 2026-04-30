import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface Bet {
  category: string
  predicted_amount: number
}

export interface SavedBet {
  id: string
  user_id: string
  month: string
  category: string
  predicted_amount: number
  created_at: string
}

export interface HouseholdBet {
  user_id: string
  display_name: string
  category: string
  predicted_amount: number
}

export interface HouseholdBetStatus {
  user_id: string
  display_name: string
  avatar_url: string | null
  category_count: number
  is_current_user: boolean
}

export function useBets(householdId: string | null | undefined) {
  const [myBets, setMyBets] = useState<SavedBet[]>([])
  const [householdBets, setHouseholdBets] = useState<HouseholdBet[]>([])
  const [householdBetStatus, setHouseholdBetStatus] = useState<HouseholdBetStatus[]>([])
  const [loading, setLoading] = useState(false)

  const fetchMyBets = useCallback(async (month: string) => {
    if (!householdId) return
    setLoading(true)
    const { data, error } = await supabase.rpc('get_my_bets', {
      p_household_id: householdId,
      p_month: month,
    })
    if (!error && data) {
      setMyBets(data as SavedBet[])
    }
    setLoading(false)
  }, [householdId])

  const fetchHouseholdBets = useCallback(async (month: string) => {
    if (!householdId) return
    const { data, error } = await supabase.rpc('get_household_bets', {
      p_household_id: householdId,
      p_month: month,
    })
    if (!error && data) {
      setHouseholdBets(data as HouseholdBet[])
    }
  }, [householdId])

  const fetchHouseholdBetStatus = useCallback(async (month: string) => {
    if (!householdId) return
    const { data, error } = await supabase.rpc('get_household_bet_status', {
      p_household_id: householdId,
      p_month: month,
    })
    if (!error && data) {
      setHouseholdBetStatus(data as HouseholdBetStatus[])
    }
  }, [householdId])

  const submitBets = useCallback(async (month: string, bets: Bet[]) => {
    if (!householdId) return { error: new Error('No household') }
    const { error } = await supabase.rpc('submit_bets', {
      p_household_id: householdId,
      p_month: month,
      p_bets: bets,
    })
    if (!error) {
      await fetchMyBets(month)
    }
    return { error }
  }, [householdId, fetchMyBets])

  return {
    myBets,
    householdBets,
    householdBetStatus,
    loading,
    fetchMyBets,
    fetchHouseholdBets,
    fetchHouseholdBetStatus,
    submitBets,
  }
}
