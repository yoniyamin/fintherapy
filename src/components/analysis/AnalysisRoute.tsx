import { useIsDesktop } from '../../hooks/useIsDesktop'
import AnalysisDesktopPage from './AnalysisDesktopPage'
import AnalysisPage from './AnalysisPage'

export default function AnalysisRoute() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <AnalysisDesktopPage /> : <AnalysisPage />
}
