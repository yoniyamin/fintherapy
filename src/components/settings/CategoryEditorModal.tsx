import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { COLOR_PALETTE, NO_IDEA_CATEGORY_ID, OWN_TRANSFERS_CATEGORY_ID, type CategoryDef, type SpendingFrequency } from '../../lib/constants'
import {
  categoryHasBuiltInIcon,
  CATEGORY_GIF_OPTIONS,
  gifIconKey,
  isFluentEmojiToken,
  isGifIconToken,
  toGifIconToken,
} from '../../lib/categoryIconAssets'
import {
  buildFluentEmojiUrl,
  fluentEmojiKey,
  FLUENT_EMOJI_GROUPS,
  toFluentEmojiToken,
} from '../../lib/fluentAnimatedEmojis'
import { formatCurrency } from '../../lib/formatCurrency'
import CategoryIcon from '../common/CategoryIcon'
import { useBottomSheetDrag } from '../../hooks/useBottomSheetDrag'
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

export default function CategoryEditorModal({ open, onClose, config }: Props) {
  const { categories, upsertCategory, renameCategory, deleteCategory, countTransactions, sampleTransactions } = config
  const [editing, setEditing] = useState<EditingCat | null>(null)
  /** null = loading, undefined = RPC error/unavailable */
  const [txCount, setTxCount] = useState<number | null | undefined>(null)
  const [samples, setSamples] = useState<SampleTx[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [subcatBannerDismissed, setSubcatBannerDismissed] = useState(false)
  const [expandedFluentGroups, setExpandedFluentGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(FLUENT_EMOJI_GROUPS.map((g) => [g.id, g.defaultExpanded])),
  )
  const { sheetDragProps, handleZoneProps } = useBottomSheetDrag(onClose)

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
      spendingFrequency: 'monthly',
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
          spendingFrequency: editing.spendingFrequency,
          parentCategoryId: editing.parentCategoryId,
        })
      } else if (editing.originalId && editing.originalId !== newId) {
        const res = await renameCategory(
          editing.originalId, newId, label, editing.icon, editing.color,
        )
        if (res.error) { setError(res.error); setSaving(false); return }
        await upsertCategory({
          id: newId, label, icon: editing.icon, color: editing.color,
          expenseType: editing.expenseType, spendingFrequency: editing.spendingFrequency,
          parentCategoryId: editing.parentCategoryId,
        })
      } else {
        await upsertCategory({
          id: editing.originalId!, label, icon: editing.icon, color: editing.color,
          expenseType: editing.expenseType, spendingFrequency: editing.spendingFrequency,
          parentCategoryId: editing.parentCategoryId,
        })
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

  const editingCategoryId = editing
    ? editing.isNew
      ? slugify(editing.label)
      : (editing.originalId ?? editing.id)
    : ''
  const editingHasBuiltInIcon =
    !!editingCategoryId && categoryHasBuiltInIcon(editingCategoryId)
  const selectedGifKey = editing ? gifIconKey(editing.icon) : null
  const selectedFluentKey = editing ? fluentEmojiKey(editing.icon) : null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 left-[var(--shell-nav-offset)] z-[100] bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-0 left-[var(--shell-nav-offset)] bottom-0 z-[101] flex max-h-[90vh] flex-col rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            {...sheetDragProps}
          >
            <div {...handleZoneProps('shrink-0 px-4 pt-3')}>
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
                      {categories.map((cat) => {
                        const parentLabel = cat.parentCategoryId
                          ? categories.find((c) => c.id === cat.parentCategoryId)?.label
                          : undefined
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleEdit(cat)}
                            className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all active:scale-95 ${cat.color}`}
                          >
                            <CategoryIcon categoryId={cat.id} emoji={cat.icon} size="xl" />
                            <span className="text-[11px] font-semibold leading-tight text-surface-200 text-center">{cat.label}</span>
                            {parentLabel && (
                              <span className="text-[9px] leading-tight text-surface-400 text-center">
                                ↳ {parentLabel}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {!subcatBannerDismissed && !categories.some(c => c.parentCategoryId) && (
                      <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold text-cyan-300">Subcategories available</p>
                            <p className="mt-0.5 text-[10px] text-surface-400">
                              You can now nest categories (e.g. Kids &rarr; Activities, Clothing). Edit any category and pick a parent.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSubcatBannerDismissed(true)}
                            className="shrink-0 text-[10px] text-surface-500 hover:text-surface-300"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

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
                      {editingHasBuiltInIcon ? (
                        <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-surface-900/50 px-3 py-3">
                          <CategoryIcon
                            categoryId={editingCategoryId}
                            emoji={editing.icon}
                            size="xl"
                          />
                          <p className="text-xs leading-snug text-surface-400">
                            Built-in animated icon for this category. Emoji picks apply only to custom categories.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                              Animated
                            </p>
                            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                              {CATEGORY_GIF_OPTIONS.map((option) => (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => setEditing({ ...editing, icon: toGifIconToken(option.key) })}
                                  title={option.label}
                                  className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 transition-all ${
                                    selectedGifKey === option.key
                                      ? 'border-duo-green/60 bg-duo-green/15 scale-105'
                                      : 'border-white/[0.06] bg-surface-900/50 hover:bg-surface-800/80'
                                  }`}
                                >
                                  <img
                                    src={option.src}
                                    alt=""
                                    aria-hidden
                                    className="h-7 w-7 object-contain"
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                              Fluent Animated
                            </p>
                            <div className="max-h-40 overflow-y-auto overscroll-contain rounded-lg border border-white/[0.06] bg-surface-900/30 p-1.5">
                              {FLUENT_EMOJI_GROUPS.map((group) => {
                                const isExpanded = expandedFluentGroups[group.id] ?? group.defaultExpanded
                                return (
                                  <div key={group.id} className="mb-1 last:mb-0">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedFluentGroups((prev) => ({ ...prev, [group.id]: !isExpanded }))}
                                      className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-surface-400 transition-colors hover:text-surface-300"
                                    >
                                      <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▸</span>
                                      {group.label}
                                    </button>
                                    {isExpanded && (
                                      <div className="mt-1 grid grid-cols-5 gap-1 sm:grid-cols-6">
                                        {group.emojis.map((emoji) => (
                                          <button
                                            key={emoji.key}
                                            type="button"
                                            onClick={() => setEditing({ ...editing!, icon: toFluentEmojiToken(emoji.key) })}
                                            title={emoji.label}
                                            className={`flex h-11 flex-col items-center justify-center rounded-lg border transition-all ${
                                              selectedFluentKey === emoji.key
                                                ? 'border-duo-green/60 bg-duo-green/15 scale-105'
                                                : 'border-white/[0.04] hover:bg-surface-800/80'
                                            }`}
                                          >
                                            <img
                                              src={buildFluentEmojiUrl(emoji.folder)}
                                              alt=""
                                              aria-hidden
                                              loading="lazy"
                                              className="h-7 w-7 object-contain"
                                            />
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <div>
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                              Emoji
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {ICON_SUGGESTIONS.map((icon) => (
                                <button
                                  key={icon}
                                  type="button"
                                  onClick={() => setEditing({ ...editing, icon })}
                                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition-all ${
                                    !isGifIconToken(editing.icon) && !isFluentEmojiToken(editing.icon) && editing.icon === icon
                                      ? 'border-duo-green/60 bg-duo-green/15 scale-110'
                                      : 'border-white/[0.06] bg-surface-900/50 hover:bg-surface-800/80'
                                  }`}
                                >
                                  {icon}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
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

                    {/* Expense Type */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                        Expense Type
                      </label>
                      <div className="flex gap-1.5">
                        {([
                          { value: 'discretionary' as const, label: 'Discretionary' },
                          { value: 'fixed' as const, label: 'Fixed Cost' },
                        ]).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setEditing({ ...editing, expenseType: opt.value })}
                            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                              editing.expenseType === opt.value
                                ? 'border-duo-green/60 bg-duo-green/15 text-duo-green'
                                : 'border-white/[0.08] bg-surface-900/80 text-surface-400 hover:bg-surface-800'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-surface-500">
                        Fixed costs (like rent or school fees) are separated from discretionary spending (like dining or clothes) in budget analysis.
                      </p>
                    </div>

                    {/* Spending Frequency */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                        Spending Frequency
                      </label>
                      <div className="flex gap-1.5">
                        {([
                          { value: 'monthly' as SpendingFrequency, label: 'Monthly' },
                          { value: 'annual' as SpendingFrequency, label: 'Annual' },
                          { value: 'one_off' as SpendingFrequency, label: 'One-off' },
                        ]).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setEditing({ ...editing, spendingFrequency: opt.value })}
                            className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                              editing.spendingFrequency === opt.value
                                ? 'border-duo-green/60 bg-duo-green/15 text-duo-green'
                                : 'border-white/[0.08] bg-surface-900/80 text-surface-400 hover:bg-surface-800'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-surface-500">
                        {editing.spendingFrequency === 'annual'
                          ? 'Costs spread across 12 months in reports (e.g. insurance, holidays).'
                          : editing.spendingFrequency === 'one_off'
                            ? 'Excluded from monthly averages and trend analysis.'
                            : 'Included in monthly averages and trend analysis.'}
                      </p>
                    </div>

                    {/* Parent Category */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                        Parent Category
                      </label>
                      <select
                        value={editing.parentCategoryId ?? ''}
                        onChange={(e) => setEditing({ ...editing, parentCategoryId: e.target.value || undefined })}
                        className="w-full rounded-xl border border-white/[0.08] bg-surface-900/80 px-3 py-2.5 text-sm text-surface-100 focus:border-duo-green/40 focus:outline-none focus:ring-1 focus:ring-duo-green/30"
                      >
                        <option value="">None (top-level)</option>
                        {categories
                          .filter((c) =>
                            c.id !== (editing.originalId ?? editing.id) &&
                            !c.parentCategoryId &&
                            c.id !== OWN_TRANSFERS_CATEGORY_ID &&
                            c.id !== NO_IDEA_CATEGORY_ID
                          )
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                          ))}
                      </select>
                      <p className="mt-1 text-[10px] text-surface-500">
                        Make this a subcategory of another category for grouped reports.
                      </p>
                    </div>

                    {/* Preview */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                        Preview
                      </label>
                      <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 ${editing.color}`}>
                        <CategoryIcon
                          categoryId={editingCategoryId || 'preview'}
                          emoji={editing.icon}
                          size="xl"
                        />
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
                    {!editing.isNew && editing.originalId !== OWN_TRANSFERS_CATEGORY_ID && editing.originalId !== NO_IDEA_CATEGORY_ID && (
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
                                  {formatCurrency(Number(tx.amount))}
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
