import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { DailyTotal } from '../../hooks/useMultiMonthReveal'
import { detectDayOfWeekPattern } from '../../lib/advisorInsights'
import { formatCurrency } from '../../lib/formatCurrency'
import { ui } from '../../lib/uiClasses'

function computeTooltipPos(el: HTMLElement, tipW = 180, tipH = 48) {
  const cellRect = el.getBoundingClientRect()
  const pad = 8
  let left = cellRect.left + cellRect.width / 2 - tipW / 2
  let top = cellRect.top - tipH - pad
  if (top < 4) top = cellRect.bottom + pad
  if (left < 4) left = 4
  if (left + tipW > window.innerWidth - 4) left = window.innerWidth - tipW - 4
  return { left, top }
}

function CalendarTooltip({ tooltip }: { tooltip: { date: string; amount: number; count: number; left: number; top: number } }) {
  return (
    <div
      className="pointer-events-none fixed z-[200] rounded-lg border border-white/[0.1] bg-surface-950/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md"
      style={{ left: tooltip.left, top: tooltip.top }}
    >
      <p className="font-medium text-surface-200">{tooltip.date}</p>
      <p className="mt-0.5 text-surface-400">
        {formatCurrency(tooltip.amount, false)} &middot; {tooltip.count} transaction{tooltip.count !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

interface Props {
  dailyTotals: DailyTotal[]
  months: string[]
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function getWeeksForMonth(year: number, month: number): Date[][] {
  const weeks: Date[][] = []
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  let week: Date[] = Array(first.getDay()).fill(null as unknown as Date)

  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d)
    week.push(date)
    if (date.getDay() === 6 || d === last.getDate()) {
      while (week.length < 7) week.push(null as unknown as Date)
      weeks.push(week)
      week = []
    }
  }

  return weeks
}

function getIntensityClass(amount: number, max: number): string {
  if (amount === 0) return 'bg-surface-800/40'
  const ratio = amount / max
  if (ratio < 0.2) return 'bg-emerald-900/50'
  if (ratio < 0.4) return 'bg-emerald-700/50'
  if (ratio < 0.6) return 'bg-emerald-500/50'
  if (ratio < 0.8) return 'bg-emerald-400/60'
  return 'bg-emerald-300/70'
}

export default function CalendarHeatmap({ dailyTotals, months }: Props) {
  const [tooltip, setTooltip] = useState<{ date: string; amount: number; count: number; left: number; top: number } | null>(null)

  const dailyMap = useMemo(() => {
    const map = new Map<string, DailyTotal>()
    for (const d of dailyTotals) map.set(d.date, d)
    return map
  }, [dailyTotals])

  const maxAmount = useMemo(
    () => Math.max(...dailyTotals.map(d => d.amount), 1),
    [dailyTotals],
  )

  const sortedMonths = useMemo(() => {
    return [...months].sort().map(m => {
      const [y, mo] = m.split('-').map(Number)
      return { year: y, month: mo - 1, key: m }
    })
  }, [months])

  const pattern = useMemo(() => detectDayOfWeekPattern(dailyTotals), [dailyTotals])

  const formatMonthLabel = (year: number, month: number) => {
    return new Date(year, month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  const monthLabelW = 'w-10'
  const cellSize = 'h-[14px] w-[14px]'
  const cellGap = 'gap-[3px]'

  return (
    <motion.div
      className={ui.chartCard}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">
        Spending Calendar
      </p>

      <div className="mt-3 overflow-x-auto">
        {/* Day header row */}
        <div className="flex items-center">
          <div className={`shrink-0 ${monthLabelW}`} />
          <div className={`flex ${cellGap}`}>
            {DAY_LABELS.map((d, i) => (
              <span key={i} className={`${cellSize} text-center text-[9px] leading-[14px] text-surface-600`}>{d}</span>
            ))}
          </div>
        </div>

        {/* Month rows */}
        <div className="mt-1.5 space-y-3">
          {sortedMonths.map(({ year, month, key }) => {
            const weeks = getWeeksForMonth(year, month)
            return (
              <div key={key} className="space-y-[3px]">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex items-center">
                    {/* Month label on the first week row only */}
                    <div className={`shrink-0 ${monthLabelW}`}>
                      {wi === 0 && (
                        <span className="text-[10px] font-medium text-surface-400">
                          {formatMonthLabel(year, month)}
                        </span>
                      )}
                    </div>
                    <div className={`flex ${cellGap}`}>
                      {week.map((date, di) => {
                        if (!date) {
                          return <div key={di} className={cellSize} />
                        }

                        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                        const day = dailyMap.get(dateStr)
                        const amount = day?.amount ?? 0
                        const count = day?.count ?? 0

                        return (
                          <div
                            key={di}
                            className={`${cellSize} cursor-pointer rounded-[3px] transition-colors ${getIntensityClass(amount, maxAmount)}`}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget as HTMLElement
                            const { left, top } = computeTooltipPos(el)
                            setTooltip({ date: dateStr, amount, count, left, top })
                          }}
                          onMouseLeave={() => setTooltip(null)}
                            title={`${dateStr}: ${formatCurrency(amount, false)} (${count} txns)`}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-2">
          <div className={`shrink-0 ${monthLabelW}`} />
          <span className="text-[10px] text-surface-500">Less</span>
          <div className="flex gap-[2px]">
            {['bg-surface-800/40', 'bg-emerald-900/50', 'bg-emerald-700/50', 'bg-emerald-500/50', 'bg-emerald-400/60', 'bg-emerald-300/70'].map((cls, i) => (
              <div key={i} className={`h-[10px] w-[10px] rounded-[2px] ${cls}`} />
            ))}
          </div>
          <span className="text-[10px] text-surface-500">More</span>
        </div>
      </div>

      {pattern && (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-surface-950/40 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-surface-300">
            <span className="mr-1.5 text-purple-400">&#128269;</span>
            {pattern}
          </p>
        </div>
      )}

      {tooltip && <CalendarTooltip tooltip={tooltip} />}
    </motion.div>
  )
}
