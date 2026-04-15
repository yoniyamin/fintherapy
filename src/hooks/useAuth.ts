/**
 * Vite resolves extensionless imports as `.ts` before `.tsx`, so this file must exist
 * as the entry for `from '../hooks/useAuth'`. Implementation lives in useAuthImpl.tsx.
 */
export { AuthProvider, useAuth, type AuthContextValue } from './useAuthImpl.tsx'
