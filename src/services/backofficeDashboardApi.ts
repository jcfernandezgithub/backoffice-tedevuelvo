export type DashboardGranularity = 'day' | 'week' | 'month'
export type DashboardChart = 'solicitudes' | 'callcenter' | 'pagos' | 'distribucion'
export interface DashboardRange { from?: string; to?: string }
export interface DashboardMeta {
  schemaVersion: string
  metricVersion: string
  datePolicy: string
  bucketPolicy: string
  range: { from: string | null; to: string | null }
  generatedAt: string
  dataAsOf: string | null
  readStartedAt: string
  consistency: string
  currency: string
  requestId: string
  sortPolicy: string
}
export interface DashboardSummary {
  totals: { totalRequests: number; inProgress: number; paidRequests: number; successRatePct: number; totalPaidAmountCLP: number }
  statusCounts: Record<string, number>
  phaseCounts: Record<string, number>
  qualification: { total: number; signedMandate: number; pendingMandate: number }
  scheduledPayment: { total: number; withBankInfo: number; withoutBankInfo: number }
  dataQuality: { unknownStatusRequests: number; missingCreatedAtRequests: number }
  meta: DashboardMeta
}
export type DashboardInsurance = 'DESGRAVAMEN' | 'CESANTIA' | 'AMBOS' | 'UNKNOWN'
export interface DashboardCallCenterSummary {
  totals: { managedRequests: number; estimatedPremiumsCLP: number; averageTicketCLP: number }
  byInsurance: { insurance: DashboardInsurance; managedRequests: number; estimatedPremiumsCLP: number; averageTicketCLP: number; sharePct: number }[]
  meta: DashboardMeta
}
export interface DashboardRequestsSeries {
  granularity: DashboardGranularity; totalRequests: number
  series: { bucket: string; count: number }[]
  dataQuality: { missingCreatedAtRequests: number }; meta: DashboardMeta
}
export interface DashboardManagedSeries {
  granularity: DashboardGranularity; totalManagedRequests: number
  series: { bucket: string; count: number }[]; meta: DashboardMeta
}
export interface DashboardPaymentsSeries {
  granularity: DashboardGranularity; totalAmountCLP: number
  series: { bucket: string; amountCLP: number }[]
  dataQuality: { missingUpdatedAtRequests: number; estimatedFallbackRequests: number }; meta: DashboardMeta
}
export interface DashboardDistribution {
  totalRequests: number
  items: { status: string; label: string; count: number; percentage: number }[]
  meta: DashboardMeta
}
export interface DashboardResponses {
  summary: DashboardSummary
  'call-center-summary': DashboardCallCenterSummary
  'requests-timeseries': DashboardRequestsSeries
  'call-center-timeseries': DashboardManagedSeries
  'payments-timeseries': DashboardPaymentsSeries
  'status-distribution': DashboardDistribution
}
export type DashboardEndpoint = keyof DashboardResponses

export class DashboardApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string, public retryAfterMs?: number) {
    super(message)
    this.name = 'DashboardApiError'
  }
}

export function dashboardQueryKey(scope: string | null, endpoint: DashboardEndpoint, range: DashboardRange, granularity?: DashboardGranularity) {
  return ['backoffice-dashboard', '1.0', scope, endpoint, range.from || null, range.to || null,
    ...(endpoint.endsWith('-timeseries') ? [granularity ?? 'day'] : [])]
}

export function dashboardQueryString(endpoint: DashboardEndpoint, range: DashboardRange, granularity?: DashboardGranularity): string {
  const params = new URLSearchParams()
  if (range.from) params.set('from', range.from)
  if (range.to) params.set('to', range.to)
  if (endpoint.endsWith('-timeseries')) params.set('granularity', granularity ?? 'day')
  const query = params.toString()
  return query ? `?${query}` : ''
}

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const numbers = (v: unknown, keys: string[]) => object(v) && keys.every(key => typeof v[key] === 'number' && Number.isFinite(v[key]))
const statuses = ['DATOS_SIN_SIMULACION', 'SIMULATED', 'REQUESTED', 'QUALIFYING', 'DOCS_PENDING', 'DOCS_RECEIVED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAYMENT_SCHEDULED', 'PAID', 'CANCELED']

/** Reject partial/incompatible bodies rather than presenting absent metrics as zero. */
export function validateDashboardResponse(endpoint: DashboardEndpoint, body: unknown): void {
  const meta = object(body) && object(body.meta) ? body.meta : undefined
  let valid = Boolean(object(body) && meta?.schemaVersion === '1.0' && typeof meta.generatedAt === 'string' && Number.isFinite(Date.parse(meta.generatedAt)) && typeof meta.requestId === 'string' && typeof meta.metricVersion === 'string')
  if (object(body)) {
    switch (endpoint) {
      case 'summary':
        valid = valid && numbers(body.totals, ['totalRequests', 'inProgress', 'paidRequests', 'successRatePct', 'totalPaidAmountCLP']) && numbers(body.statusCounts, statuses) && numbers(body.phaseCounts, ['captacion', 'revision', 'gestion', 'salida']) && numbers(body.qualification, ['total', 'signedMandate', 'pendingMandate']) && numbers(body.scheduledPayment, ['total', 'withBankInfo', 'withoutBankInfo'])
        break
      case 'call-center-summary':
        valid = valid && numbers(body.totals, ['managedRequests', 'estimatedPremiumsCLP', 'averageTicketCLP']) && Array.isArray(body.byInsurance) && body.byInsurance.length === 4 && body.byInsurance.every((g, i) => object(g) && g.insurance === ['DESGRAVAMEN', 'CESANTIA', 'AMBOS', 'UNKNOWN'][i] && numbers(g, ['managedRequests', 'estimatedPremiumsCLP', 'averageTicketCLP', 'sharePct']))
        break
      case 'status-distribution':
        valid = valid && numbers(body, ['totalRequests']) && Array.isArray(body.items) && body.items.every(g => object(g) && typeof g.status === 'string' && typeof g.label === 'string' && numbers(g, ['count', 'percentage']))
        break
      default:
        valid = valid && ['day', 'week', 'month'].includes(String(body.granularity)) && numbers(body, [endpoint === 'payments-timeseries' ? 'totalAmountCLP' : endpoint === 'call-center-timeseries' ? 'totalManagedRequests' : 'totalRequests']) && Array.isArray(body.series) && body.series.every(p => object(p) && typeof p.bucket === 'string' && numbers(p, [endpoint === 'payments-timeseries' ? 'amountCLP' : 'count']))
    }
  }
  if (!valid) throw new DashboardApiError(500, 'INVALID_RESPONSE', 'La respuesta del dashboard está incompleta o no es compatible.', typeof meta?.requestId === 'string' ? meta.requestId : undefined)
}

export function createDashboardClient(options: { apiBaseUrl?: string; fetchAuthenticated: (endpoint: string, init: RequestInit, baseUrl: string) => Promise<Response> }) {
  return {
    async get<E extends DashboardEndpoint>(endpoint: E, range: DashboardRange, signal?: AbortSignal, granularity?: DashboardGranularity): Promise<DashboardResponses[E]> {
      if (!options.apiBaseUrl) throw new DashboardApiError(0, 'MISSING_API_URL', 'Falta configurar VITE_API_BASE_URL para el dashboard.')
      const response = await options.fetchAuthenticated(`/backoffice-dashboard/${endpoint}${dashboardQueryString(endpoint, range, granularity)}`, { method: 'GET', headers: { Accept: 'application/json' }, signal }, options.apiBaseUrl)
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const error = object(body) && object(body.error) ? body.error : object(body) ? body : {}
        const retryAfter = response.headers.get('Retry-After')
        const retryAfterMs = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now())) : undefined
        throw new DashboardApiError(response.status, typeof error.code === 'string' ? error.code : `HTTP_${response.status}`, typeof error.message === 'string' ? error.message : 'No se pudo cargar este bloque.', typeof error.requestId === 'string' ? error.requestId : undefined, retryAfterMs)
      }
      validateDashboardResponse(endpoint, body)
      return body as DashboardResponses[E]
    },
  }
}

const insuranceLabels: Record<DashboardInsurance, string> = { DESGRAVAMEN: 'Desgravamen', CESANTIA: 'Cesantía', AMBOS: 'Ambos seguros', UNKNOWN: 'Sin tipo confirmado' }
export const adaptInsuranceGroups = (data: DashboardCallCenterSummary) => data.byInsurance.map(g => ({ key: g.insurance.toLowerCase(), label: insuranceLabels[g.insurance], count: g.managedRequests, premiums: g.estimatedPremiumsCLP, ticket: g.averageTicketCLP, sharePct: g.sharePct }))
export const adaptCountSeries = (data: DashboardRequestsSeries | DashboardManagedSeries) => data.series.map(p => ({ bucket: p.bucket, value: p.count }))
export const adaptPaymentSeries = (data: DashboardPaymentsSeries) => data.series.map(p => ({ bucket: p.bucket, monto: p.amountCLP }))