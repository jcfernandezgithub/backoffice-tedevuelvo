import { useQuery } from '@tanstack/react-query'
import { refundAdminApi } from '@/services/refundAdminApi'

export function useUrgentAlerts() {
  const { data, isLoading } = useQuery({
    queryKey: ['urgent-alerts'],
    queryFn: async () => {
      const PAGE_SIZE = 100
      const firstPage = await refundAdminApi.list({ pageSize: PAGE_SIZE, page: 1 })
      const total = firstPage.total || 0
      const totalPages = Math.ceil(total / PAGE_SIZE)

      let allItems = [...(firstPage.items || [])]

      if (totalPages > 1) {
        const pagePromises = []
        for (let page = 2; page <= totalPages; page++) {
          pagePromises.push(refundAdminApi.list({ pageSize: PAGE_SIZE, page }))
        }
        const additionalPages = await Promise.all(pagePromises)
        additionalPages.forEach(r => { allItems = allItems.concat(r.items || []) })
      }

      const normalized = allItems.map((r: any) => ({
        ...r,
        status: r.status?.toLowerCase?.() || r.status,
      }))

      const docsReceived = normalized.filter((r: any) => r.status === 'docs_received').length
      const paymentWithBank = normalized.filter(
        (r: any) => r.status === 'payment_scheduled' && r.bankInfo
      ).length

      return { docsReceived, paymentWithBank, total: docsReceived + paymentWithBank }
    },
    staleTime: 60 * 1000, // 1 minuto
    refetchInterval: 2 * 60 * 1000, // refresca cada 2 minutos
  })

  return {
    urgentCount: data?.total ?? 0,
    docsReceived: data?.docsReceived ?? 0,
    paymentWithBank: data?.paymentWithBank ?? 0,
    isLoading,
  }
}
