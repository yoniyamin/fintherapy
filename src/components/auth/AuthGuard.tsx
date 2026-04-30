import { Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import type { BootStage } from '../../hooks/useAuth'

const STAGE_PROGRESS: Record<NonNullable<BootStage>, { pct: number; label: string }> = {
  init:    { pct: 10,  label: 'Starting up…' },
  session: { pct: 40,  label: 'Checking session…' },
  profile: { pct: 75,  label: 'Loading profile…' },
}

interface AuthGuardProps {
  children: React.ReactNode
  requireHousehold?: boolean
}

export default function AuthGuard({ children, requireHousehold = true }: AuthGuardProps) {
  const { user, profile, loading, bootStage } = useAuth()

  if (loading) {
    const { pct, label } = STAGE_PROGRESS[bootStage ?? 'init']
    return (
      <div className="flex h-full flex-col bg-surface-900">
        <div className="h-1 w-full overflow-hidden bg-duo-green/20">
          <motion.div
            className="h-full bg-duo-green"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-surface-400">{label}</p>
        </div>
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
