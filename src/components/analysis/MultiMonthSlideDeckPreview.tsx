import { useMemo, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import ScrollReportShell from '../common/scrollReport/ScrollReportShell'
import {
  RevealItem,
  RevealStagger,
  ScrollReportDivider,
  ScrollReportSection,
  ScrollReportTitleSection,
} from '../common/scrollReport/ScrollReportParts'
import { REPORT_EASE } from '../../lib/scrollReportMotion'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, LineChart, Line, Legend, ReferenceLine,
} from 'recharts'
import type { MultiMonthData, CategoryTrendPoint } from '../../hooks/useMultiMonthReveal'
import type { CategorySummary } from '../../hooks/useReveal'
import type { ExportRow } from '../../hooks/useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID, type CategoryDef, type SpendingFrequency } from '../../lib/constants'
import { rollUpAmounts } from '../../lib/categoryHierarchy'
import { exportSpendMagnitude, topSpendingTransactions } from '../../lib/exportSpend'
import { formatCurrency } from '../../lib/formatCurrency'
import {
  buildInsightInput,
  generateInsights,
  getHealthSummary,
  type AdvisorInsight,
  type HealthSummary,
} from '../../lib/advisorInsights'
import AnalysisIcon from './AnalysisIcons'
import { getInsightIconName } from './analysisIconPaths'

interface Props {
  data: MultiMonthData
  months: string[]
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string; spendingFrequency?: SpendingFrequency; parentCategoryId?: string }>
  onClose: () => void
  onDownload: () => void
  downloading: boolean
  subcategoryDisplay?: 'grouped' | 'detailed'
}

const COLORS = ['#34D399', '#60A5FA', '#F59E0B', '#F472B6', '#A78BFA', '#FB923C']

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
  subcategoryDisplay = 'grouped',
}: Props) {
  const sorted = useMemo(() => [...months].sort(), [months])

  const categories: CategoryDef[] = useMemo(() =>
    Object.entries(categoryLookup).map(([id, info]) => ({
      id, ...info,
      color: '',
      expenseType: (info.expenseType ?? 'discretionary') as CategoryDef['expenseType'],
      spendingFrequency: (info.spendingFrequency ?? 'monthly') as CategoryDef['spendingFrequency'],
      parentCategoryId: info.parentCategoryId,
    })),
    [categoryLookup],
  )

  const filteredSummary = useMemo(() => {
    const base = data.aggregatedSummary.filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID)
    if (subcategoryDisplay !== 'grouped') return base

    const amountMap: Record<string, number> = {}
    for (const s of base) amountMap[s.category] = Number(s.total_amount)
    const rolled = rollUpAmounts(categories, amountMap)

    const seen = new Set<string>()
    const result: CategorySummary[] = []
    for (const s of base) {
      const parentId = categoryLookup[s.category]?.parentCategoryId
      const effectiveId = parentId && rolled[parentId] !== undefined ? parentId : s.category
      if (seen.has(effectiveId)) continue
      seen.add(effectiveId)
      result.push({ ...s, category: effectiveId, total_amount: rolled[effectiveId] ?? Number(s.total_amount) })
    }
    return result.sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
  }, [data.aggregatedSummary, subcategoryDisplay, categories, categoryLookup])

  const oneOffTotal = useMemo(() => {
    return data.aggregatedSummary
      .filter(c => categoryLookup[c.category]?.spendingFrequency === 'one_off')
      .reduce((s, c) => s + Number(c.total_amount), 0)
  }, [data.aggregatedSummary, categoryLookup])

  const filteredTransactions = useMemo(
    () => data.allTransactions.filter(tx =>
      tx.status !== 'transfer' && tx.status !== 'offset' && tx.category !== OWN_TRANSFERS_CATEGORY_ID
    ),
    [data.allTransactions],
  )

  const totalSpent = filteredSummary.reduce((s, c) => s + Number(c.total_amount), 0)
  const avgMonthly = sorted.length > 0 ? totalSpent / sorted.length : 0

  const insightInput = useMemo(() => buildInsightInput({
    months: sorted,
    aggregatedSummary: data.aggregatedSummary,
    summaryByMonth: data.summaryByMonth,
    monthlyTotals: data.monthlyTotals,
    categoryTrend: data.categoryTrend,
    dailyTotals: data.dailyTotals,
    income: data.householdIncome,
    categoryLookup,
    transactions: data.allTransactions,
    spendingByAccount: data.spendingByAccount,
  }), [data, sorted, categoryLookup])

  const health = useMemo(() => getHealthSummary(insightInput), [insightInput])
  const insights = useMemo(() => generateInsights(insightInput), [insightInput])

  const annualCategorySpend = useMemo(() => {
    return data.aggregatedSummary
      .filter(c => categoryLookup[c.category]?.spendingFrequency === 'annual')
      .reduce((s, c) => s + Number(c.total_amount), 0)
  }, [data.aggregatedSummary, categoryLookup])

  const trueMonthlyBaseline = useMemo(() => {
    if (sorted.length === 0) return 0
    return (totalSpent - annualCategorySpend - oneOffTotal) / sorted.length
  }, [totalSpent, annualCategorySpend, oneOffTotal, sorted.length])

  const sections = useMemo(() => [
    { id: 'title', label: 'Financial Health Check' },
    { id: 'big-picture', label: 'The Big Picture' },
    { id: 'trajectory', label: 'Spending Trajectory' },
    { id: 'where-money-goes', label: 'Where Your Money Goes' },
    { id: 'how-changing', label: 'How Things Are Changing' },
    { id: 'biggest-movers', label: 'Biggest Movers' },
    { id: 'top-merchants', label: 'Top Merchants' },
    { id: 'who-pays', label: 'Who Pays What' },
    { id: 'top-transactions', label: 'Top Transactions' },
    { id: 'advisor-summary', label: 'Advisor Summary' },
  ], [])

  return (
    <ScrollReportShell
      sections={sections}
      onClose={onClose}
      onDownload={onDownload}
      downloading={downloading}
    >
      {({ scrollToTop }) => (
        <>
          <TitleSlide
            months={sorted}
            totalSpent={totalSpent}
            txCount={filteredTransactions.length}
            onScrollToTop={scrollToTop}
          />
          <ScrollReportDivider />
          <ScrollReportSection id="big-picture" title="The Big Picture">
            <BigPictureSlide totalSpent={totalSpent} avgMonthly={avgMonthly} trueMonthlyBaseline={trueMonthlyBaseline} monthCount={sorted.length} income={data.householdIncome} health={health} oneOffTotal={oneOffTotal} annualMonthlySetAside={annualCategorySpend / 12} />
          </ScrollReportSection>
          <ScrollReportDivider />
          <ScrollReportSection id="trajectory" title="Spending Trajectory">
            <TrajectorySlide monthlyTotals={data.monthlyTotals} income={data.householdIncome} />
          </ScrollReportSection>
          <ScrollReportDivider />
          <ScrollReportSection id="where-money-goes" title="Where Your Money Goes">
            <WhereMoneyGoesSlide summary={filteredSummary} total={totalSpent} categoryLookup={categoryLookup} />
          </ScrollReportSection>
          <ScrollReportDivider />
          <ScrollReportSection id="how-changing" title="How Things Are Changing">
            <HowChangingSlide trend={data.categoryTrend} months={sorted} aggregated={data.aggregatedSummary} categoryLookup={categoryLookup} />
          </ScrollReportSection>
          <ScrollReportDivider />
          <ScrollReportSection id="biggest-movers" title="Biggest Movers">
            <BiggestMoversSlide summaryByMonth={data.summaryByMonth} months={sorted} categoryLookup={categoryLookup} />
          </ScrollReportSection>
          <ScrollReportDivider />
          <ScrollReportSection id="top-merchants" title="Top Merchants">
            <TopMerchantsSlide transactions={filteredTransactions} months={sorted.length} categoryLookup={categoryLookup} />
          </ScrollReportSection>
          <ScrollReportDivider />
          <ScrollReportSection id="who-pays" title="Who Pays What">
            <WhoPaysSlide transactions={filteredTransactions} categoryLookup={categoryLookup} />
          </ScrollReportSection>
          <ScrollReportDivider />
          <ScrollReportSection id="top-transactions" title="Top Transactions">
            <TopTransactionsSlide transactions={filteredTransactions} categoryLookup={categoryLookup} />
          </ScrollReportSection>
          <ScrollReportDivider />
          <ScrollReportSection id="advisor-summary" title="Advisor Summary">
            <AdvisorSummarySlide insights={insights} income={data.householdIncome} avgMonthly={avgMonthly} />
          </ScrollReportSection>
        </>
      )}
    </ScrollReportShell>
  )
}

/* ─────────────────── SLIDE COMPONENTS ─────────────────── */

function SlideDeckInsightIcon({ id }: { id: string }) {
  return (
    <span className="mt-0.5 shrink-0 text-surface-400">
      <AnalysisIcon name={getInsightIconName(id)} width={16} height={16} />
    </span>
  )
}

function TitleSlide({
  months, totalSpent, txCount, onScrollToTop,
}: {
  months: string[]; totalSpent: number; txCount: number; onScrollToTop: () => void
}) {
  const first = months[0]
  const last = months[months.length - 1]
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })

  return (
    <ScrollReportTitleSection id="title" onTitleClick={onScrollToTop}>
      <div ref={ref} className="space-y-6 text-center">
        <motion.div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-500/20 to-blue-500/20"
          initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
          animate={inView ? { scale: 1, rotate: 0, opacity: 1 } : {}}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
        >
          <span className="text-3xl">📊</span>
        </motion.div>
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.12, ease: REPORT_EASE }}
        >
          <h2 className="bg-gradient-to-r from-surface-100 via-purple-200 to-blue-200 bg-clip-text text-2xl font-bold text-transparent">
            Financial Health Check
          </h2>
          <p className="text-base font-medium text-surface-400">
            {formatMonthLabel(first)} – {formatMonthLabel(last)}
          </p>
        </motion.div>
        <motion.div
          className="flex items-center justify-center gap-6 pt-2"
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.2, ease: REPORT_EASE }}
        >
          <div>
            <p className="text-xl font-bold tabular-nums text-surface-50">{formatCurrency(totalSpent, false)}</p>
            <p className="mt-0.5 text-[10px] text-surface-500">total spent</p>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div>
            <p className="text-xl font-bold tabular-nums text-surface-50">{txCount}</p>
            <p className="mt-0.5 text-[10px] text-surface-500">transactions</p>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div>
            <p className="text-xl font-bold tabular-nums text-surface-50">{months.length}</p>
            <p className="mt-0.5 text-[10px] text-surface-500">months</p>
          </div>
        </motion.div>
      </div>
    </ScrollReportTitleSection>
  )
}

function BigPictureSlide({ totalSpent, avgMonthly, trueMonthlyBaseline, monthCount, income, health, oneOffTotal, annualMonthlySetAside }: {
  totalSpent: number; avgMonthly: number; trueMonthlyBaseline: number; monthCount: number; income: number | null; health: HealthSummary; oneOffTotal: number; annualMonthlySetAside: number
}) {
  const savingsRate = income != null && income > 0 ? ((income - avgMonthly) / income) * 100 : null
  const verdictColor = health.verdict === 'green' ? 'text-emerald-400' : health.verdict === 'amber' ? 'text-amber-400' : 'text-red-400'
  const hasFrequencyData = trueMonthlyBaseline !== avgMonthly

  const kpis = [
    { label: 'Total Spent', value: formatCurrency(totalSpent, false) },
    { label: 'Avg Monthly', value: formatCurrency(avgMonthly, false) },
    ...(hasFrequencyData ? [{ label: 'True Monthly Baseline', value: formatCurrency(trueMonthlyBaseline, false) }] : []),
    { label: 'Months', value: String(monthCount) },
    ...(savingsRate != null ? [{ label: 'Savings Rate', value: `${Math.round(savingsRate)}%` }] : []),
    ...(annualMonthlySetAside > 0 ? [{ label: 'Annual Set-Aside', value: `${formatCurrency(annualMonthlySetAside, false)}/mo` }] : []),
  ]

  return (
    <div className="space-y-4">
      <motion.div
        className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5 text-center"
        initial={{ scale: 0.95, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.45, ease: REPORT_EASE }}
      >
        <p className={`text-xs font-medium ${verdictColor}`}>{health.message}</p>
      </motion.div>
      <RevealStagger className="grid grid-cols-2 gap-2">
        {kpis.map((m) => (
          <RevealItem key={m.label}>
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-center">
              <p className="text-sm font-bold tabular-nums text-surface-200">{m.value}</p>
              <p className="mt-0.5 text-[9px] text-surface-500">{m.label}</p>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
      {oneOffTotal > 0 && (
        <p className="text-center text-[10px] text-surface-400">
          One-off expenses this period: {formatCurrency(oneOffTotal, false)} (excluded from baseline).
        </p>
      )}
      {monthCount < 12 && (
        <p className="text-center text-[9px] italic text-surface-500">
          Based on {monthCount} months of data. Annual expenses may not all appear in this window.
        </p>
      )}
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
      <motion.div
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.45, ease: REPORT_EASE }}
      >
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11 }} formatter={(value) => [formatCurrency(Number(value ?? 0), false), 'Spent']} />
              {income != null && income > 0 && <ReferenceLine y={income} stroke="#64748b" strokeDasharray="6 4" label={{ value: 'Income', position: 'right', fill: '#64748b', fontSize: 9 }} />}
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={28} fill="#6366F1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      {minMonth && maxMonth && (
        <p className="text-center text-[11px] text-surface-400">
          Lightest: <span className="font-medium text-emerald-400">{shortMonth(minMonth.billing_month)}</span> ({formatCurrency(min, false)}) · Heaviest: <span className="font-medium text-amber-400">{shortMonth(maxMonth.billing_month)}</span> ({formatCurrency(max, false)})
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
      <div className="flex items-center gap-3">
        <motion.div
          className="h-32 w-32 shrink-0"
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.45, ease: REPORT_EASE }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={28} outerRadius={52} paddingAngle={2} dataKey="value" stroke="none">
                {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
        <RevealStagger className="min-w-0 flex-1 space-y-1.5">
          {top.map((cat, i) => {
            const label = categoryLookup[cat.category]?.label ?? cat.category
            const icon = categoryLookup[cat.category]?.icon ?? '📦'
            const pct = total > 0 ? ((Number(cat.total_amount) / total) * 100).toFixed(0) : '0'
            return (
              <RevealItem key={cat.category}>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="shrink-0 text-xs">{icon}</span>
                  <span className="flex-1 truncate text-[11px] text-surface-300">{label}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-surface-200">{pct}%</span>
                </div>
              </RevealItem>
            )
          })}
        </RevealStagger>
      </div>
      <p className="text-center text-[11px] text-surface-400">Your top 3 categories account for {top3Pct}% of all spending.</p>
    </div>
  )
}

function HowChangingSlide({ trend, months, aggregated, categoryLookup }: {
  trend: CategoryTrendPoint[]; months: string[]; aggregated: CategorySummary[];
  categoryLookup: Record<string, { icon: string; label: string; spendingFrequency?: SpendingFrequency }>
}) {
  const [view, setView] = useState<'analysis' | 'cashflow'>('analysis')
  const top5 = aggregated.filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID).slice(0, 5).map(c => c.category)
  const labels = top5.map(c => categoryLookup[c]?.label ?? c)
  const hasAnnual = top5.some(c => categoryLookup[c]?.spendingFrequency === 'annual')

  const chartData = months.map(m => {
    const row: Record<string, number | string> = { month: shortMonth(m) }
    for (const cat of top5) {
      const label = categoryLookup[cat]?.label ?? cat
      const point = trend.find(p => p.month === m && p.category === cat)
      const rawAmount = point?.amount ?? 0
      const freq = categoryLookup[cat]?.spendingFrequency
      row[label] = view === 'analysis' && freq === 'annual' ? rawAmount / 12 : rawAmount
    }
    return row
  })

  return (
    <div className="space-y-2">
      {hasAnnual && (
        <div className="flex items-center justify-end gap-1">
          {(['analysis', 'cashflow'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${view === v ? 'bg-indigo-500/20 text-indigo-300' : 'text-surface-500 hover:text-surface-300'}`}
            >
              {v === 'analysis' ? 'Analysis' : 'Cash flow'}
            </button>
          ))}
        </div>
      )}
      <motion.div
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ duration: 0.45, ease: REPORT_EASE }}
      >
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11 }} formatter={(value) => [formatCurrency(Number(value ?? 0), false), '']} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="circle" iconSize={6} />
              {labels.map((label, i) => <Line key={label} type="monotone" dataKey={label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      {view === 'analysis' && hasAnnual && (
        <p className="text-center text-[9px] italic text-surface-500">
          Includes smoothed annual costs. Switch to Cash flow view for actual outflows.
        </p>
      )}
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
    <RevealStagger className="space-y-2">
      {movers.map((m) => {
        const info = categoryLookup[m.category]
        const isUp = m.delta > 0
        return (
          <RevealItem key={m.category}>
            <div className={`rounded-xl border p-3 ${isUp ? 'border-red-500/15 bg-red-500/[0.03]' : 'border-emerald-500/15 bg-emerald-500/[0.03]'}`}>
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{info?.icon ?? '📦'}</span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-surface-200">{info?.label ?? m.category}</p>
                  <p className="text-[10px] text-surface-500">{formatCurrency(m.prev, false)} → {formatCurrency(m.current, false)}</p>
                </div>
                <span className={`text-sm font-bold ${isUp ? 'text-red-400' : 'text-emerald-400'}`}>
                  {isUp ? '↑' : '↓'} {Math.abs(Math.round(m.pct))}%
                </span>
              </div>
            </div>
          </RevealItem>
        )
      })}
      {movers.length === 0 && <p className="py-4 text-center text-xs text-surface-500">No significant category changes to report.</p>}
    </RevealStagger>
  )
}

function TopTransactionsSlide({ transactions, categoryLookup }: { transactions: ExportRow[]; categoryLookup: Record<string, { icon: string; label: string }> }) {
  const top = topSpendingTransactions(transactions, 8)

  return (
    <div className="space-y-3">
      <p className="text-center text-[11px] text-surface-400">These individual purchases had the most impact</p>
      <RevealStagger className="space-y-1.5">
        {top.map((tx, i) => {
          const merchant = truncate(tx.merchant_clean || tx.merchant_raw, 20)
          const catIcon = categoryLookup[tx.category]?.icon ?? '📦'
          return (
            <RevealItem key={`${tx.tx_date}-${tx.merchant_raw}-${i}`}>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
                <span className="text-base">{catIcon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-surface-200">{merchant}</p>
                  <p className="text-[10px] text-surface-500">{tx.tx_date}</p>
                </div>
                <span className="text-sm font-bold tabular-nums text-surface-100">{fmtFull(exportSpendMagnitude(tx))}</span>
              </div>
            </RevealItem>
          )
        })}
      </RevealStagger>
    </div>
  )
}

function TopMerchantsSlide({ transactions, months, categoryLookup }: { transactions: ExportRow[]; months: number; categoryLookup: Record<string, { icon: string; label: string }> }) {
  const byCat = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const tx of transactions) {
      const cat = tx.category || 'uncategorized'
      const merchant = (tx.merchant_clean || tx.merchant_raw).trim()
      if (!merchant || !categoryLookup[cat]) continue
      if (!map.has(cat)) map.set(cat, new Map())
      const m = map.get(cat)!
      m.set(merchant, (m.get(merchant) ?? 0) + Math.abs(Number(tx.normalized_amount ?? tx.amount)))
    }
    return Array.from(map.entries())
      .map(([cat, merchants]) => ({
        cat,
        info: categoryLookup[cat],
        top: Array.from(merchants.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3),
      }))
      .sort((a, b) => b.top.reduce((s, [, v]) => s + v, 0) - a.top.reduce((s, [, v]) => s + v, 0))
      .slice(0, 4)
  }, [transactions, categoryLookup])

  return (
    <div className="space-y-3">
      <p className="text-center text-[11px] text-surface-400">Where spending concentrates by category</p>
      <RevealStagger className="space-y-2">
        {byCat.map(({ cat, info, top }) => (
          <RevealItem key={cat}>
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
              <p className="text-xs font-medium text-surface-200 mb-1.5">{info?.icon} {info?.label}</p>
              {top.map(([merchant, amount]) => (
                <div key={merchant} className="flex items-center justify-between py-0.5">
                  <span className="text-[11px] text-surface-400 truncate max-w-[160px]">{merchant}</span>
                  <span className="text-[11px] tabular-nums text-surface-300">{formatCurrency(amount / Math.max(months, 1), false)}/mo</span>
                </div>
              ))}
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </div>
  )
}

function WhoPaysSlide({ transactions, categoryLookup }: { transactions: ExportRow[]; categoryLookup: Record<string, { icon: string; label: string }> }) {
  const splits = useMemo(() => {
    const matrix = new Map<string, Map<string, number>>()
    for (const tx of transactions) {
      const cat = tx.category || 'uncategorized'
      const acct = tx.account_last4 || '????'
      if (!categoryLookup[cat]) continue
      if (!matrix.has(cat)) matrix.set(cat, new Map())
      const m = matrix.get(cat)!
      m.set(acct, (m.get(acct) ?? 0) + Math.abs(Number(tx.normalized_amount ?? tx.amount)))
    }
    return Array.from(matrix.entries())
      .map(([cat, accounts]) => {
        const total = Array.from(accounts.values()).reduce((s, v) => s + v, 0)
        const cards = Array.from(accounts.entries())
          .map(([acct, amt]) => ({ acct, amt, pct: total > 0 ? (amt / total) * 100 : 0 }))
          .sort((a, b) => b.amt - a.amt)
        return { cat, info: categoryLookup[cat], total, cards }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [transactions, categoryLookup])

  return (
    <div className="space-y-3">
      <p className="text-center text-[11px] text-surface-400">Card contribution by category</p>
      <RevealStagger className="space-y-2">
        {splits.map(({ cat, info, cards }) => (
          <RevealItem key={cat}>
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
              <p className="text-xs font-medium text-surface-200 mb-1">{info?.icon} {info?.label}</p>
              <div className="flex h-2 w-full overflow-hidden rounded-full">
                {cards.map((c, i) => (
                  <div
                    key={c.acct}
                    className="h-full"
                    style={{ width: `${c.pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                  />
                ))}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3">
                {cards.map((c, i) => (
                  <span key={c.acct} className="text-[10px] text-surface-400">
                    <span className="inline-block h-1.5 w-1.5 rounded-full mr-0.5" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    ••{c.acct} {Math.round(c.pct)}%
                  </span>
                ))}
              </div>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </div>
  )
}

function AdvisorSummarySlide({ insights, income, avgMonthly }: { insights: AdvisorInsight[]; income: number | null; avgMonthly: number }) {
  const savingsRate = income != null && income > 0 ? Math.round(((income - avgMonthly) / income) * 100) : null

  return (
    <div className="space-y-4">
      <p className="text-center text-[11px] text-surface-400">Here&apos;s what we&apos;d recommend focusing on</p>

      {savingsRate != null && (
        <motion.div
          className={`rounded-2xl border p-4 text-center ${savingsRate >= 10 ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : savingsRate >= 0 ? 'border-amber-500/20 bg-amber-500/[0.04]' : 'border-red-500/20 bg-red-500/[0.04]'}`}
          initial={{ scale: 0.95, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ type: 'spring', stiffness: 220, damping: 20 }}
        >
          <p className="text-[10px] uppercase tracking-wider text-surface-500">Overall Savings Rate</p>
          <p className={`mt-1 text-3xl font-extrabold ${savingsRate >= 10 ? 'text-emerald-400' : savingsRate >= 0 ? 'text-amber-400' : 'text-red-400'}`}>{savingsRate}%</p>
        </motion.div>
      )}

      <RevealStagger className="space-y-2">
        {insights.map((insight) => (
          <RevealItem key={insight.id}>
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
              <div className="flex gap-2.5">
                <SlideDeckInsightIcon id={insight.id} />
                <div className="min-w-0">
                  <p className="text-xs leading-relaxed text-surface-200">{insight.text}</p>
                  <p className="mt-1 text-[10px] leading-snug text-surface-500">{insight.rationale}</p>
                </div>
              </div>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </div>
  )
}
