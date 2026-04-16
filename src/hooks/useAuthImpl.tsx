import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

/** JWT still valid locally but auth.users row was removed (e.g. reset_all_for_new_deployment.sql). */
function isOrphanSessionProfileError(err: { message: string; code?: string }): boolean {
  const msg = err.message.toLowerCase()
  return (
    err.code === '23503' ||
    msg.includes('profiles_id_fkey') ||
    (msg.includes('insert or update on table "profiles"') && msg.includes('foreign key'))
  )
}

/** Returns true if we signed out so the client stops using a dead session. */
async function signOutIfOrphanProfileError(err: { message: string; code?: string }): Promise<boolean> {
  if (!isOrphanSessionProfileError(err)) return false
  console.warn(
    'This login no longer exists in the database (for example after a full data reset). Signing out — register or sign in again.',
  )
  await supabase.auth.signOut()
  return true
}

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
}

export interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, displayName: string) => Promise<unknown>
  signIn: (email: string, password: string) => Promise<unknown>
  signOut: () => Promise<unknown>
  refreshProfile: (options?: { untilHouseholdId?: boolean }) => Promise<Profile | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
  })

  const fetchProfile = useCallback(async (retries = 2): Promise<Profile | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const { data, error } = await supabase.rpc('get_my_profile')
      if (!error) return data as Profile | null
      if (await signOutIfOrphanProfileError(error)) return null
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      } else {
        console.warn('Failed to fetch profile:', error.message)
      }
    }
    return null
  }, [])

  /**
   * After create/join household, `get_my_profile` can succeed on the first round-trip
   * before `household_id` is visible (read-after-write / trigger timing). Poll briefly
   * when `untilHouseholdId` so AuthGuard and `/` load without a manual refresh.
   */
  const refreshProfile = useCallback(
    async (options?: { untilHouseholdId?: boolean }) => {
      if (options?.untilHouseholdId) {
        const deadline = Date.now() + 12_000
        while (Date.now() < deadline) {
          const { data, error } = await supabase.rpc('get_my_profile')
          if (error) {
            if (await signOutIfOrphanProfileError(error)) return null
            await new Promise((r) => setTimeout(r, 280))
            continue
          }
          if (data && (data as Profile).household_id) {
            const profile = data as Profile
            setState((prev) => ({ ...prev, profile }))
            return profile
          }
          await new Promise((r) => setTimeout(r, 280))
        }
      }
      const profile = await fetchProfile()
      setState((prev) => ({ ...prev, profile }))
      return profile
    },
    [fetchProfile],
  )

  useEffect(() => {
    let cancelled = false
    let initialDone = false

    const bootTimeout = window.setTimeout(() => {
      if (cancelled) return
      setState((prev) =>
        prev.loading ? { ...prev, loading: false } : prev,
      )
    }, 15_000)

    const applySession = async (session: Session | null) => {
      const profile = session?.user ? await fetchProfile() : null
      if (cancelled) return
      setState({
        user: session?.user ?? null,
        profile,
        session,
        loading: false,
      })
    }

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (cancelled) return
        initialDone = true
        await applySession(session)
      })
      .catch((err) => {
        console.error('getSession failed:', err)
        if (!cancelled) {
          setState({
            user: null,
            profile: null,
            session: null,
            loading: false,
          })
        }
      })
      .finally(() => {
        window.clearTimeout(bootTimeout)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      if (!initialDone && event === 'INITIAL_SESSION') return
      await applySession(session)
    })

    return () => {
      cancelled = true
      window.clearTimeout(bootTimeout)
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  /** Tab sleep / PWA background pauses refresh timers; nudge session when user returns. */
  useEffect(() => {
    let debounce: number | undefined

    const onResume = () => {
      if (document.visibilityState !== 'visible') return
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        void supabase.auth.refreshSession().then(({ error }) => {
          if (!error) return
          const msg = error.message.toLowerCase()
          if (msg.includes('refresh token') || msg.includes('invalid refresh token')) {
            void supabase.auth.signOut()
          }
        })
      }, 400)
    }

    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('online', onResume)

    return () => {
      window.clearTimeout(debounce)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('pageshow', onResume)
      window.removeEventListener('online', onResume)
    }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) throw error
      const session = data.session
      const user = data.user
      if (session && user) {
        const profile = await fetchProfile()
        setState({
          user,
          profile,
          session,
          loading: false,
        })
      }
      return data
    },
    [fetchProfile],
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      const session = data.session
      const user = data.user ?? session?.user ?? null
      if (!session || !user) {
        setState((prev) => ({ ...prev, loading: false }))
        return data
      }
      const profile = await fetchProfile()
      setState({
        user,
        profile,
        session,
        loading: false,
      })
      return data
    },
    [fetchProfile],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(
    (): AuthContextValue => ({
      ...state,
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [state, signUp, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
