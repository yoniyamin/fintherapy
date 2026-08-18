import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { flushSessionStats } from '../lib/sessionStatsFlush'
import { pathToRouteKey, sessionStats } from '../lib/sessionStats'

const FLUSH_INTERVAL_MS = 30_000

/** Times the current route while the user is signed in and periodically flushes stats. */
export function useSessionStatsCollector() {
  const { pathname } = useLocation()

  useEffect(() => {
    sessionStats.start()
    const onVisibility = () => {
      const hidden = document.visibilityState === 'hidden'
      sessionStats.setPaused(hidden)
      if (hidden) void flushSessionStats({ keepalive: true })
    }
    const onPageHide = () => {
      sessionStats.setPaused(true)
      void flushSessionStats({ keepalive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    const interval = window.setInterval(() => {
      void flushSessionStats()
    }, FLUSH_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.clearInterval(interval)
      sessionStats.stop()
      void flushSessionStats({ keepalive: true })
    }
  }, [])

  useEffect(() => {
    sessionStats.setRoute(pathToRouteKey(pathname))
  }, [pathname])
}

/** Reports which analysis subsection is on screen. */
export function useTrackAnalysisSection(sectionId: string | null) {
  useEffect(() => {
    sessionStats.setAnalysisSection(sectionId)
    return () => sessionStats.setAnalysisSection(null)
  }, [sectionId])
}

/** Scroll-spy for mobile analysis: the section nearest the top of the scroll container. */
export function useTrackVisibleAnalysisSection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      sessionStats.setAnalysisSection(null)
      return
    }

    const update = () => {
      const nodes = [...document.querySelectorAll<HTMLElement>('[data-analysis-section]')]
      if (nodes.length === 0) return
      const scrollContainer = nodes[0].closest('[class*="overflow-y-auto"]') as HTMLElement | null
      const scanY = (scrollContainer?.getBoundingClientRect().top ?? 0) + 120
      let current = nodes[0].dataset.analysisSection ?? null
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= scanY) {
          current = node.dataset.analysisSection ?? current
        }
      }
      sessionStats.setAnalysisSection(current)
    }

    const scrollContainer = document.querySelector('main')
    scrollContainer?.addEventListener('scroll', update, { passive: true })
    update()
    return () => {
      scrollContainer?.removeEventListener('scroll', update)
      sessionStats.setAnalysisSection(null)
    }
  }, [enabled])
}
