import { useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { UiPrefs } from '../types/database'
import { useAuth } from './useAuth'

/**
 * Read and write UI preferences stored on the user's profile.
 * Reads from the already-fetched profile (no extra query on mount).
 * Writes optimistically and persists to Supabase in the background.
 */
export function useUiPrefs() {
  const { profile, refreshProfile } = useAuth()

  const prefs: UiPrefs = useMemo(
    () => (profile?.ui_prefs as UiPrefs) ?? {},
    [profile?.ui_prefs],
  )

  const updatePrefs = useCallback(async (patch: Partial<UiPrefs>) => {
    if (!profile) return
    const merged = { ...prefs, ...patch }
    await supabase
      .from('profiles')
      .update({ ui_prefs: merged })
      .eq('id', profile.id)
    await refreshProfile()
  }, [profile, prefs, refreshProfile])

  return { prefs, updatePrefs }
}
