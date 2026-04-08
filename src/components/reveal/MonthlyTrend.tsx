import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { MonthlyTotal } from '../../hooks/useReveal'
import { ui } from '../../lib/uiClasses'

interface Props {
  data: MonthlyTotal[]
  selectedMonth: string
  income: number | null
}

function shortMonth(billing: string): string {
  const [year, month] = billing.split('-')
  const d = new Date(Number(year), Number(month) - 1)
  return d.toLocaleDateString('en-US', { month: 'short' })
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

export default function MonthlyTrend({ data, selectedMonth, income }: Props) {
  if (data.length < 1) {
    return null
  }

  const chartData = data.map((d) => ({
    month: shortMonth(d.billing_month),
    raw: d.billing_month,
    amount: Number(d.total_amount),
    count: Number(d.tx_count),
  }))

  return (
    <motion.div
      className="mt-6 space-y-3"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">Monthly Spending</h2>

      <div className={ui.chartCard}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `€${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}`}
            />
            {income && (
              <CartesianGrid
                horizontal={true}
                vertical={false}
                strokeDasharray="6 4"
                stroke="#FF9600"
              />
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '12px',
              }}
              itemStyle={{ color: '#f8fafc' }}
              formatter={(value) => fmt(Number(value ?? 0))}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={36}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.raw}
                  fill={entry.raw === selectedMonth ? '#58CC02' : '#6366f1'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {data.length > 1 && (
          <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-surface-500">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-sm bg-duo-green" />
              <span>Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-sm bg-primary-500" />
              <span>Other months</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
