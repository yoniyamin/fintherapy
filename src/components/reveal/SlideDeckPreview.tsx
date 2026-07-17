import { useMemo, useRef } from 'react'
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
  XAxis, YAxis, Tooltip, LineChart, Line, Legend,
} from 'recharts'
import type { CategorySummary, MonthlyTotal } from '../../hooks/useReveal'
import type { ExportRow } from '../../hooks/useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'
import {
  exportSpendMagnitude,
  isSpendingOutflow,
  topSpendingTransactions,
} from '../../lib/exportSpend'
import { formatCurrency } from '../../lib/formatCurrency'

interface Props {
  month: string
  summary: CategorySummary[]
  prevMonthSummary: CategorySummary[] | null
  monthlyTotals: MonthlyTotal[]
  income: number | null
  transactions: ExportRow[]
  categoryLookup: Record<string, { icon: string; label: string }>
  onClose: () => void
  onDownload: () => void
  downloading: boolean
}

const COLORS = ['#58CC02', '#1CB0F6', '#A560E8', '#FF9600', '#818cf8', '#ec4899']

const fmtFull = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(v)

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function shortMonth(value: string): string {
  const [y, m] = value.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short' })
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '\u2026'
}

function getDelta(current: number, previous: number): { pct: number; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { pct: 0, direction: 'flat' }
  const pct = ((current - previous) / previous) * 100
  return { pct: Math.abs(pct), direction: pct > 1 ? 'up' : pct < -1 ? 'down' : 'flat' }
}

function DeltaBadge({ pct, direction, inverted = false }: { pct: number; direction: 'up' | 'down' | 'flat'; inverted?: boolean }) {
  if (direction === 'flat') return null
  const isGood = inverted ? direction === 'up' : direction === 'down'
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isGood ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
      {direction === 'up' ? '↑' : '↓'} {pct.toFixed(0)}%
    </span>
  )
}

export default function SlideDeckPreview({
  month,
  summary,
  prevMonthSummary,
  monthlyTotals,
  income,
  transactions,
  categoryLookup,
  onClose,
  onDownload,
  downloading,
}: Props) {
  const filteredSummary = useMemo(
    () => summary.filter((c) => c.category !== OWN_TRANSFERS_CATEGORY_ID),
    [summary],
  )
  const filteredPrev = useMemo(
    () => prevMonthSummary?.filter((c) => c.category !== OWN_TRANSFERS_CATEGORY_ID) ?? null,
    [prevMonthSummary],
  )
  const filteredTransactions = useMemo(
    () => transactions.filter((tx) => tx.status !== 'transfer' && tx.status !== 'offset' && tx.category !== OWN_TRANSFERS_CATEGORY_ID),
    [transactions],
  )

  const totalSpent = filteredSummary.reduce((s, c) => s + Number(c.total_amount), 0)
  const prevTotalSpent = filteredPrev?.reduce((s, c) => s + Number(c.total_amount), 0) ?? null

  const sortedCategories = useMemo(
    () => [...filteredSummary].filter((c) => Number(c.total_amount) > 0).sort((a, b) => Number(b.total_amount) - Number(a.total_amount)),
    [filteredSummary],
  )
  const topCategory = sortedCategories[0] ?? null

  const topCategoryTransactions = useMemo(() => {
    if (!topCategory) return []
    return topSpendingTransactions(
      filteredTransactions.filter((tx) => tx.category === topCategory.category),
      6,
    )
  }, [filteredTransactions, topCategory])

  const topTransactions = useMemo(
    () => topSpendingTransactions(filteredTransactions, 8),
    [filteredTransactions],
  )

  const hasTrend = monthlyTotals.length >= 2
  const hasIncomeHistory = income != null && hasTrend

  const sections = useMemo(() => {
    const s = [
      { id: 'title', label: 'Spending Report' },
      { id: 'overview', label: 'Overview' },
      { id: 'categories', label: 'By Category' },
    ]
    if (topCategory) s.push({ id: 'top-category', label: 'Top Category' })
    s.push({ id: 'top-transactions', label: 'Biggest Purchases' })
    if (hasTrend) s.push({ id: 'trend', label: 'Monthly Trend' })
    if (hasIncomeHistory) s.push({ id: 'income-vs-spending', label: 'Income vs Spending' })
    s.push({ id: 'highlights', label: 'Highlights' })
    return s
  }, [hasTrend, hasIncomeHistory, topCategory])

  const prevMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 2)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [month])

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
            month={month}
            totalSpent={totalSpent}
            txCount={filteredTransactions.length}
            onScrollToTop={scrollToTop}
          />
          <ScrollReportDivider />
          <ScrollReportSection id="overview" title="Overview">
            <OverviewSlide
              totalSpent={totalSpent}
              prevTotalSpent={prevTotalSpent}
              txCount={filteredTransactions.length}
              income={income}
              categoryCount={filteredSummary.length}
              prevMonth={prevMonth}
            />
          </ScrollReportSection>
          <ScrollReportDivider />
          <ScrollReportSection id="categories" title="By Category">
            <CategoriesSlide
              categories={sortedCategories}
              prevCategories={filteredPrev}
              total={totalSpent}
              categoryLookup={categoryLookup}
            />
          </ScrollReportSection>
          {topCategory && (
            <>
              <ScrollReportDivider />
              <ScrollReportSection id="top-category" title="Top Category">
                <TopCategorySlide
                  category={topCategory}
                  transactions={topCategoryTransactions}
                  categoryLookup={categoryLookup}
                  prevAmount={filteredPrev?.find((c) => c.category === topCategory.category)?.total_amount ?? null}
                />
              </ScrollReportSection>
            </>
          )}
          <ScrollReportDivider />
          <ScrollReportSection id="top-transactions" title="Biggest Purchases">
            <TopTransactionsSlide transactions={topTransactions} categoryLookup={categoryLookup} />
          </ScrollReportSection>
          {hasTrend && (
            <>
              <ScrollReportDivider />
              <ScrollReportSection id="trend" title="Monthly Trend">
                <TrendSlide monthlyTotals={monthlyTotals} selectedMonth={month} />
              </ScrollReportSection>
            </>
          )}
          {hasIncomeHistory && (
            <>
              <ScrollReportDivider />
              <ScrollReportSection id="income-vs-spending" title="Income vs Spending">
                <IncomeVsSpendingSlide monthlyTotals={monthlyTotals} income={income!} />
              </ScrollReportSection>
            </>
          )}
          <ScrollReportDivider />
          <ScrollReportSection id="highlights" title="Highlights">
            <HighlightsSlide
              transactions={filteredTransactions}
              summary={filteredSummary}
              prevSummary={filteredPrev}
              categoryLookup={categoryLookup}
              income={income}
              totalSpent={totalSpent}
            />
          </ScrollReportSection>
        </>
      )}
    </ScrollReportShell>
  )
}

/* ─────────────────── SLIDE COMPONENTS ─────────────────── */

function TitleSlide({
  month, totalSpent, txCount, onScrollToTop,
}: {
  month: string; totalSpent: number; txCount: number; onScrollToTop: () => void
}) {
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
            Spending Report
          </h2>
          <p className="text-base font-medium text-surface-400">{formatMonthLabel(month)}</p>
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
        </motion.div>
      </div>
    </ScrollReportTitleSection>
  )
}

function OverviewSlide({
  totalSpent, prevTotalSpent, txCount, income, categoryCount, prevMonth,
}: {
  totalSpent: number; prevTotalSpent: number | null; txCount: number
  income: number | null; categoryCount: number; prevMonth: string
}) {
  const freeIncome = income != null ? income - totalSpent : null
  const spendDelta = prevTotalSpent != null ? getDelta(totalSpent, prevTotalSpent) : null

  return (
    <div className="space-y-4">
      <motion.div
        className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5 text-center"
        initial={{ scale: 0.95, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.45, ease: REPORT_EASE }}
      >
        <p className="text-[10px] uppercase tracking-wider text-surface-500">Total Spent</p>
        <motion.p
          className="mt-1 text-3xl font-extrabold tabular-nums text-surface-50"
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.08 }}
        >
          {formatCurrency(totalSpent, false)}
        </motion.p>
        {spendDelta && spendDelta.direction !== 'flat' && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <DeltaBadge pct={spendDelta.pct} direction={spendDelta.direction} />
            <span className="text-[10px] text-surface-500">vs {shortMonth(prevMonth)}</span>
          </div>
        )}
      </motion.div>

      <RevealStagger className="grid grid-cols-3 gap-2">
        {[
          { label: 'Transactions', value: String(txCount) },
          { label: 'Categories', value: String(categoryCount) },
          ...(income != null ? [{ label: 'Savings Rate', value: `${Math.round(((income - totalSpent) / income) * 100)}%` }] : [{ label: 'Avg/Tx', value: formatCurrency(txCount > 0 ? totalSpent / txCount : 0, false) }]),
        ].map((m) => (
          <RevealItem key={m.label}>
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-center">
              <p className="text-sm font-bold tabular-nums text-surface-200">{m.value}</p>
              <p className="mt-0.5 text-[9px] text-surface-500">{m.label}</p>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>

      {income != null && (
        <motion.div
          className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15, ease: REPORT_EASE }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-surface-400">Income: {formatCurrency(income, false)}</span>
            <span className={`font-semibold ${freeIncome! >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {freeIncome! >= 0 ? '+' : ''}{formatCurrency(freeIncome!, false)} free
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-900">
            <motion.div
              className={`h-full rounded-full ${freeIncome! >= 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.min((totalSpent / income) * 100, 100)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}
    </div>
  )
}

function CategoriesSlide({
  categories, prevCategories, total, categoryLookup,
}: {
  categories: CategorySummary[]; prevCategories: CategorySummary[] | null
  total: number; categoryLookup: Record<string, { icon: string; label: string }>
}) {
  const TOP_N = 5
  const top = categories.slice(0, TOP_N)
  const rest = categories.slice(TOP_N)
  const otherTotal = rest.reduce((s, c) => s + Number(c.total_amount), 0)

  const chartData = top.map((c, i) => ({
    name: categoryLookup[c.category]?.label ?? c.category,
    value: Number(c.total_amount),
    color: COLORS[i % COLORS.length],
  }))
  if (otherTotal > 0) chartData.push({ name: 'Other', value: otherTotal, color: '#475569' })

  const prevLookup = new Map(prevCategories?.map((c) => [c.category, Number(c.total_amount)]) ?? [])

  return (
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
          const prevAmount = prevLookup.get(cat.category)
          const delta = prevAmount != null ? getDelta(Number(cat.total_amount), prevAmount) : null
          return (
            <RevealItem key={cat.category}>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="shrink-0 text-xs">{icon}</span>
                <span className="flex-1 truncate text-[11px] text-surface-300">{label}</span>
                {delta && delta.direction !== 'flat' && (
                  <DeltaBadge pct={delta.pct} direction={delta.direction} />
                )}
                <span className="text-[11px] font-semibold tabular-nums text-surface-200">{pct}%</span>
              </div>
            </RevealItem>
          )
        })}
        {otherTotal > 0 && (
          <RevealItem>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 shrink-0 rounded-full bg-slate-600" />
              <span className="flex-1 text-[11px] text-surface-500">Other</span>
              <span className="text-[11px] tabular-nums text-surface-500">{total > 0 ? ((otherTotal / total) * 100).toFixed(0) : '0'}%</span>
            </div>
          </RevealItem>
        )}
      </RevealStagger>
    </div>
  )
}

function TopCategorySlide({
  category, transactions, categoryLookup, prevAmount,
}: {
  category: CategorySummary; transactions: ExportRow[]
  categoryLookup: Record<string, { icon: string; label: string }>; prevAmount: number | null
}) {
  const label = categoryLookup[category.category]?.label ?? category.category
  const icon = categoryLookup[category.category]?.icon ?? '📦'
  const amount = Number(category.total_amount)
  const delta = prevAmount != null ? getDelta(amount, Number(prevAmount)) : null

  return (
    <div className="space-y-4">
      <motion.div
        className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#58CC02]/[0.06] to-transparent p-4 text-center"
        initial={{ scale: 0.92, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      >
        <span className="text-3xl">{icon}</span>
        <p className="mt-2 text-lg font-bold text-surface-50">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#58CC02]">{formatCurrency(amount, false)}</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-[10px] text-surface-500">{Number(category.tx_count)} transactions</span>
          {delta && delta.direction !== 'flat' && (
            <>
              <span className="text-surface-700">&middot;</span>
              <DeltaBadge pct={delta.pct} direction={delta.direction} />
              <span className="text-[10px] text-surface-500">vs last month</span>
            </>
          )}
        </div>
      </motion.div>

      {transactions.length > 0 && (
        <RevealStagger className="space-y-1">
          <p className="px-1 text-[10px] uppercase tracking-wider text-surface-500">Top in this category</p>
          {transactions.map((tx, i) => (
            <RevealItem key={`${tx.tx_date}-${tx.merchant_raw}-${i}`}>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                <span className="w-5 text-center text-[10px] font-bold text-surface-600">{i + 1}</span>
                <span className="flex-1 truncate text-xs text-surface-200">{truncate(tx.merchant_clean || tx.merchant_raw, 22)}</span>
                <span className="text-[10px] text-surface-500">{tx.tx_date}</span>
                <span className="text-xs font-bold tabular-nums text-surface-100">{fmtFull(exportSpendMagnitude(tx))}</span>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      )}
    </div>
  )
}

function TopTransactionsSlide({
  transactions, categoryLookup,
}: {
  transactions: ExportRow[]; categoryLookup: Record<string, { icon: string; label: string }>
}) {
  return (
    <RevealStagger className="space-y-1.5">
      {transactions.map((tx, i) => {
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
  )
}

function TrendSlide({ monthlyTotals, selectedMonth }: { monthlyTotals: MonthlyTotal[]; selectedMonth: string }) {
  const chartData = monthlyTotals.map((d) => ({
    month: shortMonth(d.billing_month),
    amount: Number(d.total_amount),
    isCurrent: d.billing_month === selectedMonth,
  }))

  return (
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
            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `\u20AC${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}`} />
            <Tooltip
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '11px' }}
              itemStyle={{ color: '#f8fafc' }}
              formatter={(value) => formatCurrency(Number(value ?? 0), false)}
            />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={28}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.isCurrent ? '#58CC02' : '#4f46e5'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}

function IncomeVsSpendingSlide({ monthlyTotals, income }: { monthlyTotals: MonthlyTotal[]; income: number }) {
  const chartData = monthlyTotals.map((d) => ({
    month: shortMonth(d.billing_month),
    spending: Number(d.total_amount),
    income,
  }))

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
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `\u20AC${(v / 1000).toFixed(1)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '11px' }}
                itemStyle={{ color: '#f8fafc' }}
                formatter={(value) => formatCurrency(Number(value ?? 0), false)}
              />
              <Legend
                wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
              />
              <Line type="monotone" dataKey="income" stroke="#58CC02" strokeWidth={2} dot={false} strokeDasharray="6 3" />
              <Line type="monotone" dataKey="spending" stroke="#A560E8" strokeWidth={2.5} dot={{ r: 3, fill: '#A560E8' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      <p className="text-center text-[10px] text-surface-500">
        Income shown as fixed baseline &middot; Spending varies monthly
      </p>
    </div>
  )
}

function HighlightsSlide({
  transactions, summary, prevSummary, categoryLookup, income, totalSpent,
}: {
  transactions: ExportRow[]; summary: CategorySummary[]; prevSummary: CategorySummary[] | null
  categoryLookup: Record<string, { icon: string; label: string }>; income: number | null; totalSpent: number
}) {
  const spendingTxCount = transactions.filter(isSpendingOutflow).length
  const avgPerTx = spendingTxCount > 0 ? totalSpent / spendingTxCount : 0
  const topCategory = [...summary].sort((a, b) => Number(b.total_amount) - Number(a.total_amount))[0]
  const topTx = topSpendingTransactions(transactions, 1)[0]

  const biggestIncrease = useMemo(() => {
    if (!prevSummary) return null
    const prevMap = new Map(prevSummary.map((c) => [c.category, Number(c.total_amount)]))
    let max: { category: string; delta: number; pct: number } | null = null
    for (const cat of summary) {
      const prev = prevMap.get(cat.category)
      if (prev && prev > 0) {
        const delta = Number(cat.total_amount) - prev
        const pct = (delta / prev) * 100
        if (delta > 0 && (!max || delta > max.delta)) {
          max = { category: cat.category, delta, pct }
        }
      }
    }
    return max
  }, [summary, prevSummary])

  const cards: { emoji: string; title: string; value: string; sub: string; accent: string }[] = []

  if (topTx) {
    cards.push({
      emoji: '🏆',
      title: 'Biggest Purchase',
      value: fmtFull(exportSpendMagnitude(topTx)),
      sub: truncate(topTx.merchant_clean || topTx.merchant_raw, 26),
      accent: 'from-amber-500/10 to-transparent border-amber-500/20',
    })
  }
  if (topCategory) {
    const catLabel = categoryLookup[topCategory.category]?.label ?? topCategory.category
    cards.push({
      emoji: categoryLookup[topCategory.category]?.icon ?? '📊',
      title: 'Top Category',
      value: formatCurrency(Number(topCategory.total_amount), false),
      sub: `${catLabel} \u2022 ${Number(topCategory.tx_count)} txns`,
      accent: 'from-purple-500/10 to-transparent border-purple-500/20',
    })
  }
  if (biggestIncrease) {
    const catLabel = categoryLookup[biggestIncrease.category]?.label ?? biggestIncrease.category
    cards.push({
      emoji: '📈',
      title: 'Biggest Increase',
      value: `+${formatCurrency(biggestIncrease.delta, false)}`,
      sub: `${catLabel} \u2022 +${biggestIncrease.pct.toFixed(0)}% vs last month`,
      accent: 'from-red-500/10 to-transparent border-red-500/20',
    })
  }
  cards.push({
    emoji: '🧮',
    title: 'Average per Transaction',
    value: fmtFull(avgPerTx),
    sub: `${spendingTxCount} transactions total`,
    accent: 'from-blue-500/10 to-transparent border-blue-500/20',
  })
  if (income != null) {
    const savingsRate = Math.round(((income - totalSpent) / income) * 100)
    cards.push({
      emoji: savingsRate >= 0 ? '💚' : '🔴',
      title: 'Savings Rate',
      value: `${savingsRate}%`,
      sub: savingsRate >= 0 ? `Saved ${formatCurrency(income - totalSpent, false)}` : `Over budget by ${formatCurrency(totalSpent - income, false)}`,
      accent: savingsRate >= 0 ? 'from-emerald-500/10 to-transparent border-emerald-500/20' : 'from-red-500/10 to-transparent border-red-500/20',
    })
  }

  return (
    <div className="space-y-2.5">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          className={`rounded-2xl border bg-gradient-to-br p-4 ${card.accent}`}
          initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20, rotate: i % 2 === 0 ? -1.5 : 1.5 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ type: 'spring', stiffness: 180, damping: 20, delay: i * 0.06 }}
        >
          <div className="flex items-start gap-3">
            <motion.span
              className="text-xl"
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.08 + i * 0.06 }}
            >
              {card.emoji}
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-surface-500">{card.title}</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-surface-100">{card.value}</p>
              <p className="mt-0.5 text-xs text-surface-400">{card.sub}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
