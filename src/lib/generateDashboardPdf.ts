import { jsPDF } from 'jspdf'
import type { CategorySummary, MonthlyTotal } from '../hooks/useReveal'
import type { ExportRow } from '../hooks/useTransactions'
import {
  generateInsights,
  getDeltaDrivers,
  getHealthSummary,
  getBiggestMover,
  getSpendingPredictability,
  type HealthVerdict,
  type InsightInput,
} from './advisorInsights'
import type { AccountSpending, CardFundingRow, DailyTotal, CategoryTrendPoint, SalaryRow } from '../hooks/useMultiMonthReveal'
import type { RecurringCharge } from './recurringDetector'
import { OWN_TRANSFERS_CATEGORY_ID } from './constants'
import { formatCurrency } from './formatCurrency'

export interface BudgetEntry {
  category_id: string
  monthly_target: number
  is_discretionary: boolean
  subject_to_inflation: boolean
}

export interface PdfReportInput {
  months: string[]
  summaryByMonth: Map<string, CategorySummary[]>
  aggregatedSummary: CategorySummary[]
  categoryTrend: CategoryTrendPoint[]
  monthlyTotals: MonthlyTotal[]
  dailyTotals: DailyTotal[]
  income: number | null
  transactions: ExportRow[]
  categoryLookup: Record<string, { icon: string; label: string; expenseType?: string }>
  recurringCharges: RecurringCharge[]
  spendingByAccount: AccountSpending[]
  cardFunding: CardFundingRow[]
  salaryDetected: SalaryRow[]
  fixedTotal: number
  discretionaryTotal: number
  headline: string
  reportConfig?: Record<string, boolean>
  budgets?: BudgetEntry[]
  inflationRate?: number
  savingsGoals?: { name: string; target: number; horizon_months: number }[]
}

const PALETTE = ['#58CC02', '#38bdf8', '#f59e0b', '#ef4444', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c']
const BG = '#0f172a'
const BG_CARD = '#1e293b'
const BG_CARD_ALT = '#162032'
const TEXT = '#f8fafc'
const TEXT_MUTED = '#94a3b8'
const TEXT_DIM = '#64748b'
const PRIMARY = '#58CC02'
const CYAN = '#22d3ee'
const VERDICT_COLORS: Record<HealthVerdict, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
}

const SEVERITY_BULLETS: Record<string, string> = {
  positive: '>>',
  neutral: '--',
  warning: '!!',
  concern: 'XX',
}

const fmtCompact = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v.toFixed(0)
}

function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  })
}

function formatMonthShort(m: string): string {
  const [, mo] = m.split('-')
  return new Date(2000, Number(mo) - 1).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

function stripEmoji(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/gu, '')
    .replace(/\u200D/gu, '')
    .replace(/\u20E3/gu, '')
    .trim()
}

// --------------- D3 SVG chart builders ---------------

async function svgToPng(svgEl: SVGSVGElement, w: number, h: number): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svgEl)
  const img = new Image()
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    img.src = url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
    })
  } finally {
    URL.revokeObjectURL(url)
  }

  const c = document.createElement('canvas')
  c.width = w * 2
  c.height = h * 2
  const ctx = c.getContext('2d')!
  ctx.scale(2, 2)
  ctx.drawImage(img, 0, 0, w, h)
  return c.toDataURL('image/png')
}

function createOffscreen(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  el.style.top = '-9999px'
  document.body.appendChild(el)
  return el
}

async function renderLineChart(
  monthlyTotals: MonthlyTotal[],
  income: number | null,
  months: string[],
  width: number,
  height: number,
): Promise<string> {
  const d3 = await import('d3')
  const sorted = [...months].sort()
  const data = sorted.map(m => {
    const t = monthlyTotals.find(t => t.billing_month === m)
    return { month: m, label: formatMonthShort(m), amount: t ? Number(t.total_amount) : 0 }
  })

  const margin = { top: 20, right: 15, bottom: 28, left: 50 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom
  const container = createOffscreen()

  const svg = d3.select(container)
    .append('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', width)
    .attr('height', height)

  svg.append('rect').attr('width', width).attr('height', height).attr('fill', BG_CARD).attr('rx', 6)

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  const maxVal = Math.max(...data.map(d => d.amount), income ?? 0) * 1.15 || 100
  const x = d3.scalePoint<string>().domain(data.map(d => d.label)).range([0, innerW]).padding(0.3)
  const y = d3.scaleLinear().domain([0, maxVal]).range([innerH, 0])

  // Grid lines
  g.selectAll('.grid')
    .data(y.ticks(4))
    .enter()
    .append('line')
    .attr('x1', 0).attr('x2', innerW)
    .attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', '#1e293b').attr('stroke-width', 1)

  // X axis
  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call(g => g.select('.domain').remove())
    .selectAll('text')
    .attr('fill', TEXT_MUTED).attr('font-size', '11px')
    .attr('font-family', 'Helvetica, Arial, sans-serif')
    .attr('dy', '12')

  // Y axis
  g.append('g')
    .call(d3.axisLeft(y).ticks(4).tickFormat(v => `€${fmtCompact(v as number)}`))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').remove())
    .selectAll('text')
    .attr('fill', TEXT_MUTED).attr('font-size', '10px')
    .attr('font-family', 'Helvetica, Arial, sans-serif')

  // Area fill under line
  const area = d3.area<typeof data[0]>()
    .x(d => x(d.label)!)
    .y0(innerH)
    .y1(d => y(d.amount))
    .curve(d3.curveMonotoneX)

  const gradient = svg.append('defs').append('linearGradient')
    .attr('id', 'areaGrad').attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1')
  gradient.append('stop').attr('offset', '0%').attr('stop-color', CYAN).attr('stop-opacity', 0.3)
  gradient.append('stop').attr('offset', '100%').attr('stop-color', CYAN).attr('stop-opacity', 0.02)

  g.append('path').datum(data).attr('d', area).attr('fill', 'url(#areaGrad)')

  // Line
  const line = d3.line<typeof data[0]>()
    .x(d => x(d.label)!)
    .y(d => y(d.amount))
    .curve(d3.curveMonotoneX)

  g.append('path').datum(data)
    .attr('d', line).attr('fill', 'none')
    .attr('stroke', CYAN).attr('stroke-width', 2.5)

  // Dots
  g.selectAll('.dot')
    .data(data).enter()
    .append('circle')
    .attr('cx', d => x(d.label)!)
    .attr('cy', d => y(d.amount))
    .attr('r', 4).attr('fill', CYAN)
    .attr('stroke', BG_CARD).attr('stroke-width', 2)

  // Value labels on dots
  g.selectAll('.val')
    .data(data).enter()
    .append('text')
    .attr('x', d => x(d.label)!)
    .attr('y', d => y(d.amount) - 10)
    .attr('text-anchor', 'middle')
    .attr('fill', TEXT).attr('font-size', '9px')
    .attr('font-family', 'Helvetica, Arial, sans-serif')
    .text(d => `€${fmtCompact(d.amount)}`)

  // Income reference line
  if (income != null && income > 0 && income <= maxVal) {
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', y(income)).attr('y2', y(income))
      .attr('stroke', '#ef4444').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,4')

    g.append('text')
      .attr('x', innerW).attr('y', y(income) - 6)
      .attr('text-anchor', 'end').attr('fill', '#ef4444')
      .attr('font-size', '9px').attr('font-family', 'Helvetica, Arial, sans-serif')
      .text('Income')
  }

  const svgEl = container.querySelector('svg') as SVGSVGElement
  const png = await svgToPng(svgEl, width, height)
  document.body.removeChild(container)
  return png
}

async function renderDonutChart(
  aggregatedSummary: CategorySummary[],
  categoryLookup: Record<string, { icon: string; label: string }>,
  totalSpent: number,
  width: number,
  height: number,
): Promise<{ png: string; slices: { label: string; amount: number; pct: number; color: string }[] }> {
  const d3 = await import('d3')

  const total = totalSpent || aggregatedSummary.reduce((s, c) => s + c.total_amount, 0)
  const top5 = aggregatedSummary.slice(0, 5)
  const otherAmount = total - top5.reduce((s, c) => s + c.total_amount, 0)

  const sliceData = top5.map((c, i) => ({
    label: categoryLookup[c.category]?.label ?? c.category,
    value: c.total_amount,
    color: PALETTE[i],
    pct: total > 0 ? Math.round((c.total_amount / total) * 100) : 0,
  }))
  if (otherAmount > 0) {
    sliceData.push({
      label: 'Other',
      value: otherAmount,
      color: PALETTE[5],
      pct: total > 0 ? Math.round((otherAmount / total) * 100) : 0,
    })
  }

  const container = createOffscreen()
  const radius = Math.min(width, height) / 2 - 6
  const svg = d3.select(container)
    .append('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', width).attr('height', height)

  const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`)

  const pie = d3.pie<typeof sliceData[0]>().value(d => d.value).sort(null).padAngle(0.03)
  const arc = d3.arc<d3.PieArcDatum<typeof sliceData[0]>>()
    .innerRadius(radius * 0.6)
    .outerRadius(radius)
    .cornerRadius(3)

  g.selectAll('path')
    .data(pie(sliceData)).enter()
    .append('path')
    .attr('d', arc as never)
    .attr('fill', d => d.data.color)

  // Center total
  g.append('text')
    .attr('text-anchor', 'middle').attr('dy', '-4')
    .attr('fill', TEXT).attr('font-size', '16px').attr('font-weight', 'bold')
    .attr('font-family', 'Helvetica, Arial, sans-serif')
    .text(`€${fmtCompact(total)}`)
  g.append('text')
    .attr('text-anchor', 'middle').attr('dy', '12')
    .attr('fill', TEXT_MUTED).attr('font-size', '9px')
    .attr('font-family', 'Helvetica, Arial, sans-serif')
    .text('TOTAL')

  const svgEl = container.querySelector('svg') as SVGSVGElement
  const png = await svgToPng(svgEl, width, height)
  document.body.removeChild(container)

  return {
    png,
    slices: sliceData.map(s => ({ label: s.label, amount: s.value, pct: s.pct, color: s.color })),
  }
}

async function renderGauge(
  value: number,
  maxVal: number,
  label: string,
  color: string,
  width: number,
  height: number,
): Promise<string> {
  const d3 = await import('d3')
  const container = createOffscreen()

  const svg = d3.select(container)
    .append('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', width).attr('height', height)

  const cx = width / 2
  const cy = height * 0.65
  const radius = Math.min(width, height) * 0.42

  const bgArc = d3.arc()
    .innerRadius(radius * 0.75).outerRadius(radius)
    .startAngle(-Math.PI * 0.75).endAngle(Math.PI * 0.75)
    .cornerRadius(4)

  const pct = Math.min(Math.max(value / maxVal, 0), 1)
  const endAngle = -Math.PI * 0.75 + pct * Math.PI * 1.5

  const valueArc = d3.arc()
    .innerRadius(radius * 0.75).outerRadius(radius)
    .startAngle(-Math.PI * 0.75).endAngle(endAngle)
    .cornerRadius(4)

  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`)

  g.append('path').attr('d', bgArc({} as never) as string).attr('fill', '#1e293b')
  g.append('path').attr('d', valueArc({} as never) as string).attr('fill', color)

  g.append('text')
    .attr('text-anchor', 'middle').attr('dy', '-2')
    .attr('fill', TEXT).attr('font-size', '18px').attr('font-weight', 'bold')
    .attr('font-family', 'Helvetica, Arial, sans-serif')
    .text(`${Math.round(value)}%`)

  g.append('text')
    .attr('text-anchor', 'middle').attr('dy', '14')
    .attr('fill', TEXT_MUTED).attr('font-size', '9px')
    .attr('font-family', 'Helvetica, Arial, sans-serif')
    .text(label.toUpperCase())

  const svgEl = container.querySelector('svg') as SVGSVGElement
  const png = await svgToPng(svgEl, width, height)
  document.body.removeChild(container)
  return png
}

// --------------- PDF drawing helpers ---------------

function drawBg(pdf: jsPDF) {
  const [r, g, b] = hexToRgb(BG)
  pdf.setFillColor(r, g, b)
  pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F')
}

function drawCard(pdf: jsPDF, x: number, y: number, w: number, h: number, color = BG_CARD) {
  const [r, g, b] = hexToRgb(color)
  pdf.setFillColor(r, g, b)
  pdf.roundedRect(x, y, w, h, 2, 2, 'F')
}

function setCol(pdf: jsPDF, hex: string) {
  const [r, g, b] = hexToRgb(hex)
  pdf.setTextColor(r, g, b)
}

function drawDot(pdf: jsPDF, cx: number, cy: number, r: number, hex: string) {
  const [rv, gv, bv] = hexToRgb(hex)
  pdf.setFillColor(rv, gv, bv)
  pdf.circle(cx, cy, r, 'F')
}

function drawProgressBar(
  pdf: jsPDF,
  x: number, y: number,
  fullW: number, h: number,
  pct: number,
  color: string,
) {
  const [br, bg, bb] = hexToRgb('#1e293b')
  pdf.setFillColor(br, bg, bb)
  pdf.roundedRect(x, y, fullW, h, h / 2, h / 2, 'F')

  const fillW = Math.max(fullW * (pct / 100), h)
  const [fr, fg, fb] = hexToRgb(color)
  pdf.setFillColor(fr, fg, fb)
  pdf.roundedRect(x, y, fillW, h, h / 2, h / 2, 'F')

  // Endpoint dot
  const [dr, dg, db] = hexToRgb(color)
  pdf.setFillColor(dr, dg, db)
  pdf.circle(x + fillW - h / 2, y + h / 2, h * 0.65, 'F')
  pdf.setFillColor(255, 255, 255)
  pdf.circle(x + fillW - h / 2, y + h / 2, h * 0.3, 'F')
}

function drawSectionTitle(pdf: jsPDF, text: string, x: number, y: number, accentColor = PRIMARY) {
  drawDot(pdf, x + 2, y - 1.5, 1.5, accentColor)
  setCol(pdf, TEXT)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'bold')
  pdf.text(text, x + 7, y)
}

function drawFooter(pdf: jsPDF) {
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const [lr, lg, lb] = hexToRgb('#334155')
  pdf.setDrawColor(lr, lg, lb)
  pdf.setLineWidth(0.3)
  pdf.line(14, ph - 10, pw - 14, ph - 10)
  setCol(pdf, TEXT_DIM)
  pdf.setFontSize(6.5)
  pdf.setFont('helvetica', 'normal')
  pdf.text('SpentWhatt  |  Financial Therapy', pw / 2, ph - 5.5, { align: 'center' })
}

// --------------- Page 1: Summary ---------------

async function drawPage1(
  pdf: jsPDF,
  input: PdfReportInput,
  lineChartPng: string,
  donutPng: string,
  donutSlices: { label: string; amount: number; pct: number; color: string }[],
  gaugePng: string | null,
  isLandscape: boolean,
) {
  drawBg(pdf)
  const pw = pdf.internal.pageSize.getWidth()
  const mx = isLandscape ? 16 : 12
  const contentW = pw - mx * 2
  let y = 14

  const insightInput: InsightInput = {
    months: input.months,
    aggregatedSummary: input.aggregatedSummary,
    summaryByMonth: input.summaryByMonth,
    monthlyTotals: input.monthlyTotals,
    categoryTrend: input.categoryTrend,
    dailyTotals: input.dailyTotals,
    income: input.income,
    categoryLookup: input.categoryLookup,
    transactions: input.transactions,
    recurringCharges: input.recurringCharges,
    spendingByAccount: input.spendingByAccount,
    fixedTotal: input.fixedTotal,
    discretionaryTotal: input.discretionaryTotal,
  }

  const health = getHealthSummary(insightInput)
  const insights = generateInsights(insightInput)
  const totals = input.monthlyTotals.map(t => Number(t.total_amount))
  const totalSpent = totals.reduce((s, v) => s + v, 0)
  const avgMonthly = totals.length > 0 ? totalSpent / totals.length : 0
  const predictability = getSpendingPredictability(totals)
  const biggestMover = getBiggestMover(input.summaryByMonth, input.months, input.categoryLookup)
  const savingsRate = input.income && input.income > 0
    ? ((input.income - avgMonthly) / input.income) * 100
    : null

  const sorted = [...input.months].sort()
  const fromLabel = formatMonthLabel(sorted[0])
  const toLabel = formatMonthLabel(sorted[sorted.length - 1])

  // ── Title ──
  setCol(pdf, TEXT)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.text('YOUR FINANCIAL HEALTH CHECK', mx, y)
  y += 5
  setCol(pdf, TEXT_DIM)
  pdf.setFontSize(7.5)
  pdf.setFont('helvetica', 'normal')
  pdf.text(
    `${fromLabel} - ${toLabel}   |   Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    mx, y,
  )
  y += 7

  // ── Narrative headline ──
  const headlineText = input.headline || stripEmoji(health.message)
  const verdictColor = VERDICT_COLORS[health.verdict]
  const headlineH = Math.max(14, pdf.splitTextToSize(headlineText, contentW - 16).length * 4 + 8)
  drawCard(pdf, mx, y, contentW, headlineH)
  drawDot(pdf, mx + 5, y + headlineH / 2, 2.5, verdictColor)
  setCol(pdf, TEXT)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  const hLines = pdf.splitTextToSize(headlineText, contentW - 16)
  pdf.text(hLines, mx + 11, y + 6)
  y += headlineH + 3

  // ── KPI row ──
  const kpiGap = 2.5
  const kpiCount = gaugePng ? 3 : 4
  const gaugeW = gaugePng ? 38 : 0
  const kpiTotalW = contentW - (gaugePng ? gaugeW + kpiGap : 0)
  const kpiW = (kpiTotalW - kpiGap * (kpiCount - 1)) / kpiCount

  const fixedAvg = input.months.length > 0 ? input.fixedTotal / input.months.length : 0
  const discretionaryAvg = input.months.length > 0 ? input.discretionaryTotal / input.months.length : 0
  const incomeRef = input.income && input.income > 0
    ? ` (${Math.round((avgMonthly / input.income) * 100)}% of income)`
    : ''

  const kpis: { title: string; value: string; sub: string; accent: string }[] = [
    {
      title: 'AVG MONTHLY',
      value: formatCurrency(avgMonthly, false),
      sub: savingsRate != null ? `${Math.round(savingsRate)}% savings rate${incomeRef}` : `across ${input.months.length} months`,
      accent: PRIMARY,
    },
    {
      title: 'FIXED COSTS',
      value: formatCurrency(fixedAvg, false),
      sub: input.income ? `${Math.round((fixedAvg / input.income) * 100)}% of income` : 'committed monthly',
      accent: '#a78bfa',
    },
    {
      title: 'DISCRETIONARY',
      value: formatCurrency(discretionaryAvg, false),
      sub: input.income ? `${formatCurrency(input.income - fixedAvg, false)} available` : 'flexible spending',
      accent: CYAN,
    },
  ]
  if (!gaugePng) {
    kpis.push({
      title: 'BIGGEST MOVER',
      value: biggestMover ? biggestMover.label : predictability.label,
      sub: biggestMover ? `${biggestMover.direction === 'up' ? '+' : ''}${Math.round(biggestMover.pct)}%` : `CV ${predictability.cv.toFixed(2)}`,
      accent: biggestMover?.direction === 'up' ? '#ef4444' : '#22c55e',
    })
  }

  for (let i = 0; i < kpis.length; i++) {
    const kx = mx + i * (kpiW + kpiGap)
    drawCard(pdf, kx, y, kpiW, 22)

    // Accent top bar
    const [ar, ag, ab] = hexToRgb(kpis[i].accent)
    pdf.setFillColor(ar, ag, ab)
    pdf.roundedRect(kx, y, kpiW, 1.2, 0.6, 0.6, 'F')

    setCol(pdf, TEXT_DIM)
    pdf.setFontSize(6)
    pdf.setFont('helvetica', 'bold')
    pdf.text(kpis[i].title, kx + 3.5, y + 6)

    setCol(pdf, TEXT)
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    const kVal = kpis[i].value.length > 13 ? kpis[i].value.substring(0, 12) + '..' : kpis[i].value
    pdf.text(kVal, kx + 3.5, y + 13)

    setCol(pdf, kpis[i].accent)
    pdf.setFontSize(6.5)
    pdf.setFont('helvetica', 'normal')
    pdf.text(kpis[i].sub, kx + 3.5, y + 18.5)
  }

  // Savings gauge next to KPIs
  if (gaugePng) {
    const gx = mx + kpis.length * (kpiW + kpiGap)
    drawCard(pdf, gx, y, gaugeW, 22)
    pdf.addImage(gaugePng, 'PNG', gx + 2, y + 0.5, gaugeW - 4, 21)
  }

  y += 26

  if (isLandscape) {
    // ── Landscape: line chart left, donut + progress bars right ──
    const halfW = (contentW - 4) / 2

    drawSectionTitle(pdf, 'Spending Trend', mx, y + 3, CYAN)
    y += 6
    const chartH = 68
    pdf.addImage(lineChartPng, 'PNG', mx, y, halfW, chartH)

    const rx = mx + halfW + 4
    drawSectionTitle(pdf, 'Category Breakdown', rx, y - 3, '#f59e0b')
    const donutW = 42
    pdf.addImage(donutPng, 'PNG', rx, y, donutW, donutW)

    // Progress bars legend on right of donut
    let ly = y + 2
    const barStartX = rx + donutW + 4
    const barW = halfW - donutW - 8
    for (const slice of donutSlices) {
      setCol(pdf, TEXT)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'normal')
      pdf.text(slice.label, barStartX, ly + 2)

      setCol(pdf, TEXT_DIM)
      pdf.setFontSize(6.5)
      pdf.text(`${slice.pct}%`, barStartX + barW - 1, ly + 2, { align: 'right' })

      drawProgressBar(pdf, barStartX, ly + 3.5, barW, 2, slice.pct, slice.color)
      ly += 9
    }

    y += chartH + 4
  } else {
    // ── Portrait: stacked ──

    // Line chart
    drawSectionTitle(pdf, 'Spending Trend', mx, y + 3, CYAN)
    y += 6
    const chartH = 55
    pdf.addImage(lineChartPng, 'PNG', mx, y, contentW, chartH)

    // Min/max callout
    y += chartH + 2
    if (totals.length > 0) {
      const minT = input.monthlyTotals.reduce((a, b) => Number(a.total_amount) < Number(b.total_amount) ? a : b)
      const maxT = input.monthlyTotals.reduce((a, b) => Number(a.total_amount) > Number(b.total_amount) ? a : b)
      setCol(pdf, TEXT_DIM)
      pdf.setFontSize(6.5)
      pdf.setFont('helvetica', 'normal')
      pdf.text(
        `Lightest: ${formatMonthLabel(minT.billing_month)} (${formatCurrency(Number(minT.total_amount), false)})   |   Heaviest: ${formatMonthLabel(maxT.billing_month)} (${formatCurrency(Number(maxT.total_amount), false)})`,
        mx, y,
      )
      y += 5
    }

    // Donut + horizontal progress bars
    drawSectionTitle(pdf, 'Category Breakdown', mx, y + 3, '#f59e0b')
    y += 6

    const donutW = 45
    pdf.addImage(donutPng, 'PNG', mx, y, donutW, donutW)

    // Progress bars to the right of donut
    const barX = mx + donutW + 5
    const barW = contentW - donutW - 5
    let ly = y + 1
    for (const slice of donutSlices) {
      setCol(pdf, TEXT)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'normal')
      pdf.text(slice.label, barX, ly + 2)

      setCol(pdf, TEXT_DIM)
      pdf.setFontSize(6.5)
      const amtStr = formatCurrency(slice.amount, false)
      pdf.text(`${amtStr}  (${slice.pct}%)`, barX + barW, ly + 2, { align: 'right' })

      drawProgressBar(pdf, barX, ly + 3.5, barW, 2, slice.pct, slice.color)
      ly += 8
    }

    y += Math.max(donutW, donutSlices.length * 8) + 4
  }

  // ── Advisor Notes ──
  if (insights.length > 0) {
    drawSectionTitle(pdf, 'Advisor Notes', mx, y + 3, '#a78bfa')
    y += 7

    const noteH = insights.length * 8.5 + 4
    drawCard(pdf, mx, y, contentW, noteH)
    y += 4

    for (const insight of insights) {
      const bullet = SEVERITY_BULLETS[insight.severity] ?? '--'
      const bulletColor = insight.severity === 'positive' ? '#22c55e'
        : insight.severity === 'warning' ? '#f59e0b'
        : insight.severity === 'concern' ? '#ef4444'
        : TEXT_MUTED

      setCol(pdf, bulletColor)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')
      pdf.text(bullet, mx + 4, y + 1.5)

      setCol(pdf, TEXT)
      pdf.setFontSize(7.5)
      pdf.setFont('helvetica', 'normal')
      const cleanText = stripEmoji(insight.text)
      const lines = pdf.splitTextToSize(cleanText, contentW - 18)
      pdf.text(lines, mx + 12, y + 1.5)
      y += lines.length * 3.5 + 5
    }
  }

  drawFooter(pdf)
}

// --------------- Page 2: Detail ---------------

function drawPage2(pdf: jsPDF, input: PdfReportInput, isLandscape: boolean) {
  pdf.addPage()
  drawBg(pdf)
  const pw = pdf.internal.pageSize.getWidth()
  const mx = isLandscape ? 16 : 12
  const contentW = pw - mx * 2
  let y = 14

  const sorted = [...input.months].sort()

  // ── Month-over-month table ──
  drawSectionTitle(pdf, 'Month-over-Month Breakdown', mx, y + 3, CYAN)
  y += 8

  const tableCategories = input.aggregatedSummary.filter(
    c => c.category !== OWN_TRANSFERS_CATEGORY_ID,
  )
  const displayMonths = sorted.slice(-6)
  const pageH = pdf.internal.pageSize.getHeight()
  const trendColW = 18
  const catColW = isLandscape ? 48 : 38
  const availW = contentW - catColW - trendColW
  const colW = Math.min(28, availW / displayMonths.length)

  // Header
  drawCard(pdf, mx, y, contentW, 7)
  setCol(pdf, TEXT_DIM)
  pdf.setFontSize(6)
  pdf.setFont('helvetica', 'bold')
  pdf.text('CATEGORY', mx + 3, y + 4.5)
  for (let i = 0; i < displayMonths.length; i++) {
    pdf.text(
      formatMonthShort(displayMonths[i]),
      mx + catColW + i * colW + colW / 2,
      y + 4.5,
      { align: 'center' },
    )
  }
  pdf.text('TREND', mx + catColW + displayMonths.length * colW + trendColW / 2, y + 4.5, { align: 'center' })
  y += 9

  for (let ci = 0; ci < tableCategories.length; ci++) {
    if (y > pageH - 90) {
      drawFooter(pdf)
      pdf.addPage()
      drawBg(pdf)
      y = 14
      drawSectionTitle(pdf, 'Month-over-Month Breakdown (cont.)', mx, y + 3, CYAN)
      y += 8
      drawCard(pdf, mx, y, contentW, 7)
      setCol(pdf, TEXT_DIM)
      pdf.setFontSize(6)
      pdf.setFont('helvetica', 'bold')
      pdf.text('CATEGORY', mx + 3, y + 4.5)
      for (let i = 0; i < displayMonths.length; i++) {
        pdf.text(
          formatMonthShort(displayMonths[i]),
          mx + catColW + i * colW + colW / 2,
          y + 4.5,
          { align: 'center' },
        )
      }
      pdf.text('TREND', mx + catColW + displayMonths.length * colW + trendColW / 2, y + 4.5, { align: 'center' })
      y += 9
    }

    const cat = tableCategories[ci]
    const label = input.categoryLookup[cat.category]?.label ?? cat.category
    const truncLabel = label.length > (isLandscape ? 22 : 16)
      ? label.substring(0, isLandscape ? 21 : 15) + '..'
      : label

    if (ci % 2 === 0) drawCard(pdf, mx, y - 1, contentW, 8, BG_CARD_ALT)

    // Category color dot
    drawDot(pdf, mx + 3.5, y + 2.5, 1.5, PALETTE[ci % PALETTE.length])

    setCol(pdf, TEXT)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.text(truncLabel, mx + 7, y + 3.5)

    const amounts: number[] = []
    for (let i = 0; i < displayMonths.length; i++) {
      const mData = input.summaryByMonth.get(displayMonths[i]) ?? []
      const entry = mData.find(c => c.category === cat.category)
      const val = entry ? Number(entry.total_amount) : 0
      amounts.push(val)

      setCol(pdf, val > 0 ? TEXT_MUTED : TEXT_DIM)
      pdf.setFontSize(6.5)
      pdf.text(
        val > 0 ? formatCurrency(val, false) : '-',
        mx + catColW + i * colW + colW / 2,
        y + 3.5,
        { align: 'center' },
      )
    }

    // Trend badge
    if (amounts.length >= 2 && amounts[0] > 0) {
      const first = amounts[0]
      const last = amounts[amounts.length - 1]
      const pct = Math.round(Math.max(-500, Math.min(500, ((last - first) / first) * 100)))
      const trendColor = pct > 10 ? '#ef4444' : pct < -10 ? '#22c55e' : TEXT_MUTED
      const badgeBg = pct > 10 ? '#3b1111' : pct < -10 ? '#0b2b15' : BG_CARD

      const bx = mx + catColW + displayMonths.length * colW + 1
      const [bbr, bbg, bbb] = hexToRgb(badgeBg)
      pdf.setFillColor(bbr, bbg, bbb)
      pdf.roundedRect(bx, y, trendColW - 2, 6, 2, 2, 'F')

      setCol(pdf, trendColor)
      pdf.setFontSize(6.5)
      pdf.setFont('helvetica', 'bold')
      pdf.text(
        `${pct >= 0 ? '+' : ''}${pct}%`,
        bx + (trendColW - 2) / 2,
        y + 4,
        { align: 'center' },
      )
    }

    y += 8
  }

  y += 6

  // ── Top transactions ──
  drawSectionTitle(pdf, 'Top 10 Transactions', mx, y + 3, '#f59e0b')
  y += 8

  const topTx = [...input.transactions]
    .filter(tx => tx.category !== OWN_TRANSFERS_CATEGORY_ID && tx.status !== 'transfer' && tx.status !== 'offset')
    .sort((a, b) => Math.abs(Number(b.normalized_amount ?? b.amount)) - Math.abs(Number(a.normalized_amount ?? a.amount)))
    .slice(0, 10)

  const txDateW = 20
  const txMerchantW = isLandscape ? 95 : 52

  // Header
  drawCard(pdf, mx, y, contentW, 7)
  setCol(pdf, TEXT_DIM)
  pdf.setFontSize(6)
  pdf.setFont('helvetica', 'bold')
  pdf.text('DATE', mx + 3, y + 4.5)
  pdf.text('MERCHANT', mx + txDateW + 3, y + 4.5)
  pdf.text('CATEGORY', mx + txDateW + txMerchantW + 3, y + 4.5)
  pdf.text('AMOUNT', pw - mx - 3, y + 4.5, { align: 'right' })
  y += 9

  for (let i = 0; i < topTx.length; i++) {
    const tx = topTx[i]
    const maxMerch = isLandscape ? 42 : 22
    const merchant = (tx.merchant_clean || tx.merchant_raw || '').substring(0, maxMerch)
    const catLabel = (input.categoryLookup[tx.category]?.label ?? tx.category).substring(0, 14)

    if (i % 2 === 0) drawCard(pdf, mx, y - 1, contentW, 8, BG_CARD_ALT)

    setCol(pdf, TEXT_DIM)
    pdf.setFontSize(6.5)
    pdf.setFont('helvetica', 'normal')
    pdf.text(tx.tx_date, mx + 3, y + 3.5)

    setCol(pdf, TEXT)
    pdf.setFontSize(7)
    pdf.text(merchant, mx + txDateW + 3, y + 3.5)

    setCol(pdf, TEXT_MUTED)
    pdf.setFontSize(6.5)
    pdf.text(catLabel, mx + txDateW + txMerchantW + 3, y + 3.5)

    setCol(pdf, TEXT)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.text(formatCurrency(Math.abs(Number(tx.normalized_amount ?? tx.amount)), false), pw - mx - 3, y + 3.5, { align: 'right' })

    y += 8
  }

  drawFooter(pdf)
}

// --------------- Page 3: Household Money Flow ---------------

function drawPage3(pdf: jsPDF, input: PdfReportInput, insightInput: InsightInput, isLandscape: boolean) {
  pdf.addPage()
  drawBg(pdf)
  const pw = pdf.internal.pageSize.getWidth()
  const mx = isLandscape ? 16 : 12
  const contentW = pw - mx * 2
  let y = 14

  // ── Title ──
  setCol(pdf, TEXT)
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'bold')
  pdf.text('HOUSEHOLD MONEY FLOW', mx, y)
  y += 8

  // ── Per-card/member spending ──
  if (input.spendingByAccount.length > 0) {
    drawSectionTitle(pdf, 'Spending by Card / Member', mx, y, CYAN)
    y += 6

    const accountTotals = new Map<string, { label: string; amount: number; txCount: number }>()
    for (const row of input.spendingByAccount) {
      const key = row.account_last4 ?? 'unknown'
      const existing = accountTotals.get(key)
      if (existing) {
        existing.amount += Number(row.total_amount)
        existing.txCount += Number(row.tx_count)
      } else {
        accountTotals.set(key, { label: row.label, amount: Number(row.total_amount), txCount: Number(row.tx_count) })
      }
    }

    const accountRows = Array.from(accountTotals.values()).sort((a, b) => b.amount - a.amount)
    const maxAcctAmount = accountRows[0]?.amount ?? 1

    for (let i = 0; i < Math.min(accountRows.length, 5); i++) {
      const row = accountRows[i]
      const barPct = (row.amount / maxAcctAmount) * 100
      const monthlyAvg = row.amount / Math.max(input.months.length, 1)

      if (i % 2 === 0) drawCard(pdf, mx, y - 1, contentW, 9, BG_CARD_ALT)

      setCol(pdf, TEXT)
      pdf.setFontSize(7.5)
      pdf.setFont('helvetica', 'bold')
      pdf.text(row.label, mx + 4, y + 3.5)

      setCol(pdf, TEXT_MUTED)
      pdf.setFontSize(6.5)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`${formatCurrency(monthlyAvg, false)}/mo · ${row.txCount} txs`, mx + 55, y + 3.5)

      drawProgressBar(pdf, mx + contentW * 0.5, y + 2, contentW * 0.4, 3, barPct, PALETTE[i % PALETTE.length])

      setCol(pdf, TEXT)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')
      pdf.text(formatCurrency(row.amount, false), pw - mx - 4, y + 3.5, { align: 'right' })

      y += 9
    }
    y += 4
  }

  // ── Card funding ──
  if (input.cardFunding.length > 0) {
    drawSectionTitle(pdf, 'Card Funding (Transfers to Shared Cards)', mx, y, '#f59e0b')
    y += 6

    const fundingByMonth = new Map<string, number>()
    const fundingBySource = new Map<string, { label: string; amount: number }>()
    for (const row of input.cardFunding) {
      fundingByMonth.set(row.billing_month, (fundingByMonth.get(row.billing_month) ?? 0) + Number(row.total_amount))
      const key = row.source_account ?? 'unknown'
      const existing = fundingBySource.get(key)
      if (existing) {
        existing.amount += Number(row.total_amount)
      } else {
        fundingBySource.set(key, { label: row.source_label, amount: Number(row.total_amount) })
      }
    }

    const totalFunding = Array.from(fundingByMonth.values()).reduce((s, v) => s + v, 0)
    const fundingSources = Array.from(fundingBySource.values()).sort((a, b) => b.amount - a.amount)

    drawCard(pdf, mx, y, contentW, 14)
    setCol(pdf, TEXT)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`Total funded: ${formatCurrency(totalFunding, false)} across ${input.months.length} months`, mx + 4, y + 5)

    setCol(pdf, TEXT_MUTED)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    const sourceText = fundingSources.slice(0, 3).map(s => `${s.label}: ${formatCurrency(s.amount, false)}`).join(' · ')
    pdf.text(sourceText, mx + 4, y + 11)
    y += 18

    // Funding vs spending comparison (if we can approximate)
    const spendingOnShared = input.spendingByAccount
      .filter(r => input.cardFunding.some(f => f.source_account !== r.account_last4))
    if (spendingOnShared.length > 0 && totalFunding > 0) {
      setCol(pdf, TEXT_DIM)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'italic')
      pdf.text('Card funding is not spending — it is money moved to shared cards before purchases.', mx + 4, y)
      y += 6
    }
  }

  // ── Salary / Income check ──
  if (input.salaryDetected.length > 0 || input.income) {
    drawSectionTitle(pdf, 'Income Check', mx, y, '#22c55e')
    y += 6

    drawCard(pdf, mx, y, contentW, 16)
    let iy = y + 5

    if (input.income && input.income > 0) {
      setCol(pdf, TEXT)
      pdf.setFontSize(7.5)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Configured household income: ${formatCurrency(input.income, false)}/month`, mx + 4, iy)
      iy += 5
    }

    if (input.salaryDetected.length > 0) {
      const detectedTotal = input.salaryDetected.reduce((s, r) => s + Number(r.total_amount), 0)
      const detectedMonthly = detectedTotal / Math.max(input.months.length, 1)
      setCol(pdf, TEXT_MUTED)
      pdf.setFontSize(7)
      pdf.text(`Detected payroll (NOMINA): ${formatCurrency(detectedMonthly, false)}/month average`, mx + 4, iy)
      iy += 5

      if (input.income && input.income > 0) {
        const delta = detectedMonthly - input.income
        if (Math.abs(delta) > 100) {
          setCol(pdf, delta > 0 ? '#22c55e' : '#f59e0b')
          pdf.text(`Delta: ${delta > 0 ? '+' : ''}${formatCurrency(delta, false)} vs configured income`, mx + 4, iy)
        }
      }
    }
    y += 20
  }

  // ── Recurring charges ──
  if (input.recurringCharges.length > 0) {
    drawSectionTitle(pdf, 'Recurring Charges Detected', mx, y, '#a78bfa')
    y += 6

    const recurringTotal = input.recurringCharges.reduce((s, r) => s + r.monthlyEstimate, 0)
    drawCard(pdf, mx, y, contentW, 8)
    setCol(pdf, TEXT)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${input.recurringCharges.length} recurring charges = ${formatCurrency(recurringTotal, false)}/month (${formatCurrency(recurringTotal * 12, false)}/year)`, mx + 4, y + 5)
    y += 11

    const topRecurring = input.recurringCharges.slice(0, 8)
    for (let i = 0; i < topRecurring.length; i++) {
      const r = topRecurring[i]
      if (i % 2 === 0) drawCard(pdf, mx, y - 1, contentW, 7, BG_CARD_ALT)

      setCol(pdf, TEXT)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'normal')
      const name = r.merchantClean.length > 30 ? r.merchantClean.substring(0, 28) + '..' : r.merchantClean
      pdf.text(name, mx + 4, y + 3)

      setCol(pdf, TEXT_MUTED)
      pdf.setFontSize(6.5)
      pdf.text(`${r.frequency}/${input.months.length} months`, mx + contentW * 0.55, y + 3)

      setCol(pdf, TEXT)
      pdf.setFontSize(7)
      pdf.setFont('helvetica', 'bold')
      pdf.text(formatCurrency(r.avgAmount, false), pw - mx - 4, y + 3, { align: 'right' })

      y += 7
    }
    y += 4
  }

  // ── Delta drivers ──
  const drivers = getDeltaDrivers(insightInput)
  if (drivers.length > 0) {
    drawSectionTitle(pdf, 'What Changed & Why', mx, y, '#ef4444')
    y += 6

    for (const driver of drivers.slice(0, 3)) {
      const dir = driver.delta >= 0 ? '+' : ''
      drawCard(pdf, mx, y, contentW, 14)
      setCol(pdf, driver.delta >= 0 ? '#ef4444' : '#22c55e')
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${driver.label}: ${dir}${Math.round(driver.pct)}% (${dir}${formatCurrency(driver.delta, false)})`, mx + 4, y + 5)

      if (driver.topTransactions.length > 0) {
        setCol(pdf, TEXT_MUTED)
        pdf.setFontSize(6.5)
        pdf.setFont('helvetica', 'normal')
        const txList = driver.topTransactions
          .map(t => `${t.merchant.substring(0, 20)} ${formatCurrency(t.amount, false)}`)
          .join(' · ')
        pdf.text(txList, mx + 4, y + 10.5)
      }

      y += 16
    }
  }

  // ── Micro-spend callout ──
  const microTxs = input.transactions.filter(tx =>
    tx.category !== OWN_TRANSFERS_CATEGORY_ID &&
    tx.status !== 'transfer' && tx.status !== 'offset' &&
    Math.abs(Number(tx.normalized_amount ?? tx.amount)) < 15 &&
    Math.abs(Number(tx.normalized_amount ?? tx.amount)) > 0
  )
  if (microTxs.length > 20) {
    const microTotal = microTxs.reduce((s, tx) => s + Math.abs(Number(tx.normalized_amount ?? tx.amount)), 0)
    const microMonthly = microTotal / Math.max(input.months.length, 1)

    if (y < pdf.internal.pageSize.getHeight() - 30) {
      drawSectionTitle(pdf, 'Small Purchase Alert', mx, y, '#f472b6')
      y += 6
      drawCard(pdf, mx, y, contentW, 10)
      setCol(pdf, TEXT)
      pdf.setFontSize(7.5)
      pdf.setFont('helvetica', 'normal')
      pdf.text(
        `${microTxs.length} purchases under €15 totaling ${formatCurrency(microTotal, false)} (${formatCurrency(microMonthly, false)}/month).`,
        mx + 4, y + 5.5,
      )
      y += 14
    }
  }

  drawFooter(pdf)
}

function drawTopMerchantsPage(pdf: jsPDF, input: PdfReportInput, isLandscape: boolean) {
  pdf.addPage(undefined, isLandscape ? 'landscape' : 'portrait')
  drawBg(pdf)

  const mx = isLandscape ? 15 : 12
  const pw = isLandscape ? 277 : 186
  let y = 14

  pdf.setFontSize(14)
  pdf.setTextColor(...hexToRgb(TEXT))
  pdf.setFont('helvetica', 'bold')
  pdf.text('Top Spending Merchants', mx, y)
  y += 10

  const byCat = new Map<string, Map<string, number>>()
  for (const tx of input.transactions) {
    const cat = tx.category || 'uncategorized'
    if (cat === OWN_TRANSFERS_CATEGORY_ID) continue
    const merchant = (tx.merchant_clean || tx.merchant_raw).trim()
    if (!merchant || !input.categoryLookup[cat]) continue
    if (!byCat.has(cat)) byCat.set(cat, new Map())
    const m = byCat.get(cat)!
    m.set(merchant, (m.get(merchant) ?? 0) + Math.abs(Number(tx.normalized_amount ?? tx.amount)))
  }

  const sorted = Array.from(byCat.entries())
    .map(([cat, merchants]) => ({
      cat,
      label: stripEmoji(input.categoryLookup[cat]?.label || cat),
      merchants: Array.from(merchants.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3),
      total: Array.from(merchants.values()).reduce((s, v) => s + v, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const months = input.months.length

  for (const cat of sorted) {
    if (y > (isLandscape ? 185 : 270)) break

    pdf.setFillColor(...hexToRgb(BG_CARD))
    pdf.roundedRect(mx, y, pw, 22, 2, 2, 'F')

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...hexToRgb(TEXT))
    pdf.text(cat.label, mx + 4, y + 5.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...hexToRgb(TEXT_MUTED))
    pdf.text(formatCurrency(cat.total / Math.max(months, 1), false) + '/mo', mx + pw - 4, y + 5.5, { align: 'right' })

    let my = y + 10
    for (const [merchant, amount] of cat.merchants) {
      pdf.setFontSize(8)
      pdf.setTextColor(...hexToRgb(TEXT_DIM))
      pdf.text(merchant.substring(0, 30), mx + 8, my + 3)
      pdf.text(formatCurrency(amount / Math.max(months, 1), false) + '/mo', mx + pw - 8, my + 3, { align: 'right' })
      my += 4
    }

    y += 24
  }

  drawFooter(pdf)
}

function drawBudgetPage(pdf: jsPDF, input: PdfReportInput, isLandscape: boolean) {
  const budgets = input.budgets ?? []
  if (budgets.length === 0) return

  pdf.addPage(undefined, isLandscape ? 'landscape' : 'portrait')
  drawBg(pdf)

  const mx = isLandscape ? 15 : 12
  const pw = isLandscape ? 277 : 186
  let y = 14

  pdf.setFontSize(14)
  pdf.setTextColor(...hexToRgb(TEXT))
  pdf.setFont('helvetica', 'bold')
  pdf.text('Budget vs Actual', mx, y)
  y += 8

  pdf.setFontSize(8)
  pdf.setTextColor(...hexToRgb(TEXT_MUTED))
  pdf.setFont('helvetica', 'normal')
  pdf.text('Actual = median monthly spend (prevents anomaly distortion)', mx, y)
  y += 6

  const months = input.months
  const budgetMap = new Map(budgets.map(b => [b.category_id, b]))

  const rows: { label: string; actual: number; target: number; delta: number }[] = []
  for (const [catId, budget] of budgetMap) {
    const info = input.categoryLookup[catId]
    if (!info) continue

    const monthlyAmounts = months.map(m => {
      const summary = input.summaryByMonth.get(m)
      const cat = summary?.find(c => c.category === catId)
      return cat ? Math.abs(Number(cat.total_amount)) : 0
    })
    const sorted = [...monthlyAmounts].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2

    rows.push({
      label: stripEmoji(info.label),
      actual: median,
      target: budget.monthly_target,
      delta: median - budget.monthly_target,
    })
  }

  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  pdf.setFillColor(...hexToRgb(BG_CARD))
  pdf.roundedRect(mx, y, pw, 6, 1, 1, 'F')
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...hexToRgb(TEXT_MUTED))
  pdf.text('Category', mx + 4, y + 4)
  pdf.text('Actual', mx + pw * 0.5, y + 4, { align: 'right' })
  pdf.text('Target', mx + pw * 0.7, y + 4, { align: 'right' })
  pdf.text('Delta', mx + pw - 4, y + 4, { align: 'right' })
  y += 8

  for (const row of rows) {
    if (y > (isLandscape ? 185 : 270)) break

    const bg = rows.indexOf(row) % 2 === 0 ? BG_CARD : BG_CARD_ALT
    pdf.setFillColor(...hexToRgb(bg))
    pdf.roundedRect(mx, y, pw, 5.5, 0.5, 0.5, 'F')

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...hexToRgb(TEXT))
    pdf.text(row.label.substring(0, 22), mx + 4, y + 4)
    pdf.text(formatCurrency(row.actual, false), mx + pw * 0.5, y + 4, { align: 'right' })
    pdf.text(formatCurrency(row.target, false), mx + pw * 0.7, y + 4, { align: 'right' })

    const deltaColor = row.delta > 0 ? '#ef4444' : '#10b981'
    pdf.setTextColor(...hexToRgb(deltaColor))
    pdf.text((row.delta > 0 ? '+' : '') + formatCurrency(row.delta, false), mx + pw - 4, y + 4, { align: 'right' })

    y += 6
  }

  const totalTarget = rows.reduce((s, r) => s + r.target, 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0)
  y += 4

  pdf.setFillColor(...hexToRgb(BG_CARD))
  pdf.roundedRect(mx, y, pw, 7, 1, 1, 'F')
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...hexToRgb(TEXT))
  pdf.text('TOTAL', mx + 4, y + 5)
  pdf.text(formatCurrency(totalActual, false), mx + pw * 0.5, y + 5, { align: 'right' })
  pdf.text(formatCurrency(totalTarget, false), mx + pw * 0.7, y + 5, { align: 'right' })
  const totalDelta = totalActual - totalTarget
  pdf.setTextColor(...hexToRgb(totalDelta > 0 ? '#ef4444' : '#10b981'))
  pdf.text((totalDelta > 0 ? '+' : '') + formatCurrency(totalDelta, false), mx + pw - 4, y + 5, { align: 'right' })
  y += 12

  if (input.income != null && input.income > 0) {
    const surplus = input.income - totalTarget
    pdf.setFontSize(9)
    pdf.setTextColor(...hexToRgb(TEXT_MUTED))
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Income: ${formatCurrency(input.income, false)}/mo`, mx, y + 4)
    pdf.setTextColor(...hexToRgb(surplus >= 0 ? '#10b981' : '#ef4444'))
    pdf.setFont('helvetica', 'bold')
    pdf.text(`Projected surplus: ${formatCurrency(surplus, false)}/mo`, mx + pw / 2, y + 4)
    y += 10

    const goals = input.savingsGoals ?? []
    const inflRate = input.inflationRate ?? 3.2
    if (goals.length > 0) {
      pdf.setFontSize(10)
      pdf.setTextColor(...hexToRgb(TEXT))
      pdf.setFont('helvetica', 'bold')
      pdf.text('Savings Goals', mx, y + 4)
      y += 8

      const fixedCosts = budgets.filter(b => input.categoryLookup[b.category_id]?.expenseType === 'fixed').reduce((s, b) => s + b.monthly_target, 0)
      const variableCosts = budgets.filter(b => input.categoryLookup[b.category_id]?.expenseType !== 'fixed').reduce((s, b) => s + b.monthly_target, 0)
      const realSurplus = input.income - fixedCosts - variableCosts * (1 + inflRate / 1200)

      for (const goal of goals) {
        const monthlyNeeded = goal.horizon_months > 0 ? goal.target / goal.horizon_months : goal.target
        const monthsToGoal = realSurplus > 0 ? Math.ceil(goal.target / realSurplus) : Infinity

        pdf.setFillColor(...hexToRgb(BG_CARD))
        pdf.roundedRect(mx, y, pw, 8, 1, 1, 'F')
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(...hexToRgb(TEXT))
        pdf.text(goal.name, mx + 4, y + 5)
        pdf.setTextColor(...hexToRgb(TEXT_MUTED))
        pdf.text(`${formatCurrency(goal.target, false)} goal · ${formatCurrency(monthlyNeeded, false)}/mo needed · ${monthsToGoal === Infinity ? '—' : monthsToGoal + 'mo'} to goal`, mx + pw - 4, y + 5, { align: 'right' })
        y += 10
      }

      y += 4
      pdf.setFontSize(7)
      pdf.setTextColor(...hexToRgb(TEXT_DIM))
      pdf.text(`Inflation-adjusted surplus: ${formatCurrency(realSurplus, false)}/mo (at ${inflRate}% annual inflation)`, mx, y + 3)
      y += 6
    }

    pdf.setFontSize(6)
    pdf.setTextColor(...hexToRgb(TEXT_DIM))
    pdf.text(
      `Note: Savings projections assume ${inflRate}% annual inflation applied to all variable/discretionary spending. Fixed costs (mortgage, loans) are held flat. Per-category inflation flags are not used in this report.`,
      mx, y + 6, { maxWidth: pw },
    )
  }

  drawFooter(pdf)
}

// --------------- Exports ---------------

export async function exportSummaryPdf(
  input: PdfReportInput,
  layout: 'mobile' | 'desktop',
): Promise<void> {
  const isLandscape = layout === 'desktop'

  const lineW = isLandscape ? 380 : 520
  const lineH = isLandscape ? 200 : 200
  const donutSize = 200

  const totals = input.monthlyTotals.map(t => Number(t.total_amount))
  const totalSpent = totals.reduce((s, v) => s + v, 0)
  const avgMonthly = totals.length > 0 ? totalSpent / totals.length : 0
  const savingsRate = input.income && input.income > 0
    ? ((input.income - avgMonthly) / input.income) * 100
    : null

  const chartPromises: Promise<unknown>[] = [
    renderLineChart(input.monthlyTotals, input.income, input.months, lineW, lineH),
    renderDonutChart(input.aggregatedSummary, input.categoryLookup, totalSpent, donutSize, donutSize),
  ]

  if (savingsRate != null) {
    chartPromises.push(renderGauge(Math.max(savingsRate, 0), 100, 'Savings', savingsRate >= 10 ? '#22c55e' : savingsRate >= 0 ? '#f59e0b' : '#ef4444', 160, 100))
  }

  const results = await Promise.all(chartPromises)
  const lineChartPng = results[0] as string
  const donutResult = results[1] as Awaited<ReturnType<typeof renderDonutChart>>
  const gaugePng = results.length > 2 ? (results[2] as string) : null

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  await drawPage1(pdf, input, lineChartPng, donutResult.png, donutResult.slices, gaugePng, isLandscape)
  drawPage2(pdf, input, isLandscape)

  const insightInput: InsightInput = {
    months: input.months,
    aggregatedSummary: input.aggregatedSummary,
    summaryByMonth: input.summaryByMonth,
    monthlyTotals: input.monthlyTotals,
    categoryTrend: input.categoryTrend,
    dailyTotals: input.dailyTotals,
    income: input.income,
    categoryLookup: input.categoryLookup,
    transactions: input.transactions,
    recurringCharges: input.recurringCharges,
    spendingByAccount: input.spendingByAccount,
    fixedTotal: input.fixedTotal,
    discretionaryTotal: input.discretionaryTotal,
  }

  const hasPage3Content = input.spendingByAccount.length > 1
    || input.cardFunding.length > 0
    || input.recurringCharges.length > 0
    || input.salaryDetected.length > 0
  if (hasPage3Content) {
    drawPage3(pdf, input, insightInput, isLandscape)
  }

  const rc = input.reportConfig ?? {}
  const showTopVendors = rc.topVendors !== false && input.months.length >= 3
  if (showTopVendors) {
    drawTopMerchantsPage(pdf, input, isLandscape)
  }

  const showBudget = rc.budgetVsActual !== false && (input.budgets ?? []).length > 0
  if (showBudget) {
    drawBudgetPage(pdf, input, isLandscape)
  }

  const sorted = [...input.months].sort()
  const filename = `financial-health-check-${sorted[0]}-to-${sorted[sorted.length - 1]}-${layout}.pdf`
  pdf.save(filename)
}
