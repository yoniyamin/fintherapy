import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { FlaggedSuggestion } from '../../hooks/useFlaggedSuggestions'
import type { CategoryDef } from '../../lib/constants'
import { formatCurrency } from '../../lib/formatCurrency'

interface Props {
  suggestions: FlaggedSuggestion[]
  categoryLookup: Record<string, CategoryDef>
  onAccept: (txId: string, category: string, merchantRaw: string) => Promise<void>
  onDismiss: (txId: string) => void
}

/**
 * Collapsible banner shown on the No-idea deck when merchant_knowledge
 * now recognises some flagged transactions, offering one-tap reclassification.
 */
export default function FlaggedSuggestionsBanner({ suggestions, categoryLookup, onAccept, onDismiss }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (suggestions.length === 0) return null

  return (
    <motion.div
      className="mt-2 rounded-xl border border-duo-green/20 bg-duo-green/[0.06] backdrop-blur-sm"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 300 }}
    >
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <p className="text-xs font-semibold text-duo-green">
          We now recognise {suggestions.length} merchant{suggestions.length !== 1 ? 's' : ''} — review?
        </p>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-duo-green/70 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 px-3 pb-3">
              {suggestions.map((s) => {
                const cat = categoryLookup[s.suggested_category]
                const busy = busyId === s.tx_id
                return (
                  <div
                    key={s.tx_id}
                    className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-surface-200">
                        {s.merchant_raw}
                      </p>
                      <p className="text-[10px] text-surface-500">
                        {formatCurrency(Math.abs(s.amount), false)}
                        {cat ? ` → ${cat.icon} ${cat.label}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusyId(s.tx_id)
                        await onAccept(s.tx_id, s.suggested_category, s.merchant_raw)
                        setBusyId(null)
                      }}
                      className="shrink-0 rounded-lg bg-duo-green/20 px-2.5 py-1 text-[10px] font-bold text-duo-green transition-colors hover:bg-duo-green/30 disabled:opacity-50"
                    >
                      {busy ? '…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDismiss(s.tx_id)}
                      className="shrink-0 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-surface-400 transition-colors hover:bg-white/[0.1] disabled:opacity-50"
                    >
                      Skip
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
