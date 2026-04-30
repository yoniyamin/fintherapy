import { useEffect, useMemo } from 'react'
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion'
import type { MerchantGroup } from '../../stores/classificationStore'
import { CATEGORIES, type CategoryDef } from '../../lib/constants'
import { formatAccountLabel } from '../../lib/accountDisplay'
import type { AccountType } from '../../types/database'

interface SwipeCardProps {
  group: MerchantGroup
  onSwipeRight: () => void
  onSwipeLeft: () => void
  /** Vertical swipe (or external trigger) to open the category picker. */
  onSwipeUp?: () => void
  onTransfer: () => void
  stackIndex: number
  /** Main deck: categorize / no idea. No idea deck: pick category / skip for later */
  rightLabel?: string
  leftLabel?: string
  showTransferButton?: boolean
  accountAliases?: Map<string, string>
  /** Per-card account_type (credit/debit) — drives the "card load" hint. */
  accountTypes?: Map<string, AccountType>
  /** When true and the group mixes multiple cards, show account next to each amount. */
  showAccountPerLine?: boolean
  /** Shown when any transaction has a note (top card). */
  notePreview?: string | null
  onOpenNote?: () => void
  /** Resolved categories from useCategoryConfig; falls back to hard-coded defaults. */
  categories?: readonly CategoryDef[]
}

const SWIPE_DISTANCE = 90
const SWIPE_VELOCITY = 500

export default function SwipeCard({
  group,
  onSwipeRight,
  onSwipeLeft,
  onSwipeUp,
  onTransfer,
  stackIndex,
  rightLabel = 'Categorize',
  leftLabel = 'No idea',
  showTransferButton = true,
  accountAliases = new Map(),
  accountTypes = new Map(),
  showAccountPerLine = false,
  notePreview = null,
  onOpenNote,
  categories,
}: SwipeCardProps) {
  const cats = categories ?? CATEGORIES
  const catLookup = useMemo(
    () => Object.fromEntries(cats.map((c) => [c.id, c])) as Record<string, CategoryDef | undefined>,
    [cats],
  )

  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const controls = useAnimation()
  const rotate = useTransform(x, [-200, 200], [-12, 12])
  const rightOpacity = useTransform(x, [0, 100], [0, 1])
  const leftOpacity = useTransform(x, [-100, 0], [1, 0])
  const upOpacity = useTransform(y, [-100, 0], [1, 0])

  const isTopCard = stackIndex === 0
  const scale = 1 - stackIndex * 0.05
  const yOffset = stackIndex * 10
  const predicted = group.predictedCategory ? catLookup[group.predictedCategory] : null

  const handleDragEnd = (
    _: unknown,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } },
  ) => {
    const { offset, velocity } = info
    const horizontal = Math.abs(offset.x) > Math.abs(offset.y)

    if (horizontal && (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY)) {
      void controls.start({
        x: 600,
        opacity: 0,
        rotate: 24,
        transition: { duration: 0.28, ease: 'easeOut' },
      })
      onSwipeRight()
      return
    }
    if (horizontal && (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY)) {
      void controls.start({
        x: -600,
        opacity: 0,
        rotate: -24,
        transition: { duration: 0.28, ease: 'easeOut' },
      })
      onSwipeLeft()
      return
    }
    if (
      !horizontal &&
      onSwipeUp &&
      (offset.y < -SWIPE_DISTANCE || velocity.y < -SWIPE_VELOCITY)
    ) {
      void controls.start({
        y: -600,
        opacity: 0,
        transition: { duration: 0.26, ease: 'easeOut' },
      })
      onSwipeUp()
      return
    }
    // Below threshold: spring x/y back to origin so the card returns to center.
    void controls.start({
      x: 0,
      y: 0,
      transition: { type: 'spring', stiffness: 420, damping: 32 },
    })
  }

  // When this card becomes the top card (mount or no-idea rotate), animate to resting
  // pose. controls.start drives a smooth entrance from `initial`; on later transitions
  // (e.g. after a no-idea skip rotates a different group to top) it just snaps cleanly.
  useEffect(() => {
    if (isTopCard) {
      x.set(0)
      y.set(0)
      void controls.start({
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        rotate: 0,
        transition: { type: 'spring', stiffness: 320, damping: 28 },
      })
    }
  }, [isTopCard, group.key, controls, x, y])

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const tx = group.transactions[0]
  const distinctLast4 = new Set(
    group.transactions.map((t) => t.account_last4?.trim() ?? '').filter(Boolean),
  )
  const showMixedAccountTags = showAccountPerLine && distinctLast4.size > 1

  /** Show "looks like a card load" hint when this group is positive-amount on a debit card. */
  const isLikelyCardLoad =
    isTopCard &&
    showTransferButton &&
    group.totalAmount > 0 &&
    distinctLast4.size > 0 &&
    [...distinctLast4].every((l) => accountTypes.get(l) === 'debit')

  const dateRange = group.count > 1
    ? `${formatDate(group.transactions[group.transactions.length - 1].tx_date)} – ${formatDate(group.transactions[0].tx_date)}`
    : formatDate(tx.tx_date)

  // Non-top cards: skip drag wiring, drop the expensive backdrop-blur, and freeze them
  // to a static transform so the dragging top card doesn't trigger frame-by-frame
  // re-layouts on the stack underneath. Backdrop-blur is the single biggest GPU cost
  // on mid-range Android during the swipe — applying it only to the top card removes
  // the worst of the jank.
  return (
    <motion.div
      className={`absolute inset-0 ${isTopCard ? 'cursor-grab touch-none active:cursor-grabbing' : 'pointer-events-none'}`}
      style={{
        x: isTopCard ? x : 0,
        y: isTopCard ? y : yOffset,
        rotate: isTopCard ? rotate : 0,
        scale,
        zIndex: 10 - stackIndex,
        willChange: isTopCard ? 'transform' : undefined,
      }}
      drag={isTopCard}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.4}
      dragMomentum={false}
      onDragEnd={isTopCard ? handleDragEnd : undefined}
      animate={isTopCard ? controls : { scale, opacity: 1, y: yOffset }}
      initial={{ scale: 0.95, opacity: 0, y: yOffset + 30 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      <div
        className={`flex h-full flex-col items-center justify-center rounded-[24px] border border-white/[0.09] bg-gradient-to-br from-white/[0.07] via-surface-950 to-surface-950 p-8 shadow-[0_28px_56px_-24px_rgba(0,0,0,0.55)] ${isTopCard ? 'backdrop-blur-xl' : ''}`}
      >
        {isTopCard && (
          <>
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-2xl border border-duo-green"
              style={{ opacity: rightOpacity }}
            />
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-2xl border border-flame"
              style={{ opacity: leftOpacity }}
            />
            {onSwipeUp && (
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-2xl border border-gem"
                style={{ opacity: upOpacity }}
              />
            )}

            <motion.div
              className="absolute left-4 top-4 rounded-lg bg-duo-green px-3 py-1 text-xs font-bold text-white"
              style={{ opacity: rightOpacity }}
            >
              {rightLabel}
            </motion.div>
            <motion.div
              className="absolute right-4 top-4 rounded-lg bg-flame px-3 py-1 text-xs font-bold text-white"
              style={{ opacity: leftOpacity }}
            >
              {leftLabel}
            </motion.div>
            {onSwipeUp && (
              <motion.div
                className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-gem px-3 py-1 text-xs font-bold text-white"
                style={{ opacity: upOpacity }}
              >
                Change category
              </motion.div>
            )}
          </>
        )}

        {isTopCard && onOpenNote && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenNote()
            }}
            className="absolute bottom-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-gem/15 text-lg transition-all active:scale-90 active:bg-gem/25"
            title="Add or edit note"
          >
            📝
          </button>
        )}

        {isTopCard && showTransferButton && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTransfer()
            }}
            className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-ice/10 text-lg transition-all active:scale-90 active:bg-ice/20"
            title="Mark as own account transfer"
          >
            💸
          </button>
        )}

        <div className="text-center">
          <p className="text-xs text-surface-500">{dateRange}</p>
          <h2 className="mt-2 text-xl font-bold text-surface-50">
            {group.merchantClean ?? group.merchantRaw}
          </h2>

          {predicted && (
            <motion.div
              className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full border border-duo-green/40 bg-duo-green/15 px-2.5 py-1"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', delay: 0.05, damping: 18 }}
            >
              <span className="text-[11px] uppercase tracking-wider text-duo-green/80">Predicted</span>
              <span className="text-sm">{predicted.icon}</span>
              <span className="text-xs font-semibold text-duo-green">{predicted.label}</span>
            </motion.div>
          )}

          {group.count > 1 && (
            <motion.div
              className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full bg-gem/10 px-2.5 py-0.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
            >
              <span className="text-xs font-semibold text-gem">
                {group.count >= 3 ? '🎯 Smart Stack · ' : ''}
                {group.count} transactions
              </span>
            </motion.div>
          )}

          <p className="mt-4 text-4xl font-extrabold tracking-tight tabular-nums text-primary-400">
            {formatAmount(group.totalAmount)}
          </p>

          {group.count > 1 && (
            <div className="mt-1 space-y-0.5 text-xs text-surface-500">
              {showMixedAccountTags ? (
                group.transactions.map((t) => (
                  <p key={t.id} className="tabular-nums">
                    <span className="text-surface-400">
                      {formatAccountLabel(t.account_last4, accountAliases)}
                    </span>
                    {' · '}
                    {formatAmount(Number(t.amount))}
                  </p>
                ))
              ) : (
                <p>{group.transactions.map((t) => formatAmount(Number(t.amount))).join(' + ')}</p>
              )}
            </div>
          )}

          {isTopCard && notePreview && (
            <p className="mt-3 max-w-full px-1 text-center text-[11px] leading-snug text-surface-400 line-clamp-3">
              {notePreview}
            </p>
          )}
        </div>

        {isLikelyCardLoad && (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-ice/10 px-3 py-2.5 ring-1 ring-ice/25">
            <p className="text-center text-[11px] leading-snug text-ice">
              Looks like a card load — money you moved <em>into</em> this debit card, not spending.
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTransfer()
              }}
              className="rounded-lg bg-ice px-3 py-1.5 text-xs font-bold text-surface-950 active:scale-95"
            >
              💸 Mark as transfer
            </button>
          </div>
        )}

        {isTopCard && (
          <p
            className={`text-[10px] font-medium tracking-wider text-surface-500 ${
              notePreview || isLikelyCardLoad ? 'mt-3' : 'mt-8'
            }`}
          >
            {predicted
              ? 'Right to confirm · up to change · left for no idea'
              : 'Swipe right to categorize · left to flag'}
          </p>
        )}
      </div>
    </motion.div>
  )
}
