import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { CategorySummary } from '../../hooks/useReveal'
import { ui } from '../../lib/uiClasses'

interface Props {
  summary: CategorySummary[]
  total: number
  categoryLookup: Record<string, { icon: string; label: string }>
  onCategoryClick?: (categoryId: string) => void
}

const PIE_COLORS = [
  '#58CC02', '#1CB0F6', '#A560E8', '#FF9600',
  '#818cf8', '#ec4899', '#06b6d4', '#eab308',
  '#ef4444', '#6366f1', '#f97316', '#10b981',
]

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(v)

export default function SpendingChart({ summary, total, categoryLookup, onCategoryClick }: Props) {
  if (summary.length === 0) {
    return (
      <div className={`${ui.chartCard} mt-6 p-8 text-center`}>
        <p className="text-4xl drop-shadow-[0_8px_20px_rgba(165,96,232,0.25)]">📊</p>
        <p className="mt-3 text-sm text-surface-400">No classified transactions for this month yet</p>
      </div>
    )
  }

  const chartData = summary.map((item, i) => {
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
          <p className="text-[10px] font-medium text-surface-500">Total</p>
          <p className="text-base font-bold tabular-nums text-surface-50">{fmt(total)}</p>
        </div>
      </motion.div>

      <div className="space-y-1">
        {chartData.map((item, i) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0
          return (
            <motion.button
              key={item.name}
              onClick={() => onCategoryClick?.(item.id)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-white/[0.06] hover:bg-white/[0.04]"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-base">{item.icon}</span>
              <span className="flex-1 text-sm font-medium text-surface-200">{item.name}</span>
              <span className="text-xs text-surface-500">{item.count}</span>
              <span className="text-sm font-semibold tabular-nums text-surface-50">{fmt(item.value)}</span>
              <span className="w-10 text-right text-xs tabular-nums text-surface-500">{pct.toFixed(0)}%</span>
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
