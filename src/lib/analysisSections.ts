import type { AnalysisReportConfig } from '../types/database'

export interface AnalysisSectionDef {
  id: string
  label: string
}

export const ANALYSIS_SECTIONS: AnalysisSectionDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'trends', label: 'Trends' },
  { id: 'advisor', label: 'Advisor' },
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'details', label: 'Details' },
  { id: 'recurring', label: 'Recurring & Budget' },
  { id: 'projections', label: 'Projections' },
]

export const ANALYSIS_SECTION_IDS = ANALYSIS_SECTIONS.map((section) => section.id)

/** Returns whether a report widget should render for the selected month count. */
export function showAnalysisWidget(
  rc: AnalysisReportConfig,
  key: keyof AnalysisReportConfig,
  minMonths: number,
  monthCount: number,
): boolean {
  return (rc[key] ?? true) && monthCount >= minMonths
}

/** Returns the analysis nav section ids that have at least one visible widget. */
export function getVisibleAnalysisSections(
  rc: AnalysisReportConfig,
  monthCount: number,
): Set<string> {
  const visible = new Set<string>()
  const show = (key: keyof AnalysisReportConfig, minMonths: number) =>
    showAnalysisWidget(rc, key, minMonths, monthCount)

  if (show('headline', 1) || show('kpiCards', 1) || show('fixedDiscretionary', 1)) visible.add('overview')
  if (show('categoryTrend', 2) || show('comparisonTable', 2)) visible.add('trends')
  if (show('advisorNotes', 1)) visible.add('advisor')
  if (show('deltaDrivers', 2) || show('memberSpending', 1)) visible.add('breakdown')
  if (show('calendarHeatmap', 2)) visible.add('calendar')
  if (show('topVendors', 3) || show('cardCategorySplit', 3)) visible.add('details')
  if (show('recurring', 1) || show('budgetVsActual', 3)) visible.add('recurring')
  if (show('savingsProjection', 3) || show('velocityGauge', 1)) visible.add('projections')
  return visible
}
