export type EstadoSolicitud =
  | 'SIMULACION_CONFIRMADA'
  | 'DEVOLUCION_CONFIRMADA_COMPANIA'
  | 'FONDOS_RECIBIDOS_TD'
  | 'CERTIFICADO_EMITIDO'
  | 'CLIENTE_NOTIFICADO'
  | 'PAGADA_CLIENTE';

export type TipoSeguro = 'cesantia' | 'desgravamen';
export type Granularidad = 'day' | 'week' | 'month';

export interface Solicitud {
  id: string;
  fechaCreacion: string;
  fechaCierre?: string;
  estadoActual: EstadoSolicitud;
  tipoSeguro: TipoSeguro;
  montoRecuperado: number;
  montoPagadoCliente: number;
  alianzaId: string;
  companiaId: string;
  usuarioId: string;
}

export interface EventoEstado {
  solicitudId: string;
  estado: EstadoSolicitud;
  fecha: string;
}

export interface Alianza {
  id: string;
  nombre: string;
  comisionPct: number;
}

export interface Compania {
  id: string;
  nombre: string;
}

export interface Usuario {
  id: string;
  nombre: string;
}

export interface MotivoRechazo {
  solicitudId: string;
  motivo: string;
}

export interface Alerta {
  id: string;
  severidad: 'Low' | 'Med' | 'High';
  regla: string;
  fecha: string;
  activa: boolean;
}

export interface FiltrosReporte {
  fechaDesde?: string;
  fechaHasta?: string;
  estados?: EstadoSolicitud[];
  alianzas?: string[];
  companias?: string[];
  tiposSeguro?: TipoSeguro[];
  montoMin?: number;
  montoMax?: number;
}

export interface KpiData {
  titulo: string;
  valor: number | string;
  delta?: number;
  formato: 'numero' | 'moneda' | 'porcentaje';
  icono: string;
  tooltip?: string;
}

export interface TimeSeriesPoint {
  fecha: string;
  valor: number;
}

export interface DistribucionItem {
  categoria: string;
  name: string;
  valor: number;
  porcentaje: number;
}

export interface SlaMetric {
  compania: string;
  promedio: number;
  p95: number;
  p99: number;
  estado: 'green' | 'yellow' | 'red';
}

export interface FunnelStep {
  etapa: string;
  cantidad: number;
  porcentaje: number;
}