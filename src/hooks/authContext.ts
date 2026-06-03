import { createContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '../types/database'

export type BootStage = 'init' | 'session' | 'profile' | null

export interface AuthContextValue {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  bootStage: BootStage
  sessionExpiredReason: string | null
  passwordRecoveryActive: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<unknown>
  signIn: (email: string, password: string) => Promise<unknown>
  signOut: () => Promise<unknown>
  refreshProfile: (options?: { untilHouseholdId?: boolean }) => Promise<Profile | null>
  clearSessionExpired: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
