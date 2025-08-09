import { db } from "./db"
import { uid } from "./storage"
import { Alianza, Certificado, Comision, EstadoSolicitud, Solicitud } from "@/types/domain"

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const flujo: EstadoSolicitud[] = [
  'SIMULACION_CONFIRMADA',
  'DEVOLUCION_CONFIRMADA_COMPANIA',
  'FONDOS_RECIBIDOS_TD',
  'CERTIFICADO_EMITIDO',
  'CLIENTE_NOTIFICADO',
  'PAGADA_CLIENTE',
]

function siguienteValido(actual: EstadoSolicitud | undefined, siguiente: EstadoSolicitud) {
  if (!actual) return siguiente === 'SIMULACION_CONFIRMADA'
  const idx = flujo.indexOf(actual)
  const idxNext = flujo.indexOf(siguiente)
  return idxNext === idx || idxNext === idx + 1 // permitir re-registro del mismo paso
}

function generarComision(si: Solicitud, montoRecibido: number) {
  if (!si.alianzaId) return
  const alianzas = db.getAlianzas()
  const al = alianzas.find((a) => a.id === si.alianzaId)
  if (!al) return
  const base = montoRecibido
  const porcentaje = al.porcentajeComision
  const monto = Math.round((base * porcentaje) / 100)
  const reg: Comision = {
    id: uid('cm-'),
    solicitudId: si.id,
    alianzaId: al.id,
    baseCalculo: base,
    porcentaje,
    monto,
    estado: 'PENDIENTE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const coms = db.getComisiones()
  coms.unshift(reg)
  db.setComisiones(coms)
}

export const solicitudesService = {
  async list(): Promise<Solicitud[]> {
    await delay(200)
    return db.getSolicitudes()
  },
  async get(id: string): Promise<Solicitud | undefined> {
    await delay(150)
    return db.getSolicitudes().find((s) => s.id === id)
  },
  async create(input: Omit<Solicitud, 'id' | 'createdAt' | 'updatedAt' | 'timeline'> & { timeline?: Solicitud['timeline'] }): Promise<Solicitud> {
    await delay(300)
    const now = new Date().toISOString()
    const timeline = input.timeline ?? [{ fecha: now, evento: 'SIMULACION_CONFIRMADA' }]
    const nuevo: Solicitud = {
      ...input,
      id: uid('sol-'),
      createdAt: now,
      updatedAt: now,
      timeline,
    }
    const arr = db.getSolicitudes()
    arr.unshift(nuevo)
    db.setSolicitudes(arr)
    return nuevo
  },
  async update(id: string, patch: Partial<Solicitud>): Promise<Solicitud> {
    await delay(250)
    const arr = db.getSolicitudes()
    const idx = arr.findIndex((s) => s.id === id)
    if (idx === -1) throw new Error('Solicitud no encontrada')
    const updated: Solicitud = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() }
    arr[idx] = updated
    db.setSolicitudes(arr)
    return updated
  },
  async remove(id: string) {
    await delay(200)
    db.setSolicitudes(db.getSolicitudes().filter((s) => s.id !== id))
  },
  async avanzarEstado(id: string, nuevo: EstadoSolicitud, detalle?: string, montoRecibido?: number): Promise<Solicitud> {
    await delay(250)
    const arr = db.getSolicitudes()
    const idx = arr.findIndex((s) => s.id === id)
    if (idx === -1) throw new Error('Solicitud no encontrada')
    const actual = arr[idx]
    if (!siguienteValido(actual.estado, nuevo)) {
      throw new Error('Transición de estado no válida')
    }
    const now = new Date().toISOString()
    const timeline = [...actual.timeline, { fecha: now, evento: nuevo, detalle }]
    const updated: Solicitud = { ...actual, estado: nuevo, timeline, updatedAt: now }

    if (nuevo === 'FONDOS_RECIBIDOS_TD' && typeof montoRecibido === 'number') {
      generarComision(updated, montoRecibido)
      updated.montoADevolverFinal = montoRecibido
    }

    if (nuevo === 'CERTIFICADO_EMITIDO') {
      const cert: Certificado = { id: uid('cf-'), solicitudId: id, url: '#', createdAt: now }
      // guardar certificado en storage simple (reutilizamos comisiones key? mejor su propia, pero por simplicidad omitimos persistencia)
      updated.certificadoId = cert.id
    }

    arr[idx] = updated
    db.setSolicitudes(arr)
    return updated
  },
}
