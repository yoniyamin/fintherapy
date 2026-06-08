import PptxGenJS from 'pptxgenjs'
import type { CategorySummary, MonthlyTotal } from '../hooks/useReveal'
import type { ExportRow } from '../hooks/useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID } from './constants'
import {
  exportSpendMagnitude,
  isSpendingOutflow,
  topSpendingTransactions,
} from './exportSpend'

const theme = {
  colors: {
    background: '0F172A',
    primary: '58CC02',
    secondary: '6366F1',
    accent: '1CB0F6',
    text: 'F8FAFC',
    muted: '94A3B8',
    dark: '1E293B',
    chartPalette: ['58CC02', '1CB0F6', 'A560E8', 'FF9600', '818CF8', 'EC4899'],
  },
  fonts: {
    title: 'Segoe UI',
    body: 'Segoe UI',
  },
  sizes: {
    titleFontSize: 28,
    subtitleFontSize: 14,
    bodyFontSize: 12,
    smallFontSize: 10,
    headerFontSize: 18,
  },
} as const

export interface SlideDeckInput {
  month: string
  summary: CategorySummary[]
  prevMonthSummary?: CategorySummary[] | null
  monthlyTotals: MonthlyTotal[]
  income: number | null
  transactions: ExportRow[]
  categoryLookup: Record<string, { icon: string; label: string }>
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(v)

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '\u2026'
}

function applyMasterBackground(slide: PptxGenJS.Slide) {
  slide.background = { color: theme.colors.background }
}

function addTitleSlide(pptx: PptxGenJS, month: string) {
  const slide = pptx.addSlide()
  applyMasterBackground(slide)

  slide.addText('Monthly Spending Report', {
    x: 0.8,
    y: 1.8,
    w: 8.4,
    h: 1,
    fontSize: theme.sizes.titleFontSize,
    fontFace: theme.fonts.title,
    color: theme.colors.text,
    bold: true,
  })

  slide.addText(formatMonthLabel(month), {
    x: 0.8,
    y: 2.7,
    w: 8.4,
    h: 0.6,
    fontSize: theme.sizes.headerFontSize,
    fontFace: theme.fonts.body,
    color: theme.colors.primary,
    bold: true,
  })

  slide.addText(`Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, {
    x: 0.8,
    y: 4.5,
    w: 8.4,
    h: 0.4,
    fontSize: theme.sizes.smallFontSize,
    fontFace: theme.fonts.body,
    color: theme.colors.muted,
  })
}

function addOverviewSlide(
  pptx: PptxGenJS,
  month: string,
  summary: CategorySummary[],
  income: number | null,
  txCount: number,
) {
  const slide = pptx.addSlide()
  applyMasterBackground(slide)

  slide.addText('Overview', {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: theme.sizes.headerFontSize,
    fontFace: theme.fonts.title,
    color: theme.colors.text,
    bold: true,
  })

  const totalSpent = summary.reduce((s, c) => s + Number(c.total_amount), 0)
  const freeIncome = income != null ? income - totalSpent : null

  const metrics: [string, string][] = [
    ['Total Spent', fmt(totalSpent)],
    ['Transactions', String(txCount)],
    ['Categories', String(summary.length)],
  ]
  if (income != null) {
    metrics.push(['Income', fmt(income)])
    metrics.push(['Free Income', fmt(freeIncome!)])
  }

  const colW = 8.5 / metrics.length
  metrics.forEach(([label, value], i) => {
    const x = 0.5 + i * colW
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 1.3,
      w: colW - 0.15,
      h: 1.4,
      fill: { color: theme.colors.dark },
      rectRadius: 0.08,
    })
    slide.addText(value, {
      x,
      y: 1.45,
      w: colW - 0.15,
      h: 0.7,
      fontSize: 20,
      fontFace: theme.fonts.title,
      color: theme.colors.primary,
      bold: true,
      align: 'center',
    })
    slide.addText(label, {
      x,
      y: 2.15,
      w: colW - 0.15,
      h: 0.4,
      fontSize: theme.sizes.smallFontSize,
      fontFace: theme.fonts.body,
      color: theme.colors.muted,
      align: 'center',
    })
  })

  slide.addText(formatMonthLabel(month), {
    x: 0.5,
    y: 4.8,
    w: 9,
    h: 0.3,
    fontSize: theme.sizes.smallFontSize,
    fontFace: theme.fonts.body,
    color: theme.colors.muted,
    align: 'right',
  })
}

function addCategoryBreakdownSlide(
  pptx: PptxGenJS,
  summary: CategorySummary[],
  categoryLookup: Record<string, { icon: string; label: string }>,
) {
  const slide = pptx.addSlide()
  applyMasterBackground(slide)

  slide.addText('Spending by Category', {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: theme.sizes.headerFontSize,
    fontFace: theme.fonts.title,
    color: theme.colors.text,
    bold: true,
  })

  const sorted = [...summary]
    .filter((c) => Number(c.total_amount) > 0)
    .sort((a, b) => Number(b.total_amount) - Number(a.total_amount))

  const TOP_N = 5
  const top = sorted.slice(0, TOP_N)
  const rest = sorted.slice(TOP_N)
  const otherTotal = rest.reduce((s, c) => s + Number(c.total_amount), 0)
  const otherCount = rest.reduce((s, c) => s + Number(c.tx_count), 0)

  const chartLabels = top.map((c) => categoryLookup[c.category]?.label ?? c.category)
  const chartValues = top.map((c) => Number(c.total_amount))
  if (otherTotal > 0) {
    chartLabels.push('Other')
    chartValues.push(otherTotal)
  }

  slide.addChart(pptx.ChartType.doughnut, [{ name: 'Spending', labels: chartLabels, values: chartValues }], {
    x: 0.3,
    y: 1.0,
    w: 4.2,
    h: 4.0,
    showLegend: true,
    legendPos: 'b',
    legendFontSize: 9,
    legendColor: theme.colors.muted,
    chartColors: theme.colors.chartPalette.slice(0, chartLabels.length),
    dataLabelColor: theme.colors.text,
    dataLabelFontSize: 9,
    showPercent: true,
    showValue: false,
    showLabel: false,
  })

  const total = sorted.reduce((s, c) => s + Number(c.total_amount), 0)

  const allForTable = otherTotal > 0
    ? [...top, { category: '__other__', total_amount: otherTotal, tx_count: otherCount }]
    : top

  const tableRows: PptxGenJS.TableRow[] = [
    [
      { text: 'Category', options: { bold: true, color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
      { text: 'Amount', options: { bold: true, color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
      { text: '%', options: { bold: true, color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
      { text: 'Txns', options: { bold: true, color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
    ],
    ...allForTable.map((c): PptxGenJS.TableRow => {
      const label = c.category === '__other__' ? 'Other' : (categoryLookup[c.category]?.label ?? c.category)
      const pct = total > 0 ? ((Number(c.total_amount) / total) * 100).toFixed(1) + '%' : '\u2014'
      return [
        { text: label, options: { color: theme.colors.text, fontSize: 9, fill: { color: theme.colors.dark } } },
        { text: fmt(Number(c.total_amount)), options: { color: theme.colors.text, fontSize: 9, fill: { color: theme.colors.dark } } },
        { text: pct, options: { color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
        { text: String(Number(c.tx_count)), options: { color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
      ]
    }),
  ]

  slide.addTable(tableRows, {
    x: 4.7,
    y: 1.2,
    w: 4.8,
    colW: [1.8, 1.3, 0.7, 0.7],
    border: { pt: 0, color: theme.colors.dark },
    margin: 4,
  })
}

function addTopTransactionsSlide(
  pptx: PptxGenJS,
  transactions: ExportRow[],
  categoryLookup: Record<string, { icon: string; label: string }>,
) {
  const slide = pptx.addSlide()
  applyMasterBackground(slide)

  slide.addText('Top Transactions', {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: theme.sizes.headerFontSize,
    fontFace: theme.fonts.title,
    color: theme.colors.text,
    bold: true,
  })

  const sorted = topSpendingTransactions(transactions, 10)

  const tableRows: PptxGenJS.TableRow[] = [
    [
      { text: 'Merchant', options: { bold: true, color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
      { text: 'Amount', options: { bold: true, color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
      { text: 'Category', options: { bold: true, color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
      { text: 'Date', options: { bold: true, color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
    ],
    ...sorted.map((tx): PptxGenJS.TableRow => {
      const merchantName = truncate(tx.merchant_clean || tx.merchant_raw, 30)
      const catLabel = categoryLookup[tx.category]?.label ?? tx.category
      return [
        { text: merchantName, options: { color: theme.colors.text, fontSize: 9, fill: { color: theme.colors.dark } } },
        { text: fmt(exportSpendMagnitude(tx)), options: { color: theme.colors.primary, fontSize: 9, bold: true, fill: { color: theme.colors.dark } } },
        { text: truncate(catLabel, 18), options: { color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
        { text: tx.tx_date, options: { color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
      ]
    }),
  ]

  slide.addTable(tableRows, {
    x: 0.4,
    y: 1.0,
    w: 9.2,
    colW: [3.2, 1.6, 2.2, 1.8],
    border: { pt: 0, color: theme.colors.dark },
    margin: 4,
  })
}

function addMonthlyTrendSlide(pptx: PptxGenJS, monthlyTotals: MonthlyTotal[], selectedMonth: string) {
  if (monthlyTotals.length < 2) return

  const slide = pptx.addSlide()
  applyMasterBackground(slide)

  slide.addText('Monthly Trend', {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: theme.sizes.headerFontSize,
    fontFace: theme.fonts.title,
    color: theme.colors.text,
    bold: true,
  })

  const labels = monthlyTotals.map((d) => {
    const [y, m] = d.billing_month.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short' })
  })
  const values = monthlyTotals.map((d) => Number(d.total_amount))

  slide.addChart(pptx.ChartType.bar, [{ name: 'Spending', labels, values }], {
    x: 0.5,
    y: 1.0,
    w: 9.0,
    h: 4.2,
    barDir: 'col',
    barGrouping: 'clustered',
    chartColors: monthlyTotals.map((d) =>
      d.billing_month === selectedMonth ? theme.colors.primary : theme.colors.secondary,
    ),
    valAxisLabelColor: theme.colors.muted,
    valAxisLabelFontSize: 9,
    catAxisLabelColor: theme.colors.muted,
    catAxisLabelFontSize: 9,
    valGridLine: { color: theme.colors.dark, size: 1 },
    showValue: false,
    showLegend: false,
  })
}

function addHighlightsSlide(
  pptx: PptxGenJS,
  transactions: ExportRow[],
  summary: CategorySummary[],
  categoryLookup: Record<string, { icon: string; label: string }>,
) {
  const slide = pptx.addSlide()
  applyMasterBackground(slide)

  slide.addText('Highlights', {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.6,
    fontSize: theme.sizes.headerFontSize,
    fontFace: theme.fonts.title,
    color: theme.colors.text,
    bold: true,
  })

  const totalSpent = summary.reduce((s, c) => s + Number(c.total_amount), 0)
  const spendingTxCount = transactions.filter(isSpendingOutflow).length
  const avgPerTx = spendingTxCount > 0 ? totalSpent / spendingTxCount : 0

  const topCategory = [...summary].sort((a, b) => Number(b.total_amount) - Number(a.total_amount))[0]
  const topTx = topSpendingTransactions(transactions, 1)[0]

  const highlights: { label: string; value: string; sub: string }[] = []

  if (topTx) {
    highlights.push({
      label: 'Biggest Transaction',
      value: fmt(exportSpendMagnitude(topTx)),
      sub: truncate(topTx.merchant_clean || topTx.merchant_raw, 30),
    })
  }
  if (topCategory) {
    const catLabel = categoryLookup[topCategory.category]?.label ?? topCategory.category
    highlights.push({
      label: 'Top Category',
      value: fmt(Number(topCategory.total_amount)),
      sub: catLabel,
    })
  }
  highlights.push({
    label: 'Average per Transaction',
    value: fmt(avgPerTx),
    sub: `${spendingTxCount} transactions total`,
  })

  const cardW = 8.5 / highlights.length
  highlights.forEach((h, i) => {
    const x = 0.5 + i * cardW
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 1.6,
      w: cardW - 0.2,
      h: 2.4,
      fill: { color: theme.colors.dark },
      rectRadius: 0.08,
    })
    slide.addText(h.label, {
      x,
      y: 1.8,
      w: cardW - 0.2,
      h: 0.5,
      fontSize: theme.sizes.smallFontSize,
      fontFace: theme.fonts.body,
      color: theme.colors.muted,
      align: 'center',
    })
    slide.addText(h.value, {
      x,
      y: 2.4,
      w: cardW - 0.2,
      h: 0.7,
      fontSize: 22,
      fontFace: theme.fonts.title,
      color: theme.colors.accent,
      bold: true,
      align: 'center',
    })
    slide.addText(h.sub, {
      x,
      y: 3.1,
      w: cardW - 0.2,
      h: 0.5,
      fontSize: theme.sizes.smallFontSize,
      fontFace: theme.fonts.body,
      color: theme.colors.text,
      align: 'center',
    })
  })
}

function addTopCategorySlide(
  pptx: PptxGenJS,
  summary: CategorySummary[],
  transactions: ExportRow[],
  categoryLookup: Record<string, { icon: string; label: string }>,
  prevSummary: CategorySummary[] | null,
) {
  const sorted = [...summary].sort((a, b) => Number(b.total_amount) - Number(a.total_amount))
  const topCat = sorted[0]
  if (!topCat) return

  const slide = pptx.addSlide()
  applyMasterBackground(slide)

  const label = categoryLookup[topCat.category]?.label ?? topCat.category
  const prevAmount = prevSummary?.find((c) => c.category === topCat.category)
  const deltaText = prevAmount
    ? (() => {
        const diff = Number(topCat.total_amount) - Number(prevAmount.total_amount)
        const pct = Number(prevAmount.total_amount) > 0 ? Math.abs((diff / Number(prevAmount.total_amount)) * 100).toFixed(0) : '—'
        return diff > 0 ? `+${pct}% vs last month` : diff < 0 ? `-${pct}% vs last month` : 'same as last month'
      })()
    : null

  slide.addText(`Top Category: ${label}`, {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: theme.sizes.headerFontSize, fontFace: theme.fonts.title, color: theme.colors.text, bold: true,
  })

  slide.addText(fmt(Number(topCat.total_amount)), {
    x: 0.5, y: 1.0, w: 4, h: 0.6,
    fontSize: 24, fontFace: theme.fonts.title, color: theme.colors.primary, bold: true,
  })

  if (deltaText) {
    slide.addText(deltaText, {
      x: 0.5, y: 1.6, w: 4, h: 0.4,
      fontSize: theme.sizes.smallFontSize, fontFace: theme.fonts.body, color: theme.colors.muted,
    })
  }

  const topInCategory = topSpendingTransactions(
    transactions.filter((tx) => tx.category === topCat.category),
    8,
  )

  if (topInCategory.length > 0) {
    slide.addText('Top transactions in this category', {
      x: 0.5, y: 2.2, w: 9, h: 0.4,
      fontSize: theme.sizes.bodyFontSize, fontFace: theme.fonts.body, color: theme.colors.muted,
    })

    const tableRows: PptxGenJS.TableRow[] = topInCategory.map((tx): PptxGenJS.TableRow => [
      { text: truncate(tx.merchant_clean || tx.merchant_raw, 28), options: { color: theme.colors.text, fontSize: 9, fill: { color: theme.colors.dark } } },
      { text: fmt(exportSpendMagnitude(tx)), options: { color: theme.colors.primary, fontSize: 9, bold: true, fill: { color: theme.colors.dark } } },
      { text: tx.tx_date, options: { color: theme.colors.muted, fontSize: 9, fill: { color: theme.colors.dark } } },
    ])

    slide.addTable(tableRows, {
      x: 0.5, y: 2.7, w: 9,
      colW: [4.5, 2.0, 2.5],
      border: { pt: 0, color: theme.colors.dark },
      margin: 4,
    })
  }
}

function addIncomeVsSpendingSlide(pptx: PptxGenJS, monthlyTotals: MonthlyTotal[], income: number) {
  if (monthlyTotals.length < 2) return

  const slide = pptx.addSlide()
  applyMasterBackground(slide)

  slide.addText('Income vs Spending', {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: theme.sizes.headerFontSize, fontFace: theme.fonts.title, color: theme.colors.text, bold: true,
  })

  const labels = monthlyTotals.map((d) => {
    const [y, m] = d.billing_month.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short' })
  })
  const spendingValues = monthlyTotals.map((d) => Number(d.total_amount))
  const incomeValues = monthlyTotals.map(() => income)

  slide.addChart(pptx.ChartType.line, [
    { name: 'Income', labels, values: incomeValues },
    { name: 'Spending', labels, values: spendingValues },
  ], {
    x: 0.5, y: 1.0, w: 9.0, h: 4.2,
    chartColors: [theme.colors.primary, theme.colors.secondary],
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 6,
    valAxisLabelColor: theme.colors.muted,
    valAxisLabelFontSize: 9,
    catAxisLabelColor: theme.colors.muted,
    catAxisLabelFontSize: 9,
    valGridLine: { color: theme.colors.dark, size: 1 },
    showLegend: true,
    legendPos: 'b',
    legendColor: theme.colors.muted,
    legendFontSize: 9,
  })
}

export async function generateSlideDeck(input: SlideDeckInput): Promise<Blob> {
  const { month, monthlyTotals, income, categoryLookup } = input

  const summary = input.summary.filter((c) => c.category !== OWN_TRANSFERS_CATEGORY_ID)
  const prevSummary = input.prevMonthSummary?.filter((c) => c.category !== OWN_TRANSFERS_CATEGORY_ID) ?? null
  const transactions = input.transactions.filter(
    (tx) => tx.status !== 'transfer' && tx.status !== 'offset' && tx.category !== OWN_TRANSFERS_CATEGORY_ID,
  )

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'SpentWhatt'
  pptx.subject = `Monthly Report - ${formatMonthLabel(month)}`

  addTitleSlide(pptx, month)
  addOverviewSlide(pptx, month, summary, income, transactions.length)
  addCategoryBreakdownSlide(pptx, summary, categoryLookup)
  addTopCategorySlide(pptx, summary, transactions, categoryLookup, prevSummary)
  addTopTransactionsSlide(pptx, transactions, categoryLookup)
  addMonthlyTrendSlide(pptx, monthlyTotals, month)
  if (income != null && monthlyTotals.length >= 2) {
    addIncomeVsSpendingSlide(pptx, monthlyTotals, income)
  }
  addHighlightsSlide(pptx, transactions, summary, categoryLookup)

  const blob = await pptx.write({ outputType: 'blob' }) as Blob
  return blob
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* ═══════════════════════════════════════════════════════════
   MULTI-MONTH SLIDE DECK
   ═══════════════════════════════════════════════════════════ */

import { buildDailyTotals, type AccountSpending, type CategoryTrendPoint } from '../hooks/useMultiMonthReveal'
import { buildInsightInput, generateInsights, getHealthSummary } from './advisorInsights'

export interface MultiMonthSlideDeckInput {
  months: string[]
  summaryByMonth: Map<string, CategorySummary[]>
  aggregatedSummary: CategorySummary[]
  categoryTrend: CategoryTrendPoint[]
  monthlyTotals: MonthlyTotal[]
  income: number | null
  transactions: ExportRow[]
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>
  spendingByAccount?: AccountSpending[]
}

function shortMonthLabel(value: string): string {
  const [y, m] = value.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short' })
}

function pctChangeSafe(from: number, to: number): number {
  if (from === 0) return 0
  return ((to - from) / Math.abs(from)) * 100
}

export async function generateMultiMonthSlideDeck(input: MultiMonthSlideDeckInput): Promise<Blob> {
  const sorted = [...input.months].sort()
  const summary = input.aggregatedSummary.filter(c => c.category !== OWN_TRANSFERS_CATEGORY_ID)
  const transactions = input.transactions.filter(
    tx => tx.status !== 'transfer' && tx.status !== 'offset' && tx.category !== OWN_TRANSFERS_CATEGORY_ID,
  )

  const totalSpent = summary.reduce((s, c) => s + Number(c.total_amount), 0)
  const avgMonthly = sorted.length > 0 ? totalSpent / sorted.length : 0

  const dailyTotals = buildDailyTotals(input.transactions, false)

  const insightInput = buildInsightInput({
    months: sorted,
    aggregatedSummary: input.aggregatedSummary,
    summaryByMonth: input.summaryByMonth,
    monthlyTotals: input.monthlyTotals,
    categoryTrend: input.categoryTrend,
    dailyTotals,
    income: input.income,
    categoryLookup: input.categoryLookup,
    transactions: input.transactions,
    spendingByAccount: input.spendingByAccount,
  })

  const health = getHealthSummary(insightInput)
  const insights = generateInsights(insightInput)

  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'SpentWhatt'
  pptx.subject = `Financial Health Check — ${formatMonthLabel(sorted[0])} to ${formatMonthLabel(sorted[sorted.length - 1])}`

  // Slide 1: Title
  {
    const slide = pptx.addSlide()
    applyMasterBackground(slide)
    slide.addText('Your Financial Health Check', {
      x: 0.8, y: 1.8, w: 8.4, h: 1,
      fontSize: theme.sizes.titleFontSize, fontFace: theme.fonts.title, color: theme.colors.text, bold: true,
    })
    slide.addText(`${formatMonthLabel(sorted[0])} – ${formatMonthLabel(sorted[sorted.length - 1])}`, {
      x: 0.8, y: 2.7, w: 8.4, h: 0.6,
      fontSize: theme.sizes.headerFontSize, fontFace: theme.fonts.body, color: theme.colors.primary, bold: true,
    })
    const stats = `${fmt(totalSpent)} total · ${transactions.length} transactions · ${sorted.length} months`
    slide.addText(stats, {
      x: 0.8, y: 3.5, w: 8.4, h: 0.4,
      fontSize: theme.sizes.bodyFontSize, fontFace: theme.fonts.body, color: theme.colors.muted,
    })
    slide.addText(`Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, {
      x: 0.8, y: 4.5, w: 8.4, h: 0.4,
      fontSize: theme.sizes.smallFontSize, fontFace: theme.fonts.body, color: theme.colors.muted,
    })
  }

  // Slide 2: The Big Picture
  {
    const slide = pptx.addSlide()
    applyMasterBackground(slide)
    slide.addText('The Big Picture', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: theme.sizes.headerFontSize, fontFace: theme.fonts.title, color: theme.colors.text, bold: true,
    })

    const verdictColor = health.verdict === 'green' ? '10B981' : health.verdict === 'amber' ? 'F59E0B' : 'EF4444'
    slide.addText(health.message, {
      x: 0.5, y: 1.0, w: 9, h: 0.6,
      fontSize: theme.sizes.bodyFontSize, fontFace: theme.fonts.body, color: verdictColor, italic: true,
    })

    const metrics: [string, string][] = [
      ['Total Spent', fmt(totalSpent)],
      ['Avg Monthly', fmt(avgMonthly)],
      ['Months', String(sorted.length)],
    ]
    if (input.income != null) {
      const savingsRate = Math.round(((input.income - avgMonthly) / input.income) * 100)
      metrics.push(['Savings Rate', `${savingsRate}%`])
    }

    const colW = 8.5 / metrics.length
    metrics.forEach(([label, value], i) => {
      const x = 0.5 + i * colW
      slide.addShape(pptx.ShapeType.roundRect, { x, y: 1.8, w: colW - 0.15, h: 1.4, fill: { color: theme.colors.dark }, rectRadius: 0.08 })
      slide.addText(value, { x, y: 1.95, w: colW - 0.15, h: 0.7, fontSize: 20, fontFace: theme.fonts.title, color: theme.colors.primary, bold: true, align: 'center' })
      slide.addText(label, { x, y: 2.65, w: colW - 0.15, h: 0.4, fontSize: theme.sizes.smallFontSize, fontFace: theme.fonts.body, color: theme.colors.muted, align: 'center' })
    })
  }

  // Slide 3: Spending Trajectory (bar chart)
  if (input.monthlyTotals.length >= 2) {
    const slide = pptx.addSlide()
    applyMasterBackground(slide)
    slide.addText('Spending Trajectory', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: theme.sizes.headerFontSize, fontFace: theme.fonts.title, color: theme.colors.text, bold: true,
    })

    const labels = input.monthlyTotals.map(d => shortMonthLabel(d.billing_month))
    const values = input.monthlyTotals.map(d => Number(d.total_amount))

    const chartSeries = [{ name: 'Spending', labels, values }]
    if (input.income != null) {
      chartSeries.push({ name: 'Income', labels, values: labels.map(() => input.income!) })
    }

    slide.addChart(
      input.income != null ? pptx.ChartType.line : pptx.ChartType.bar,
      chartSeries,
      {
        x: 0.5, y: 1.0, w: 9.0, h: 3.8,
        ...(input.income == null ? { barDir: 'col' as const, barGrouping: 'clustered' as const } : {}),
        chartColors: input.income != null ? [theme.colors.secondary, theme.colors.primary] : [theme.colors.secondary],
        valAxisLabelColor: theme.colors.muted, valAxisLabelFontSize: 9,
        catAxisLabelColor: theme.colors.muted, catAxisLabelFontSize: 9,
        valGridLine: { color: theme.colors.dark, size: 1 },
        showValue: false, showLegend: input.income != null,
        legendPos: 'b', legendColor: theme.colors.muted, legendFontSize: 9,
        lineDataSymbol: 'circle', lineDataSymbolSize: 6,
      }
    )

    const amounts = input.monthlyTotals.map(d => Number(d.total_amount))
    const minI = amounts.indexOf(Math.min(...amounts))
    const maxI = amounts.indexOf(Math.max(...amounts))
    slide.addText(
      `Best: ${shortMonthLabel(input.monthlyTotals[minI].billing_month)} (${fmt(amounts[minI])}) · Worst: ${shortMonthLabel(input.monthlyTotals[maxI].billing_month)} (${fmt(amounts[maxI])})`,
      { x: 0.5, y: 4.9, w: 9, h: 0.3, fontSize: theme.sizes.smallFontSize, fontFace: theme.fonts.body, color: theme.colors.muted, align: 'center' },
    )
  }

  // Slide 4: Where Your Money Goes (donut)
  addCategoryBreakdownSlide(pptx, summary, input.categoryLookup)

  // Slide 5: How Things Are Changing (trend lines)
  if (sorted.length >= 2) {
    const slide = pptx.addSlide()
    applyMasterBackground(slide)
    slide.addText('How Things Are Changing', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: theme.sizes.headerFontSize, fontFace: theme.fonts.title, color: theme.colors.text, bold: true,
    })

    const top5Cats = summary.slice(0, 5).map(c => c.category)
    const catLabels = sorted.map(m => shortMonthLabel(m))

    const series = top5Cats.map(cat => {
      const label = input.categoryLookup[cat]?.label ?? cat
      const vals = sorted.map(m => {
        const point = input.categoryTrend.find(p => p.month === m && p.category === cat)
        return point?.amount ?? 0
      })
      return { name: truncate(label, 18), labels: catLabels, values: vals }
    })

    slide.addChart(pptx.ChartType.line, series, {
      x: 0.5, y: 1.0, w: 9.0, h: 4.0,
      chartColors: theme.colors.chartPalette.slice(0, top5Cats.length),
      lineDataSymbol: 'circle', lineDataSymbolSize: 5,
      valAxisLabelColor: theme.colors.muted, valAxisLabelFontSize: 9,
      catAxisLabelColor: theme.colors.muted, catAxisLabelFontSize: 9,
      valGridLine: { color: theme.colors.dark, size: 1 },
      showLegend: true, legendPos: 'b', legendColor: theme.colors.muted, legendFontSize: 9,
    })
  }

  // Slide 6: Biggest Movers
  {
    const slide = pptx.addSlide()
    applyMasterBackground(slide)
    slide.addText('Biggest Movers', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: theme.sizes.headerFontSize, fontFace: theme.fonts.title, color: theme.colors.text, bold: true,
    })

    const firstMonth = input.summaryByMonth.get(sorted[0]) ?? []
    const lastMonth = input.summaryByMonth.get(sorted[sorted.length - 1]) ?? []
    const firstMap = new Map(firstMonth.map(c => [c.category, Number(c.total_amount)]))

    const movers = lastMonth
      .map(c => {
        const prev = firstMap.get(c.category) ?? 0
        return { category: c.category, prev, current: Number(c.total_amount), delta: Number(c.total_amount) - prev, pct: prev > 30 ? pctChangeSafe(prev, Number(c.total_amount)) : 0 }
      })
      .filter(m => Math.abs(m.pct) > 10)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6)

    movers.forEach((m, i) => {
      const label = input.categoryLookup[m.category]?.label ?? m.category
      const isUp = m.delta > 0
      const x = 0.5
      const y = 1.2 + i * 0.7

      slide.addShape(pptx.ShapeType.roundRect, { x, y, w: 9, h: 0.6, fill: { color: theme.colors.dark }, rectRadius: 0.06 })
      slide.addText(`${label}`, { x: x + 0.2, y, w: 3, h: 0.6, fontSize: 11, fontFace: theme.fonts.body, color: theme.colors.text })
      slide.addText(`${fmt(m.prev)} → ${fmt(m.current)}`, { x: x + 3.2, y, w: 3, h: 0.6, fontSize: 10, fontFace: theme.fonts.body, color: theme.colors.muted })
      slide.addText(`${isUp ? '↑' : '↓'} ${Math.abs(Math.round(m.pct))}%`, {
        x: x + 7, y, w: 2, h: 0.6, fontSize: 12, fontFace: theme.fonts.title,
        color: isUp ? 'EF4444' : '10B981', bold: true, align: 'right',
      })
    })
  }

  // Slide 7: Top Transactions
  addTopTransactionsSlide(pptx, transactions, input.categoryLookup)

  // Slide 8: Comparison Table
  if (sorted.length >= 2) {
    const slide = pptx.addSlide()
    applyMasterBackground(slide)
    slide.addText('Month-over-Month Comparison', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: theme.sizes.headerFontSize, fontFace: theme.fonts.title, color: theme.colors.text, bold: true,
    })

    const displayMonths = sorted.slice(-6)
    const cats = summary.slice(0, 8)

    const headerRow: PptxGenJS.TableRow = [
      { text: 'Category', options: { bold: true, color: theme.colors.muted, fontSize: 8, fill: { color: theme.colors.dark } } },
      ...displayMonths.map(m => ({
        text: shortMonthLabel(m),
        options: { bold: true, color: theme.colors.muted, fontSize: 8, fill: { color: theme.colors.dark }, align: 'right' as const },
      })),
    ]

    const bodyRows: PptxGenJS.TableRow[] = cats.map(cat => {
      const label = input.categoryLookup[cat.category]?.label ?? cat.category
      return [
        { text: truncate(label, 16), options: { color: theme.colors.text, fontSize: 8, fill: { color: theme.colors.dark } } },
        ...displayMonths.map(m => {
          const monthData = input.summaryByMonth.get(m) ?? []
          const entry = monthData.find(c => c.category === cat.category)
          const amount = entry ? Number(entry.total_amount) : 0
          return { text: amount > 0 ? fmt(amount) : '—', options: { color: theme.colors.text, fontSize: 8, fill: { color: theme.colors.dark }, align: 'right' as const } }
        }),
      ]
    })

    const colWidths = [2, ...displayMonths.map(() => (9 - 2) / displayMonths.length)]
    slide.addTable([headerRow, ...bodyRows], {
      x: 0.4, y: 1.0, w: 9.2, colW: colWidths,
      border: { pt: 0, color: theme.colors.dark }, margin: 3,
    })
  }

  // Slide 9: Advisor Summary
  {
    const slide = pptx.addSlide()
    applyMasterBackground(slide)
    slide.addText('Advisor Summary', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: theme.sizes.headerFontSize, fontFace: theme.fonts.title, color: theme.colors.text, bold: true,
    })
    slide.addText("Here's what we'd recommend focusing on", {
      x: 0.5, y: 0.85, w: 9, h: 0.4,
      fontSize: theme.sizes.bodyFontSize, fontFace: theme.fonts.body, color: theme.colors.muted,
    })

    if (input.income != null && input.income > 0) {
      const savingsRate = Math.round(((input.income - avgMonthly) / input.income) * 100)
      const savColor = savingsRate >= 10 ? '10B981' : savingsRate >= 0 ? 'F59E0B' : 'EF4444'
      slide.addShape(pptx.ShapeType.roundRect, { x: 3.5, y: 1.4, w: 3, h: 1.2, fill: { color: theme.colors.dark }, rectRadius: 0.08 })
      slide.addText(`${savingsRate}%`, { x: 3.5, y: 1.5, w: 3, h: 0.7, fontSize: 28, fontFace: theme.fonts.title, color: savColor, bold: true, align: 'center' })
      slide.addText('Savings Rate', { x: 3.5, y: 2.15, w: 3, h: 0.3, fontSize: theme.sizes.smallFontSize, fontFace: theme.fonts.body, color: theme.colors.muted, align: 'center' })
    }

    const startY = input.income != null ? 2.9 : 1.5
    insights.forEach((insight, i) => {
      const y = startY + i * 0.55
      slide.addText(`${insight.emoji}  ${insight.text}`, {
        x: 0.5, y, w: 9, h: 0.5,
        fontSize: theme.sizes.bodyFontSize, fontFace: theme.fonts.body, color: theme.colors.text,
      })
    })
  }

  const blob = await pptx.write({ outputType: 'blob' }) as Blob
  return blob
}
