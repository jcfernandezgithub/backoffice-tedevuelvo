import { describe, expect, test } from 'bun:test'
import { firstCallCenterManagementDate, firstManagedRefunds } from '../src/lib/callCenterMetrics'

const transition = (at: string, from = 'docs_pending') => ({ from, to: 'DOCS_RECEIVED', at })
describe('Call Center: solo primera gestión histórica', () => {
  test('excluye una re-gestión de octubre si se gestionó en septiembre', () => {
    const refund = { statusHistory: [transition('2026-10-20T12:00:00'), transition('2026-09-15T12:00:00')] }
    expect(firstManagedRefunds([refund], '2026-10-01', '2026-10-20')).toEqual([])
    expect(firstCallCenterManagementDate(refund)).toBe('2026-09-15')
  })
  test('cuenta una sola vez en el mes y no vuelve a contar en el día de re-gestión', () => {
    const refund = { statusHistory: [transition('2026-10-20T12:00:00'), transition('2026-10-02T12:00:00')] }
    expect(firstManagedRefunds([refund], '2026-10-01', '2026-10-20')).toHaveLength(1)
    expect(firstManagedRefunds([refund], '2026-10-20', '2026-10-20')).toHaveLength(0)
  })
  test('ignora auto-transiciones y fechas inválidas', () => {
    const refund = { statusHistory: [transition('2026-09-01T12:00:00', 'DOCS_RECEIVED'), transition('invalid'), transition('2026-10-20T12:00:00')] }
    expect(firstCallCenterManagementDate(refund)).toBe('2026-10-20')
  })
  test('excluye canceladas y solicitudes sin gestión', () => {
    expect(firstManagedRefunds([{ status: 'CANCELED', statusHistory: [transition('2026-10-20')] }, { statusHistory: [] }])).toEqual([])
  })
  test('primas y ticket usan solamente el universo de primeras gestiones', () => {
    const refunds = [
      { statusHistory: [transition('2026-10-20')], calculationSnapshot: { newMonthlyPremium: 10000, remainingInstallments: 12 } },
      { statusHistory: [transition('2026-09-01'), transition('2026-10-20')], calculationSnapshot: { newMonthlyPremium: 20000, remainingInstallments: 10 } },
    ]
    const selected = firstManagedRefunds(refunds, '2026-10-01', '2026-10-20')
    const premium = selected.reduce((sum, r) => sum + r.calculationSnapshot.newMonthlyPremium * r.calculationSnapshot.remainingInstallments, 0)
    expect(premium).toBe(120000)
    expect(premium / selected.length).toBe(120000)
  })
})