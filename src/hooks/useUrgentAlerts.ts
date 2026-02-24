import { useMemo } from 'react'
import { useAllRefunds } from '@/pages/Operacion/hooks/useAllRefunds'

/**
 * Alertas urgentes: cuenta GLOBAL (sin filtro de fecha) de solicitudes
 * en estados que requieren acción inmediata.
 * 
 * Reutiliza el caché compartido useAllRefunds — sin fetch adicional.
 */
export function useUrgentAlerts() {
  const { data: allRefunds = [], isLoading } = useAllRefunds()

  const counts = useMemo(() => {
    const docsReceived = allRefunds.filter((r: any) => r.status === 'docs_received').length
    const paymentWithBank = allRefunds.filter(
      (r: any) => r.status === 'payment_scheduled' && r.bankInfo
    ).length

    return {
      docsReceived,
      paymentWithBank,
      total: docsReceived + paymentWithBank,
    }
  }, [allRefunds])

  return {
    urgentCount: counts.total,
    docsReceived: counts.docsReceived,
    paymentWithBank: counts.paymentWithBank,
    isLoading,
  }
}
