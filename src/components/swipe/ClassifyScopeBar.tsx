import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { formatAccountLabel } from '../../lib/accountDisplay'
import { formatBillingMonthLabel } from '../../lib/classifyDeckScope'
import { useBottomSheetDrag } from '../../hooks/useBottomSheetDrag'

export type ClassifyScopeBarProps = {
  accountAliases: Map<string, string>
  accountFilter: string | null
  cardPicklist: string[]
  effectiveMonthFilter: string | null
  flaggedByMonth: Map<string, number>
  hasPendingOnCard: (last4: string) => boolean
  monthsInScope: string[]
  onAccountChange: (last4: string | null) => void
  onEditCard: (last4: string) => void
  onMonthChange: (month: string) => void
  pendingMonthsPerCard: Map<string, number>
  emphasizeMonthQueue?: boolean
  showAllCardsOption: boolean
  stacksByMonth: Map<string, number>
}

function MonthQueueDots({
  monthsInScope,
  effectiveMonthFilter,
  stacksByMonth,
  emphasize,
}: {
  monthsInScope: string[]
  effectiveMonthFilter: string | null
  stacksByMonth: Map<string, number>
  emphasize?: boolean
}) {
  if (monthsInScope.length < 2) return null

  return (
    <div className="flex items-center justify-center gap-1 pt-1.5" aria-hidden>
      {monthsInScope.map((bm) => {
        const pending = (stacksByMonth.get(bm) ?? 0) > 0
        const active = bm === effectiveMonthFilter
        return (
          <motion.span
            key={bm}
            title={formatBillingMonthLabel(bm)}
            className={`h-1.5 rounded-full ${
              active
                ? 'w-4 bg-gem'
                : pending
                  ? 'w-1.5 bg-duo-green'
                  : 'w-1.5 bg-surface-600'
            }`}
            animate={
              emphasize && active
                ? { opacity: [1, 0.55, 1], scale: [1, 1.08, 1] }
                : emphasize && pending && !active
                  ? { opacity: [0.7, 1, 0.7] }
                  : undefined
            }
            transition={
              emphasize
                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                : undefined
            }
          />
        )
      })}
    </div>
  )
}

function scopeLineLabel(
  accountFilter: string | null,
  accountAliases: Map<string, string>,
  effectiveMonthFilter: string | null,
  hasCardChoice: boolean,
  hasMonthChoice: boolean,
): string {
  const parts: string[] = []
  if (hasCardChoice) {
    parts.push(
      accountFilter ? formatAccountLabel(accountFilter, accountAliases) : 'All cards',
    )
  }
  if (hasMonthChoice && effectiveMonthFilter) {
    parts.push(formatBillingMonthLabel(effectiveMonthFilter))
  }
  return parts.join(' · ')
}

export default function ClassifyScopeBar({
  accountAliases,
  accountFilter,
  cardPicklist,
  effectiveMonthFilter,
  flaggedByMonth,
  hasPendingOnCard,
  monthsInScope,
  onAccountChange,
  onEditCard,
  onMonthChange,
  emphasizeMonthQueue = false,
  pendingMonthsPerCard,
  showAllCardsOption,
  stacksByMonth,
}: ClassifyScopeBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const hasCardChoice = showAllCardsOption
  const hasMonthChoice = monthsInScope.length >= 2
  const showBar = hasCardChoice || hasMonthChoice

  const handleOpenSheet = useCallback(() => {
    setSheetOpen(true)
  }, [])

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false)
  }, [])
  const { sheetDragProps, handleZoneProps } = useBottomSheetDrag(handleCloseSheet)

  const handlePickAccount = useCallback(
    (last4: string | null) => {
      onAccountChange(last4)
      setSheetOpen(false)
    },
    [onAccountChange],
  )

  const handlePickMonth = useCallback(
    (month: string) => {
      onMonthChange(month)
      setSheetOpen(false)
    },
    [onMonthChange],
  )

  const pendingMonthCount = useMemo(
    () => monthsInScope.filter((m) => (stacksByMonth.get(m) ?? 0) > 0).length,
    [monthsInScope, stacksByMonth],
  )

  const otherPendingMonthCount = useMemo(
    () =>
      monthsInScope.filter(
        (m) => m !== effectiveMonthFilter && (stacksByMonth.get(m) ?? 0) > 0,
      ).length,
    [monthsInScope, effectiveMonthFilter, stacksByMonth],
  )

  if (!showBar) return null

  const lineLabel = scopeLineLabel(
    accountFilter,
    accountAliases,
    effectiveMonthFilter,
    hasCardChoice,
    hasMonthChoice,
  )

  return (
    <>
      <button
        type="button"
        onClick={handleOpenSheet}
        className={`mb-2 flex w-full flex-col rounded-full border px-3 py-2 text-xs font-semibold text-surface-200 transition-colors hover:bg-surface-800/50 active:bg-surface-800/70 ${
          emphasizeMonthQueue
            ? 'border-gem/35 bg-gem/[0.08]'
            : hasMonthChoice && pendingMonthCount >= 2
              ? 'border-gem/20 bg-surface-950/55'
              : 'border-white/[0.08] bg-surface-950/55'
        }`}
        aria-expanded={sheetOpen}
        aria-haspopup="dialog"
        aria-label={
          hasMonthChoice && pendingMonthCount >= 2
            ? `${lineLabel}, ${pendingMonthCount} billing months with items to classify`
            : lineLabel
        }
      >
        <div className="flex w-full items-center justify-center gap-1.5">
          <span className="truncate">{lineLabel}</span>
          {hasMonthChoice && pendingMonthCount >= 2 && (
            <span className="shrink-0 rounded-full bg-gem/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gem">
              {pendingMonthCount} mo
            </span>
          )}
          {otherPendingMonthCount > 0 && pendingMonthCount < 2 && (
            <span className="shrink-0 rounded-full bg-gem/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gem">
              +{otherPendingMonthCount}
            </span>
          )}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-surface-500"
            aria-hidden
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {hasMonthChoice && (
          <MonthQueueDots
            monthsInScope={monthsInScope}
            effectiveMonthFilter={effectiveMonthFilter}
            stacksByMonth={stacksByMonth}
            emphasize={emphasizeMonthQueue}
          />
        )}
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {sheetOpen && (
              <>
                <motion.div
                  className="fixed inset-0 z-[105] bg-black/55 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleCloseSheet}
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="classify-scope-title"
                  className="fixed inset-x-0 bottom-0 z-[106] max-h-[70vh] overflow-y-auto rounded-t-[28px] border border-white/10 border-b-0 bg-surface-950/95 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-24px_48px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  {...sheetDragProps}
                >
                  <div {...handleZoneProps('mb-3')}>
                    <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden />
                    <h3
                      id="classify-scope-title"
                      className="text-center text-base font-bold text-surface-50"
                    >
                      Change focus
                    </h3>
                    <p className="mt-1 text-center text-[11px] text-surface-500">
                      Card and billing month for this classify session
                    </p>
                  </div>

                  {hasCardChoice && (
                    <div className="mb-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">
                        Card
                      </p>
                      <ul className="space-y-1">
                        {showAllCardsOption && (
                          <li>
                            <button
                              type="button"
                              onClick={() => handlePickAccount(null)}
                              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                                accountFilter == null
                                  ? 'bg-duo-green/15 text-duo-green'
                                  : 'text-surface-300 hover:bg-white/[0.06]'
                              }`}
                            >
                              All cards
                            </button>
                          </li>
                        )}
                        {cardPicklist.map((last4) => {
                          const isSelected = accountFilter === last4
                          const hasPending = hasPendingOnCard(last4)
                          const monthBadge = pendingMonthsPerCard.get(last4) ?? 0
                          return (
                            <li key={last4}>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handlePickAccount(last4)}
                                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                                    isSelected
                                      ? 'bg-duo-green/15 text-duo-green'
                                      : 'text-surface-300 hover:bg-white/[0.06]'
                                  }`}
                                >
                                  {hasPending && (
                                    <span
                                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-duo-green shadow-[0_0_8px_rgba(88,204,2,0.7)]"
                                      aria-hidden
                                    />
                                  )}
                                  <span className="truncate">
                                    {formatAccountLabel(last4, accountAliases)}
                                  </span>
                                  {monthBadge > 1 && (
                                    <span className="shrink-0 rounded bg-surface-800/80 px-1.5 py-0.5 text-[10px] tabular-nums text-surface-400">
                                      {monthBadge} mo
                                    </span>
                                  )}
                                </button>
                                {isSelected && (
                                  <button
                                    type="button"
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ice/70 transition-colors hover:bg-white/[0.08] hover:text-ice"
                                    title="Edit display name and card type"
                                    onClick={() => {
                                      handleCloseSheet()
                                      onEditCard(last4)
                                    }}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 16 16"
                                      fill="currentColor"
                                      className="h-3.5 w-3.5"
                                    >
                                      <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
                                      <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9A.75.75 0 0 1 14 9v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {hasMonthChoice && (
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-500">
                        Billing month
                      </p>
                      <ul className="space-y-1">
                        {monthsInScope.map((bm) => {
                          const pendingStacks = stacksByMonth.get(bm) ?? 0
                          const isCleared = pendingStacks === 0
                          const isActive = effectiveMonthFilter === bm
                          const flaggedCount = flaggedByMonth.get(bm) ?? 0
                          return (
                            <li key={bm}>
                              <button
                                type="button"
                                onClick={() => handlePickMonth(bm)}
                                className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                                  isActive
                                    ? 'bg-gem/15 text-gem'
                                    : 'text-surface-300 hover:bg-white/[0.06]'
                                }`}
                              >
                                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                                  {isCleared ? (
                                    <span className="text-[11px] text-duo-green" aria-hidden>
                                      ✓
                                    </span>
                                  ) : (
                                    <span
                                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-duo-green shadow-[0_0_8px_rgba(88,204,2,0.7)]"
                                      aria-hidden
                                    />
                                  )}
                                  {formatBillingMonthLabel(bm)}
                                  {!isCleared && pendingStacks > 0 && (
                                    <span className="text-[11px] tabular-nums text-surface-400">
                                      {pendingStacks} stacks
                                    </span>
                                  )}
                                </span>
                                {flaggedCount > 0 && (
                                  <span className="pl-3.5 text-[10px] font-medium text-flame/90">
                                    {flaggedCount} in No idea
                                  </span>
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
