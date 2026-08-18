import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { sessionStats } from '../lib/sessionStats'
import { flushSessionStats } from '../lib/sessionStatsFlush'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'
import { friendlyAuthError } from './authErrors'
import { AuthContext, type AuthContextValue, type BootStage } from './authContext'

// ---------------------------------------------------------------------------
// Orphan session detection (user row deleted from DB while JWT still valid)
// ---------------------------------------------------------------------------

function isOrphanSessionProfileError(err: { message: string; code?: string }): boolean {
  const msg = err.message.toLowerCase()
  return (
    err.code === '23503' ||
    msg.includes('profiles_id_fkey') ||
    (msg.includes('insert or update on table "profiles"') && msg.includes('foreign key'))
  )
}

async function signOutIfOrphanProfileError(err: { message: string; code?: string }): Promise<boolean> {
  if (!isOrphanSessionProfileError(err)) return false
  console.warn(
    'This login no longer exists in the database (for example after a full data reset). Signing out — register or sign in again.',
  )
  await supabase.auth.signOut()
  return true
}

// ---------------------------------------------------------------------------
// Auth context types
// ---------------------------------------------------------------------------

const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  /** Tracks bootstrap progress so the UI can show a determinate progress bar. */
  bootStage: BootStage
  sessionExpiredReason: string | null
  /** Set when onAuthStateChange fires PASSWORD_RECOVERY so ResetPasswordPage can act. */
  passwordRecoveryActive: boolean
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    bootStage: 'init',
    sessionExpiredReason: null,
    passwordRecoveryActive: false,
  })
  const bootDoneRef = useRef(false)
  /** true while the user explicitly clicks "sign out" — distinguishes voluntary from automatic. */
  const manualSignOutRef = useRef(false)
  /** true once the initial getSession + applySession has run (prevents double-fire with INITIAL_SESSION). */
  const hadSessionRef = useRef(false)
  /** true while signIn is handling its own state updates — suppresses onAuthStateChange. */
  const signingInRef = useRef(false)

  // ---- helpers ----

  const setExpired = useCallback((reason: string) => {
    setState((prev) => ({ ...prev, sessionExpiredReason: reason }))
  }, [])

  const clearSessionExpired = useCallback(() => {
    setState((prev) =>
      prev.sessionExpiredReason ? { ...prev, sessionExpiredReason: null } : prev,
    )
  }, [])

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

  // ---- bootstrap + auth state listener ----

  useEffect(() => {
    let cancelled = false
    let initialDone = false
    let applySeq = 0

    const bootTimeout = window.setTimeout(() => {
      if (cancelled) return
      bootDoneRef.current = true
      setState((prev) =>
        prev.loading ? { ...prev, loading: false, bootStage: null } : prev,
      )
    }, 15_000)

    const applySession = async (session: Session | null) => {
      const seq = ++applySeq
      if (session?.user) {
        setState((prev) => (prev.bootStage ? { ...prev, bootStage: 'profile' } : prev))
      }
      const profile = session?.user ? await fetchProfile() : null
      if (cancelled || seq !== applySeq) return
      setState((prev) => ({
        ...prev,
        user: session?.user ?? null,
        profile,
        session,
        loading: false,
        bootStage: null,
        passwordRecoveryActive: prev.passwordRecoveryActive,
      }))
    }

    setState((prev) => (prev.bootStage === 'init' ? { ...prev, bootStage: 'session' } : prev))

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (cancelled) return
        initialDone = true
        if (session) hadSessionRef.current = true
        await applySession(session)
      })
      .catch((err) => {
        console.error('getSession failed:', err)
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            user: null,
            profile: null,
            session: null,
            loading: false,
            bootStage: null,
          }))
        }
      })
      .finally(() => {
        window.clearTimeout(bootTimeout)
        bootDoneRef.current = true
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (signingInRef.current) return
      if (!initialDone && event === 'INITIAL_SESSION') return

      if (event === 'PASSWORD_RECOVERY') {
        setState((prev) => ({ ...prev, passwordRecoveryActive: true }))
      }

      if (event === 'SIGNED_OUT') {
        if (!manualSignOutRef.current && hadSessionRef.current) {
          setExpired('Your session has expired. Please sign in again.')
        }
        hadSessionRef.current = false
      }

      if (session) hadSessionRef.current = true

      // Never await other Supabase calls inside this callback — it deadlocks the client
      // ((profile RPC never leaves the browser; websocket connect spins). See Supabase JS docs.)
      window.setTimeout(() => {
        if (cancelled) return
        void applySession(session)
      }, 0)
    })

    return () => {
      cancelled = true
      window.clearTimeout(bootTimeout)
      subscription.unsubscribe()
    }
  }, [fetchProfile, setExpired])

  // ---- tab sleep / PWA background: nudge session when user returns ----

  useEffect(() => {
    let debounce: number | undefined

    const onResume = () => {
      if (document.visibilityState !== 'visible') return
      if (!bootDoneRef.current) return
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        void supabase.auth.refreshSession().then(({ error }) => {
          if (!error) return
          const msg = error.message.toLowerCase()
          if (msg.includes('refresh token') || msg.includes('invalid refresh token')) {
            setExpired('Your session has expired. Please sign in again.')
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
  }, [setExpired])

  // ---- periodic session health check (catches silent expiry during active use) ----

  useEffect(() => {
    const id = window.setInterval(async () => {
      if (!bootDoneRef.current) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session && hadSessionRef.current) {
        setExpired('Your session has expired. Please sign in again.')
        hadSessionRef.current = false
        void supabase.auth.signOut()
      }
    }, SESSION_CHECK_INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [setExpired])

  // ---- signUp / signIn / signOut ----

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      })
      if (error) throw new Error(friendlyAuthError(error.message))

      const user = data.user
      if (user && (!user.identities || user.identities.length === 0)) {
        throw new Error('An account with this email already exists. Please sign in instead.')
      }

      const session = data.session
      if (session && user) {
        sessionStats.stop()
        await flushSessionStats()
        sessionStats.beginNewSession('sign_up')
        const profile = await fetchProfile()
        setState((prev) => ({
          ...prev,
          user,
          profile,
          session,
          loading: false,
        }))
      }
      return data
    },
    [fetchProfile],
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      manualSignOutRef.current = true
      try { await supabase.auth.signOut() } catch { /* stale-session cleanup */ }
      finally { manualSignOutRef.current = false }

      signingInRef.current = true
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw new Error(friendlyAuthError(error.message))

        const session = data.session
        const user = data.user ?? session?.user ?? null
        if (!session || !user) {
          setState((prev) => ({ ...prev, loading: false, bootStage: null }))
          return data
        }

        hadSessionRef.current = true
        sessionStats.stop()
        await flushSessionStats()
        sessionStats.beginNewSession('sign_in')
        setState((prev) => ({ ...prev, user, session, loading: true, bootStage: 'profile' }))

        const profile = await fetchProfile()
        setState((prev) => ({
          ...prev,
          user,
          profile,
          session,
          loading: false,
          bootStage: null,
        }))
        return data
      } finally {
        signingInRef.current = false
      }
    },
    [fetchProfile],
  )

  const signOut = useCallback(async () => {
    manualSignOutRef.current = true
    try {
      sessionStats.stop()
      await flushSessionStats()
      sessionStats.clear()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } finally {
      manualSignOutRef.current = false
    }
  }, [])

  // ---- context value ----

  const value = useMemo(
    (): AuthContextValue => ({
      ...state,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      clearSessionExpired,
    }),
    [state, signUp, signIn, signOut, refreshProfile, clearSessionExpired],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
