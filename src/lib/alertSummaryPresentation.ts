import type { AlertSummary } from '@/services/operationalAlertsApi'

export function alertTypeDistribution(summary: Pick<AlertSummary, 'totals' | 'byRule'>) {
  return summary.byRule.map(rule => ({
    ...rule,
    percentage: summary.totals.open > 0 ? rule.open / summary.totals.open * 100 : 0,
  })).sort((a, b) => b.open - a.open)
}