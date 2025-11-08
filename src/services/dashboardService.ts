import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(isoWeek)
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('America/Santiago')

import { refundAdminApi } from './refundAdminApi'
import type { RefundRequest, RefundStatus } from '@/types/refund'

export type Aggregation = 'day' | 'week' | 'month'

// Mapeo de estados de refunds a estados del dashboard
const statusToDashboardState = (status: RefundStatus): string => {
  switch (status) {
    case 'simulated':
    case 'requested':
      return 'SIMULACION_CONFIRMADA'
    case 'qualifying':
    case 'docs_pending':
    case 'docs_received':
      return 'EN_PROCESO'
    case 'submitted':
      return 'DEVOLUCION_CONFIRMADA_COMPANIA'
    case 'approved':
      return 'FONDOS_RECIBIDOS_TD'
    case 'payment_scheduled':
      return 'CLIENTE_NOTIFICADO'
    case 'paid':
      return 'PAGADA_CLIENTE'
    case 'rejected':
    case 'canceled':
      return 'RECHAZADO'
    default:
      return 'OTRO'
  }
}

function inRange(fechaISO: string, desde?: string, hasta?: string) {
  const d = dayjs.tz(fechaISO)
  if (desde && d.isBefore(dayjs.tz(desde), 'day')) return false
  if (hasta && d.isAfter(dayjs.tz(hasta), 'day')) return false
  return true
}

export const dashboardService = {
  async getSolicitudesPorEstado(desde?: string, hasta?: string) {
    try {
      // Obtener todas las solicitudes del API
      const response = await refundAdminApi.list({
        from: desde,
        to: hasta,
        pageSize: 1000, // Obtener todas las solicitudes
      })

      const refunds = Array.isArray(response) ? response : response.items || []

      // Contar por estado mapeado
      const counts: Record<string, number> = {
        SIMULACION_CONFIRMADA: 0,
        EN_PROCESO: 0,
        DEVOLUCION_CONFIRMADA_COMPANIA: 0,
        FONDOS_RECIBIDOS_TD: 0,
        CLIENTE_NOTIFICADO: 0,
        PAGADA_CLIENTE: 0,
        RECHAZADO: 0,
        OTRO: 0,
      }

      for (const refund of refunds as RefundRequest[]) {
        const estado = statusToDashboardState(refund.status)
        counts[estado] = (counts[estado] ?? 0) + 1
      }

      return counts
    } catch (error) {
      console.error('Error obteniendo solicitudes:', error)
      return {
        SIMULACION_CONFIRMADA: 0,
        EN_PROCESO: 0,
        DEVOLUCION_CONFIRMADA_COMPANIA: 0,
        FONDOS_RECIBIDOS_TD: 0,
        CLIENTE_NOTIFICADO: 0,
        PAGADA_CLIENTE: 0,
        RECHAZADO: 0,
        OTRO: 0,
      }
    }
  },

  async getPagosClientes(desde?: string, hasta?: string) {
    try {
      // Obtener todas las solicitudes en el rango de fechas
      const response = await refundAdminApi.list({
        from: desde,
        to: hasta,
        pageSize: 1000,
      })

      const refunds = Array.isArray(response) ? response : response.items || []

      // Filtrar solo las que están en estado paid
      const paidRefunds = (refunds as RefundRequest[]).filter(
        refund => refund.status === 'paid'
      )

      // Transformar a estructura de pagos
      return paidRefunds.map(refund => ({
        fecha: dayjs.tz(refund.updatedAt).format('YYYY-MM-DD'),
        monto: refund.estimatedAmountCLP || 0,
      }))
    } catch (error) {
      console.error('Error obteniendo pagos:', error)
      return []
    }
  },

  async getPagosAggregate(desde?: string, hasta?: string, by: Aggregation = 'day') {
    const pagos = await this.getPagosClientes(desde, hasta)
    const map = new Map<string, number>()
    
    for (const p of pagos) {
      let key = p.fecha
      if (by === 'week') {
        const d = dayjs.tz(p.fecha)
        const week = String(d.isoWeek()).padStart(2, '0')
        key = `${d.year()}-W${week}`
      }
      if (by === 'month') key = dayjs.tz(p.fecha).format('YYYY-MM')
      map.set(key, (map.get(key) ?? 0) + p.monto)
    }
    
    const toDate = (bucket: string) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) return dayjs.tz(bucket)
      if (/^\d{4}-W\d{2}$/.test(bucket)) {
        const [y, w] = bucket.split('-W')
        return dayjs.tz(y).isoWeek(parseInt(w, 10)).startOf('week')
      }
      if (/^\d{4}-\d{2}$/.test(bucket)) return dayjs.tz(bucket + '-01')
      return dayjs.tz(bucket)
    }
    
    const out = [...map.entries()]
      .map(([k, v]) => ({ bucket: k, monto: v, sortKey: toDate(k).valueOf() }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ bucket, monto }) => ({ bucket, monto }))

    const total = pagos.reduce((acc, x) => acc + x.monto, 0)
    return { total, series: out }
  },

  async getSolicitudesAggregate(desde?: string, hasta?: string, by: Aggregation = 'day') {
    try {
      // Obtener todas las solicitudes en el rango de fechas
      const response = await refundAdminApi.list({
        from: desde,
        to: hasta,
        pageSize: 1000,
      })

      const refunds = Array.isArray(response) ? response : response.items || []

      // Agrupar por fecha de creación
      const map = new Map<string, number>()
      
      for (const refund of refunds as RefundRequest[]) {
        const fecha = dayjs.tz(refund.createdAt).format('YYYY-MM-DD')
        let key = fecha
        
        if (by === 'week') {
          const d = dayjs.tz(fecha)
          const week = String(d.isoWeek()).padStart(2, '0')
          key = `${d.year()}-W${week}`
        }
        if (by === 'month') {
          key = dayjs.tz(fecha).format('YYYY-MM')
        }
        
        map.set(key, (map.get(key) ?? 0) + 1)
      }
      
      const toDate = (bucket: string) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) return dayjs.tz(bucket)
        if (/^\d{4}-W\d{2}$/.test(bucket)) {
          const [y, w] = bucket.split('-W')
          return dayjs.tz(y).isoWeek(parseInt(w, 10)).startOf('week')
        }
        if (/^\d{4}-\d{2}$/.test(bucket)) return dayjs.tz(bucket + '-01')
        return dayjs.tz(bucket)
      }
      
      const series = [...map.entries()]
        .map(([k, v]) => ({ bucket: k, cantidad: v, sortKey: toDate(k).valueOf() }))
        .sort((a, b) => a.sortKey - b.sortKey)
        .map(({ bucket, cantidad }) => ({ bucket, cantidad }))

      const total = refunds.length
      return { total, series }
    } catch (error) {
      console.error('Error obteniendo solicitudes aggregate:', error)
      return { total: 0, series: [] }
    }
  },
}
