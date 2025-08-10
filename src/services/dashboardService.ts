import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(isoWeek)
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('America/Santiago')

import { dashboardDataMock } from '../mocks/dashboardData'
import type { PagoCliente } from '../mocks/dashboardData'

export type Aggregation = 'day' | 'week' | 'month'

function inRange(fechaISO: string, desde?: string, hasta?: string) {
  const d = dayjs.tz(fechaISO)
  if (desde && d.isBefore(dayjs.tz(desde), 'day')) return false
  if (hasta && d.isAfter(dayjs.tz(hasta), 'day')) return false
  return true
}

export const dashboardService = {
  async getSolicitudesPorEstado(desde?: string, hasta?: string) {
    const data = dashboardDataMock.solicitudes.filter((s) => inRange(s.fecha, desde, hasta))
    const counts: Record<string, number> = {
      SIMULACION_CONFIRMADA: 0,
      DEVOLUCION_CONFIRMADA_COMPANIA: 0,
      FONDOS_RECIBIDOS_TD: 0,
      CERTIFICADO_EMITIDO: 0,
      CLIENTE_NOTIFICADO: 0,
      PAGADA_CLIENTE: 0,
    }
    for (const s of data) counts[s.estado] = (counts[s.estado] ?? 0) + 1
    return Promise.resolve(counts)
  },

  async getPagosClientes(desde?: string, hasta?: string) {
    const pagos = dashboardDataMock.pagos.filter((p) => inRange(p.fecha, desde, hasta))
    return Promise.resolve(pagos)
  },

  async getPagosAggregate(desde?: string, hasta?: string, by: Aggregation = 'day') {
    const pagos = (await this.getPagosClientes(desde, hasta)) as PagoCliente[]
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
}
