import { motion, AnimatePresence } from 'framer-motion'
import { AccountCardEditModal } from '../common/AccountCardEditModal'
import CategoryDetail from './CategoryDetail'
import MonthlyTrend from './MonthlyTrend'
import SlideDeckPreview from './SlideDeckPreview'
import SpendingChart from './SpendingChart'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import { formatAccountLabel } from '../../lib/accountDisplay'
import { formatCurrency } from '../../lib/formatCurrency'
import { ui } from '../../lib/uiClasses'
import { useRevealData, formatMonthLabel } from './useRevealData'

export default function RevealDesktopPage() {
  const {
    profile, summary, leaderboard, monthlyTotals, householdIncome, loading,
    month, handleMonthChange, monthOptions, accountFilter, mergedCardLast4s,
    aliasMap, accountTypeMap, aliasDraft, setAliasDraft,
    editingIncome, setEditingIncome, incomeRef, incomeInput,
    drillCategory, setDrillCategory, drillTxns, drillLoading,
    exporting, showDeckPreview, setShowDeckPreview, previewTransactions,
    prevMonthSummary, loadingPreview, includeOwnTransfers, setIncludeOwnTransfers,
    showTransfersHelp, setShowTransfersHelp, monthStats, monthStatsLoading,
    markCelebrated, noData, tooManyUnclassified, showCompletionScreen,
    totalSpent, spendingTxCount, incomeNum, freeIncome, savingsRate,
    categoryLookup, catConfig, navigate,
    handleIncomeSave, handleIncomeKeyDown, handleCategoryClick, handleReclassify,
    handleMarkTransfer, handleSaveNote, isCardIncluded, toggleAccountLast4,
    selectAllCards, handleExport, handleOpenPreview, handleGeneratePpt, generatingPpt,
    setIncomeDraft, saveAlias,
  } = useRevealData()

  return (
    <div className={ui.pageDesktop} data-testid="reveal-desktop-page">
      {/* Inline header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className={ui.heroTitle}>Reveal</h1>
          <p className={ui.heroSub}>Monthly spending breakdown & household leaderboard</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
            className={ui.select}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || summary.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-surface-950/55 px-3 py-2 text-xs font-medium text-surface-300 transition-colors hover:bg-surface-900/70 disabled:opacity-40"
          >
            {exporting ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-surface-400 border-t-transparent" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            className="flex items-center gap-1.5 rounded-xl border border-purple-400/20 bg-purple-500/5 px-3 py-2 text-xs font-medium text-purple-300 transition-colors hover:bg-purple-500/10 disabled:opacity-40"
          >
            {loadingPreview ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            )}
            Slides
          </button>
        </div>
      </div>

      {/* Card filter -- horizontal chips on desktop */}
      {profile?.household_id && mergedCardLast4s.length > 0 && (
        <div className={`${ui.glassFlat} mt-4 px-4 py-3`}>
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-xs font-semibold text-surface-400">Cards</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllCards}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  accountFilter === null
                    ? 'bg-ice/15 text-ice ring-1 ring-ice/30'
                    : 'bg-white/[0.04] text-surface-400 hover:bg-white/[0.06]'
                }`}
              >
                All
              </button>
              {mergedCardLast4s.map((last4) => {
                const included = isCardIncluded(last4)
                return (
                  <button
                    key={last4}
                    type="button"
                    onClick={() => toggleAccountLast4(last4)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      included && accountFilter !== null
                        ? 'bg-ice/15 text-ice ring-1 ring-ice/30'
                        : 'bg-white/[0.04] text-surface-400 hover:bg-white/[0.06]'
                    }`}
                  >
                    {formatAccountLabel(last4, aliasMap)}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                const first = mergedCardLast4s[0]
                if (first) {
                  setAliasDraft({
                    last4: first,
                    label: aliasMap.get(first) ?? '',
                    accountType: accountTypeMap.get(first) ?? null,
                  })
                }
              }}
              className="shrink-0 text-xs text-ice hover:text-ice/80"
            >
              Edit cards
            </button>
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
        <div className="mx-auto mt-8 max-w-md flex flex-col items-center gap-4 px-4 py-8">
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
            Upload a statement
          </button>
        </div>
      ) : tooManyUnclassified ? (
        <div className="mx-auto mt-8 max-w-md flex flex-col items-center gap-4 px-4 py-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-flame/30 bg-flame/10">
            <span className="text-4xl">🚧</span>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-surface-100">Not ready yet</p>
            <p className="mt-2 text-sm text-surface-400 leading-relaxed">
              There {monthStats!.pending_count === 1 ? 'is' : 'are'} still{' '}
              <span className="font-semibold text-flame">{monthStats!.pending_count} unclassified</span>{' '}
              transaction{monthStats!.pending_count === 1 ? '' : 's'} out of {monthStats!.total_count} for {formatMonthLabel(month)}.
            </p>
          </div>
          <div className="mt-2 w-full max-w-xs">
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-900 ring-1 ring-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-flame to-duo-green transition-all"
                style={{ width: `${((monthStats!.total_count - monthStats!.pending_count) / monthStats!.total_count) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : showCompletionScreen ? (
        <div className="mx-auto mt-8 max-w-md flex flex-col items-center gap-5 px-4 py-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-duo-green/40 bg-duo-green/10">
            <span className="text-5xl">🎉</span>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-surface-50">Amazing work!</p>
            <p className="mt-1 text-sm text-surface-400">
              All <span className="font-semibold text-duo-green">{monthStats!.total_count}</span> transactions
              for {formatMonthLabel(month)} are classified.
            </p>
          </div>
          <button
            type="button"
            onClick={markCelebrated}
            className="flex items-center justify-center gap-2 rounded-xl bg-duo-green px-8 py-3.5 text-sm font-bold text-white shadow-[0_12px_32px_-10px_rgba(88,204,2,0.4)] transition-all hover:brightness-110"
          >
            Reveal the numbers
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          {/* Income + Spending summary -- full width */}
          <div className="mt-5 grid grid-cols-2 gap-5 items-start">
            <motion.div
              className={`${ui.glass} overflow-hidden`}
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
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${!includeOwnTransfers ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {showTransfersHelp && (
                <p className="border-b border-white/[0.06] bg-surface-950/40 px-4 py-2 text-[11px] leading-snug text-surface-400">
                  {includeOwnTransfers
                    ? 'Own-account transfers are counted in totals, the donut, and monthly bars.'
                    : 'Own-account transfers are excluded from totals and the donut so spending isn\'t double-counted.'}
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
                      <div
                        className={`h-full rounded-full transition-all ${freeIncome >= 0 ? 'bg-duo-green' : 'bg-danger'}`}
                        style={{ width: `${Math.min(Math.max((totalSpent / incomeNum) * 100, 0), 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold tabular-nums ${freeIncome >= 0 ? 'text-duo-green' : 'text-danger'}`}>
                      {savingsRate >= 0 ? `${savingsRate.toFixed(0)}% saved` : `${Math.abs(savingsRate).toFixed(0)}% over`}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Spending donut + category list */}
            <SpendingChart
              summary={summary}
              total={totalSpent}
              categoryLookup={categoryLookup}
              onCategoryClick={handleCategoryClick}
              excludeFromPieIds={includeOwnTransfers ? [] : [OWN_TRANSFERS_CATEGORY_ID]}
            />
          </div>

          {/* Monthly trend -- full width below */}
          <div className="mt-5">
            <MonthlyTrend
              data={monthlyTotals}
              selectedMonth={month}
              income={householdIncome}
              subtitle={
                includeOwnTransfers ? undefined : 'Excludes own-account transfers (enable checkbox above to include).'
              }
            />
          </div>

          {/* Top classifier highlight */}
          {leaderboard.length > 0 && (() => {
            const topClassifier = [...leaderboard].sort((a, b) => b.total_xp - a.total_xp)[0]!
            return (
              <motion.div
                className={`mt-5 flex items-center gap-3 px-4 py-3 ${ui.glassFlat}`}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gem/15 text-xs font-bold text-gem ring-2 ring-surface-900">
                  {topClassifier.display_name.charAt(0).toUpperCase()}
                </div>
                <p className="text-sm text-surface-300">
                  <span className="font-semibold text-surface-100">{topClassifier.display_name}</span>
                  {' '}leads with{' '}
                  <span className="font-bold tabular-nums text-gem">{topClassifier.total_xp.toLocaleString()} XP</span>
                </p>
                <span className="ml-auto text-lg">🏆</span>
              </motion.div>
            )
          })()}
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
