import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { COLOR_PALETTE, OWN_TRANSFERS_CATEGORY_ID, type CategoryDef } from '../../lib/constants'
import type { useCategoryConfig } from '../../hooks/useCategoryConfig'

type CatConfig = ReturnType<typeof useCategoryConfig>

interface Props {
  open: boolean
  onClose: () => void
  config: CatConfig
}

type EditingCat = CategoryDef & { isNew?: boolean; originalId?: string }

const ICON_SUGGESTIONS = [
  '🛒','🚗','📺','🍽️','🏖️','💊','📡','👟','🧸','🏠','📦','🔁',
  '🎮','🎵','💻','📚','🎓','✈️','🏋️','💇','🐕','🎁','☕','🍕',
  '🛍️','💡','🏥','🎬','🧹','🚿','🌐','🎯','💰','🏦','📱','🔧',
]

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

interface SampleTx {
  merchant_raw: string
  merchant_clean: string | null
  amount: number
  tx_date: string
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(v)

export default function CategoryEditorModal({ open, onClose, config }: Props) {
  const { categories, upsertCategory, renameCategory, deleteCategory, countTransactions, sampleTransactions } = config
  const [editing, setEditing] = useState<EditingCat | null>(null)
  /** null = loading, undefined = RPC error/unavailable */
  const [txCount, setTxCount] = useState<number | null | undefined>(null)
  const [samples, setSamples] = useState<SampleTx[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) {
      setEditing(null)
      setError(null)
      setConfirmDelete(false)
      setSamples([])
    }
  }, [open])

  const loadTxInfo = useCallback(async (id: string) => {
    setTxCount(null)
    setSamples([])
    const [c, s] = await Promise.all([
      countTransactions(id),
      sampleTransactions(id, 5),
    ])
    setTxCount(c === null ? undefined : c)
    setSamples(s)
  }, [countTransactions, sampleTransactions])

  const handleEdit = (cat: CategoryDef) => {
    setEditing({ ...cat, originalId: cat.id })
    setError(null)
    setConfirmDelete(false)
    void loadTxInfo(cat.id)
  }

  const handleNew = () => {
    setEditing({
      id: '',
      label: '',
      icon: '📦',
      color: COLOR_PALETTE[0].value,
      expenseType: 'discretionary',
      isNew: true,
    })
    setTxCount(0)
    setError(null)
    setConfirmDelete(false)
  }

  const handleSave = async () => {
    if (!editing) return
    const label = editing.label.trim()
    if (!label) { setError('Label is required'); return }

    const newId = editing.isNew ? slugify(label) : editing.id
    if (!newId) { setError('Could not generate an ID from the label'); return }

    // Duplicate check (client-side quick guard)
    const isDuplicate = categories.some(
      (c) => c.id !== editing.originalId && c.id === newId,
    )
    if (isDuplicate) {
      setError(`A category with id "${newId}" already exists`)
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (editing.isNew) {
        await upsertCategory({
          id: newId,
          label,
          icon: editing.icon,
          color: editing.color,
          expenseType: editing.expenseType,
        })
      } else if (editing.originalId && editing.originalId !== newId) {
        // Real rename (id changed)
        const res = await renameCategory(
          editing.originalId, newId, label, editing.icon, editing.color,
        )
        if (res.error) { setError(res.error); setSaving(false); return }
      } else {
        // Same id, just update metadata
        const res = await renameCategory(
          editing.originalId!, editing.originalId!, label, editing.icon, editing.color,
        )
        if (res.error) { setError(res.error); setSaving(false); return }
      }
      setEditing(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editing?.originalId) return
    setSaving(true)
    const res = await deleteCategory(editing.originalId)
    if (res.error) {
      setError(res.error)
      setSaving(false)
      return
    }
    setEditing(null)
    setSaving(false)
  }

  if (typeof document === 'undefined') return null

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
            className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[90vh] flex-col rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="shrink-0 px-4 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-surface-50">
                  {editing ? (editing.isNew ? 'New Category' : 'Edit Category') : 'Categories'}
                </h3>
                {editing ? (
                  <button
                    type="button"
                    onClick={() => { setEditing(null); setError(null); setConfirmDelete(false) }}
                    className="rounded-lg border border-white/[0.08] bg-surface-900/80 px-3 py-1.5 text-xs font-medium text-surface-400 transition-colors hover:bg-surface-800"
                  >
                    Back
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-white/[0.08] bg-surface-900/80 px-3 py-1.5 text-xs font-medium text-surface-400 transition-colors hover:bg-surface-800"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
              <AnimatePresence mode="wait">
                {!editing ? (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleEdit(cat)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all active:scale-95 ${cat.color}`}
                        >
                          <span className="text-2xl">{cat.icon}</span>
                          <span className="text-[11px] font-semibold leading-tight text-surface-200 text-center">{cat.label}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleNew}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] py-3 text-sm font-semibold text-duo-green transition-colors hover:border-duo-green/40 hover:bg-duo-green/5"
                    >
                      <span className="text-lg">+</span> Add Category
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="edit"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-5"
                  >
                    {/* Label */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                        Label
                      </label>
                      <input
                        type="text"
                        value={editing.label}
                        onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                        placeholder="e.g. Coffee Shops"
                        maxLength={40}
                        className="w-full rounded-xl border border-white/[0.08] bg-surface-900/80 px-3 py-2.5 text-sm text-surface-100 placeholder:text-surface-600 focus:border-duo-green/40 focus:outline-none focus:ring-1 focus:ring-duo-green/30"
                      />
                      {editing.isNew && editing.label.trim() && (
                        <p className="mt-1 text-[10px] text-surface-500">
                          ID: {slugify(editing.label)}
                        </p>
                      )}
                    </div>

                    {/* Icon */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                        Icon
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {ICON_SUGGESTIONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => setEditing({ ...editing, icon })}
                            className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition-all ${
                              editing.icon === icon
                                ? 'border-duo-green/60 bg-duo-green/15 scale-110'
                                : 'border-white/[0.06] bg-surface-900/50 hover:bg-surface-800/80'
                            }`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                        Tile Color
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setEditing({ ...editing, color: c.value })}
                            className={`h-9 w-9 rounded-lg border-2 transition-all ${c.value} ${
                              editing.color === c.value
                                ? 'ring-2 ring-duo-green/60 ring-offset-1 ring-offset-surface-950 scale-110'
                                : ''
                            }`}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                        Preview
                      </label>
                      <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 ${editing.color}`}>
                        <span className="text-2xl">{editing.icon}</span>
                        <span className="text-sm font-semibold text-surface-200">
                          {editing.label || 'Untitled'}
                        </span>
                      </div>
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400">
                        {error}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || !editing.label.trim()}
                        className="flex-1 rounded-xl border-b-[3px] border-duo-green-dark bg-duo-green py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(88,204,2,0.4)] transition-all active:translate-y-[1px] active:border-b disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : editing.isNew ? 'Create' : 'Save'}
                      </button>
                    </div>

                    {/* Usage & delete zone */}
                    {!editing.isNew && editing.originalId !== OWN_TRANSFERS_CATEGORY_ID && (
                      <div className="border-t border-white/[0.06] pt-4">
                        <p className="mb-1 text-[11px] text-surface-500">
                          {txCount === null
                            ? 'Checking…'
                            : txCount === undefined
                              ? 'Could not check transaction count (migration may need to be applied).'
                              : txCount > 0
                                ? `${txCount} transaction${txCount !== 1 ? 's' : ''} use this category — delete is disabled.`
                                : 'No transactions use this category. You can safely delete it.'}
                        </p>

                        {samples.length > 0 && (
                          <div className="mb-3 mt-2 space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                              Recent transactions
                            </p>
                            {samples.map((tx, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5"
                              >
                                <span className="flex-1 truncate text-xs text-surface-300">
                                  {tx.merchant_clean ?? tx.merchant_raw}
                                </span>
                                <span className="shrink-0 text-[10px] text-surface-500">
                                  {new Date(tx.tx_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                <span className="shrink-0 text-xs font-semibold tabular-nums text-surface-200">
                                  {fmt(Number(tx.amount))}
                                </span>
                              </div>
                            ))}
                            {typeof txCount === 'number' && txCount > samples.length && (
                              <p className="text-[10px] text-surface-500">
                                …and {txCount - samples.length} more
                              </p>
                            )}
                          </div>
                        )}

                        {!confirmDelete ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(true)}
                            disabled={txCount === null || txCount === undefined || txCount > 0 || saving}
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Delete category
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleDelete()}
                              disabled={saving}
                              className="rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                            >
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(false)}
                              className="rounded-xl border border-white/[0.08] bg-surface-900/80 px-4 py-2 text-xs font-medium text-surface-400"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
