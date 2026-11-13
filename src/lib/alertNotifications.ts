import type { AlertFilters, AlertSummary } from '@/services/operationalAlertsApi'

export const pendingNotificationFilters: AlertFilters = {}
export function assignedNotificationFilters(userId: string): AlertFilters {
  return { assigneeId: userId }
}
// Assigned pending cases are already included in the general pending count.
export function alertNotificationCount(pending?: AlertSummary, assigned?: AlertSummary) {
  return (pending?.totals.pending ?? 0) + (assigned?.totals.inReview ?? 0)
}
export function alertNotificationLink(view: 'pending' | 'assigned') {
  return `/operacion?tab=alertas&alertView=${view}`
}
export function notificationViewFilters(view: string | null, userId?: string): AlertFilters | null {
  if (view === 'pending') return { status: 'PENDING', sort: 'PRIORITY_DESC' }
  if (view === 'assigned' && userId) return { assigneeId: userId, status: 'IN_REVIEW', sort: 'PRIORITY_DESC' }
  return null
}