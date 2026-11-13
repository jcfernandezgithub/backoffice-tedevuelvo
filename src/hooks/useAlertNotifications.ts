import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/state/AuthContext'
import { alertsAccess, alertsScope } from '@/lib/operationalAlerts'
import { alertNotificationCount, assignedNotificationFilters, pendingNotificationFilters } from '@/lib/alertNotifications'
import { operationalAlertsApi as api, AlertsApiError } from '@/services/operationalAlertsApi'
import { configuredApiBaseUrl } from '@/services/apiConfig'

export function useAlertNotifications() {
  const { user } = useAuth()
  const allowed = alertsAccess(user).allowed
  const scope = alertsScope(user)
  const options = {
    enabled: allowed,
    retry: false as const,
    staleTime: 60_000,
    gcTime: 0,
    refetchInterval: (query: { state: { error: Error | null } }) => {
      const error = query.state.error
      if (error instanceof AlertsApiError) {
        if ([401, 403].includes(error.status)) return false
        return Math.max(60_000, error.retryAfterMs)
      }
      return 60_000
    },
    refetchIntervalInBackground: false,
  }
  const pending = useQuery({
    ...options,
    queryKey: ['operational-alerts', scope, 'notifications', configuredApiBaseUrl, 'pending'],
    queryFn: ({ signal }) => api.summary(pendingNotificationFilters, signal),
  })
  const assigned = useQuery({
    ...options,
    enabled: allowed && Boolean(user?.id),
    queryKey: ['operational-alerts', scope, 'notifications', configuredApiBaseUrl, 'assigned'],
    queryFn: ({ signal }) => api.summary(assignedNotificationFilters(user?.id ?? ''), signal),
  })
  // A failed refresh is unknown, never a valid empty result or an old badge.
  const pendingData = pending.isError ? undefined : pending.data
  const assignedData = assigned.isError ? undefined : assigned.data
  return { allowed, pending, assigned,
    pendingCount: pendingData?.totals.pending ?? 0,
    assignedCount: assignedData?.totals.inReview ?? 0,
    count: allowed ? alertNotificationCount(pendingData, assignedData) : 0,
  }
}