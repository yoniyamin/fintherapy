import { createPortal } from 'react-dom'
import { type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useScrollReport } from '../../../hooks/useScrollReport'
import { REPORT_EASE, type ScrollReportSectionDef } from '../../../lib/scrollReportMotion'

export interface ScrollReportNav {
  scrollToTop: () => void
}

interface Props {
  sections: readonly ScrollReportSectionDef[]
  onClose: () => void
  onDownload: () => void
  downloading: boolean
  children: ReactNode | ((nav: ScrollReportNav) => ReactNode)
}

/** Full-screen scroll report shell with sticky header, progress bar, and reveal-ready body. */
export default function ScrollReportShell({
  sections,
  onClose,
  onDownload,
  downloading,
  children,
}: Props) {
  const {
    scrollRef,
    headerRef,
    activeSection,
    activeIndex,
    navShadow,
    scrollProgress,
    reportComplete,
    scrollToTop,
  } = useScrollReport(sections)

  const shell = (
    <motion.div
      className="fixed inset-0 z-[250] flex flex-col overflow-hidden pt-[env(safe-area-inset-top,0px)]"
      style={{ background: 'linear-gradient(145deg, #0a0f1a 0%, #0f172a 40%, #0c1220 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <header
        ref={headerRef}
        className={`relative z-10 shrink-0 border-b bg-[#0a0f1a]/95 backdrop-blur-md transition-shadow duration-300 ${
          navShadow
            ? 'border-white/[0.08] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)]'
            : 'border-white/[0.04] shadow-none'
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-surface-400 transition-all hover:bg-white/[0.04] hover:text-surface-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>

          <button
            type="button"
            onClick={scrollToTop}
            className="min-w-0 flex-1 text-center transition-opacity hover:opacity-90"
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={activeSection.id}
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                transition={{ duration: 0.28, ease: REPORT_EASE }}
                className="truncate text-sm font-semibold text-surface-100"
              >
                {reportComplete ? 'Report complete ✓' : activeSection.label}
              </motion.p>
            </AnimatePresence>
            <motion.p
              className="mt-0.5 text-[10px] tabular-nums text-surface-500"
              animate={{ opacity: reportComplete ? 0 : 1 }}
            >
              Section {activeIndex + 1} · {Math.round(scrollProgress)}% read
            </motion.p>
          </button>

          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-purple-400/20 bg-gradient-to-r from-purple-500/20 to-blue-500/20 px-3 py-1.5 text-sm font-medium text-purple-200 transition-all hover:from-purple-500/30 hover:to-blue-500/30 disabled:opacity-50"
          >
            {downloading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            Export
          </button>
        </div>

        <div className="relative h-1 w-full bg-surface-900/90">
          <motion.div
            className="relative h-full overflow-hidden rounded-r-full bg-gradient-to-r from-purple-500 via-blue-400 to-cyan-400"
            animate={{ width: `${scrollProgress}%` }}
            transition={{ duration: 0.15, ease: 'linear' }}
          >
            <motion.div
              className="absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-white/40"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
          {reportComplete && (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-transparent to-emerald-500/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.2 }}
            />
          )}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth overscroll-y-contain">
        <div className="mx-auto max-w-md px-5 pb-[max(3rem,env(safe-area-inset-bottom,0px))] pt-6">
          {typeof children === 'function' ? children({ scrollToTop }) : children}
        </div>
      </div>
    </motion.div>
  )

  if (typeof document === 'undefined') return null

  return createPortal(shell, document.body)
}
