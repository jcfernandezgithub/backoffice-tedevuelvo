export type Rol = 'ADMIN' | 'OPERACIONES' | 'ALIANZAS' | 'READONLY' | 'CALLCENTER'

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: Rol
  activo: boolean
}

export type TipoAlianza = 'RRHH' | 'SINDICATO' | 'BROKER' | 'OTRO'

export interface Alianza {
  id: string
  nombre: string
  tipo: TipoAlianza
  rut?: string
  emailContacto?: string
  telefonoContacto?: string
  porcentajeComision: number
  activo: boolean
  createdAt: string
  updatedAt: string
  notas?: string
}

export type EstadoSolicitud =
  | 'SIMULACION_CONFIRMADA'
  | 'DEVOLUCION_CONFIRMADA_COMPANIA'
  | 'FONDOS_RECIBIDOS_TD'
  | 'CERTIFICADO_EMITIDO'
  | 'CLIENTE_NOTIFICADO'
  | 'PAGADA_CLIENTE'

export interface Solicitud {
  id: string
  cliente: {
    rut: string
    nombre: string
    email: string
    telefono?: string
    banco: string
    edad: number
  }
  credito: {
    monto: number
    cuotasTotales: number
    cuotasPendientes: number
    tipoSeguro: 'CESANTIA' | 'DESGRAVAMEN'
  }
  alianzaId?: string
  estado: EstadoSolicitud
  montoADevolverEstimado: number
  montoADevolverFinal?: number
  certificadoId?: string
  timeline: { fecha: string; evento: string; usuarioId?: string; detalle?: string }[]
  createdAt: string
  updatedAt: string
}

export type EstadoComision = 'PENDIENTE' | 'APROBADA' | 'PAGADA'

export interface Comision {
  id: string
  solicitudId: string
  alianzaId: string
  baseCalculo: number
  porcentaje: number
  monto: number
  estado: EstadoComision
  createdAt: string
  updatedAt: string
}

