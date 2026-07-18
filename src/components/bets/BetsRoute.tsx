import { useIsDesktop } from '../../hooks/useIsDesktop'
import BetsDesktopPage from './BetsDesktopPage'
import BetsPage from './BetsPage'

export default function BetsRoute() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <BetsDesktopPage /> : <BetsPage />
}
