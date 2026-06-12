import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import ScrollReportShell from '../common/scrollReport/ScrollReportShell'
import {
  RevealItem,
  RevealStagger,
  ScrollReportDivider,
  ScrollReportSection,
  ScrollReportTitleSection,
} from '../common/scrollReport/ScrollReportParts'
import { REPORT_EASE } from '../../lib/scrollReportMotion'
import { ui } from '../../lib/uiClasses'

const MOCK_SECTIONS = [
  { id: 'report-title', label: 'Spending Report' },
  { id: 'report-overview', label: 'Overview' },
  { id: 'report-categories', label: 'By Category' },
  { id: 'report-top-category', label: 'Top Category' },
  { id: 'report-top-spending', label: 'Biggest Purchases' },
  { id: 'report-trend', label: 'Monthly Trend' },
  { id: 'report-highlights', label: 'Highlights' },
] as const

interface Props {
  onClose: () => void
}

/** Dev mockup for scroll-report previews — uses production shell and reveal parts. */
export default function ScrollReportMockup({ onClose }: Props) {
  return (
    <ScrollReportShell
      sections={MOCK_SECTIONS}
      onClose={onClose}
      onDownload={() => undefined}
      downloading={false}
    >
      {({ scrollToTop }) => (
        <>
          <MockTitleSection onTitleClick={scrollToTop} />
          <ScrollReportDivider />
          <MockOverviewSection />
          <ScrollReportDivider />
          <MockCategoriesSection />
          <ScrollReportDivider />
          <MockTopCategorySection />
          <ScrollReportDivider />
          <MockTopSpendingSection />
          <ScrollReportDivider />
          <MockTrendSection />
          <ScrollReportDivider />
          <MockHighlightsSection />
        </>
      )}
    </ScrollReportShell>
  )
}

/** Mock title hero with spring entrance animations. */
function MockTitleSection({ onTitleClick }: { onTitleClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })

  return (
    <ScrollReportTitleSection id="report-title" onTitleClick={onTitleClick}>
      <div ref={ref} className="space-y-5 text-center">
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
          <p className="text-base font-medium text-surface-400">March 2026</p>
        </motion.div>
        <motion.div
          className="flex items-center justify-center gap-6 pt-1"
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.2, ease: REPORT_EASE }}
        >
          <div>
            <p className="text-xl font-bold tabular-nums text-surface-50">€2,847</p>
            <p className="mt-0.5 text-[10px] text-surface-500">total spent</p>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div>
            <p className="text-xl font-bold tabular-nums text-surface-50">124</p>
            <p className="mt-0.5 text-[10px] text-surface-500">transactions</p>
          </div>
        </motion.div>
      </div>
    </ScrollReportTitleSection>
  )
}

function MockOverviewSection() {
  return (
    <ScrollReportSection id="report-overview" title="Overview">
      <div className={`${ui.glassFlat} p-5 text-center`}>
        <p className="text-[10px] uppercase tracking-wider text-surface-500">Total Spent</p>
        <motion.p
          className="mt-1 text-3xl font-extrabold tabular-nums text-surface-50"
          initial={{ opacity: 0, scale: 0.85 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.08 }}
        >
          €2,847
        </motion.p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
            ↑ 12%
          </span>
          <span className="text-[10px] text-surface-500">vs Feb</span>
        </div>
      </div>
      <RevealStagger className="grid grid-cols-3 gap-2">
        {[
          { label: 'Transactions', value: '124' },
          { label: 'Categories', value: '11' },
          { label: 'Savings Rate', value: '18%' },
        ].map((metric) => (
          <RevealItem key={metric.label}>
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-center">
              <p className="text-sm font-bold tabular-nums text-surface-200">{metric.value}</p>
              <p className="mt-0.5 text-[9px] text-surface-500">{metric.label}</p>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </ScrollReportSection>
  )
}

function MockCategoriesSection() {
  const categories = [
    { icon: '🛒', label: 'Groceries', pct: 28, color: '#58CC02' },
    { icon: '🏠', label: 'Housing', pct: 22, color: '#1CB0F6' },
    { icon: '🍽️', label: 'Dining', pct: 15, color: '#A560E8' },
    { icon: '🚗', label: 'Transport', pct: 12, color: '#FF9600' },
    { icon: '🎬', label: 'Entertainment', pct: 8, color: '#818cf8' },
  ]

  return (
    <ScrollReportSection id="report-categories" title="By Category">
      <RevealStagger className={`${ui.glassFlat} space-y-3 p-4`}>
        {categories.map((category) => (
          <RevealItem key={category.label}>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="text-xs">{category.icon}</span>
              <span className="flex-1 truncate text-[11px] text-surface-300">{category.label}</span>
              <span className="text-[11px] font-semibold tabular-nums text-surface-200">{category.pct}%</span>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </ScrollReportSection>
  )
}

function MockTopCategorySection() {
  const transactions = [
    { merchant: 'Whole Foods Market', date: '2026-03-12', amount: '€142.30' },
    { merchant: 'Trader Joe\'s', date: '2026-03-08', amount: '€89.50' },
    { merchant: 'Local Farmers Market', date: '2026-03-02', amount: '€56.20' },
  ]

  return (
    <ScrollReportSection id="report-top-category" title="Top Category">
      <motion.div
        className="rounded-2xl border border-[#58CC02]/20 bg-gradient-to-br from-[#58CC02]/[0.06] to-transparent p-4 text-center"
        initial={{ opacity: 0, scale: 0.92 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.35 }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      >
        <span className="text-3xl">🛒</span>
        <p className="mt-2 text-lg font-bold text-surface-50">Groceries</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#58CC02]">€798</p>
      </motion.div>
      <RevealStagger className="space-y-1">
        {transactions.map((tx, index) => (
          <RevealItem key={`${tx.merchant}-${index}`}>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2">
              <span className="w-5 text-center text-[10px] font-bold text-surface-600">{index + 1}</span>
              <span className="flex-1 truncate text-xs text-surface-200">{tx.merchant}</span>
              <span className="text-[10px] text-surface-500">{tx.date}</span>
              <span className="text-xs font-bold tabular-nums text-surface-100">{tx.amount}</span>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </ScrollReportSection>
  )
}

function MockTopSpendingSection() {
  const purchases = [
    { icon: '🏠', merchant: 'Rent Payment', date: '2026-03-01', amount: '€1,200.00' },
    { icon: '🛒', merchant: 'Whole Foods Market', date: '2026-03-12', amount: '€142.30' },
    { icon: '✈️', merchant: 'Airline Ticket', date: '2026-03-15', amount: '€289.00' },
  ]

  return (
    <ScrollReportSection id="report-top-spending" title="Biggest Purchases">
      <RevealStagger className="space-y-1.5">
        {purchases.map((purchase, index) => (
          <RevealItem key={`${purchase.merchant}-${index}`}>
            <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
              <span className="text-base">{purchase.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-surface-200">{purchase.merchant}</p>
                <p className="text-[10px] text-surface-500">{purchase.date}</p>
              </div>
              <span className="text-sm font-bold tabular-nums text-surface-100">{purchase.amount}</span>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </ScrollReportSection>
  )
}

function MockTrendSection() {
  const months = [
    { label: 'Oct', pct: 45 },
    { label: 'Nov', pct: 62 },
    { label: 'Dec', pct: 78 },
    { label: 'Jan', pct: 55 },
    { label: 'Feb', pct: 70 },
    { label: 'Mar', pct: 85, current: true },
  ]

  return (
    <ScrollReportSection id="report-trend" title="Monthly Trend">
      <div className={`${ui.glassFlat} p-4`}>
        <div className="flex h-36 items-end justify-between gap-2">
          {months.map((month, index) => (
            <div key={month.label} className="flex flex-1 flex-col items-center gap-2">
              <motion.div
                className={`w-full origin-bottom rounded-t-md ${month.current ? 'bg-[#58CC02]' : 'bg-indigo-500/80'}`}
                initial={{ scaleY: 0, opacity: 0.4 }}
                whileInView={{ scaleY: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.55, delay: index * 0.06, ease: REPORT_EASE }}
                style={{ height: `${month.pct}%` }}
              />
              <span className="text-[10px] text-surface-500">{month.label}</span>
            </div>
          ))}
        </div>
      </div>
    </ScrollReportSection>
  )
}

function MockHighlightsSection() {
  const cards = [
    { emoji: '🏆', title: 'Biggest Purchase', value: '€1,200', sub: 'Rent Payment', accent: 'from-amber-500/10 to-transparent border-amber-500/20', x: -24 },
    { emoji: '📈', title: 'Biggest Increase', value: '+€124', sub: 'Dining · +34% vs last month', accent: 'from-red-500/10 to-transparent border-red-500/20', x: 24 },
    { emoji: '💚', title: 'Savings Rate', value: '18%', sub: 'Saved €624', accent: 'from-emerald-500/10 to-transparent border-emerald-500/20', x: -24 },
  ]

  return (
    <ScrollReportSection id="report-highlights" title="Highlights">
      <div className="space-y-2.5">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            className={`rounded-2xl border bg-gradient-to-br p-4 ${card.accent}`}
            initial={{ opacity: 0, x: card.x, rotate: index % 2 === 0 ? -1.5 : 1.5 }}
            whileInView={{ opacity: 1, x: 0, rotate: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20, delay: index * 0.08 }}
          >
            <div className="flex items-start gap-3">
              <motion.span
                className="text-xl"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.1 + index * 0.08 }}
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
    </ScrollReportSection>
  )
}
