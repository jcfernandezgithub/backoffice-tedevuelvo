type HistoryEntry = { from?: string; to?: string; at?: string }
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