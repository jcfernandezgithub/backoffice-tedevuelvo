type HistoryEntry = { from?: string | null; to?: string; at?: string }
type ManagedRefund = { status?: string; statusHistory?: HistoryEntry[] }

/** Earliest real DOCS_RECEIVED transition across the complete history. */
export function firstCallCenterManagementDate(refund: ManagedRefund): string | undefined {
  if (refund.status?.toLowerCase() === 'canceled') return undefined
  let first: HistoryEntry | undefined
  let firstTime = Infinity
  for (const entry of refund.statusHistory ?? []) {
    if (entry.to?.toLowerCase() !== 'docs_received') continue
    if (entry.from?.toLowerCase() === 'docs_received' || !entry.at) continue
    const time = Date.parse(entry.at)
    if (!Number.isFinite(time) || time >= firstTime) continue
    first = entry
    firstTime = time
  }
  return first?.at?.split('T')[0]
}

export function firstManagedRefunds<T extends ManagedRefund>(refunds: T[], from?: string, to?: string): T[] {
  return refunds.filter(refund => {
    const date = firstCallCenterManagementDate(refund)
    return Boolean(date && (!from || date >= from) && (!to || date <= to))
  })
}

type InsuranceSnapshot = {
  insuranceToEvaluate?: string; insuranceType?: string; tipoSeguro?: string
  newMonthlyPremium?: number; remainingInstallments?: number
}
export function callCenterInsuranceBreakdown(refunds: { calculationSnapshot?: InsuranceSnapshot }[]) {
  const groups = [
    { key: 'desgravamen', label: 'Desgravamen', count: 0, premiums: 0, ticket: 0 },
    { key: 'cesantia', label: 'Cesantía', count: 0, premiums: 0, ticket: 0 },
    { key: 'ambos', label: 'Ambos seguros', count: 0, premiums: 0, ticket: 0 },
    { key: 'unknown', label: 'Sin tipo confirmado', count: 0, premiums: 0, ticket: 0 },
  ]
  for (const refund of refunds) {
    const snap = refund.calculationSnapshot ?? {}
    const type = String(snap.insuranceToEvaluate || snap.insuranceType || snap.tipoSeguro || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const mixed = type.includes('ambos') || type.includes('both') || (type.includes('desgrav') && type.includes('cesant'))
    const key = mixed ? 'ambos' : type.includes('cesant') ? 'cesantia' : type.includes('desgrav') ? 'desgravamen' : 'unknown'
    const group = groups.find(item => item.key === key)
    if (!group) continue
    group.count++
    group.premiums += (snap.newMonthlyPremium || 0) * (snap.remainingInstallments || 0)
  }
  return groups.map(group => ({ ...group, ticket: group.count ? Math.round(group.premiums / group.count) : 0 }))
}