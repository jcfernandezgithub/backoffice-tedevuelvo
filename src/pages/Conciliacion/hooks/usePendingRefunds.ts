import { useQuery } from '@tanstack/react-query'
import { refundAdminApi } from '@/services/refundAdminApi'
import { conciliacionService } from '../services/conciliacionService'
import type { PendingRefund } from '../types'
import type { RefundRequest } from '@/types/refund'

function getRealAmount(refund: RefundRequest): number {
  const entry = refund.statusHistory
    ?.slice()
    .reverse()
    .find((e) => {
      const to = String(e.to).toLowerCase()
      return (to === 'payment_scheduled' || to === 'paid') && e.realAmount
    })
  return Number(entry?.realAmount ?? 0)
}

export function usePendingRefunds() {
  return useQuery<PendingRefund[]>({
    queryKey: ['conciliacion', 'pending-refunds'],
    queryFn: async () => {
      // El endpoint /admin/search limita a 100 por página: paginamos en paralelo.
      const PAGE_SIZE = 100
      const first = await refundAdminApi.search({
        status: 'payment_scheduled',
        limit: PAGE_SIZE,
        page: 1,
        sort: 'recent',
      })
      const totalPages = first.totalPages ?? 1
      let allItems = first.items ?? []
      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            refundAdminApi.search({
              status: 'payment_scheduled',
              limit: PAGE_SIZE,
              page: i + 2,
              sort: 'recent',
            }),
          ),
        )
        allItems = allItems.concat(...rest.map((r) => r.items ?? []))
      }
      const links = conciliacionService.listLinks()
      return allItems.map((r) => {
        const realAmount = getRealAmount(r)
        const reconciledAmount = links
          .filter((l) => l.refundId === r.id)
          .reduce((s, l) => s + l.amountApplied, 0)
        const remainingAmount = Math.max(0, realAmount - reconciledAmount)
        return {
          id: r.id,
          publicId: r.publicId,
          fullName: r.fullName,
          rut: r.rut,
          realAmount,
          reconciledAmount,
          remainingAmount,
          isFullyReconciled: realAmount > 0 && remainingAmount <= 0.5,
          scheduledAt: r.updatedAt,
        } as PendingRefund
      })
    },
    staleTime: 30_000,
  })
}