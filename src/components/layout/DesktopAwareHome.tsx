import { Navigate } from 'react-router-dom'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import HomePage from '../home/HomePage'

/**
 * On desktop the compact Home panel is always visible in the left column,
 * so we redirect the index route to /reveal instead of rendering HomePage twice.
 * On mobile the full HomePage renders as usual.
 */
export default function DesktopAwareHome() {
  const isDesktop = useIsDesktop()
  if (isDesktop) return <Navigate to="/reveal" replace />
  return <HomePage />
}
