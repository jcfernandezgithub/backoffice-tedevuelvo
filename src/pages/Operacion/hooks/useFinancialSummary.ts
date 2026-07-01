import { useQuery } from '@tanstack/react-query'
import { refundAdminApi, type FinancialSummaryResponse } from '@/services/refundAdminApi'

/**
 * Hook que consume GET /api/v1/dashboard/financial-summary.
 * Alimenta las calugas de "Resumen Financiero" (Monto a Pagar, Monto Pagado, Prima Total).
 */
export function useFinancialSummary(params: { since?: string; to?: string }) {
  return useQuery<FinancialSummaryResponse>({
    queryKey: ['financial-summary', params.since || null, params.to || null],
    queryFn: () => refundAdminApi.getFinancialSummary(params),
    staleTime: 30 * 1000,
  })
}

/** Toma el primer valor numérico definido de una lista de posibles nombres de campo plano. */
export function pickNumber(obj: FinancialSummaryResponse | undefined, keys: string[]): number {
  if (!obj) return 0
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && !isNaN(v)) return v
  }
  return 0
}

/** Extrae el amount de un objeto métrica anidado; si no existe, cae de forma segura. */
function pickNestedAmount(obj: FinancialSummaryResponse | undefined, key: string): number | undefined {
  if (!obj) return undefined
  const v = obj[key]
  if (v && typeof v === 'object' && typeof v.amount === 'number' && !isNaN(v.amount)) return v.amount
  return undefined
}

/** Extrae el count de un objeto métrica anidado; si no existe, cae de forma segura. */
function pickNestedCount(obj: FinancialSummaryResponse | undefined, key: string): number | undefined {
  if (!obj) return undefined
  const v = obj[key]
  if (v && typeof v === 'object' && typeof v.count === 'number' && !isNaN(v.count)) return v.count
  return undefined
}

/** Extrae la descripción de un objeto métrica anidado. */
function pickNestedDescription(obj: FinancialSummaryResponse | undefined, key: string): string | undefined {
  if (!obj) return undefined
  const v = obj[key]
  if (v && typeof v === 'object' && typeof v.description === 'string') return v.description
  return undefined
}

/** Toma el monto de una métrica, priorizando el formato anidado y luego el plano. */
export function getMetricAmount(
  obj: FinancialSummaryResponse | undefined,
  nestedKey: string,
  flatKeys: string[] = []
): number {
  return pickNestedAmount(obj, nestedKey) ?? pickNumber(obj, flatKeys)
}

/** Toma el conteo de una métrica, priorizando el formato anidado y luego el plano. */
export function getMetricCount(
  obj: FinancialSummaryResponse | undefined,
  nestedKey: string,
  flatKeys: string[] = []
): number {
  return pickNestedCount(obj, nestedKey) ?? pickNumber(obj, flatKeys)
}

/** Toma la descripción de una métrica anidada si existe. */
export function getMetricDescription(obj: FinancialSummaryResponse | undefined, nestedKey: string): string | undefined {
  return pickNestedDescription(obj, nestedKey)
}