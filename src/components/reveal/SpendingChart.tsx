import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { CategorySummary } from '../../hooks/useReveal'
import { ui } from '../../lib/uiClasses'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'

interface Props {
  summary: CategorySummary[]
  total: number
  categoryLookup: Record<string, { icon: string; label: string }>
  onCategoryClick?: (categoryId: string) => void
  /** Categories omitted from the donut (still listed below for drill-down). */
  excludeFromPieIds?: readonly string[]
}

const PIE_COLORS = [
  '#58CC02', '#1CB0F6', '#A560E8', '#FF9600',
  '#818cf8', '#ec4899', '#06b6d4', '#eab308',
  '#ef4444', '#6366f1', '#f97316', '#10b981',
]

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(v)

export default function SpendingChart({
  summary,
  total,
  categoryLookup,
  onCategoryClick,
  excludeFromPieIds = [OWN_TRANSFERS_CATEGORY_ID],
}: Props) {
  const exclude = new Set(excludeFromPieIds)
  /** Pie arcs only for positive net spend; refunds netting to ≤0 stay in the list below. */
  const pieSummary = summary.filter(
    (s) => !exclude.has(s.category) && Number(s.total_amount) > 0,
  )
  const pieTotal = pieSummary.reduce((sum, s) => sum + Number(s.total_amount), 0)

  if (summary.length === 0) {
    return (
      <div className={`${ui.chartCard} mt-6 p-8 text-center`}>
        <p className="text-4xl drop-shadow-[0_8px_20px_rgba(165,96,232,0.25)]">📊</p>
        <p className="mt-3 text-sm text-surface-400">No classified transactions for this month yet</p>
      </div>
    )
  }

  if (pieSummary.length === 0) {
    return (
      <div className="mt-6 space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">By Category</h2>
        <div className={`${ui.chartCard} p-6 text-center`}>
          <p className="text-sm text-surface-400">
            No spending categories for this view (only own transfers or excluded categories).
          </p>
        </div>
        <div className="space-y-1">
          {summary.map((item, i) => {
            const cat = categoryLookup[item.category]
            const value = Number(item.total_amount)
            const count = Number(item.tx_count)
            return (
              <motion.button
                key={item.category}
                type="button"
                onClick={() => onCategoryClick?.(item.category)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-white/[0.06] hover:bg-white/[0.04]"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                <span className="text-base">{cat?.icon ?? '📦'}</span>
                <span className="flex-1 text-sm font-medium text-surface-200">{cat?.label ?? item.category}</span>
                <span className="text-xs text-surface-500">{count}</span>
                <span className="text-sm font-semibold tabular-nums text-surface-50">{fmt(value)}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }

  const chartData = pieSummary.map((item, i) => {
    const cat = categoryLookup[item.category]
    return {
      id: item.category,
      name: cat?.label ?? item.category,
      value: Number(item.total_amount),
      icon: cat?.icon ?? '📦',
      color: PIE_COLORS[i % PIE_COLORS.length],
      count: Number(item.tx_count),
    }
  })

  return (
    <div className="mt-6 space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">By Category</h2>

      <motion.div
        className={ui.chartCard}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              animationBegin={0}
              animationDuration={800}
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '12px',
                backdropFilter: 'blur(8px)',
              }}
              itemStyle={{ color: '#f8fafc' }}
              formatter={(value) => fmt(Number(value ?? 0))}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none -mt-[150px] mb-[110px] text-center">
          <p className="text-[10px] font-medium text-surface-500">Spending total</p>
          <p className="text-base font-bold tabular-nums text-surface-50">{fmt(pieTotal)}</p>
          {excludeFromPieIds.length > 0 && Math.abs(pieTotal - total) > 0.005 && (
            <p className="mt-1 text-[10px] text-surface-500">Excl. own transfers</p>
          )}
        </div>
      </motion.div>

      <div className="space-y-1">
        {summary.map((item, i) => {
          const cat = categoryLookup[item.category]
          const value = Number(item.total_amount)
          const inPie = !exclude.has(item.category) && value > 0
          const pieEntry = inPie ? chartData.find((c) => c.id === item.category) : null
          const color = pieEntry?.color ?? '#64748b'
          const pct = pieTotal > 0 && inPie ? (value / pieTotal) * 100 : 0
          const count = Number(item.tx_count)
          return (
            <motion.button
              key={item.category}
              type="button"
              onClick={() => onCategoryClick?.(item.category)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-white/[0.06] hover:bg-white/[0.04]"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-base">{cat?.icon ?? '📦'}</span>
              <span className="flex-1 text-sm font-medium text-surface-200">
                {cat?.label ?? item.category}
                {!inPie && (
                  <span className="ml-1.5 text-[10px] font-normal text-surface-500">
                    {exclude.has(item.category) ? '(not in pie)' : '(net — not in pie)'}
                  </span>
                )}
              </span>
              <span className="text-xs text-surface-500">{count}</span>
              <span className="text-sm font-semibold tabular-nums text-surface-50">{fmt(value)}</span>
              <span className="w-10 text-right text-xs tabular-nums text-surface-500">{inPie ? `${pct.toFixed(0)}%` : '—'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-surface-600">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
