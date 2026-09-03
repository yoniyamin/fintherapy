import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { Transaction } from '../../types/database'
import type { CategoryDef } from '../../lib/constants'
import { formatAccountLabel } from '../../lib/accountDisplay'
import { formatCurrency } from '../../lib/formatCurrency'
import { useBottomSheetDrag } from '../../hooks/useBottomSheetDrag'

interface Props {
  category: string
  transactions: Transaction[]
  loading: boolean
  onClose: () => void
  onReclassify: (txId: string, newCategory: string) => Promise<void>
  onMarkTransfer?: (txId: string) => Promise<void>
  onSaveNote?: (txId: string, note: string | null) => Promise<void>
  accountAliases?: Map<string, string>
  categories: readonly CategoryDef[]
  /** Optional context line (e.g. billing month). */
  subtitle?: string
}

export default function CategoryDetail({
  category,
  transactions,
  loading,
  onClose,
  onReclassify,
  onMarkTransfer,
  onSaveNote,
  accountAliases,
  categories,
  subtitle,
}: Props) {
  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount))),
    [transactions],
  )
  const [localTxns, setLocalTxns] = useState(sortedTransactions)
  const [movingTxId, setMovingTxId] = useState<string | null>(null)
  const [noteTxId, setNoteTxId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [reclassifying, setReclassifying] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const { sheetDragProps, handleZoneProps } = useBottomSheetDrag(onClose)

  useEffect(() => {
    setLocalTxns(sortedTransactions)
  }, [sortedTransactions])

  const cats = categories
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

  const handleOpenNote = (tx: Transaction) => {
    if (noteTxId === tx.id) {
      setNoteTxId(null)
      return
    }
    setMovingTxId(null)
    setNoteTxId(tx.id)
    setNoteDraft(tx.user_note?.trim() ?? '')
  }

  const handleSaveNote = async (txId: string) => {
    if (!onSaveNote) return
    setSavingNote(true)
    const trimmed = noteDraft.trim() || null
    await onSaveNote(txId, trimmed)
    setLocalTxns(prev => prev.map(t => (t.id === txId ? { ...t, user_note: trimmed } : t)))
    setSavingNote(false)
    setNoteTxId(null)
  }

  return createPortal(
    <>
      <motion.div
        className="fixed inset-0 left-[var(--shell-nav-offset)] z-[60] bg-black/55 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        className="fixed inset-x-0 left-[var(--shell-nav-offset)] bottom-0 z-[70] flex max-h-[85vh] flex-col rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        {...sheetDragProps}
      >
        <div {...handleZoneProps('shrink-0 px-4 pt-3')}>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />

          <div className="mb-4 flex items-center gap-3">
            <span className="text-2xl">{cat?.icon ?? '📦'}</span>
            <div className="flex-1">
              <h3 className="text-base font-bold text-surface-50">{cat?.label ?? category}</h3>
              {subtitle && (
                <p className="text-xs text-surface-400">{subtitle}</p>
              )}
              <p className="text-xs text-surface-500">
                {localTxns.length} transaction{localTxns.length !== 1 ? 's' : ''}
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

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-duo-green border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {localTxns.map(tx => (
                <div key={tx.id} className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-3 backdrop-blur-sm">
                  <p className="text-sm font-medium text-surface-200">
                    {tx.merchant_clean ?? tx.merchant_raw}
                  </p>
                  <p className="mt-0.5 text-[11px] text-surface-500">
                    {formatAccountLabel(tx.account_last4, accountAliases ?? new Map())}
                  </p>
                  {tx.user_note?.trim() && noteTxId !== tx.id && (
                    <p className="mt-1.5 text-[11px] leading-snug text-surface-400">{tx.user_note.trim()}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-xs text-surface-500">
                      {new Date(tx.tx_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="flex-1 text-right text-sm font-semibold tabular-nums text-primary-400">
                      {formatCurrency(Number(tx.amount))}
                    </span>
                    {onMarkTransfer && (
                      <button
                        type="button"
                        onClick={() => handleTransfer(tx.id)}
                        disabled={reclassifying || savingNote}
                        className="rounded-md border border-ice/20 bg-ice/10 px-2 py-1 text-xs font-medium text-ice transition-colors hover:bg-ice/20 disabled:opacity-50"
                        title="Mark as money transfer"
                      >
                        💸
                      </button>
                    )}
                    {onSaveNote && (
                      <button
                        type="button"
                        onClick={() => handleOpenNote(tx)}
                        disabled={reclassifying || savingNote}
                        className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                          tx.user_note?.trim()
                            ? 'border-gem/25 bg-gem/10 text-gem hover:bg-gem/20'
                            : 'border-white/[0.08] bg-surface-800/80 text-surface-400 hover:bg-surface-700'
                        }`}
                      >
                        Note
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setNoteTxId(null)
                        setMovingTxId(movingTxId === tx.id ? null : tx.id)
                      }}
                      disabled={reclassifying || savingNote}
                      className="rounded-md border border-white/[0.08] bg-surface-800/80 px-2 py-1 text-xs font-medium text-surface-400 transition-colors hover:bg-surface-700 disabled:opacity-50"
                    >
                      Move
                    </button>
                  </div>

                  <AnimatePresence>
                    {noteTxId === tx.id && (
                      <motion.div
                        className="mt-2.5"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <textarea
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="Why is this here? Context for later…"
                          maxLength={2000}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-white/[0.08] bg-surface-900/80 px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-600 focus:border-duo-green/40 focus:outline-none focus:ring-1 focus:ring-duo-green/30"
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setNoteTxId(null)}
                            disabled={savingNote}
                            className="flex-1 rounded-lg border border-white/[0.1] bg-surface-800/80 py-2 text-xs font-semibold text-surface-300 transition-colors hover:bg-surface-700 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveNote(tx.id)}
                            disabled={savingNote}
                            className="flex-1 rounded-lg border-b-[3px] border-duo-green-dark bg-duo-green py-2 text-xs font-bold text-white shadow-[0_8px_24px_-8px_rgba(88,204,2,0.4)] transition-[transform,opacity,filter] duration-150 active:scale-[0.97] disabled:opacity-50"
                          >
                            {savingNote ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

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
                            className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-[transform,opacity] duration-150 active:scale-95 disabled:opacity-50 ${c.color}`}
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
