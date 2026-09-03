import { motion, AnimatePresence } from 'framer-motion'
import { AccountCardEditModal } from '../common/AccountCardEditModal'
import SpendingChart from './SpendingChart'
import MonthlyTrend from './MonthlyTrend'
import Leaderboard from './Leaderboard'
import CategoryDetail from './CategoryDetail'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import { ui } from '../../lib/uiClasses'
import { formatAccountLabel } from '../../lib/accountDisplay'
import { formatCurrency } from '../../lib/formatCurrency'
import SlideDeckPreview from './SlideDeckPreview'
import { useRevealData, formatMonthLabel } from './useRevealData'

export default function RevealPage() {
  const {
    profile, summary, leaderboard, monthlyTotals, householdIncome, loading,
    month, handleMonthChange, monthOptions, accountFilter, mergedCardLast4s,
    aliasMap, accountTypeMap, aliasDraft, setAliasDraft, retroBusy, retroResult,
    cardsOpen, setCardsOpen, cardsPanelRef, setIncomeDraft,
    editingIncome, setEditingIncome, incomeRef, incomeInput,
    drillCategory, setDrillCategory, drillTxns, drillLoading,
    exporting, showDeckPreview, setShowDeckPreview, previewTransactions,
    prevMonthSummary, loadingPreview, includeOwnTransfers, setIncludeOwnTransfers,
    showTransfersHelp, setShowTransfersHelp, monthStats, monthStatsLoading,
    markCelebrated, noData, tooManyUnclassified,
    showCompletionScreen, totalSpent, spendingTxCount, incomeNum, freeIncome,
    savingsRate, categoryLookup, catConfig, navigate,
    handleIncomeSave, handleIncomeKeyDown, handleCategoryClick, handleReclassify,
    handleMarkTransfer, handleSaveNote, isCardIncluded, toggleAccountLast4,
    selectAllCards, saveAlias, handleMarkAllLoads, handleExport, handleOpenPreview,
    handleGeneratePpt, generatingPpt,
  } = useRevealData()

  return (
    <div className={`${ui.screen} ${ui.page}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className={ui.heroTitle}>Reveal</h1>
        <p className={ui.heroSub}>
          Monthly spending breakdown & household leaderboard
        </p>
      </motion.div>

      {/* Month selector + Export */}
      <div className="mt-6 flex gap-2">
        <select
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className={`flex-1 ${ui.select}`}
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || summary.length === 0}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-surface-950/55 px-3 py-2.5 text-sm text-surface-300 transition-colors hover:bg-surface-900/70 disabled:opacity-40"
        >
          {exporting ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-surface-400 border-t-transparent" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          CSV
        </button>
        <button
          type="button"
          onClick={handleOpenPreview}
          disabled={loadingPreview || summary.length === 0}
          className="flex items-center gap-1.5 rounded-xl border border-purple-400/20 bg-purple-500/5 px-3 py-2.5 text-sm text-purple-300 transition-colors hover:bg-purple-500/10 disabled:opacity-40"
        >
          {loadingPreview ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          )}
          Slides
        </button>
      </div>

      {profile?.household_id && (
        <div className={`${ui.glassFlat} relative z-30 mt-3 px-3 py-3`} ref={cardsPanelRef}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-surface-400">Cards in this view</span>
            <button
              type="button"
              onClick={selectAllCards}
              className="text-xs font-medium text-ice hover:text-ice/90"
            >
              All cards
            </button>
          </div>
          <p className="mt-1 text-[10px] text-surface-500">
            Saved names apply everywhere (including upload). Open the list to filter Reveal by card.
          </p>
          <div className="relative mt-2">
            <button
              type="button"
              onClick={() => setCardsOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-surface-950/55 px-3 py-2.5 text-left text-sm text-surface-200 outline-none ring-1 ring-white/[0.06]"
            >
              <span>
                {accountFilter === null
                  ? 'All cards included'
                  : `${accountFilter.length} card${accountFilter.length !== 1 ? 's' : ''} selected`}
              </span>
              <span className="text-surface-500">{cardsOpen ? '▲' : '▼'}</span>
            </button>
            {cardsOpen && (
              <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-64 overflow-y-auto rounded-xl border border-white/[0.1] bg-surface-950 p-2 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)]">
                {mergedCardLast4s.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-surface-500">
                    No card last-4 in this month yet. Upload a CSV with an account, or add a name after data appears.
                  </p>
                ) : (
                  <>
                    {mergedCardLast4s.map((last4) => {
                      const cardType = accountTypeMap.get(last4) ?? null
                      const isDebit = cardType === 'debit'
                      return (
                        <label
                          key={last4}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/[0.04]"
                        >
                          <input
                            type="checkbox"
                            checked={isCardIncluded(last4)}
                            onChange={() => toggleAccountLast4(last4)}
                            className="h-4 w-4 rounded border-white/20 bg-surface-900 text-duo-green"
                          />
                          <span className="flex-1 text-sm text-surface-200">
                            {formatAccountLabel(last4, aliasMap)}
                            {cardType && (
                              <span
                                className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  isDebit
                                    ? 'bg-ice/15 text-ice'
                                    : 'bg-duo-green/10 text-duo-green'
                                }`}
                              >
                                {isDebit ? 'Debit' : 'Credit'}
                              </span>
                            )}
                          </span>
                          {isDebit && (
                            <button
                              type="button"
                              disabled={retroBusy === last4}
                              className="shrink-0 rounded-md px-2 py-1 text-xs text-ice hover:bg-white/[0.06] disabled:opacity-40"
                              onClick={(e) => {
                                e.preventDefault()
                                void handleMarkAllLoads(last4)
                              }}
                              title="Mark all positive-amount transactions on this card as own-account transfers"
                            >
                              {retroBusy === last4 ? '…' : 'Mark loads'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="shrink-0 rounded-md px-2 py-1 text-xs text-ice hover:bg-white/[0.06]"
                            title="Edit display name, card type, and debit load behavior"
                            onClick={(e) => {
                              e.preventDefault()
                              setAliasDraft({
                                last4,
                                label: aliasMap.get(last4) ?? '',
                                accountType: cardType,
                              })
                            }}
                          >
                            Edit
                          </button>
                        </label>
                      )
                    })}
                    {retroResult && (
                      <p className="px-2 py-2 text-[11px] text-surface-500">
                        Marked {retroResult.count} load
                        {retroResult.count === 1 ? '' : 's'} on ···{retroResult.last4} as transfers.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <AccountCardEditModal
        draft={aliasDraft}
        onChange={setAliasDraft}
        onClose={() => setAliasDraft(null)}
        onSave={() => void saveAlias()}
      />

      {loading || monthStatsLoading ? (
        <div className="mt-12 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-duo-green border-t-transparent" />
        </div>
      ) : noData ? (
        <motion.div
          className="mt-8 flex flex-col items-center gap-4 px-4 py-8"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-surface-600/30 bg-surface-900/50">
            <span className="text-4xl">📭</span>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-surface-100">
              No data for {formatMonthLabel(month)}
            </p>
            <p className="mt-2 text-sm text-surface-400 leading-relaxed">
              No transactions have been uploaded for this month yet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="mt-2 flex items-center gap-2 rounded-xl border border-ice/20 bg-ice/5 px-5 py-3 text-sm font-semibold text-ice transition-colors hover:bg-ice/10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload a statement
          </button>
        </motion.div>
      ) : tooManyUnclassified ? (
        <motion.div
          className="mt-8 flex flex-col items-center gap-4 px-4 py-8"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-flame/30 bg-flame/10">
            <span className="text-4xl">🚧</span>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-surface-100">
              Not ready yet
            </p>
            <p className="mt-2 text-sm text-surface-400 leading-relaxed">
              There {monthStats!.pending_count === 1 ? 'is' : 'are'} still{' '}
              <span className="font-semibold text-flame">{monthStats!.pending_count} unclassified</span>{' '}
              transaction{monthStats!.pending_count === 1 ? '' : 's'} out of {monthStats!.total_count} for {formatMonthLabel(month)}.
            </p>
            <p className="mt-1 text-xs text-surface-500">
              Classify your transactions first to unlock insights.
            </p>
          </div>
          <div className="mt-2 w-full max-w-xs">
            <div className="flex items-center justify-between text-xs text-surface-500 mb-1.5">
              <span>Progress</span>
              <span className="tabular-nums font-medium">
                {Math.round(((monthStats!.total_count - monthStats!.pending_count) / monthStats!.total_count) * 100)}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-900 ring-1 ring-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-flame to-duo-green"
                initial={{ width: 0 }}
                animate={{
                  width: `${((monthStats!.total_count - monthStats!.pending_count) / monthStats!.total_count) * 100}%`,
                }}
                transition={{ type: 'spring', stiffness: 60, delay: 0.3 }}
              />
            </div>
          </div>
        </motion.div>
      ) : showCompletionScreen ? (
        <motion.div
          className="mt-8 flex flex-col items-center gap-5 px-4 py-6"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 80 }}
        >
          <motion.div
            className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-duo-green/40 bg-duo-green/10"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="text-5xl">🎉</span>
          </motion.div>

          <div className="text-center">
            <p className="text-lg font-bold text-surface-50">
              Amazing work!
            </p>
            <p className="mt-1 text-sm text-surface-400">
              All <span className="font-semibold text-duo-green">{monthStats!.total_count}</span> transactions
              for {formatMonthLabel(month)} are classified.
            </p>
          </div>

          <motion.div
            className="w-full"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <button
              type="button"
              onClick={markCelebrated}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-duo-green px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_32px_-10px_rgba(88,204,2,0.4)] transition-[transform,opacity,filter] duration-150 hover:brightness-110 active:scale-[0.97]"
            >
              Reveal the numbers
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </motion.div>

          <motion.div
            className={`${ui.glassFlat} w-full space-y-3 px-4 py-4`}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-xs font-semibold text-surface-400">Before we reveal the numbers...</p>

            <button
              type="button"
              onClick={() => navigate('/upload')}
              className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/[0.06]"
            >
              <span className="text-xl">💳</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-surface-200">More cards to load?</p>
                <p className="text-[11px] text-surface-500">Upload additional credit card statements</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-surface-500">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => navigate('/bets')}
              className="flex w-full items-center gap-3 rounded-xl border border-ice/20 bg-ice/5 px-4 py-3 text-left transition-colors hover:bg-ice/10"
            >
              <span className="text-xl">🎲</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-ice">Place bets first?</p>
                <p className="text-[11px] text-surface-500">Predict spending before seeing the results</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-ice/60">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </motion.div>
        </motion.div>
      ) : (
        <>
          {/* Income + Spending + Free Income summary */}
          <motion.div
            className={`${ui.glass} mt-6 overflow-hidden`}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
              <span className="text-sm text-surface-400">Household Income</span>
              {editingIncome ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-500">EUR</span>
                  <input
                    ref={incomeRef}
                    type="number"
                    min="0"
                    step="100"
                    value={incomeInput}
                    onChange={(e) => setIncomeDraft(e.target.value)}
                    onBlur={handleIncomeSave}
                    onKeyDown={handleIncomeKeyDown}
                    autoFocus
                    className={`w-28 px-3 py-1.5 text-right text-sm font-bold tabular-nums ${ui.input}`}
                  />
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditingIncome(true)
                    setTimeout(() => incomeRef.current?.focus(), 50)
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-surface-700/50"
                >
                  <span className="text-sm font-bold tabular-nums text-duo-green">
                    {incomeNum > 0 ? formatCurrency(incomeNum) : 'Set income'}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-surface-500">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
              <span className="text-sm text-surface-400">Total spent</span>
              <span className="text-sm font-bold tabular-nums text-primary-400">{formatCurrency(totalSpent)}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-surface-300">Hide internal transfers</span>
                <button
                  type="button"
                  onClick={() => setShowTransfersHelp((v) => !v)}
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-surface-600 text-[10px] font-bold text-surface-400 transition-colors hover:border-surface-400 hover:text-surface-200"
                  aria-label="What does this do?"
                  aria-expanded={showTransfersHelp}
                >
                  ?
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIncludeOwnTransfers((v) => !v)}
                role="switch"
                aria-checked={!includeOwnTransfers}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${!includeOwnTransfers ? 'bg-duo-green' : 'bg-surface-700'}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${!includeOwnTransfers ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
            {showTransfersHelp && (
              <p className="border-b border-white/[0.06] bg-surface-950/40 px-4 py-2 text-[11px] leading-snug text-surface-400">
                {includeOwnTransfers
                  ? 'Own-account transfers (e.g. moving money between your cards) are counted in totals, the donut, and monthly bars.'
                  : 'Own-account transfers stay visible in the category list (for drill-down) but are excluded from totals and the donut so spending isn\'t double-counted.'}
              </p>
            )}
            <div className="flex items-center justify-between px-4 py-1 text-xs text-surface-500/90">
              <span />
              <span>{spendingTxCount} spending tx</span>
            </div>

            {incomeNum > 0 && (
              <div className="border-t border-dashed border-white/[0.08] px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-surface-400">Free Income</span>
                  <span className={`text-xl font-extrabold tabular-nums ${freeIncome >= 0 ? 'text-duo-green' : 'text-danger'}`}>
                    {formatCurrency(freeIncome)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-950/80 ring-1 ring-white/[0.06]">
                    <motion.div
                      className={`h-full rounded-full ${freeIncome >= 0 ? 'bg-duo-green' : 'bg-danger'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Math.max((totalSpent / incomeNum) * 100, 0), 100)}%` }}
                      transition={{ type: 'spring', stiffness: 60 }}
                    />
                  </div>
                  <span className={`text-xs font-semibold tabular-nums ${freeIncome >= 0 ? 'text-duo-green' : 'text-danger'}`}>
                    {savingsRate >= 0 ? `${savingsRate.toFixed(0)}% saved` : `${Math.abs(savingsRate).toFixed(0)}% over`}
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          <SpendingChart
            summary={summary}
            total={totalSpent}
            categoryLookup={categoryLookup}
            onCategoryClick={handleCategoryClick}
            excludeFromPieIds={includeOwnTransfers ? [] : [OWN_TRANSFERS_CATEGORY_ID]}
          />

          <MonthlyTrend
            data={monthlyTotals}
            selectedMonth={month}
            income={householdIncome}
            subtitle={
              includeOwnTransfers ? undefined : 'Excludes own-account transfers (enable checkbox above to include).'
            }
          />

          <Leaderboard entries={leaderboard} />
        </>
      )}

      <AnimatePresence>
        {drillCategory && (
          <CategoryDetail
            category={drillCategory}
            transactions={drillTxns}
            loading={drillLoading}
            onClose={() => setDrillCategory(null)}
            onReclassify={handleReclassify}
            onMarkTransfer={handleMarkTransfer}
            onSaveNote={handleSaveNote}
            accountAliases={aliasMap}
            categories={catConfig.categories}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeckPreview && (
          <SlideDeckPreview
            month={month}
            summary={summary}
            prevMonthSummary={prevMonthSummary}
            monthlyTotals={monthlyTotals}
            income={householdIncome}
            transactions={previewTransactions}
            categoryLookup={Object.fromEntries(
              catConfig.categories.map((c) => [c.id, { icon: c.icon, label: c.label }]),
            )}
            onClose={() => setShowDeckPreview(false)}
            onDownload={handleGeneratePpt}
            downloading={generatingPpt === 'generating'}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
