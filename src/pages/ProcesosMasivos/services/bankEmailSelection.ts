import { refundAdminApi } from '@/services/refundAdminApi'
import type { RefundRequest } from '@/types/refund'
import { bankEmailEligibility } from './bankEmailBatchService'

// Read every filtered page before committing a selection; never send emails here.
export async function loadAllBankEmailRecipients(search: string, signal: AbortSignal): Promise<Map<string, RefundRequest>> {
  const selected = new Map<string, RefundRequest>()
  let page = 1
  while (true) {
    signal.throwIfAborted()
    const response = await refundAdminApi.search({ status: 'payment_scheduled', page, limit: 25, q: search || undefined }, signal)
    signal.throwIfAborted()
    for (const row of response.items) {
      if (!bankEmailEligibility(row)) selected.set(row.id, row)
    }
    const hasNext = response.hasNext ?? page < (response.totalPages ?? Math.ceil(response.total / response.pageSize))
    if (!hasNext) return selected
    if (!response.items.length) throw new Error('No fue posible cargar todas las solicitudes. Actualiza la lista y vuelve a intentar.')
    page += 1
  }
}