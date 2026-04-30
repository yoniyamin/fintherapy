import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useBets } from '../../hooks/useBets'
import { useReveal } from '../../hooks/useReveal'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import { useCategoryConfig } from '../../hooks/useCategoryConfig'
import Button from '../common/Button'
import { ui } from '../../lib/uiClasses'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    options.push({ value, label: formatMonthLabel(value) })
  }
  return options
}

type Tab = 'predict' | 'results'

export default function BetsPage() {
  const { profile } = useAuth()
  const { myBets, loading, fetchMyBets, submitBets } = useBets(profile?.household_id)
  const { summary, fetchSummary } = useReveal(profile?.household_id)
  const { categories: CATEGORIES } = useCategoryConfig(profile?.household_id)
  const [month, setMonth] = useState(getCurrentMonth())
  const [tab, setTab] = useState<Tab>('predict')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const monthOptions = getMonthOptions()

  useEffect(() => {
    fetchMyBets(month)
    fetchSummary(month)
  }, [month, fetchMyBets, fetchSummary])

  useEffect(() => {
    if (myBets.length > 0) {
      const existing: Record<string, string> = {}
      myBets.forEach((b) => {
        existing[b.category] = String(b.predicted_amount)
      })
      setAmounts(existing)
    }
  }, [myBets])

  const handleSubmit = async () => {
    setSubmitting(true)
    setSuccess(false)
    const bets = CATEGORIES
      .filter((c) => c.id !== OWN_TRANSFERS_CATEGORY_ID)
      .filter((cat) => amounts[cat.id] && Number(amounts[cat.id]) > 0)
      .map((cat) => ({
        category: cat.id,
        predicted_amount: Number(amounts[cat.id]),
      }))

    await submitBets(month, bets)
    setSubmitting(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
  }

  const hasBets = myBets.length > 0
  const actualLookup = Object.fromEntries(summary.map((s) => [s.category, Number(s.total_amount)]))

  return (
    <div className={`${ui.screen} ${ui.pageNoBottomPad}`}>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className={ui.heroTitle}>Bets</h1>
        <p className={ui.heroSub}>
          Predict spending per category before classifying
        </p>
      </motion.div>

      {/* Month selector */}
      <div className="mt-6">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={`w-full ${ui.select}`}
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className={`${ui.tabShell} mt-4`}>
        {(['predict', 'results'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold transition-all ${
              tab === t ? ui.tabActive : ui.tabIdle
            }`}
          >
            {t === 'predict' ? 'Place Bets' : 'Results'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-12 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-duo-green border-t-transparent" />
        </div>
      ) : tab === 'predict' ? (
        <div className="mt-6 space-y-2">
          {CATEGORIES.filter((c) => c.id !== OWN_TRANSFERS_CATEGORY_ID).map((cat, i) => (
            <motion.div
              key={cat.id}
              className={`flex items-center gap-3 px-3.5 py-3 ${ui.glassFlat}`}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.02 }}
            >
              <span className="text-xl">{cat.icon}</span>
              <span className="flex-1 text-sm font-medium text-surface-200">{cat.label}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-surface-500">€</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={amounts[cat.id] ?? ''}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                  className={`w-20 px-2.5 py-1.5 text-right text-sm tabular-nums ${ui.input}`}
                  placeholder="0"
                />
              </div>
            </motion.div>
          ))}

          <AnimatePresence>
            {success && (
              <motion.div
                className="rounded-xl border border-duo-green/20 bg-duo-green/10 p-3 text-center text-sm font-semibold text-duo-green shadow-[0_12px_28px_-12px_rgba(88,204,2,0.25)]"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Bets saved!
              </motion.div>
            )}
          </AnimatePresence>

          <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : hasBets ? 'Update Bets' : 'Place Bets'}
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {CATEGORIES.filter((c) => c.id !== OWN_TRANSFERS_CATEGORY_ID).map((cat, i) => {
            const predicted = Number(amounts[cat.id] ?? 0)
            const actual = actualLookup[cat.id] ?? 0
            const diff = actual - predicted
            const hasPrediction = predicted > 0

            return (
              <motion.div
                key={cat.id}
                className={`p-3.5 ${ui.glassFlat}`}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.02 }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{cat.icon}</span>
                  <span className="flex-1 text-sm font-medium text-surface-200">{cat.label}</span>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-surface-500">Predicted</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-gem">
                      {hasPrediction ? `€${predicted.toFixed(0)}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-surface-500">Actual</p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums text-ice">
                      {actual > 0 ? `€${actual.toFixed(0)}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-surface-500">Diff</p>
                    <p className={`mt-0.5 text-sm font-bold tabular-nums ${
                      !hasPrediction || actual === 0 ? 'text-surface-500'
                        : Math.abs(diff) < predicted * 0.1 ? 'text-duo-green'
                        : diff > 0 ? 'text-danger' : 'text-flame'
                    }`}>
                      {hasPrediction && actual > 0
                        ? `${diff > 0 ? '+' : ''}€${diff.toFixed(0)}`
                        : '—'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
