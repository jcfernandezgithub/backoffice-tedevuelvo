import { useQuery } from '@tanstack/react-query'
import { refundAdminApi } from '@/services/refundAdminApi'
import type { PendingRefund } from '../types'
import type { RefundRequest } from '@/types/refund'

function getRealAmount(refund: RefundRequest): number {
  const entry = refund.statusHistory
    ?.slice()
    .reverse()
    .find((e) => {
      const to = String(e.to).toLowerCase()
      return (to === 'submitted' || to === 'payment_scheduled' || to === 'paid') && e.realAmount
    })
  const fromHistory = Number(entry?.realAmount ?? 0)
  if (fromHistory > 0) return fromHistory
  // Fallback para solicitudes en "Ingresada" que aún no tienen realAmount
  return Number((refund as any).estimatedAmountCLP ?? 0)
}

export function usePendingRefunds() {
  return useQuery<PendingRefund[]>({
    queryKey: ['conciliacion', 'pending-refunds'],
    queryFn: async () => {
      // El endpoint /admin/search limita a 100 por página: paginamos en paralelo.
      const PAGE_SIZE = 100
      const first = await refundAdminApi.search({
        status: 'submitted',
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
              status: 'submitted',
              limit: PAGE_SIZE,
              page: i + 2,
              sort: 'recent',
            }),
          ),
        )
        allItems = allItems.concat(...rest.map((r) => r.items ?? []))
      }
      return allItems.map((r) => {
        const realAmount = getRealAmount(r)
        const estimatedAmount = Number((r as any).estimatedAmountCLP ?? 0)
        // El estado de conciliación vive en el backend por movimiento;
        // este hook solo expone el saldo total a asignar.
        const reconciledAmount = 0
        const remainingAmount = Math.max(0, realAmount - reconciledAmount)
        const nroCredito = String((r as any)?.calculationSnapshot?.nroCredito ?? '').trim()
        const snap = (r as any)?.calculationSnapshot ?? {}
        const newMonthlyPremium = Number(snap?.newMonthlyPremium ?? 0)
        const confirmedRemainingInstallments = Number(
          snap?.confirmedRemainingInstallments ?? snap?.remainingInstallments ?? 0,
        )
        return {
          id: r.id,
          publicId: r.publicId,
          fullName: r.fullName,
          rut: r.rut,
          realAmount,
          estimatedAmount,
          reconciledAmount,
          remainingAmount,
          isFullyReconciled: realAmount > 0 && remainingAmount <= 0.5,
          scheduledAt: r.updatedAt,
          nroCredito,
          newMonthlyPremium,
          confirmedRemainingInstallments,
        } as PendingRefund
      })
    },
    staleTime: 30_000,
  })
}