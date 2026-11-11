import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { formatAccountLabel } from '../../lib/accountDisplay'
import type { CategoryDef } from '../../lib/constants'
import { formatCurrency } from '../../lib/formatCurrency'
import {
  applyCategory,
  countChanged,
  countUnassigned,
  summarizeByCategory,
  type CategoryAssignments,
} from '../../lib/groupAssignments'
import { ui } from '../../lib/uiClasses'
import { useBottomSheetDrag } from '../../hooks/useBottomSheetDrag'
import { useDialogFocus } from '../../hooks/useDialogFocus'
import type { Transaction } from '../../types/database'
import CategorySelect from './CategorySelect'

interface GroupedTransactionsModalProps {
  open: boolean
  merchantLabel: string
  transactions: readonly Transaction[]
  initialAssignments: CategoryAssignments
  categories: readonly CategoryDef[]
  /** Deck flow: rows without a category stay in the deck. Recent flow: every row needs a category. */
  allowLeaveInDeck: boolean
  accountAliases: Map<string, string>
  saving: boolean
  onSave: (assignments: CategoryAssignments) => void
  onClose: () => void
}

const SELECT_CLASS = `${ui.select} w-full py-1.5 text-xs`
const CHANGED_ROW = 'border-gem/40 bg-gem/[0.07]'
const IDLE_ROW = 'border-white/[0.06] bg-surface-900/40'

/** Bottom sheet listing every transaction of a stack with its own category dropdown. */
export default function GroupedTransactionsModal({ open, ...rest }: GroupedTransactionsModalProps) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>{open && <GroupedTransactionsSheet {...rest} />}</AnimatePresence>,
    document.body,
  )
}

function formatTxDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function GroupedTransactionsSheet({
  merchantLabel,
  transactions,
  initialAssignments,
  categories,
  allowLeaveInDeck,
  accountAliases,
  saving,
  onSave,
  onClose,
}: Omit<GroupedTransactionsModalProps, 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [assignments, setAssignments] = useState<CategoryAssignments>(initialAssignments)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const { sheetDragProps, handleZoneProps } = useBottomSheetDrag(onClose)
  useDialogFocus(panelRef, onClose)

  const labelById = useMemo(() => new Map(categories.map((c) => [c.id, c.label])), [categories])
  const allIds = useMemo(() => transactions.map((t) => t.id), [transactions])
  const summary = useMemo(() => summarizeByCategory(transactions, assignments), [transactions, assignments])
  const changedCount = countChanged(initialAssignments, assignments)
  const unassignedCount = countUnassigned(assignments)
  const assignedCount = allIds.length - unassignedCount
  const allSelected = selectedIds.size === allIds.length
  const bulkLabel = selectedIds.size > 0 ? `Set ${selectedIds.size} selected to…` : 'Set all to…'
  const canSave =
    !saving &&
    assignedCount > 0 &&
    (allowLeaveInDeck || (unassignedCount === 0 && changedCount > 0))

  const saveLabel =
    allowLeaveInDeck && unassignedCount > 0
      ? `Save ${assignedCount}, leave ${unassignedCount} in deck`
      : `Save ${assignedCount} transaction${assignedCount === 1 ? '' : 's'}`

  const handleBulkChange = (category: string | null) => {
    const targetIds = selectedIds.size > 0 ? [...selectedIds] : allIds
    setAssignments((prev) => applyCategory(prev, targetIds, category))
  }

  const handleRowChange = (id: string, category: string | null) => {
    setAssignments((prev) => applyCategory(prev, [id], category))
  }

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(allIds))

  const handleSave = () => {
    if (canSave) onSave(assignments)
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 left-[var(--shell-nav-offset)] z-[120] bg-black/55 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="grouped-transactions-title"
        className="fixed inset-x-0 left-[var(--shell-nav-offset)] bottom-0 z-[121] mx-auto flex max-h-[min(86vh,calc(100vh-2rem))] max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 px-4 pt-2 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }}
        exit={{ y: '100%', transition: { duration: 0.18, ease: [0.4, 0, 1, 0] } }}
        {...sheetDragProps}
      >
        <div {...handleZoneProps()}>
          <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />
          <h3 id="grouped-transactions-title" className="text-center text-sm font-bold text-surface-50">
            {merchantLabel}
          </h3>
          <p className="mb-2 text-center text-[11px] text-surface-500">
            {transactions.length} transactions · choose a category for each
          </p>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-surface-400">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleToggleAll}
              aria-label="Select all transactions"
            />
            All
          </label>
          <CategorySelect
            categories={categories}
            value={null}
            onChange={handleBulkChange}
            emptyLabel={bulkLabel}
            ariaLabel="Set category for selected transactions"
            className={SELECT_CLASS}
          />
        </div>

        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pb-2">
          {transactions.map((tx) => {
            const changed = (initialAssignments[tx.id] ?? null) !== (assignments[tx.id] ?? null)
            const rowClass = changed ? CHANGED_ROW : IDLE_ROW
            return (
              <li key={tx.id} className={`rounded-xl border px-2.5 py-2 ${rowClass}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(tx.id)}
                    onChange={() => handleToggle(tx.id)}
                    aria-label={`Select ${formatTxDate(tx.tx_date)} ${formatCurrency(Number(tx.amount))}`}
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <span className="font-semibold tabular-nums text-surface-100">
                      {formatCurrency(Number(tx.amount))}
                    </span>
                    <span className="ml-2 text-surface-500">
                      {formatTxDate(tx.tx_date)} · {formatAccountLabel(tx.account_last4, accountAliases)}
                    </span>
                    {tx.user_note && (
                      <p className="truncate text-[10px] text-surface-500">📝 {tx.user_note}</p>
                    )}
                  </div>
                  <div className="w-44 shrink-0">
                    <CategorySelect
                      categories={categories}
                      value={assignments[tx.id] ?? null}
                      onChange={(category) => handleRowChange(tx.id, category)}
                      emptyLabel={allowLeaveInDeck ? 'Leave in deck' : 'Pick a category'}
                      ariaLabel={`Category for ${formatTxDate(tx.tx_date)} ${formatCurrency(Number(tx.amount))}`}
                      className={SELECT_CLASS}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="shrink-0 border-t border-white/[0.08] pt-2">
          <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Summary by category">
            {summary.map((row) => (
              <span
                key={row.category}
                className="rounded-full bg-surface-800/80 px-2 py-0.5 text-[10px] text-surface-300"
              >
                {row.count} × {labelById.get(row.category) ?? row.category} · {formatCurrency(row.total)}
              </span>
            ))}
            {unassignedCount > 0 && (
              <span className="rounded-full bg-flame/15 px-2 py-0.5 text-[10px] text-flame">
                {unassignedCount} without category
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/[0.1] bg-surface-800/80 px-4 py-2.5 text-sm font-semibold text-surface-300 hover:bg-surface-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green px-4 py-2.5 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}
