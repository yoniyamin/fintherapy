import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { AnalysisReportConfig, SavingsGoal } from '../../types/database'

interface Props {
  open: boolean
  onClose: () => void
  config: AnalysisReportConfig
  inflationRate: number
  savingsGoals: SavingsGoal[]
  monthCount: number
  onSave: (config: AnalysisReportConfig, inflationRate: number, savingsGoals: SavingsGoal[]) => void
}

interface SectionDef {
  key: keyof AnalysisReportConfig
  label: string
  minMonths: number
}

const SECTIONS: SectionDef[] = [
  { key: 'headline', label: 'Headline Banner', minMonths: 1 },
  { key: 'kpiCards', label: 'KPI Cards', minMonths: 1 },
  { key: 'fixedDiscretionary', label: 'Fixed vs Discretionary', minMonths: 1 },
  { key: 'categoryTrend', label: 'Category Trends', minMonths: 2 },
  { key: 'deltaDrivers', label: 'Delta Drivers', minMonths: 2 },
  { key: 'memberSpending', label: 'Spending by Card', minMonths: 1 },
  { key: 'topVendors', label: 'Top Vendors', minMonths: 3 },
  { key: 'cardCategorySplit', label: 'Who Pays What', minMonths: 3 },
  { key: 'budgetVsActual', label: 'Budget vs Actual', minMonths: 3 },
  { key: 'savingsProjection', label: 'Savings Projection', minMonths: 3 },
  { key: 'recurring', label: 'Recurring Charges', minMonths: 1 },
  { key: 'comparisonTable', label: 'Comparison Table', minMonths: 2 },
  { key: 'calendarHeatmap', label: 'Calendar Heatmap', minMonths: 2 },
  { key: 'advisorNotes', label: 'Advisor Notes', minMonths: 1 },
  { key: 'velocityGauge', label: 'Velocity Gauge', minMonths: 1 },
]

export default function ReportConfigModal({ open, onClose, config, inflationRate, savingsGoals, monthCount, onSave }: Props) {
  if (!open) return null
  return <ReportConfigModalInner onClose={onClose} config={config} inflationRate={inflationRate} savingsGoals={savingsGoals} monthCount={monthCount} onSave={onSave} />
}

function ReportConfigModalInner({ onClose, config, inflationRate, savingsGoals, monthCount, onSave }: Omit<Props, 'open'>) {
  const [draft, setDraft] = useState<AnalysisReportConfig>(config)
  const [inflation, setInflation] = useState(String(inflationRate))
  const [goals, setGoals] = useState<SavingsGoal[]>(savingsGoals.length > 0 ? savingsGoals : [])

  const toggleSection = useCallback((key: keyof AnalysisReportConfig) => {
    setDraft(prev => ({ ...prev, [key]: !(prev[key] ?? true) }))
  }, [])

  const addGoal = useCallback(() => {
    setGoals(prev => [...prev, { name: '', target: 0, horizon_months: 12 }])
  }, [])

  const updateGoal = useCallback((index: number, field: keyof SavingsGoal, value: string | number) => {
    setGoals(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g))
  }, [])

  const removeGoal = useCallback((index: number) => {
    setGoals(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleSave = useCallback(() => {
    const validGoals = goals.filter(g => g.name && g.target > 0)
    onSave(draft, Number(inflation) || 3, validGoals)
    onClose()
  }, [draft, inflation, goals, onSave, onClose])

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="report-config-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 left-[var(--shell-nav-offset)] z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="report-config-sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="w-full max-w-lg rounded-t-2xl border-t border-white/10 bg-surface-950/95 backdrop-blur-xl"
          style={{ maxHeight: '85vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <h2 className="text-sm font-bold text-surface-100">Report Settings</h2>
            <button type="button" onClick={handleSave} className="text-xs font-medium text-teal-400 hover:text-teal-300">
              Save
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(85vh - 60px)' }}>
            {/* Section toggles */}
            <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-2">Sections</p>
            <div className="space-y-1 mb-5">
              {SECTIONS.map(s => {
                const enabled = draft[s.key] ?? true
                const locked = monthCount < s.minMonths
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => !locked && toggleSection(s.key)}
                    disabled={locked}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                      locked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="text-xs text-surface-300">{s.label}</span>
                    <div className="flex items-center gap-2">
                      {locked && <span className="text-[9px] text-surface-600">{s.minMonths}+ months</span>}
                      <div className={`h-4 w-7 rounded-full transition-colors ${enabled && !locked ? 'bg-teal-500' : 'bg-surface-700'}`}>
                        <div className={`h-3 w-3 translate-y-0.5 rounded-full bg-white transition-transform ${enabled && !locked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Inflation rate */}
            <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-2">Inflation Rate</p>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="number"
                step="0.1"
                value={inflation}
                onChange={e => setInflation(e.target.value)}
                className="w-20 rounded-lg border border-white/[0.08] bg-surface-950/55 px-3 py-1.5 text-xs text-surface-50 outline-none"
              />
              <span className="text-xs text-surface-400">% per year</span>
            </div>
            <p className="text-[9px] text-surface-600 mb-5 leading-tight">Used in savings projections to adjust variable costs forward. Categories marked "Infl." in budget targets grow at this rate; fixed costs (rent, loans) stay flat.</p>

            {/* Savings goals */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500">Savings Goals</p>
              <button
                type="button"
                onClick={addGoal}
                className="text-[10px] font-medium text-teal-400 hover:text-teal-300"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {goals.map((goal, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
                  <input
                    type="text"
                    value={goal.name}
                    onChange={e => updateGoal(i, 'name', e.target.value)}
                    placeholder="Name"
                    className="flex-1 min-w-0 rounded-md border border-white/[0.06] bg-surface-950/55 px-2 py-1 text-xs text-surface-50 outline-none"
                  />
                  <input
                    type="number"
                    value={goal.target || ''}
                    onChange={e => updateGoal(i, 'target', Number(e.target.value))}
                    placeholder="€"
                    className="w-16 rounded-md border border-white/[0.06] bg-surface-950/55 px-2 py-1 text-xs text-surface-50 outline-none"
                  />
                  <input
                    type="number"
                    value={goal.horizon_months || ''}
                    onChange={e => updateGoal(i, 'horizon_months', Number(e.target.value))}
                    placeholder="mo"
                    className="w-12 rounded-md border border-white/[0.06] bg-surface-950/55 px-2 py-1 text-xs text-surface-50 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeGoal(i)}
                    className="text-xs text-red-400 hover:text-red-300 shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
              {goals.length === 0 && (
                <p className="text-[10px] text-surface-600 italic py-2">No goals configured</p>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
