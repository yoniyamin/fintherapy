import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { Transaction } from '../../types/database'
import { CATEGORIES, type CategoryDef } from '../../lib/constants'
import { formatAccountLabel } from '../../lib/accountDisplay'

interface Props {
  category: string
  transactions: Transaction[]
  loading: boolean
  onClose: () => void
  onReclassify: (txId: string, newCategory: string) => Promise<void>
  onMarkTransfer?: (txId: string) => Promise<void>
  accountAliases?: Map<string, string>
  /** Resolved categories from useCategoryConfig; falls back to hard-coded defaults. */
  categories?: readonly CategoryDef[]
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(v)

export default function CategoryDetail({
  category,
  transactions,
  loading,
  onClose,
  onReclassify,
  onMarkTransfer,
  accountAliases,
  categories: categoriesProp,
}: Props) {
  const [movingTxId, setMovingTxId] = useState<string | null>(null)
  const [reclassifying, setReclassifying] = useState(false)

  const cats = categoriesProp ?? CATEGORIES
  const cat = cats.find(c => c.id === category)

  const handleMove = async (txId: string, newCategory: string) => {
    setReclassifying(true)
    await onReclassify(txId, newCategory)
    setReclassifying(false)
    setMovingTxId(null)
  }

  const handleTransfer = async (txId: string) => {
    if (!onMarkTransfer) return
    setReclassifying(true)
    await onMarkTransfer(txId)
    setReclassifying(false)
    setMovingTxId(null)
  }

  return createPortal(
    <>
      <motion.div
        className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[85vh] flex-col rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Sticky header */}
        <div className="shrink-0 px-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />

          <div className="mb-4 flex items-center gap-3">
            <span className="text-2xl">{cat?.icon ?? '📦'}</span>
            <div className="flex-1">
              <h3 className="text-base font-bold text-surface-50">{cat?.label ?? category}</h3>
              <p className="text-xs text-surface-500">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.08] bg-surface-900/80 px-3 py-1.5 text-xs font-medium text-surface-400 transition-colors hover:bg-surface-800"
            >
              Close
            </button>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-duo-green border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {transactions.map(tx => (
                <div key={tx.id} className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-3 backdrop-blur-sm">
                  <p className="text-sm font-medium text-surface-200">
                    {tx.merchant_clean ?? tx.merchant_raw}
                  </p>
                  <p className="mt-0.5 text-[11px] text-surface-500">
                    {formatAccountLabel(tx.account_last4, accountAliases ?? new Map())}
                  </p>
                  {tx.user_note?.trim() && (
                    <p className="mt-1.5 text-[11px] leading-snug text-surface-400">{tx.user_note.trim()}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-surface-500">
                      {new Date(tx.tx_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex-1 text-right text-sm font-semibold tabular-nums text-primary-400">
                      {fmt(Number(tx.amount))}
                    </span>
                    {onMarkTransfer && (
                      <button
                        type="button"
                        onClick={() => handleTransfer(tx.id)}
                        disabled={reclassifying}
                        className="rounded-md border border-ice/20 bg-ice/10 px-2 py-1 text-xs font-medium text-ice transition-colors hover:bg-ice/20 disabled:opacity-50"
                        title="Mark as money transfer"
                      >
                        💸
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMovingTxId(movingTxId === tx.id ? null : tx.id)}
                      className="rounded-md border border-white/[0.08] bg-surface-800/80 px-2 py-1 text-xs font-medium text-surface-400 transition-colors hover:bg-surface-700"
                    >
                      Move
                    </button>
                  </div>

                  <AnimatePresence>
                    {movingTxId === tx.id && (
                      <motion.div
                        className="mt-2.5 grid grid-cols-3 gap-1.5"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {cats.filter(c => c.id !== category).map(c => (
                          <button
                            key={c.id}
                            onClick={() => handleMove(tx.id, c.id)}
                            disabled={reclassifying}
                            className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-all active:scale-95 disabled:opacity-50 ${c.color}`}
                          >
                            <span className="text-base">{c.icon}</span>
                            <span className="text-[10px] font-medium leading-tight text-surface-200">{c.label}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>,
    document.body,
  )
}
