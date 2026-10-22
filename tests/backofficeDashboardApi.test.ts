import { describe, expect, test } from 'bun:test'
import { createDashboardClient, dashboardQueryKey, dashboardQueryString, validateDashboardResponse, adaptInsuranceGroups, adaptCountSeries, adaptPaymentSeries, DashboardApiError, type DashboardCallCenterSummary, type DashboardMeta } from '../src/services/backofficeDashboardApi'

const meta: DashboardMeta = { schemaVersion: '1.0', metricVersion: 'dashboard-total-premium-v2', datePolicy: 'legacy-iso-prefix-v1', bucketPolicy: 'legacy-dayjs-tz-string-v1', sortPolicy: 'legacy-dayjs-week-label-v1', range: { from: null, to: null }, generatedAt: '2026-10-21T23:00:00Z', readStartedAt: '2026-10-21T22:59:59Z', dataAsOf: null, consistency: 'direct-read-no-snapshot', currency: 'CLP', requestId: 'test-reference' }
const center: DashboardCallCenterSummary = {
  totals: { managedRequests: 1, estimatedPremiumsCLP: 608013, averageTicketCLP: 608013 },
  byInsurance: ['DESGRAVAMEN', 'CESANTIA', 'AMBOS', 'UNKNOWN'].map((insurance, i) => ({ insurance: insurance as 'DESGRAVAMEN' | 'CESANTIA' | 'AMBOS' | 'UNKNOWN', managedRequests: i === 0 ? 1 : 0, estimatedPremiumsCLP: i === 0 ? 608013 : 0, averageTicketCLP: i === 0 ? 608013 : 0, sharePct: i === 0 ? 99.9 : 0 })), meta,
}
describe('Dashboard aggregate contract', () => {
  test('dates remain YYYY-MM-DD and clearing omits both', () => {
    expect(dashboardQueryString('summary', { from: '2026-10-01', to: '2026-10-21' })).toBe('?from=2026-10-01&to=2026-10-21')
    expect(dashboardQueryString('summary', { from: '', to: '' })).toBe('')
  })
  test('supports each open range', () => {
    expect(dashboardQueryString('summary', { from: '2026-10-01' })).toBe('?from=2026-10-01')
    expect(dashboardQueryString('summary', { to: '2026-10-21' })).toBe('?to=2026-10-21')
  })
  test('granularity is only sent for series', () => {
    expect(dashboardQueryString('status-distribution', {}, 'month')).toBe('')
    expect(dashboardQueryString('call-center-summary', {}, 'week')).toBe('')
    expect(dashboardQueryString('payments-timeseries', {}, 'week')).toBe('?granularity=week')
  })
  test('session, endpoint, range and aggregation isolate series cache', () => {
    const key = dashboardQueryKey('one', 'requests-timeseries', { from: '2026-10-01' }, 'day')
    expect(key).not.toEqual(dashboardQueryKey('two', 'requests-timeseries', { from: '2026-10-01' }, 'day'))
    expect(key).not.toEqual(dashboardQueryKey('one', 'requests-timeseries', { from: '2026-10-01' }, 'week'))
    expect(key).not.toEqual(dashboardQueryKey('one', 'requests-timeseries', { from: '2026-10-02' }, 'day'))
    expect(key).not.toEqual(dashboardQueryKey('one', 'call-center-timeseries', { from: '2026-10-01' }, 'day'))
    expect(dashboardQueryKey('one', 'summary', {}, 'day')).toEqual(dashboardQueryKey('one', 'summary', {}, 'month'))
  })
  test('presents backend prima total, ticket and share without recomputing', () => {
    validateDashboardResponse('call-center-summary', center)
    expect(adaptInsuranceGroups(center)[0]).toMatchObject({ premiums: 608013, ticket: 608013, sharePct: 99.9 })
  })
  test('preserves weekly labels and inherited order across years', () => {
    const data = { granularity: 'week' as const, totalManagedRequests: 3, series: [{ bucket: '2021-W01', count: 1 }, { bucket: '2021-W53', count: 2 }], meta }
    expect(adaptCountSeries(data)).toEqual([{ bucket: '2021-W01', value: 1 }, { bucket: '2021-W53', value: 2 }])
  })
  test('preserves payment fallback amount and out-of-range bucket as delivered', () => {
    expect(adaptPaymentSeries({ granularity: 'day', totalAmountCLP: 50000, series: [{ bucket: '2026-10-25', amountCLP: 50000 }], dataQuality: { missingUpdatedAtRequests: 0, estimatedFallbackRequests: 1 }, meta: { ...meta, range: { from: '2026-10-20', to: '2026-10-20' } } })).toEqual([{ bucket: '2026-10-25', monto: 50000 }])
  })
  test('incomplete successful response throws rather than turning into zero', () => {
    expect(() => validateDashboardResponse('summary', { totals: {}, meta })).toThrow(DashboardApiError)
  })
  test('valid empty series remains a success', () => {
    expect(() => validateDashboardResponse('requests-timeseries', { granularity: 'day', totalRequests: 0, series: [], meta })).not.toThrow()
  })
  test('client requests the documented path with signal and Accept', async () => {
    const signal = new AbortController().signal
    let seen: unknown[] = []
    const api = createDashboardClient({ apiBaseUrl: 'https://example.test/api/v1', fetchAuthenticated: async (...args) => { seen = args; return Response.json(center) } })
    expect(await api.get('call-center-summary', { from: '2026-10-21' }, signal)).toEqual(center)
    expect(seen).toEqual(['/backoffice-dashboard/call-center-summary?from=2026-10-21', { method: 'GET', headers: { Accept: 'application/json' }, signal }, 'https://example.test/api/v1'])
  })
  test('non-JSON service errors preserve status', async () => {
    const api = createDashboardClient({ apiBaseUrl: 'https://example.test/api/v1', fetchAuthenticated: async () => new Response('Unavailable', { status: 503 }) })
    await expect(api.get('summary', {})).rejects.toMatchObject({ status: 503, code: 'HTTP_503' })
  })
  test('server error retains requestId and Retry-After', async () => {
    const api = createDashboardClient({ apiBaseUrl: 'https://example.test/api/v1', fetchAuthenticated: async () => Response.json({ error: { code: 'LIMIT', message: 'wait', requestId: 'diagnostic-42' } }, { status: 429, headers: { 'Retry-After': '5' } }) })
    await expect(api.get('summary', {})).rejects.toMatchObject({ status: 429, requestId: 'diagnostic-42', retryAfterMs: 5000 })
  })
  test('missing configuration does not call network', async () => {
    let calls = 0
    const api = createDashboardClient({ fetchAuthenticated: async () => { calls++; return Response.json({}) } })
    await expect(api.get('summary', {})).rejects.toMatchObject({ code: 'MISSING_API_URL' })
    expect(calls).toBe(0)
  })
})