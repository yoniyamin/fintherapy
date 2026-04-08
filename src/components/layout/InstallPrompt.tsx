import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'install-prompt-dismissed'

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone)
  )
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosBanner, setShowIosBanner] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    if (isIos()) {
      const timer = setTimeout(() => {
        setShowIosBanner(true)
        setVisible(true)
      }, 2000)
      return () => clearTimeout(timer)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 flex justify-center px-4 pt-3"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        >
          <div className="flex w-full max-w-md items-start gap-3 rounded-2xl border border-white/[0.12] bg-surface-900/95 px-4 py-3.5 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gem/15">
              <span className="text-lg">📲</span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-surface-100">
                Install Financial Therapy
              </p>

              {showIosBanner ? (
                <p className="mt-0.5 text-xs leading-relaxed text-surface-400">
                  Tap{' '}
                  <span className="inline-flex translate-y-[1px] items-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ice">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </span>{' '}
                  Share then <span className="font-semibold text-surface-200">"Add to Home Screen"</span>
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-surface-400">
                  Add to your home screen for the full experience
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {deferredPrompt && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="rounded-lg bg-duo-green px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(88,204,2,0.4)] transition hover:bg-duo-green-dark"
                >
                  Install
                </button>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-lg p-1.5 text-surface-500 transition hover:bg-white/[0.06] hover:text-surface-300"
                aria-label="Dismiss"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
