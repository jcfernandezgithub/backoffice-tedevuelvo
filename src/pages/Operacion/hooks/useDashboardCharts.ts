import { useQuery } from '@tanstack/react-query'
import {
  refundAdminApi,
  type RequestsTimeseriesResponse,
  type StatusDistributionResponse,
} from '@/services/refundAdminApi'

/**
 * GET /api/v1/dashboard/requests-timeseries
 * Filtra por updatedAt en America/Santiago.
 */
export function useRequestsTimeseries(params: {
  since?: string
  to?: string
  granularity: 'day' | 'week' | 'month'
}) {
  return useQuery<RequestsTimeseriesResponse>({
    queryKey: ['requests-timeseries', params.since || null, params.to || null, params.granularity],
    queryFn: () =>
      refundAdminApi.getRequestsTimeseries({
        since: params.since,
        to: params.to,
        granularity: params.granularity,
      }),
    staleTime: 30 * 1000,
  })
}

/**
 * GET /api/v1/dashboard/status-distribution
 * Filtra por updatedAt en America/Santiago.
 */
export function useStatusDistribution(params: { since?: string; to?: string }) {
  return useQuery<StatusDistributionResponse>({
    queryKey: ['status-distribution', params.since || null, params.to || null],
    queryFn: () => refundAdminApi.getStatusDistribution(params),
    staleTime: 30 * 1000,
  })
}