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

const PAGE_SIZE = 100
const CACHE_TTL_MS = 30 * 1000 // 30 segundos

// Caché simple para evitar múltiples llamadas paralelas
let refundsCache: {
  data: RefundRequest[] | null
  timestamp: number
  promise: Promise<RefundRequest[]> | null
} = {
  data: null,
  timestamp: 0,
  promise: null
}

// Función helper para obtener todos los refunds con paginación paralela y caché
async function fetchAllRefunds(): Promise<RefundRequest[]> {
  const now = Date.now()
  
  // Si hay datos en caché y no han expirado, retornarlos
  if (refundsCache.data && (now - refundsCache.timestamp) < CACHE_TTL_MS) {
    console.log('[DashboardService] Usando datos en caché')
    return refundsCache.data
  }
  
  // Si ya hay una promesa en curso, esperar por ella (evita llamadas duplicadas)
  if (refundsCache.promise) {
    console.log('[DashboardService] Esperando promesa existente')
    return refundsCache.promise
  }
  
  // Crear nueva promesa de fetch
  refundsCache.promise = (async () => {
    try {
      // Primera llamada para obtener el total
      const firstPage = await refundAdminApi.list({ pageSize: PAGE_SIZE, page: 1 })
      const total = firstPage.total || 0
      const totalPages = Math.ceil(total / PAGE_SIZE)
      
      console.log(`[DashboardService] Total registros: ${total}, Páginas: ${totalPages}`)
      
      let allItems = [...(firstPage.items || [])]
      
      // Si hay más páginas, obtenerlas en paralelo (en batches para no saturar)
      if (totalPages > 1) {
        const BATCH_SIZE = 10
        for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages)
          const pagePromises = []
          
          for (let page = batchStart; page <= batchEnd; page++) {
            pagePromises.push(refundAdminApi.list({ pageSize: PAGE_SIZE, page }))
          }
          
          const batchResults = await Promise.all(pagePromises)
          batchResults.forEach(pageResult => {
            allItems = allItems.concat(pageResult.items || [])
          })
        }
      }
      
      // Normalizar status a minúsculas
      const normalizedItems = allItems.map(r => ({
        ...r,
        status: (r.status?.toLowerCase() || r.status) as RefundStatus
      }))
      
      // Guardar en caché
      refundsCache.data = normalizedItems
      refundsCache.timestamp = Date.now()
      
      return normalizedItems
    } finally {
      // Limpiar la promesa para permitir futuras llamadas
      refundsCache.promise = null
    }
  })()
  
  return refundsCache.promise
}

// Función para invalidar el caché manualmente si es necesario
export function invalidateDashboardCache() {
  refundsCache.data = null
  refundsCache.timestamp = 0
  refundsCache.promise = null
}

// Mapeo de estados de refunds a estados del dashboard
const statusToDashboardState = (status: RefundStatus): string => {
  switch (status) {
    case 'datos_sin_simulacion':
      return 'DATOS_SIN_SIMULACION'
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

// Filtrar por fecha de creación LOCAL (mismo criterio que List.tsx)
function filterByLocalDate(refunds: RefundRequest[], desde?: string, hasta?: string): RefundRequest[] {
  if (!desde && !hasta) return refunds
  
  const parseLocalStart = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, (m as number) - 1, d as number, 0, 0, 0, 0)
  }
  const parseLocalEnd = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, (m as number) - 1, d as number, 23, 59, 59, 999)
  }

  return refunds.filter(r => {
    if (!r.createdAt) return true
    
    const createdAt = new Date(r.createdAt)
    const createdLocalDay = new Date(
      createdAt.getFullYear(),
      createdAt.getMonth(),
      createdAt.getDate(),
      0, 0, 0, 0
    )

    if (desde) {
      const fromStart = parseLocalStart(desde)
      if (createdLocalDay < fromStart) return false
    }
    if (hasta) {
      const toEnd = parseLocalEnd(hasta)
      if (createdLocalDay > toEnd) return false
    }
    return true
  })
}

export const dashboardService = {
  async getSolicitudesPorEstado(desde?: string, hasta?: string) {
    try {
      // Obtener todas las solicitudes con paginación paralela
      const refunds = await fetchAllRefunds()

      // Aplicar filtro de fecha LOCAL (mismo criterio que List.tsx)
      const filteredRefunds = filterByLocalDate(refunds as RefundRequest[], desde, hasta)

      // Contar por estado mapeado
      const counts: Record<string, number> = {
        DATOS_SIN_SIMULACION: 0,
        SIMULACION_CONFIRMADA: 0,
        EN_PROCESO: 0,
        DEVOLUCION_CONFIRMADA_COMPANIA: 0,
        FONDOS_RECIBIDOS_TD: 0,
        CLIENTE_NOTIFICADO: 0,
        PAGADA_CLIENTE: 0,
        RECHAZADO: 0,
        OTRO: 0,
      }

      for (const refund of filteredRefunds) {
        const estado = statusToDashboardState(refund.status)
        counts[estado] = (counts[estado] ?? 0) + 1
      }

      return counts
    } catch (error) {
      console.error('Error obteniendo solicitudes:', error)
      return {
        DATOS_SIN_SIMULACION: 0,
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
      // Obtener todas las solicitudes con paginación paralela
      const refunds = await fetchAllRefunds()

      // Aplicar filtro de fecha LOCAL
      const filteredRefunds = filterByLocalDate(refunds, desde, hasta)

      // Filtrar solo las que están en estado paid
      const paidRefunds = filteredRefunds.filter(
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
      // Obtener todas las solicitudes con paginación paralela
      const allRefunds = await fetchAllRefunds()

      // Aplicar filtro de fecha LOCAL
      const refunds = filterByLocalDate(allRefunds, desde, hasta)

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

  async getSolicitudesParaMandato(desde?: string, hasta?: string): Promise<string[]> {
    try {
      // Obtener todas las solicitudes con paginación paralela
      const refunds = await fetchAllRefunds()
      const filteredRefunds = filterByLocalDate(refunds, desde, hasta)

      // Retornar TODOS los publicIds del período para verificar mandatos
      // El mandato puede estar firmado en cualquier estado
      return filteredRefunds.map(r => r.publicId)
    } catch (error) {
      console.error('Error obteniendo solicitudes para mandato:', error)
      return []
    }
  },

  async getTotalPaidAmount(desde?: string, hasta?: string): Promise<number> {
    try {
      // Obtener todas las solicitudes con paginación paralela
      const refunds = await fetchAllRefunds()
      
      // Aplicar filtro de fecha LOCAL
      const filteredRefunds = filterByLocalDate(refunds, desde, hasta)
      
      // Filtrar solo las que están en estado paid
      const paidRefunds = filteredRefunds.filter(
        refund => refund.status === 'paid'
      )
      
      console.log(`[DashboardService] Refunds pagados en período: ${paidRefunds.length}`)
      
      // Sumar realAmount de statusHistory
      return paidRefunds.reduce((sum: number, refund: any) => {
        const realAmountEntry = refund.statusHistory?.slice().reverse().find(
          (entry: any) => {
            const toStatus = entry.to?.toLowerCase()
            return (toStatus === 'payment_scheduled' || toStatus === 'paid') && entry.realAmount
          }
        )
        return sum + (realAmountEntry?.realAmount || 0)
      }, 0)
    } catch (error) {
      console.error('Error calculando monto total pagado:', error)
      return 0
    }
  },
}
