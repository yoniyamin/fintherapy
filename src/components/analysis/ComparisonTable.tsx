import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { MultiMonthData } from '../../hooks/useMultiMonthReveal'
import { useUiPrefs } from '../../hooks/useUiPrefs'
import { useAuth } from '../../hooks/useAuth'
import { useTransactions } from '../../hooks/useTransactions'
import CategoryDetail from '../reveal/CategoryDetail'
import type { CategoryDef } from '../../lib/constants'
import type { Transaction } from '../../types/database'
import { ui } from '../../lib/uiClasses'

interface Props {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string }>
  accountAliases: Map<string, string>
  categories: readonly CategoryDef[]
  onDataChange: () => void
}

type ViewMode = 'bars' | 'cards'

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)

function formatMonth(m: string): string {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [, mo] = m.split('-')
  return labels[Number(mo) - 1] ?? mo
}

function formatMonthFull(m: string): string {
  const [year, mo] = m.split('-')
  const labels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${labels[Number(mo) - 1] ?? mo} ${year}`
}

function pctChange(from: number, to: number): number {
  if (Math.abs(from) < 1) return 0
  const raw = ((to - from) / Math.abs(from)) * 100
  return Math.max(-500, Math.min(500, raw))
}

interface ShiftInfo {
  spikeMonth: number
  gapMonth: number
}

interface RowData {
  category: string
  icon: string
  label: string
  amounts: number[]
  totalPct: number
  flagged: boolean
  shift: ShiftInfo | null
}

function detectShift(amounts: number[]): ShiftInfo | null {
  if (amounts.length < 3) return null
  const nonZero = amounts.filter(a => a > 0)
  if (nonZero.length < 2) return null
  const avg = nonZero.reduce((s, v) => s + v, 0) / nonZero.length

  for (let i = 0; i < amounts.length; i++) {
    if (amounts[i] > 0) continue
    const prev = i > 0 ? amounts[i - 1] : null
    const next = i < amounts.length - 1 ? amounts[i + 1] : null
    if (next != null && next >= avg * 1.7) {
      return { spikeMonth: i + 1, gapMonth: i }
    }
    if (prev != null && prev >= avg * 1.7) {
      return { spikeMonth: i - 1, gapMonth: i }
    }
  }
  return null
}

function buildRows(data: MultiMonthData, sorted: string[], categoryLookup: Record<string, { icon: string; label: string }>): RowData[] {
  const catSet = new Set<string>()
  data.aggregatedSummary.forEach(c => catSet.add(c.category))

  const result: RowData[] = []
  for (const cat of catSet) {
    const amounts = sorted.map(m => {
      const monthData = data.summaryByMonth.get(m) ?? []
      const entry = monthData.find(c => c.category === cat)
      return entry ? Number(entry.total_amount) : 0
    })

    const first = amounts[0]
    const last = amounts[amounts.length - 1]
    const totalPct = first > 0 ? pctChange(first, last) : 0
    const flagged = totalPct > 25 && first > 30
    const shift = detectShift(amounts)

    const info = categoryLookup[cat]
    result.push({
      category: cat,
      icon: info?.icon ?? '📦',
      label: info?.label ?? cat,
      amounts,
      totalPct,
      flagged,
      shift,
    })
  }

  return result.sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1
    const totalA = a.amounts.reduce((s, v) => s + v, 0)
    const totalB = b.amounts.reduce((s, v) => s + v, 0)
    return totalB - totalA
  })
}

function TrendBadge({ pct }: { pct: number }) {
  if (Math.abs(pct) < 5) return <span className="text-surface-500 text-[10px]">—</span>
  const isUp = pct > 0
  const color = isUp ? 'text-red-400' : 'text-emerald-400'
  return (
    <span className={`font-bold text-[10px] ${color}`}>
      {isUp ? '↑' : '↓'}{Math.abs(Math.round(pct))}%
    </span>
  )
}

function BarsView({
  rows,
  sorted,
  onCellClick,
}: {
  rows: RowData[]
  sorted: string[]
  onCellClick: (category: string, month: string, amount: number) => void
}) {
  const maxAmount = Math.max(...rows.flatMap(r => r.amounts), 1)

  return (
    <div className="space-y-0">
      <div className="flex items-center mb-1" style={{ paddingLeft: 88 }}>
        {sorted.map(m => (
          <div key={m} className="flex-1 text-center text-[9px] font-semibold text-surface-500">
            {formatMonth(m)}
          </div>
        ))}
        <div className="w-11 text-right text-[9px] font-semibold text-surface-500">Δ</div>
      </div>

      {rows.map(row => (
        <div
          key={row.category}
          className={`flex items-center py-1.5 border-b border-white/[0.04] ${row.flagged ? 'bg-amber-500/[0.03]' : ''}`}
        >
          <div className="w-[88px] shrink-0 flex items-center gap-1">
            {row.flagged && <span className="text-[8px] text-amber-400">⚠</span>}
            <span className="text-[12px]">{row.icon}</span>
            <span className="text-[10px] font-medium text-surface-200 truncate max-w-[52px]" title={row.label}>
              {row.label}
            </span>
          </div>

          <div className="flex-1 flex gap-0.5 items-end h-8">
            {row.amounts.map((amt, i) => {
              const barH = Math.max(2, (amt / maxAmount) * 24)
              const isSpike = row.shift?.spikeMonth === i
              const isGap = row.shift?.gapMonth === i
              let barColor = 'bg-teal-400/70'
              if (isSpike) barColor = 'bg-amber-400/85'
              else if (isGap || amt === 0) barColor = 'bg-white/[0.08]'

              const month = sorted[i]
              const clickable = amt > 0

              return (
                <button
                  key={i}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onCellClick(row.category, month, amt)}
                  className={`flex-1 flex flex-col items-center gap-0.5 rounded-md transition-colors ${clickable ? 'cursor-pointer hover:bg-white/[0.04] active:bg-white/[0.06]' : 'cursor-default'}`}
                >
                  <span className={`text-[8px] tabular-nums ${amt > 0 ? 'text-surface-400' : 'text-surface-700'}`}>
                    {amt > 0 ? fmt(amt) : '—'}
                  </span>
                  <div
                    className={`w-[65%] rounded-sm ${barColor}`}
                    style={{ height: barH }}
                  />
                </button>
              )
            })}
          </div>

          <div className="w-11 text-right shrink-0">
            <TrendBadge pct={row.totalPct} />
          </div>
        </div>
      ))}
    </div>
  )
}

function CardsView({
  rows,
  sorted,
  onCellClick,
}: {
  rows: RowData[]
  sorted: string[]
  onCellClick: (category: string, month: string, amount: number) => void
}) {
  return (
    <div className="space-y-2">
      {rows.map(row => {
        const hasShift = row.shift != null
        return (
          <div
            key={row.category}
            className={`rounded-xl border p-2.5 ${hasShift ? 'border-amber-400/20 bg-amber-500/[0.03]' : 'border-white/[0.07] bg-white/[0.03]'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {row.flagged && <span className="text-[9px] text-amber-400">⚠</span>}
                <span className="text-sm">{row.icon}</span>
                <span className="text-xs font-semibold text-surface-200">{row.label}</span>
              </div>
              <TrendBadge pct={row.totalPct} />
            </div>

            <div className="flex mt-2">
              {sorted.map((m, i) => {
                const amt = row.amounts[i]
                const isSpike = row.shift?.spikeMonth === i
                const isGap = row.shift?.gapMonth === i
                let amtColor = 'text-surface-300'
                if (amt === 0 || isGap) amtColor = 'text-surface-600'
                else if (isSpike) amtColor = 'text-amber-400'

                const clickable = amt > 0

                return (
                  <div key={m} className="flex-1 text-center">
                    <div className="text-[9px] text-surface-500 font-medium mb-0.5">{formatMonth(m)}</div>
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => onCellClick(row.category, m, amt)}
                        className={`text-[13px] font-semibold tabular-nums ${amtColor} rounded-md px-1 py-0.5 transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]`}
                      >
                        €{fmt(amt)}
                      </button>
                    ) : (
                      <div className={`text-[13px] font-semibold tabular-nums ${amtColor}`}>
                        —
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {hasShift && (
              <div className="mt-2 rounded-lg bg-amber-500/[0.06] px-2 py-1.5 text-[10px] text-amber-300/90 italic">
                ⇄ Billing shift: {formatMonth(sorted[row.shift!.gapMonth])} charge likely landed in {formatMonth(sorted[row.shift!.spikeMonth])}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-surface-950/45 p-1">
      <button
        type="button"
        onClick={() => onChange('cards')}
        className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${mode === 'cards' ? 'bg-white/[0.1] text-surface-50 shadow-sm' : 'text-surface-500 hover:text-surface-300'}`}
      >
        Cards
      </button>
      <button
        type="button"
        onClick={() => onChange('bars')}
        className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${mode === 'bars' ? 'bg-white/[0.1] text-surface-50 shadow-sm' : 'text-surface-500 hover:text-surface-300'}`}
      >
        Bars
      </button>
    </div>
  )
}

export default function ComparisonTable({
  data,
  months,
  categoryLookup,
  accountAliases,
  categories,
  onDataChange,
}: Props) {
  const sorted = useMemo(() => [...months].sort(), [months])
  const rows = useMemo(() => buildRows(data, sorted, categoryLookup), [data, sorted, categoryLookup])
  const { prefs, updatePrefs } = useUiPrefs()
  const mode: ViewMode = prefs.comparisonView ?? 'cards'
  const { profile, user } = useAuth()
  const {
    getTransactionsByCategory,
    reclassifyTransaction,
    markTransfer,
    setTransactionsUserNote,
  } = useTransactions(profile?.household_id)

  const [drill, setDrill] = useState<{ category: string; month: string } | null>(null)
  const [drillTxns, setDrillTxns] = useState<Transaction[]>([])
  const [drillLoading, setDrillLoading] = useState(false)

  const shiftedRows = rows.filter(r => r.shift != null)

  const handleCellClick = useCallback(async (category: string, month: string, amount: number) => {
    if (amount <= 0) return
    setDrill({ category, month })
    setDrillLoading(true)
    setDrillTxns([])
    const txns = await getTransactionsByCategory(month, category)
    setDrillTxns(txns)
    setDrillLoading(false)
  }, [getTransactionsByCategory])

  const handleReclassify = useCallback(async (txId: string, newCategory: string) => {
    if (!user) return
    await reclassifyTransaction(txId, newCategory, user.id)
    setDrillTxns(prev => prev.filter(t => t.id !== txId))
    onDataChange()
  }, [user, reclassifyTransaction, onDataChange])

  const handleMarkTransfer = useCallback(async (txId: string) => {
    if (!user) return
    await markTransfer(txId, user.id)
    setDrillTxns(prev => prev.filter(t => t.id !== txId))
    onDataChange()
  }, [user, markTransfer, onDataChange])

  const handleSaveNote = useCallback(async (txId: string, note: string | null) => {
    await setTransactionsUserNote([txId], note)
    setDrillTxns(prev => prev.map(t => (t.id === txId ? { ...t, user_note: note } : t)))
  }, [setTransactionsUserNote])

  return (
    <>
      <motion.div
        className={ui.chartCard}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">
            Month-over-Month
          </p>
          <ViewToggle mode={mode} onChange={v => updatePrefs({ comparisonView: v })} />
        </div>

        <div className="mt-3">
          {mode === 'bars' ? (
            <BarsView rows={rows} sorted={sorted} onCellClick={handleCellClick} />
          ) : (
            <CardsView rows={rows} sorted={sorted} onCellClick={handleCellClick} />
          )}
        </div>

        {mode === 'bars' && shiftedRows.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-400/10 bg-amber-500/[0.04] px-3 py-2">
            {shiftedRows.map(row => (
              <p key={row.category} className="text-[11px] leading-relaxed text-amber-300/80">
                <span className="mr-1">⇄</span>
                {row.label}: {formatMonth(sorted[row.shift!.gapMonth])} charge likely shifted to {formatMonth(sorted[row.shift!.spikeMonth])}
              </p>
            ))}
          </div>
        )}

        {rows.some(r => r.flagged) && (
          <div className="mt-3 rounded-xl border border-amber-400/10 bg-amber-500/[0.04] px-3 py-2">
            <p className="text-[11px] leading-relaxed text-amber-300/80">
              <span className="mr-1">⚠</span>
              Flagged categories grew more than 25% over this period.
            </p>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {drill && (
          <CategoryDetail
            category={drill.category}
            transactions={drillTxns}
            loading={drillLoading}
            onClose={() => setDrill(null)}
            onReclassify={handleReclassify}
            onMarkTransfer={handleMarkTransfer}
            onSaveNote={handleSaveNote}
            accountAliases={accountAliases}
            categories={categories}
            subtitle={formatMonthFull(drill.month)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
