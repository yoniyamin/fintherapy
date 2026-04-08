import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface AuthGuardProps {
  children: React.ReactNode
  requireHousehold?: boolean
}

export default function AuthGuard({ children, requireHousehold = true }: AuthGuardProps) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-900">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-duo-green/30 border-t-duo-green" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requireHousehold && !profile?.household_id) {
    return <Navigate to="/household" replace />
  }

  return <>{children}</>
}
