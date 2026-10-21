import { describe, expect, test } from 'bun:test'
import { firstCallCenterManagementDate, firstManagedRefunds, callCenterInsuranceBreakdown } from '../src/lib/callCenterMetrics'

const transition = (at: string, from = 'docs_pending') => ({ from, to: 'DOCS_RECEIVED', at })
describe('Call Center: solo primera gestión histórica', () => {
  test('desglosa los mismos conceptos por desgravamen y cesantía sin cambiar los totales', () => {
    const groups = callCenterInsuranceBreakdown([
      { calculationSnapshot: { tipoSeguro: 'DESGRAVAMEN', newMonthlyPremium: 1000, remainingInstallments: 12 } },
      { calculationSnapshot: { insuranceToEvaluate: 'Cesantía', newMonthlyPremium: 2000, remainingInstallments: 10 } },
    ])
    expect(groups[0]).toMatchObject({ count: 1, premiums: 12000, ticket: 12000 })
    expect(groups[1]).toMatchObject({ count: 1, premiums: 20000, ticket: 20000 })
    expect(groups.reduce((sum, g) => sum + g.premiums, 0)).toBe(32000)
  })
  test('ambos y sin tipo se conservan sin duplicación ni pérdida de primas', () => {
    const groups = callCenterInsuranceBreakdown([
      { calculationSnapshot: { tipoSeguro: 'AMBOS', newMonthlyPremium: 3000, remainingInstallments: 10 } },
      { calculationSnapshot: { newMonthlyPremium: 500, remainingInstallments: 2 } },
    ])
    expect(groups[2]).toMatchObject({ count: 1, premiums: 30000 })
    expect(groups[3]).toMatchObject({ count: 1, premiums: 1000 })
    expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(2)
    expect(groups.reduce((sum, g) => sum + g.premiums, 0)).toBe(31000)
  })
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