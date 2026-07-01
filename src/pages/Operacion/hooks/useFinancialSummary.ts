import { useQuery } from '@tanstack/react-query'
import { refundAdminApi, type FinancialSummaryResponse } from '@/services/refundAdminApi'

/**
 * Hook que consume GET /api/v2/dashboard/financial-summary.
 * Alimenta las calugas de "Resumen Financiero" (Monto a Pagar, Monto Pagado, Prima Total).
 */
export function useFinancialSummary(params: { since?: string; to?: string }) {
  return useQuery<FinancialSummaryResponse>({
    queryKey: ['financial-summary', params.since || null, params.to || null],
    queryFn: () => refundAdminApi.getFinancialSummary(params),
    staleTime: 30 * 1000,
  })
}

/** Toma el primer valor numérico definido de una lista de posibles nombres de campo. */
export function pickNumber(obj: FinancialSummaryResponse | undefined, keys: string[]): number {
  if (!obj) return 0
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && !isNaN(v)) return v
  }
  return 0
}