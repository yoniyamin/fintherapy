/* eslint-disable react-refresh/only-export-components */
import { type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '../hooks/authContext'

const noop = () => Promise.resolve(null)

export const defaultAuthContext: AuthContextValue = {
  user: null,
  profile: null,
  session: null,
  loading: false,
  bootStage: null,
  sessionExpiredReason: null,
  passwordRecoveryActive: false,
  signUp: noop as AuthContextValue['signUp'],
  signIn: noop as AuthContextValue['signIn'],
  signOut: noop as AuthContextValue['signOut'],
  refreshProfile: noop as AuthContextValue['refreshProfile'],
  clearSessionExpired: vi.fn(),
}

export function MockAuthProvider({
  value,
  children,
}: {
  value?: Partial<AuthContextValue>
  children: ReactNode
}) {
  return (
    <AuthContext.Provider value={{ ...defaultAuthContext, ...value }}>
      {children}
    </AuthContext.Provider>
  )
}
