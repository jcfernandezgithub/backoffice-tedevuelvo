import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/state/AuthContext'
import { authenticatedFetch } from '@/services/apiClient'
import { authService } from '@/services/authService'
import { configuredApiBaseUrl } from '@/services/apiConfig'
import { createDashboardClient, DashboardApiError, dashboardQueryKey, type DashboardChart, type DashboardEndpoint, type DashboardGranularity, type DashboardRange } from '@/services/backofficeDashboardApi'

const api = createDashboardClient({ apiBaseUrl: configuredApiBaseUrl, fetchAuthenticated: authenticatedFetch })

export function useBackofficeDashboard(range: DashboardRange, granularity: DashboardGranularity, activeChart: DashboardChart, enabled = true) {
  const { user } = useAuth()
  const client = useQueryClient()
  const scope = user ? JSON.stringify([user.id, user.email, user.rol, [...(user.pages ?? [])].sort(), user.activo]) : null
  const [denial, setDenial] = useState<{ scope: string | null; error: DashboardApiError } | null>(null)
  const savedAccessError = denial?.scope === scope ? denial.error : null
  const allowed = Boolean(user?.activo && user.pages?.includes('DASHBOARD') && user.email.toLowerCase() !== 'admin@callcenter.cl' && !['ALIANZAS', 'CALLCENTER'].includes(user.rol) && !savedAccessError)
  const shared = {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: (count: number, error: Error) => count < 1 && (error instanceof DashboardApiError ? error.status === 503 : error instanceof TypeError),
    retryDelay: 1500,
  }
  const options = <E extends DashboardEndpoint>(endpoint: E, chartEnabled: boolean) => ({
    ...shared, queryKey: dashboardQueryKey(scope, endpoint, range, granularity), enabled: allowed && enabled && chartEnabled,
    queryFn: ({ signal }: { signal: AbortSignal }) => {
      if (!authService.getAccessToken()) throw new DashboardApiError(401, 'INVALID_OR_MISSING_TOKEN', 'Tu sesión no está disponible. Vuelve a iniciar sesión.')
      return api.get(endpoint, range, signal, granularity)
    },
  })
  const summary = useQuery(options('summary', true))
  const callCenter = useQuery(options('call-center-summary', true))
  const requests = useQuery(options('requests-timeseries', activeChart === 'solicitudes'))
  const managed = useQuery(options('call-center-timeseries', activeChart === 'callcenter'))
  const payments = useQuery(options('payments-timeseries', activeChart === 'pagos'))
  const distribution = useQuery(options('status-distribution', activeChart === 'distribucion'))
  const deniedError = [summary.error, callCenter.error, requests.error, managed.error, payments.error, distribution.error].find(error => error instanceof DashboardApiError && [401, 403].includes(error.status))
  const accessError = deniedError instanceof DashboardApiError ? deniedError : savedAccessError
  useEffect(() => {
    if (!(deniedError instanceof DashboardApiError)) return
    setDenial({ scope, error: deniedError })
    void client.cancelQueries({ queryKey: ['backoffice-dashboard'] }).then(() => client.removeQueries({ queryKey: ['backoffice-dashboard'] }))
  }, [deniedError, scope, client])

  // Summary cancellation depends only on range/scope, never chart or granularity.
  useEffect(() => {
    const keys = [dashboardQueryKey(scope, 'summary', range), dashboardQueryKey(scope, 'call-center-summary', range)]
    return () => { keys.forEach(queryKey => { void client.cancelQueries({ queryKey, exact: true }) }) }
  }, [client, scope, range.from, range.to])
  const chartEndpoint = activeChart === 'solicitudes' ? 'requests-timeseries' : activeChart === 'callcenter' ? 'call-center-timeseries' : activeChart === 'pagos' ? 'payments-timeseries' : 'status-distribution'
  const chartGranularity = activeChart === 'distribucion' ? undefined : granularity
  useEffect(() => {
    const queryKey = dashboardQueryKey(scope, chartEndpoint, range, chartGranularity)
    return () => { void client.cancelQueries({ queryKey, exact: true }) }
  }, [client, scope, range.from, range.to, chartGranularity, chartEndpoint])

  return { summary, callCenter, requests, managed, payments, distribution, accessError, allowed: allowed && !accessError,
    refresh: () => client.invalidateQueries({ queryKey: ['backoffice-dashboard', '1.0', scope] }) }
}