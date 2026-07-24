import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { AnalysisReportConfig } from '../../types/database'

interface Props {
  open: boolean
  onClose: () => void
  config: AnalysisReportConfig
  inflationRate: number
  monthCount: number
  onSave: (config: AnalysisReportConfig, inflationRate: number) => void
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

export default function ReportConfigModal({ open, onClose, config, inflationRate, monthCount, onSave }: Props) {
  if (!open) return null
  return <ReportConfigModalInner onClose={onClose} config={config} inflationRate={inflationRate} monthCount={monthCount} onSave={onSave} />
}

function ReportConfigModalInner({ onClose, config, inflationRate, monthCount, onSave }: Omit<Props, 'open'>) {
  const [draft, setDraft] = useState<AnalysisReportConfig>(config)
  const [inflation, setInflation] = useState(String(inflationRate))

  const toggleSection = useCallback((key: keyof AnalysisReportConfig) => {
    setDraft(prev => ({ ...prev, [key]: !(prev[key] ?? true) }))
  }, [])

  const handleSave = useCallback(() => {
    onSave(draft, Number(inflation) || 3.2)
    onClose()
  }, [draft, inflation, onSave, onClose])

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

          <div className="overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))]" style={{ maxHeight: 'calc(85vh - 60px)' }}>
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
            <p className="text-[9px] text-surface-600 mb-5 leading-tight">Used in savings projections to adjust variable costs forward. Categories marked &quot;Infl.&quot; in budget targets grow at this rate; fixed costs (rent, loans) stay flat.</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
