import { useEffect, useState } from 'react'

/** True when the app runs as an installed PWA (home screen), not the in-browser tab. */
export function useStandalonePwa(): boolean {
  const [standalone, setStandalone] = useState(() => readStandalone())

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const sync = () => setStandalone(readStandalone())
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return standalone
}

function readStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
