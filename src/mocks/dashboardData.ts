import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('America/Santiago')

export type EstadoSolicitud =
  | 'SIMULACION_CONFIRMADA'
  | 'DEVOLUCION_CONFIRMADA_COMPANIA'
  | 'FONDOS_RECIBIDOS_TD'
  | 'CERTIFICADO_EMITIDO'
  | 'CLIENTE_NOTIFICADO'
  | 'PAGADA_CLIENTE'

export interface SolicitudLite {
  id: string
  estado: EstadoSolicitud
  fecha: string // ISO (yyyy-mm-dd)
}

export interface PagoCliente {
  fecha: string // ISO (yyyy-mm-dd)
  monto: number // CLP
}

// Util: PRNG deterministico (LCG)
function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return (s & 0xfffffff) / 0xfffffff
  }
}

const ESTADOS: EstadoSolicitud[] = [
  'SIMULACION_CONFIRMADA',
  'DEVOLUCION_CONFIRMADA_COMPANIA',
  'FONDOS_RECIBIDOS_TD',
  'CERTIFICADO_EMITIDO',
  'CLIENTE_NOTIFICADO',
  'PAGADA_CLIENTE',
]

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)]
}

// Genera días entre desde/hasta (inclusive) usando TZ America/Santiago
function daysBetween(desdeISO: string, hastaISO: string): string[] {
  const out: string[] = []
  let d = dayjs.tz(desdeISO)
  const end = dayjs.tz(hastaISO)
  while (d.isSame(end, 'day') || d.isBefore(end, 'day')) {
    out.push(d.format('YYYY-MM-DD'))
    d = d.add(1, 'day')
  }
  return out
}

export function buildDashboardMock(seed = 1337) {
  const rnd = seededRandom(seed)
  const hoy = dayjs().tz().format('YYYY-MM-DD')
  const desde = dayjs().tz().subtract(6, 'month').startOf('month').format('YYYY-MM-DD')
  const dias = daysBetween(desde, hoy)

  // Solicitudes: ~40–80 por semana repartidas por estado
  const solicitudes: SolicitudLite[] = []
  let idCounter = 1
  for (const dia of dias) {
    const base = 5 + Math.floor(rnd() * 20) // 5..24 por día
    for (let i = 0; i < base; i++) {
      // leve sesgo: más en estados tempranos
      const p = rnd()
      const estado: EstadoSolicitud =
        p < 0.28
          ? 'SIMULACION_CONFIRMADA'
          : p < 0.48
          ? 'DEVOLUCION_CONFIRMADA_COMPANIA'
          : p < 0.65
          ? 'FONDOS_RECIBIDOS_TD'
          : p < 0.8
          ? 'CERTIFICADO_EMITIDO'
          : p < 0.92
          ? 'CLIENTE_NOTIFICADO'
          : 'PAGADA_CLIENTE'

      solicitudes.push({ id: `SOL-${idCounter++}`, estado, fecha: dia })
    }
  }

  // Pagos a clientes: presentes solo algunos dias, con montos realistas CLP
  const pagos: PagoCliente[] = []
  for (const dia of dias) {
    // prob de tener pagos ese dia
    if (rnd() < 0.55) {
      const n = 1 + Math.floor(rnd() * 5) // 1..5 pagos en ese dia
      for (let i = 0; i < n; i++) {
        // monto entre 100k y 1.5M con ligera cola
        const monto = Math.round(100_000 + Math.pow(rnd(), 0.3) * 1_400_000)
        pagos.push({ fecha: dia, monto })
      }
    }
  }

  return { solicitudes, pagos, rango: { desde, hasta: hoy } }
}

// Instancia por defecto:
export const dashboardDataMock = buildDashboardMock(20250810)
