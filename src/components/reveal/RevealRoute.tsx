import { useIsDesktop } from '../../hooks/useIsDesktop'
import RevealDesktopPage from './RevealDesktopPage'
import RevealPage from './RevealPage'

export default function RevealRoute() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <RevealDesktopPage /> : <RevealPage />
}
