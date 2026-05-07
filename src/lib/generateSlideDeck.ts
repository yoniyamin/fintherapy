import PptxGenJS from 'pptxgenjs'
import type { CategorySummary, MonthlyTotal } from '../hooks/useReveal'
import type { ExportRow } from '../hooks/useTransactions'
import { OWN_TRANSFERS_CATEGORY_ID } from './constants'

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

  slide.addChart(pptx.charts.DOUGHNUT, [{ name: 'Spending', labels: chartLabels, values: chartValues }], {
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

  const sorted = [...transactions]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 10)

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
        { text: fmt(Number(tx.amount)), options: { color: theme.colors.primary, fontSize: 9, bold: true, fill: { color: theme.colors.dark } } },
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

  slide.addChart(pptx.charts.BAR, [{ name: 'Spending', labels, values }], {
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
  const avgPerTx = transactions.length > 0 ? totalSpent / transactions.length : 0

  const topCategory = [...summary].sort((a, b) => Number(b.total_amount) - Number(a.total_amount))[0]
  const topTx = [...transactions].sort((a, b) => Number(b.amount) - Number(a.amount))[0]

  const highlights: { label: string; value: string; sub: string }[] = []

  if (topTx) {
    highlights.push({
      label: 'Biggest Transaction',
      value: fmt(Number(topTx.amount)),
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
    sub: `${transactions.length} transactions total`,
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

  const topInCategory = [...transactions]
    .filter((tx) => tx.category === topCat.category)
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 8)

  if (topInCategory.length > 0) {
    slide.addText('Top transactions in this category', {
      x: 0.5, y: 2.2, w: 9, h: 0.4,
      fontSize: theme.sizes.bodyFontSize, fontFace: theme.fonts.body, color: theme.colors.muted,
    })

    const tableRows: PptxGenJS.TableRow[] = topInCategory.map((tx): PptxGenJS.TableRow => [
      { text: truncate(tx.merchant_clean || tx.merchant_raw, 28), options: { color: theme.colors.text, fontSize: 9, fill: { color: theme.colors.dark } } },
      { text: fmt(Number(tx.amount)), options: { color: theme.colors.primary, fontSize: 9, bold: true, fill: { color: theme.colors.dark } } },
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

  slide.addChart(pptx.charts.LINE, [
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
