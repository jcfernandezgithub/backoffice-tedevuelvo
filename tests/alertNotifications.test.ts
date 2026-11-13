import { describe, expect, test } from 'bun:test'
import { alertNotificationCount, assignedNotificationFilters, pendingNotificationFilters, notificationViewFilters, alertNotificationLink } from '../src/lib/alertNotifications'
import { createAlertsClient, type AlertSummary } from '../src/services/operationalAlertsApi'

function summary(pending: number, inReview: number, resolved = 0): AlertSummary {
  return { totals: { pending, inReview, resolved, open: pending + inReview }, globalOpenCount: 999,
    byPriority: { HIGH: 0, MEDIUM: 0, LOW: 0 }, byRule: [],
    meta: { schemaVersion: '1.0', snapshotToken: 'cut', evaluationStatus: 'READY', stale: false, page: 1, limit: 25, total: 0, totalPages: 0 } }
}
describe('Alert bell rules', () => {
  test('counts pending and my in-review cases once, never resolved or other assigned cases', () => {
    expect(alertNotificationCount(summary(3, 90, 8), summary(1, 2, 6))).toBe(5)
    expect(alertNotificationCount()).toBe(0)
  })
  test('assigned summaries query only the current identity; pending summaries have no situation filter', async () => {
    const urls: string[] = []
    const api = createAlertsClient(async path => { urls.push(path); return Response.json(summary(3, 2)) }, 'https://example.test')
    await api.summary(pendingNotificationFilters)
    await api.summary(assignedNotificationFilters('current-user'))
    expect(urls[0]).toBe('/backoffice-alerts/summary')
    expect(urls[1]).toBe('/backoffice-alerts/summary?assigneeId=current-user')
  })
  test('bell links open matching review state without hiding inactive or uncertain assigned cases', () => {
    expect(notificationViewFilters('pending')).toEqual({ status: 'PENDING', sort: 'PRIORITY_DESC' })
    expect(notificationViewFilters('assigned', 'me')).toEqual({ assigneeId: 'me', status: 'IN_REVIEW', sort: 'PRIORITY_DESC' })
    expect(notificationViewFilters('assigned')).toBeNull()
    expect(alertNotificationLink('assigned')).toBe('/operacion?tab=alertas&alertView=assigned')
  })
})