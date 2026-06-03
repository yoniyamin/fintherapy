import { useContext } from 'react'
import { AuthContext, type AuthContextValue, type BootStage } from './authContext'

export { AuthProvider } from './useAuthImpl.tsx'
export type { AuthContextValue, BootStage }

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
