import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, LineChart, Line, Legend,
} from 'recharts'
import type { CategorySummary, MonthlyTotal } from '../../hooks/useReveal'
import type { ExportRow } from '../../hooks/useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID } from '../../lib/constants'

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

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)

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
  const [slideIdx, setSlideIdx] = useState(0)

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
    return [...filteredTransactions]
      .filter((tx) => tx.category === topCategory.category)
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 6)
  }, [filteredTransactions, topCategory])

  const topTransactions = useMemo(
    () => [...filteredTransactions].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 8),
    [filteredTransactions],
  )

  const hasTrend = monthlyTotals.length >= 2
  const hasIncomeHistory = income != null && hasTrend

  const slides = useMemo(() => {
    const s: { id: string; title: string }[] = [
      { id: 'title', title: 'Title' },
      { id: 'overview', title: 'Overview' },
      { id: 'categories', title: 'Categories' },
      { id: 'top-category', title: 'Top Category' },
      { id: 'top-transactions', title: 'Top Spending' },
    ]
    if (hasTrend) s.push({ id: 'trend', title: 'Trend' })
    if (hasIncomeHistory) s.push({ id: 'income-vs-spending', title: 'Income vs Spending' })
    s.push({ id: 'highlights', title: 'Highlights' })
    return s
  }, [hasTrend, hasIncomeHistory])

  const totalSlides = slides.length
  const goNext = () => setSlideIdx((i) => Math.min(i + 1, totalSlides - 1))
  const goPrev = () => setSlideIdx((i) => Math.max(i - 1, 0))
  const currentSlide = slides[slideIdx]

  const prevMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 2)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [month])

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
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-surface-400 transition-all hover:text-surface-200 hover:bg-white/[0.04]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSlideIdx(i)}
              className={`transition-all duration-300 rounded-full ${i === slideIdx ? 'w-6 h-2 bg-gradient-to-r from-purple-400 to-blue-400' : 'w-2 h-2 bg-surface-700 hover:bg-surface-500'}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/20 px-3 py-1.5 text-sm font-medium text-purple-200 transition-all hover:from-purple-500/30 hover:to-blue-500/30 disabled:opacity-50"
        >
          {downloading ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
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
              {currentSlide.id === 'title' && <TitleSlide month={month} totalSpent={totalSpent} txCount={filteredTransactions.length} />}
              {currentSlide.id === 'overview' && (
                <OverviewSlide
                  totalSpent={totalSpent}
                  prevTotalSpent={prevTotalSpent}
                  txCount={filteredTransactions.length}
                  income={income}
                  categoryCount={filteredSummary.length}
                  month={month}
                  prevMonth={prevMonth}
                />
              )}
              {currentSlide.id === 'categories' && (
                <CategoriesSlide
                  categories={sortedCategories}
                  prevCategories={filteredPrev}
                  total={totalSpent}
                  categoryLookup={categoryLookup}
                />
              )}
              {currentSlide.id === 'top-category' && topCategory && (
                <TopCategorySlide
                  category={topCategory}
                  transactions={topCategoryTransactions}
                  categoryLookup={categoryLookup}
                  prevAmount={filteredPrev?.find((c) => c.category === topCategory.category)?.total_amount ?? null}
                />
              )}
              {currentSlide.id === 'top-transactions' && (
                <TopTransactionsSlide transactions={topTransactions} categoryLookup={categoryLookup} />
              )}
              {currentSlide.id === 'trend' && (
                <TrendSlide monthlyTotals={monthlyTotals} selectedMonth={month} />
              )}
              {currentSlide.id === 'income-vs-spending' && (
                <IncomeVsSpendingSlide monthlyTotals={monthlyTotals} income={income!} />
              )}
              {currentSlide.id === 'highlights' && (
                <HighlightsSlide
                  transactions={filteredTransactions}
                  summary={filteredSummary}
                  prevSummary={filteredPrev}
                  categoryLookup={categoryLookup}
                  income={income}
                  totalSpent={totalSpent}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Nav arrows */}
        {slideIdx > 0 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] p-2.5 text-surface-400 transition-all hover:bg-white/[0.08] hover:text-surface-200 hover:scale-110"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        {slideIdx < totalSlides - 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] backdrop-blur-sm border border-white/[0.06] p-2.5 text-surface-400 transition-all hover:bg-white/[0.08] hover:text-surface-200 hover:scale-110"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center py-2.5 border-t border-white/[0.04]">
        <span className="text-[11px] text-surface-600 tabular-nums">{slideIdx + 1} of {totalSlides}</span>
      </div>
    </motion.div>
  )
}

/* ─────────────────── SLIDE COMPONENTS ─────────────────── */

function TitleSlide({ month, totalSpent, txCount }: { month: string; totalSpent: number; txCount: number }) {
  return (
    <div className="text-center space-y-6">
      <motion.div
        className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-400/20 flex items-center justify-center"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
      >
        <span className="text-3xl">📊</span>
      </motion.div>

      <div className="space-y-2">
        <motion.h1
          className="text-2xl font-bold bg-gradient-to-r from-surface-100 via-purple-200 to-blue-200 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Spending Report
        </motion.h1>
        <motion.p
          className="text-base font-medium text-surface-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {formatMonthLabel(month)}
        </motion.p>
      </div>

      <motion.div
        className="flex items-center justify-center gap-6 pt-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div>
          <p className="text-xl font-bold tabular-nums text-surface-50">{fmt(totalSpent)}</p>
          <p className="text-[10px] text-surface-500 mt-0.5">total spent</p>
        </div>
        <div className="w-px h-8 bg-white/[0.06]" />
        <div>
          <p className="text-xl font-bold tabular-nums text-surface-50">{txCount}</p>
          <p className="text-[10px] text-surface-500 mt-0.5">transactions</p>
        </div>
      </motion.div>
    </div>
  )
}

function OverviewSlide({
  totalSpent, prevTotalSpent, txCount, income, categoryCount, month, prevMonth,
}: {
  totalSpent: number; prevTotalSpent: number | null; txCount: number
  income: number | null; categoryCount: number; month: string; prevMonth: string
}) {
  const freeIncome = income != null ? income - totalSpent : null
  const spendDelta = prevTotalSpent != null ? getDelta(totalSpent, prevTotalSpent) : null

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Overview</h2>

      {/* Main metric */}
      <motion.div
        className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-5 text-center"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <p className="text-[10px] text-surface-500 uppercase tracking-wider">Total Spent</p>
        <p className="mt-1 text-3xl font-extrabold tabular-nums text-surface-50">{fmt(totalSpent)}</p>
        {spendDelta && spendDelta.direction !== 'flat' && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <DeltaBadge pct={spendDelta.pct} direction={spendDelta.direction} />
            <span className="text-[10px] text-surface-500">vs {shortMonth(prevMonth)}</span>
          </div>
        )}
      </motion.div>

      {/* Metric grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Transactions', value: String(txCount) },
          { label: 'Categories', value: String(categoryCount) },
          ...(income != null ? [{ label: 'Savings Rate', value: `${Math.round(((income - totalSpent) / income) * 100)}%` }] : [{ label: 'Avg/Tx', value: fmt(txCount > 0 ? totalSpent / txCount : 0) }]),
        ].map((m, i) => (
          <motion.div
            key={m.label}
            className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-center"
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <p className="text-sm font-bold tabular-nums text-surface-200">{m.value}</p>
            <p className="mt-0.5 text-[9px] text-surface-500">{m.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Income bar */}
      {income != null && (
        <motion.div
          className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-surface-400">Income: {fmt(income)}</span>
            <span className={`font-semibold ${freeIncome! >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {freeIncome! >= 0 ? '+' : ''}{fmt(freeIncome!)} free
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-surface-900 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${freeIncome! >= 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((totalSpent / income) * 100, 100)}%` }}
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
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">By Category</h2>

      <div className="flex items-center gap-3">
        <motion.div
          className="w-32 h-32 shrink-0"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
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
            const prevAmount = prevLookup.get(cat.category)
            const delta = prevAmount != null ? getDelta(Number(cat.total_amount), prevAmount) : null
            return (
              <motion.div
                key={cat.category}
                className="flex items-center gap-1.5"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs shrink-0">{icon}</span>
                <span className="flex-1 text-[11px] text-surface-300 truncate">{label}</span>
                {delta && delta.direction !== 'flat' && (
                  <DeltaBadge pct={delta.pct} direction={delta.direction} />
                )}
                <span className="text-[11px] font-semibold tabular-nums text-surface-200">{pct}%</span>
              </motion.div>
            )
          })}
          {otherTotal > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 shrink-0 rounded-full bg-slate-600" />
              <span className="flex-1 text-[11px] text-surface-500">Other</span>
              <span className="text-[11px] tabular-nums text-surface-500">{total > 0 ? ((otherTotal / total) * 100).toFixed(0) : '0'}%</span>
            </div>
          )}
        </div>
      </div>
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
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Top Category</h2>

      <motion.div
        className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#58CC02]/[0.06] to-transparent p-4 text-center"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <span className="text-3xl">{icon}</span>
        <p className="mt-2 text-lg font-bold text-surface-50">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#58CC02]">{fmt(amount)}</p>
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
        <div className="space-y-1">
          <p className="text-[10px] text-surface-500 uppercase tracking-wider px-1">Top in this category</p>
          {transactions.map((tx, i) => (
            <motion.div
              key={`${tx.tx_date}-${tx.merchant_raw}-${i}`}
              className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2"
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.04 }}
            >
              <span className="w-5 text-center text-[10px] font-bold text-surface-600">{i + 1}</span>
              <span className="flex-1 text-xs text-surface-200 truncate">{truncate(tx.merchant_clean || tx.merchant_raw, 22)}</span>
              <span className="text-[10px] text-surface-500">{tx.tx_date}</span>
              <span className="text-xs font-bold tabular-nums text-surface-100">{fmtFull(Number(tx.amount))}</span>
            </motion.div>
          ))}
        </div>
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
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Biggest Purchases</h2>
      <div className="space-y-1.5">
        {transactions.map((tx, i) => {
          const merchant = truncate(tx.merchant_clean || tx.merchant_raw, 20)
          const catIcon = categoryLookup[tx.category]?.icon ?? '📦'
          return (
            <motion.div
              key={`${tx.tx_date}-${tx.merchant_raw}-${i}`}
              className="flex items-center gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.04 }}
            >
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

function TrendSlide({ monthlyTotals, selectedMonth }: { monthlyTotals: MonthlyTotal[]; selectedMonth: string }) {
  const chartData = monthlyTotals.map((d) => ({
    month: shortMonth(d.billing_month),
    amount: Number(d.total_amount),
    isCurrent: d.billing_month === selectedMonth,
  }))

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Monthly Trend</h2>
      <motion.div
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `\u20AC${(v / 1000).toFixed(v >= 1000 ? 1 : 0)}${v >= 1000 ? 'k' : ''}`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '11px' }}
                itemStyle={{ color: '#f8fafc' }}
                formatter={(value) => fmt(Number(value ?? 0))}
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
    </div>
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
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Income vs Spending</h2>
      <motion.div
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `\u20AC${(v / 1000).toFixed(1)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '11px' }}
                itemStyle={{ color: '#f8fafc' }}
                formatter={(value) => fmt(Number(value ?? 0))}
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
  const avgPerTx = transactions.length > 0 ? totalSpent / transactions.length : 0
  const topCategory = [...summary].sort((a, b) => Number(b.total_amount) - Number(a.total_amount))[0]
  const topTx = [...transactions].sort((a, b) => Number(b.amount) - Number(a.amount))[0]

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
      value: fmtFull(Number(topTx.amount)),
      sub: truncate(topTx.merchant_clean || topTx.merchant_raw, 26),
      accent: 'from-amber-500/10 to-transparent border-amber-500/20',
    })
  }
  if (topCategory) {
    const catLabel = categoryLookup[topCategory.category]?.label ?? topCategory.category
    cards.push({
      emoji: categoryLookup[topCategory.category]?.icon ?? '📊',
      title: 'Top Category',
      value: fmt(Number(topCategory.total_amount)),
      sub: `${catLabel} \u2022 ${Number(topCategory.tx_count)} txns`,
      accent: 'from-purple-500/10 to-transparent border-purple-500/20',
    })
  }
  if (biggestIncrease) {
    const catLabel = categoryLookup[biggestIncrease.category]?.label ?? biggestIncrease.category
    cards.push({
      emoji: '📈',
      title: 'Biggest Increase',
      value: `+${fmt(biggestIncrease.delta)}`,
      sub: `${catLabel} \u2022 +${biggestIncrease.pct.toFixed(0)}% vs last month`,
      accent: 'from-red-500/10 to-transparent border-red-500/20',
    })
  }
  cards.push({
    emoji: '🧮',
    title: 'Average per Transaction',
    value: fmtFull(avgPerTx),
    sub: `${transactions.length} transactions total`,
    accent: 'from-blue-500/10 to-transparent border-blue-500/20',
  })
  if (income != null) {
    const savingsRate = Math.round(((income - totalSpent) / income) * 100)
    cards.push({
      emoji: savingsRate >= 0 ? '💚' : '🔴',
      title: 'Savings Rate',
      value: `${savingsRate}%`,
      sub: savingsRate >= 0 ? `Saved ${fmt(income - totalSpent)}` : `Over budget by ${fmt(totalSpent - income)}`,
      accent: savingsRate >= 0 ? 'from-emerald-500/10 to-transparent border-emerald-500/20' : 'from-red-500/10 to-transparent border-red-500/20',
    })
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider text-center">Highlights</h2>
      <div className="space-y-2.5">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            className={`rounded-2xl border bg-gradient-to-br p-4 ${card.accent}`}
            initial={{ x: i % 2 === 0 ? -20 : 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 200 }}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{card.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-surface-500 uppercase tracking-wider">{card.title}</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-surface-100">{card.value}</p>
                <p className="mt-0.5 text-xs text-surface-400">{card.sub}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
