import { AnimatePresence, motion } from 'framer-motion'
import Button from '../common/Button'
import CategoryIcon from '../common/CategoryIcon'
import { SkeletonCard } from '../common/Skeleton'
import { ui } from '../../lib/uiClasses'
import { BET_CATEGORY_COUNT, formatMonthLabel } from './betsHelpers'
import { MultiMemberResult, SingleUserResult } from './betsResultComponents'
import { useBetsData } from './useBetsData'

export default function BetsDesktopPage() {
  const {
    month, handleMonthChange, monthOptions, loading, statsLoading, allClassified,
    isMultiMember, householdBetStatus, selectedCategories,
    amounts, setDraftAmounts, submitting, success, submitError, hasBets,
    handleSubmit, actualLookup, householdBetsByUser, betUserIds, categoryWinners,
    overallWinner, isCurrentUser,
  } = useBetsData()

  return (
    <div className={ui.pageDesktop} data-testid="bets-desktop-page">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className={ui.heroTitle}>Bets</h1>
          <p className={ui.heroSub}>Predict spending per category before classifying</p>
        </div>
        <select
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className={ui.select}
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Household bet status -- horizontal on desktop */}
      {isMultiMember && !allClassified && !loading && !statsLoading && (
        <div className={`${ui.glassFlat} mt-4 px-4 py-3`}>
          <div className="flex items-center gap-4">
            <span className="shrink-0 text-xs font-semibold text-surface-400">Household bets</span>
            <div className="flex flex-wrap gap-3">
              {householdBetStatus.map((member) => (
                <div key={member.user_id} className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-800 text-[10px] font-bold text-surface-300">
                    {member.display_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-surface-200">
                    {member.display_name}
                    {member.is_current_user && <span className="ml-1 text-[9px] text-surface-500">(you)</span>}
                  </span>
                  {member.category_count > 0 ? (
                    <span className="rounded-full bg-duo-green/10 px-2 py-0.5 text-[10px] font-semibold text-duo-green">
                      🎲 {member.is_current_user ? `${member.category_count} bet${member.category_count === 1 ? '' : 's'}` : 'Placed'}
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface-800/60 px-2 py-0.5 text-[10px] text-surface-500">
                      No bets
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* All-classified banner */}
      <AnimatePresence>
        {!statsLoading && allClassified && (
          <motion.div
            className="mt-4 rounded-2xl border border-duo-green/25 bg-duo-green/10 px-4 py-4 text-center"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="text-lg">🎉</p>
            <p className="mt-1 text-sm font-semibold text-duo-green">
              All transactions classified!
            </p>
            <p className="mt-0.5 text-xs text-surface-400">
              Bets are locked for {formatMonthLabel(month)}. Check your results below.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {loading || statsLoading ? (
        <div className="mt-6 space-y-3">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={3} />
        </div>
      ) : !allClassified ? (
        /* Predict phase -- full width, 2x2 grid for category cards */
        <div className="mt-6">
          <div className={`${ui.glassFlat} mb-4 px-4 py-3`}>
            <p className="text-xs text-surface-400">
              <span className="font-semibold text-ice">{BET_CATEGORY_COUNT} categories</span> randomly
              selected for {formatMonthLabel(month)} — same for all household members
            </p>
          </div>

          <div className="grid grid-cols-2 gap-5 items-start">
            {selectedCategories.map((cat) => (
              <div
                key={cat.id}
                className={`flex items-center gap-3 px-4 py-3.5 ${ui.glassFlat}`}
              >
                <CategoryIcon categoryId={cat.id} emoji={cat.icon} size="md" />
                <span className="flex-1 text-sm font-medium text-surface-200">{cat.label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-surface-500">€</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={amounts[cat.id] ?? ''}
                    onChange={(e) => setDraftAmounts((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                    className={`w-24 px-3 py-2 text-right text-sm tabular-nums ${ui.input}`}
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {success && (
              <motion.div
                className="mt-4 rounded-xl border border-duo-green/20 bg-duo-green/10 p-3 text-center text-sm font-semibold text-duo-green"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                🎲 Bets placed!
              </motion.div>
            )}
            {submitError && (
              <motion.div
                className="mt-4 rounded-xl border border-flame/20 bg-flame/10 p-3 text-center text-sm font-semibold text-flame"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {submitError}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 max-w-xs">
            <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : hasBets ? 'Update Bets' : 'Place Bets'}
            </Button>
          </div>
        </div>
      ) : (
        /* Results phase -- full width, 2x2 grid for result cards */
        <div className="mt-6">
          <AnimatePresence>
            {isMultiMember && overallWinner && betUserIds.length > 1 && (
              <motion.div
                className="mb-5 rounded-2xl border border-gem/25 bg-gradient-to-br from-gem/15 via-gem/5 to-transparent px-4 py-4 text-center"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 100 }}
              >
                <p className="text-2xl">🏆</p>
                <p className="mt-1 text-base font-bold text-gem-light">
                  {isCurrentUser(overallWinner.userId) ? 'You win!' : `${overallWinner.displayName} wins!`}
                </p>
                <p className="mt-0.5 text-xs text-surface-400">
                  Closest prediction in {overallWinner.wins} categor{overallWinner.wins === 1 ? 'y' : 'ies'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-5 items-start">
            {selectedCategories.map((cat) => {
              const actual = actualLookup[cat.id] ?? 0
              const winnerId = categoryWinners.get(cat.id)
              const showMultiMember = isMultiMember && betUserIds.length > 1

              return (
                <div
                  key={cat.id}
                  className={`p-4 ${ui.glassFlat}`}
                >
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon categoryId={cat.id} emoji={cat.icon} size="md" />
                    <span className="flex-1 text-sm font-medium text-surface-200">{cat.label}</span>
                    {showMultiMember && winnerId && (
                      <span className="text-[10px] font-semibold text-gem">
                        {isCurrentUser(winnerId) ? '🏆 You' : `🏆 ${householdBetsByUser.get(winnerId)?.displayName}`}
                      </span>
                    )}
                  </div>

                  {showMultiMember ? (
                    <MultiMemberResult
                      betUserIds={betUserIds}
                      householdBetsByUser={householdBetsByUser}
                      categoryId={cat.id}
                      actual={actual}
                      winnerId={winnerId}
                      isCurrentUser={isCurrentUser}
                    />
                  ) : (
                    <SingleUserResult
                      predicted={Number(amounts[cat.id] ?? 0)}
                      actual={actual}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
