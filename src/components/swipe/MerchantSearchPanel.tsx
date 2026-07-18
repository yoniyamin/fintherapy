import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  searchMerchant,
  buildMerchantSearchUrl,
  cleanMerchantForSearch,
  type SearchResult,
} from '../../lib/merchantSearch'
import { useBottomSheetDrag } from '../../hooks/useBottomSheetDrag'

interface MerchantSearchPanelProps {
  open: boolean
  merchantRaw: string
  onClose: () => void
}

type SearchSnapshot = {
  merchant: string
  loading: boolean
  error: string | null
  results: SearchResult[]
}

export default function MerchantSearchPanel({ open, merchantRaw, onClose }: MerchantSearchPanelProps) {
  const [searchSnapshot, setSearchSnapshot] = useState<SearchSnapshot | null>(null)
  const { sheetDragProps, handleZoneProps } = useBottomSheetDrag(onClose)

  useEffect(() => {
    if (!open || !merchantRaw) return

    let cancelled = false

    searchMerchant(merchantRaw).then(
      (resp) => {
        if (cancelled) return
        if (!resp.ok) {
          setSearchSnapshot({ merchant: merchantRaw, loading: false, error: resp.error, results: [] })
        } else if (resp.results.length === 0) {
          setSearchSnapshot({ merchant: merchantRaw, loading: false, error: 'No results found', results: [] })
        } else {
          setSearchSnapshot({ merchant: merchantRaw, loading: false, error: null, results: resp.results })
        }
      },
      (err) => {
        if (cancelled) return
        setSearchSnapshot({
          merchant: merchantRaw,
          loading: false,
          error: `Network error: ${err instanceof Error ? err.message : 'unknown'}`,
          results: [],
        })
      },
    )

    return () => { cancelled = true }
  }, [open, merchantRaw])

  if (typeof document === 'undefined') return null

  const activeSearch = open && merchantRaw ? merchantRaw : null
  const snapshot = activeSearch && searchSnapshot?.merchant === activeSearch ? searchSnapshot : null
  const loading = Boolean(activeSearch && (!snapshot || snapshot.loading))
  const error = snapshot?.error ?? null
  const results = snapshot?.results ?? []

  const cleanedQuery = cleanMerchantForSearch(merchantRaw)
  const googleUrl = buildMerchantSearchUrl(merchantRaw)

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[85vh] flex-col rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom))]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            {...sheetDragProps}
          >
            {/* Handle + close */}
            <div {...handleZoneProps('flex items-center justify-between px-4 pt-3')}>
              <div className="w-8" />
              <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-800 text-surface-400 transition-colors hover:text-surface-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            {/* Header */}
            <p className="mt-1 px-4 text-center text-xs text-surface-500">
              Search results for
            </p>
            <p className="mb-3 px-4 text-center text-sm font-semibold text-surface-200">
              &ldquo;{cleanedQuery}&rdquo;
            </p>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4">
              {loading && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                  <p className="text-xs text-surface-500">Searching...</p>
                </div>
              )}

              {error && !loading && (
                <p className="py-6 text-center text-xs text-surface-500">{error}</p>
              )}

              {!loading && results.length > 0 && (
                <div className="space-y-3 pb-2">
                  {results.map((result, i) => (
                    <motion.a
                      key={result.link}
                      href={result.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-white/[0.06] bg-surface-900/60 px-3.5 py-3 transition-colors active:bg-surface-800"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <p className="text-[11px] text-surface-500 truncate">{result.displayLink}</p>
                      <p className="mt-0.5 text-sm font-semibold leading-snug text-primary-400 line-clamp-2">
                        {result.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-surface-400 line-clamp-2">
                        {result.snippet}
                      </p>
                    </motion.a>
                  ))}
                </div>
              )}
            </div>

            {/* Footer: Google fallback link */}
            <div className="mt-2 flex justify-center px-4 pb-1">
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-surface-500 transition-colors hover:text-surface-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                  <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm7.25-.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V6.31l-5.47 5.47a.75.75 0 1 1-1.06-1.06l5.47-5.47H12.25a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
                </svg>
                Open full Google search
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
