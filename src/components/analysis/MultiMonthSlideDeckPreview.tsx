import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, LineChart, Line, Legend, ReferenceLine,
} from 'recharts'
import type { MultiMonthData, CategoryTrendPoint } from '../../hooks/useMultiMonthReveal'
import type { CategorySummary } from '../../hooks/useReveal'
import type { ExportRow } from '../../hooks/useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import {
  generateInsights, getHealthSummary,
  type AdvisorInsight, type HealthSummary,
} from '../../lib/advisorInsights'

interface Props {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string }>
  onClose: () => void
  onDownload: () => void
  downloading: boolean
}

const COLORS = ['#34D399', '#60A5FA', '#F59E0B', '#F472B6', '#A78BFA', '#FB923C']

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

const fmtFull = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(v)

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function shortMonth(value: string): string {
  const [y, m] = value.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short' })
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '\u2026'
}

function pctChange(from: number, to: number): number {
  if (from === 0) return 0
  return ((to - from) / Math.abs(from)) * 100
}

export default function MultiMonthSlideDeckPreview({
  data, months, categoryLookup, onClose, onDownload, downloading,
}: Props) {
  const [slideIdx, setSlideIdx] = useState(0)
  const sorted = useMemo(() => [...months].sort(), [months])

  const filteredSummary = useMemo(
    () => data.aggregatedSummary.filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID),
    [data.aggregatedSummary],
  )

  const filteredTransactions = useMemo(
    () => data.allTransactions.filter(tx =>
      tx.status !== 'transfer' && tx.status !== 'offset' && tx.category !== OWN_TRANSFERS_CATEGORY_ID
    ),
    [data.allTransactions],
  )

  const totalSpent = filteredSummary.reduce((s, c) => s + Number(c.total_amount), 0)
  const avgMonthly = sorted.length > 0 ? totalSpent / sorted.length : 0

  const insightInput = useMemo(() => ({
    months: sorted,
    aggregatedSummary: data.aggregatedSummary,
    summaryByMonth: data.summaryByMonth,
    monthlyTotals: data.monthlyTotals,
    categoryTrend: data.categoryTrend,
    dailyTotals: data.dailyTotals,
    income: data.householdIncome,
    categoryLookup,
  }), [data, sorted, categoryLookup])

  const health = useMemo(() => getHealthSummary(insightInput), [insightInput])
  const insights = useMemo(() => generateInsights(insightInput), [insightInput])

  const slides = useMemo(() => {
    const s = [
      { id: 'title', title: 'Title' },
      { id: 'big-picture', title: 'The Big Picture' },
      { id: 'trajectory', title: 'Spending Trajectory' },
      { id: 'where-money-goes', title: 'Where Your Money Goes' },
      { id: 'how-changing', title: 'How Things Are Changing' },
      { id: 'biggest-movers', title: 'Biggest Movers' },
      { id: 'top-transactions', title: 'Top Transactions' },
      { id: 'advisor-summary', title: 'Advisor Summary' },
    ]
    return s
  }, [])

  const totalSlides = slides.length
  const goNext = () => setSlideIdx(i => Math.min(i + 1, totalSlides - 1))
  const goPrev = () => setSlideIdx(i => Math.max(i - 1, 0))
  const currentSlide = slides[slideIdx]

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0a0f1a 0%, #0f172a 40%, #0c1220 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
        <button type="button" onClick={onClose} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-surface-400 transition-all hover:text-surface-200 hover:bg-white/[0.04]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>

        <div className="flex items-center gap-1.5">
          {slides.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setSlideIdx(i)}
              className={`transition-all duration-300 rounded-full ${i === slideIdx ? 'w-6 h-2 bg-gradient-to-r from-purple-400 to-blue-400' : 'w-2 h-2 bg-surface-700 hover:bg-surface-500'}`}
            />
          ))}
        </div>

        <button type="button" onClick={onDownload} disabled={downloading}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/20 px-3 py-1.5 text-sm font-medium text-purple-200 transition-all hover:from-purple-500/30 hover:to-blue-500/30 disabled:opacity-50">
          {downloading ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          )}
          Export
        </button>
      </div>

      {/* Slide content */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            className="min-h-full flex items-center justify-center p-5"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="w-full max-w-md">
              {currentSlide.id === 'title' && <TitleSlide months={sorted} totalSpent={totalSpent} txCount={filteredTransactions.length} />}
              {currentSlide.id === 'big-picture' && <BigPictureSlide totalSpent={totalSpent} avgMonthly={avgMonthly} monthCount={sorted.length} income={data.householdIncome} health={health} />}
              {currentSlide.id === 'trajectory' && <TrajectorySlide monthlyTotals={data.monthlyTotals} income={data.householdIncome} />}
              {currentSlide.id === 'where-money-goes' && <WhereMoneyGoesSlide summary={filteredSummary} total={totalSpent} categoryLookup={categoryLookup} />}
              {currentSlide.id === 'how-changing' && <HowChangingSlide trend={data.categoryTrend} months={sorted} aggregated={data.aggregatedSummary} categoryLookup={categoryLookup} />}
              {currentSlide.id === 'biggest-movers' && <BiggestMoversSlide summaryByMonth={data.summaryByMonth} months={sorted} categoryLookup={categoryLookup} />}
              {currentSlide.id === 'top-transactions' && <TopTransactionsSlide transactions={filteredTransactions} categoryLookup={categoryLookup} />}
              {currentSlide.id === 'advisor-summary' && <AdvisorSummarySlide insights={insights} income={data.householdIncome} avgMonthly={avgMonthly} />}
            </div>
          </motion.div>
        </AnimatePresence>

        {slideIdx > 0 && (
          <button type="button" onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] p-2.5 text-surface-400 transition-all hover:bg-white/[0.08] hover:text-surface-200 hover:scale-110">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        {slideIdx < totalSlides - 1 && (
          <button type="button" onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] p-2.5 text-surface-400 transition-all hover:bg-white/[0.08] hover:text-surface-200 hover:scale-110">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
      </div>

      <div className="flex items-center justify-center py-2.5 border-t border-white/[0.04]">
        <span className="text-[11px] text-surface-600 tabular-nums">{slideIdx + 1} of {totalSlides}</span>
      </div>
    </motion.div>
  )
}

/* ─────────────────── SLIDE COMPONENTS ─────────────────── */

function TitleSlide({ months, totalSpent, txCount }: { months: string[]; totalSpent: number; txCount: number }) {
  const first = months[0], last = months[months.length - 1]
  return (
    <div className="text-center space-y-6">
      <motion.div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-400/20 flex items-center justify-center" initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}>
        <span className="text-3xl">📊</span>
      </motion.div>
      <div className="space-y-2">
        <motion.h1 className="text-2xl font-bold bg-gradient-to-r from-surface-100 via-purple-200 to-blue-200 bg-clip-text text-transparent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          Financial Health Check
        </motion.h1>
        <motion.p className="text-base font-medium text-surface-400" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          {formatMonthLabel(first)} – {formatMonthLabel(last)}
        </motion.p>
      </div>
      <motion.div className="flex items-center justify-center gap-6 pt-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div>
          <p className="text-xl font-bold tabular-nums text-surface-50">{fmt(totalSpent)}</p>
          <p className="text-[10px] text-surface-500 mt-0.5">total spent</p>
        </div>
        <div className="w-px h-8 bg-white/[0.06]" />
        <div>
          <p className="text-xl font-bold tabular-nums text-surface-50">{txCount}</p>
          <p className="text-[10px] text-surface-500 mt-0.5">transactions</p>
        </div>
        <div className="w-px h-8 bg-white/[0.06]" />
        <div>
          <p className="text-xl font-bold tabular-nums text-surface-50">{months.length}</p>
          <p className="text-[10px] text-surface-500 mt-0.5">months</p>
        </div>
      </motion.div>
    </div>
  )
}

function BigPictureSlide({ totalSpent, avgMonthly, monthCount, income, health }: { totalSpent: number; avgMonthly: number; monthCount: number; income: number | null; health: HealthSummary }) {
  const savingsRate = income != null && income > 0 ? ((income - avgMonthly) / income) * 100 : null
  const verdictColor = health.verdict === 'green' ? 'text-emerald-400' : health.verdict === 'amber' ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">The Big Picture</h2>
      <motion.div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5 text-center" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <p className={`text-xs font-medium ${verdictColor}`}>{health.message}</p>
      </motion.div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total Spent', value: fmt(totalSpent) },
          { label: 'Avg Monthly', value: fmt(avgMonthly) },
          { label: 'Months', value: String(monthCount) },
          ...(savingsRate != null ? [{ label: 'Savings Rate', value: `${Math.round(savingsRate)}%` }] : []),
        ].map((m, i) => (
          <motion.div key={m.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-center" initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 + i * 0.05 }}>
            <p className="text-sm font-bold tabular-nums text-surface-200">{m.value}</p>
            <p className="mt-0.5 text-[9px] text-surface-500">{m.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function TrajectorySlide({ monthlyTotals, income }: { monthlyTotals: import('../../hooks/useReveal').MonthlyTotal[]; income: number | null }) {
  const chartData = monthlyTotals.map(d => ({ month: shortMonth(d.billing_month), amount: Number(d.total_amount) }))
  const amounts = monthlyTotals.map(d => Number(d.total_amount))
  const min = Math.min(...amounts), max = Math.max(...amounts)
  const minMonth = monthlyTotals[amounts.indexOf(min)]
  const maxMonth = monthlyTotals[amounts.indexOf(max)]

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Spending Trajectory</h2>
      <motion.div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11 }} formatter={(value) => [fmt(Number(value ?? 0)), 'Spent']} />
              {income != null && income > 0 && <ReferenceLine y={income} stroke="#64748b" strokeDasharray="6 4" label={{ value: 'Income', position: 'right', fill: '#64748b', fontSize: 9 }} />}
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={28} fill="#6366F1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      {minMonth && maxMonth && (
        <p className="text-center text-[11px] text-surface-400">
          Lightest: <span className="text-emerald-400 font-medium">{shortMonth(minMonth.billing_month)}</span> ({fmt(min)}) · Heaviest: <span className="text-amber-400 font-medium">{shortMonth(maxMonth.billing_month)}</span> ({fmt(max)})
        </p>
      )}
    </div>
  )
}

function WhereMoneyGoesSlide({ summary, total, categoryLookup }: { summary: CategorySummary[]; total: number; categoryLookup: Record<string, { icon: string; label: string }> }) {
  const sorted = [...summary].filter(c => Number(c.total_amount) > 0).sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
  const top = sorted.slice(0, 5)
  const rest = sorted.slice(5)
  const otherTotal = rest.reduce((s, c) => s + Number(c.total_amount), 0)

  const chartData = top.map((c, i) => ({ name: categoryLookup[c.category]?.label ?? c.category, value: Number(c.total_amount), color: COLORS[i % COLORS.length] }))
  if (otherTotal > 0) chartData.push({ name: 'Other', value: otherTotal, color: '#475569' })

  const top3Pct = total > 0 ? Math.round((top.slice(0, 3).reduce((s, c) => s + Number(c.total_amount), 0) / total) * 100) : 0

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Where Your Money Goes</h2>
      <div className="flex items-center gap-3">
        <motion.div className="w-32 h-32 shrink-0" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={28} outerRadius={52} paddingAngle={2} dataKey="value" stroke="none">
                {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {top.map((cat, i) => {
            const label = categoryLookup[cat.category]?.label ?? cat.category
            const icon = categoryLookup[cat.category]?.icon ?? '📦'
            const pct = total > 0 ? ((Number(cat.total_amount) / total) * 100).toFixed(0) : '0'
            return (
              <motion.div key={cat.category} className="flex items-center gap-1.5" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}>
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs shrink-0">{icon}</span>
                <span className="flex-1 text-[11px] text-surface-300 truncate">{label}</span>
                <span className="text-[11px] font-semibold tabular-nums text-surface-200">{pct}%</span>
              </motion.div>
            )
          })}
        </div>
      </div>
      <p className="text-center text-[11px] text-surface-400">Your top 3 categories account for {top3Pct}% of all spending.</p>
    </div>
  )
}

function HowChangingSlide({ trend, months, aggregated, categoryLookup }: { trend: CategoryTrendPoint[]; months: string[]; aggregated: CategorySummary[]; categoryLookup: Record<string, { icon: string; label: string }> }) {
  const top5 = aggregated.filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID).slice(0, 5).map(c => c.category)
  const labels = top5.map(c => categoryLookup[c]?.label ?? c)

  const chartData = months.map(m => {
    const row: Record<string, number | string> = { month: shortMonth(m) }
    for (const cat of top5) {
      const label = categoryLookup[cat]?.label ?? cat
      const point = trend.find(p => p.month === m && p.category === cat)
      row[label] = point?.amount ?? 0
    }
    return row
  })

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">How Things Are Changing</h2>
      <motion.div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11 }} formatter={(value) => [fmt(Number(value ?? 0)), '']} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="circle" iconSize={6} />
              {labels.map((label, i) => <Line key={label} type="monotone" dataKey={label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  )
}

function BiggestMoversSlide({ summaryByMonth, months, categoryLookup }: { summaryByMonth: Map<string, CategorySummary[]>; months: string[]; categoryLookup: Record<string, { icon: string; label: string }> }) {
  const first = summaryByMonth.get(months[0]) ?? []
  const last = summaryByMonth.get(months[months.length - 1]) ?? []
  const firstMap = new Map(first.map(c => [c.category, Number(c.total_amount)]))

  const movers = last.map(c => {
    const prev = firstMap.get(c.category) ?? 0
    return { category: c.category, prev, current: Number(c.total_amount), delta: Number(c.total_amount) - prev, pct: prev > 30 ? pctChange(prev, Number(c.total_amount)) : 0 }
  }).filter(m => Math.abs(m.pct) > 10).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 4)

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Biggest Movers</h2>
      <div className="space-y-2">
        {movers.map((m, i) => {
          const info = categoryLookup[m.category]
          const isUp = m.delta > 0
          return (
            <motion.div key={m.category} className={`rounded-xl border p-3 ${isUp ? 'border-red-500/15 bg-red-500/[0.03]' : 'border-emerald-500/15 bg-emerald-500/[0.03]'}`} initial={{ x: isUp ? 20 : -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.08 }}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{info?.icon ?? '📦'}</span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-surface-200">{info?.label ?? m.category}</p>
                  <p className="text-[10px] text-surface-500">{fmt(m.prev)} → {fmt(m.current)}</p>
                </div>
                <span className={`text-sm font-bold ${isUp ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isUp ? '↑' : '↓'} {Math.abs(Math.round(m.pct))}%
                </span>
              </div>
            </motion.div>
          )
        })}
        {movers.length === 0 && <p className="text-center text-xs text-surface-500 py-4">No significant category changes to report.</p>}
      </div>
    </div>
  )
}

function TopTransactionsSlide({ transactions, categoryLookup }: { transactions: ExportRow[]; categoryLookup: Record<string, { icon: string; label: string }> }) {
  const top = [...transactions].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 8)

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Top Transactions</h2>
      <p className="text-center text-[11px] text-surface-400">These individual purchases had the most impact</p>
      <div className="space-y-1.5">
        {top.map((tx, i) => {
          const merchant = truncate(tx.merchant_clean || tx.merchant_raw, 20)
          const catIcon = categoryLookup[tx.category]?.icon ?? '📦'
          return (
            <motion.div key={`${tx.tx_date}-${tx.merchant_raw}-${i}`} className="flex items-center gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.04 }}>
              <span className="text-base">{catIcon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-surface-200 truncate">{merchant}</p>
                <p className="text-[10px] text-surface-500">{tx.tx_date}</p>
              </div>
              <span className="text-sm font-bold tabular-nums text-surface-100">{fmtFull(Number(tx.amount))}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function AdvisorSummarySlide({ insights, income, avgMonthly }: { insights: AdvisorInsight[]; income: number | null; avgMonthly: number }) {
  const savingsRate = income != null && income > 0 ? Math.round(((income - avgMonthly) / income) * 100) : null

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Advisor Summary</h2>
      <p className="text-center text-[11px] text-surface-400">Here's what we'd recommend focusing on</p>

      {savingsRate != null && (
        <motion.div className={`rounded-2xl border p-4 text-center ${savingsRate >= 10 ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : savingsRate >= 0 ? 'border-amber-500/20 bg-amber-500/[0.04]' : 'border-red-500/20 bg-red-500/[0.04]'}`} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <p className="text-[10px] text-surface-500 uppercase tracking-wider">Overall Savings Rate</p>
          <p className={`mt-1 text-3xl font-extrabold ${savingsRate >= 10 ? 'text-emerald-400' : savingsRate >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{savingsRate}%</p>
        </motion.div>
      )}

      <div className="space-y-2">
        {insights.map((insight, i) => (
          <motion.div key={insight.id} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3" initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 + i * 0.06 }}>
            <p className="text-xs leading-relaxed text-surface-200">
              <span className="mr-1.5">{insight.emoji}</span>
              {insight.text}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
