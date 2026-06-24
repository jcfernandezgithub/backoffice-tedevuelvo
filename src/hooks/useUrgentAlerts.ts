import { useMemo } from 'react'
import dayjs from 'dayjs'
import { useAllRefunds } from '@/pages/Operacion/hooks/useAllRefunds'

/**
 * Alertas urgentes: cuenta de solicitudes del MES ACTUAL en estados que requieren
 * acción inmediata. Reutiliza el caché compartido useAllRefunds — usa el mismo
 * rango de fechas que las primeras cargas de Dashboard y Operación (sin pedirle
 * al backend traer el histórico completo).
 */
export function useUrgentAlerts() {
  const since = useMemo(() => dayjs().startOf('month').format('YYYY-MM-DD'), [])
  const to = useMemo(() => dayjs().format('YYYY-MM-DD'), [])
  const { data: allRefunds = [], isLoading } = useAllRefunds({ since, to })

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
