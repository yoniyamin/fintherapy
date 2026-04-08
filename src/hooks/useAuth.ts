import { useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
  })

  const fetchProfile = useCallback(async (): Promise<Profile | null> => {
    const { data, error } = await supabase.rpc('get_my_profile')
    if (error) {
      console.warn('Failed to fetch profile:', error.message)
      return null
    }
    return data as Profile | null
  }, [])

  const refreshProfile = useCallback(async () => {
    const profile = await fetchProfile()
    setState((prev) => ({ ...prev, profile }))
    return profile
  }, [fetchProfile])

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      const profile = session?.user ? await fetchProfile() : null
      setState({
        user: session?.user ?? null,
        profile,
        session,
        loading: false,
      })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return
      const profile = session?.user ? await fetchProfile() : null
      setState({
        user: session?.user ?? null,
        profile,
        session,
        loading: false,
      })
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signUp = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) throw error
    return data
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { ...state, signUp, signIn, signOut, refreshProfile }
}
