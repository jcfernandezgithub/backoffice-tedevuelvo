import { useQuery } from '@tanstack/react-query'
import { refundAdminApi, type DashboardCountsResponse, type DashboardMetricValue, type DashboardMetric } from '@/services/refundAdminApi'

/**
 * Hook que consume GET /refund-requests/admin/dashboard-counts.
 * Se vuelve a consultar automáticamente cuando cambia el rango de fechas.
 */
export function useDashboardCounts(params: { since?: string; to?: string }) {
  return useQuery<DashboardCountsResponse>({
    queryKey: ['dashboard-counts', params.since || null, params.to || null],
    queryFn: () => refundAdminApi.getDashboardCounts(params),
    staleTime: 30 * 1000,
  })
}

/** Extrae el total de una métrica que puede ser número u objeto. */
export function metricTotal(m: DashboardMetricValue | undefined): number {
  if (m == null) return 0
  if (typeof m === 'number') return m
  return m.total ?? 0
}

/** Extrae el objeto de métrica (vacío si llega como número). */
export function metricObj(m: DashboardMetricValue | undefined): DashboardMetric {
  if (m == null) return {}
  if (typeof m === 'number') return { total: m }
  return m
}