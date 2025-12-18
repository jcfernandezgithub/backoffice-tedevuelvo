import dayjs from 'dayjs';
import type {
  Solicitud,
  EventoEstado,
  Alianza,
  Compania,
  Usuario,
  MotivoRechazo,
  Alerta,
  EstadoSolicitud,
  TipoSeguro
} from '../types/reportTypes';

// PRNG deterministic
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return (s & 0xfffffff) / 0xfffffff;
  };
}

const ESTADOS: EstadoSolicitud[] = [
  'SIMULACION_CONFIRMADA',
  'DEVOLUCION_CONFIRMADA_COMPANIA',
  'FONDOS_RECIBIDOS_TD',
  'CERTIFICADO_EMITIDO',
  'CLIENTE_NOTIFICADO',
  'PAGADA_CLIENTE'
];

const TIPOS_SEGURO: TipoSeguro[] = ['cesantia', 'desgravamen'];

const MOTIVOS_RECHAZO = [
  'Documentación incompleta',
  'Datos inconsistentes',
  'No cumple criterios',
  'Timeout de proceso',
  'Error de sistema'
];

function pick<T>(rnd: () => number, arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function daysBetween(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let d = dayjs(desde);
  const end = dayjs(hasta);
  while (d.isSame(end) || d.isBefore(end)) {
    out.push(d.format('YYYY-MM-DD'));
    d = d.add(1, 'day');
  }
  return out;
}

export function generateMockData(seed = 12345) {
  const rnd = seededRandom(seed);
  const hoy = dayjs().format('YYYY-MM-DD');
  const hace6Meses = dayjs().subtract(6, 'month').startOf('month').format('YYYY-MM-DD');
  const dias = daysBetween(hace6Meses, hoy);

  // Entidades base
  const alianzas: Alianza[] = [
    { id: 'AL-001', nombre: 'Sindicato Financiero Andes', comisionPct: 12.5 },
    { id: 'AL-002', nombre: 'Broker Pacífico', comisionPct: 8.0 },
    { id: 'AL-003', nombre: 'Unión Trabajadores Chile', comisionPct: 15.0 },
    { id: 'AL-004', nombre: 'Asociación Bancarios', comisionPct: 10.5 },
    { id: 'AL-005', nombre: 'Federación Seguros', comisionPct: 9.0 }
  ];

  const companias: Compania[] = [
    { id: 'COMP-001', nombre: 'Metlife Chile' },
    { id: 'COMP-002', nombre: 'Vida Security' },
    { id: 'COMP-003', nombre: 'CNP Seguros' },
    { id: 'COMP-004', nombre: 'Mapfre Seguros' },
    { id: 'COMP-005', nombre: 'Consorcio Seguros' }
  ];

  const usuarios: Usuario[] = [
    { id: 'USR-001', nombre: 'María González' },
    { id: 'USR-002', nombre: 'Carlos Rodríguez' },
    { id: 'USR-003', nombre: 'Ana Pérez' },
    { id: 'USR-004', nombre: 'Luis Martínez' },
    { id: 'USR-005', nombre: 'Sofia López' }
  ];

  // Generar solicitudes
  const solicitudes: Solicitud[] = [];
  const eventosEstado: EventoEstado[] = [];
  const motivosRechazo: MotivoRechazo[] = [];
  let idCounter = 1;

  for (const dia of dias) {
    const numSolicitudes = 8 + Math.floor(rnd() * 25); // 8-32 por día
    
    for (let i = 0; i < numSolicitudes; i++) {
      const solicitudId = `SOL-${idCounter++}`;
      const fechaCreacion = dia;
      
      // Determinar si está cerrada y cuándo
      const estaCompleta = rnd() < 0.7; // 70% están completas
      const diasParaCerrar = estaCompleta ? Math.floor(rnd() * 30) + 1 : 0;
      const fechaCierre = estaCompleta 
        ? dayjs(fechaCreacion).add(diasParaCerrar, 'day').format('YYYY-MM-DD')
        : undefined;

      // Estado final
      const estadoActual = estaCompleta 
        ? pick(rnd, ESTADOS.slice(3)) // Estados más avanzados
        : pick(rnd, ESTADOS.slice(0, 3)); // Estados iniciales

      const tipoSeguro = pick(rnd, TIPOS_SEGURO);
      const montoRecuperado = Math.round(200_000 + rnd() * 1_800_000);
      const montoPagadoCliente = estadoActual === 'PAGADA_CLIENTE' 
        ? Math.round(montoRecuperado * (0.85 + rnd() * 0.1))
        : 0;

      solicitudes.push({
        id: solicitudId,
        fechaCreacion,
        fechaCierre,
        estadoActual,
        tipoSeguro,
        montoRecuperado,
        montoPagadoCliente,
        alianzaId: pick(rnd, alianzas).id,
        companiaId: pick(rnd, companias).id,
        usuarioId: pick(rnd, usuarios).id
      });

      // Generar eventos de estado para esta solicitud
      let fechaEvento = dayjs(fechaCreacion);
      for (let j = 0; j <= ESTADOS.indexOf(estadoActual); j++) {
        eventosEstado.push({
          solicitudId,
          estado: ESTADOS[j],
          fecha: fechaEvento.format('YYYY-MM-DD')
        });
        
        // Avanzar fecha para siguiente estado
        const diasParaSiguiente = 1 + Math.floor(rnd() * 7);
        fechaEvento = fechaEvento.add(diasParaSiguiente, 'day');
      }

      // Algunos motivos de rechazo aleatorios
      if (rnd() < 0.15) { // 15% tienen motivos de rechazo
        motivosRechazo.push({
          solicitudId,
          motivo: pick(rnd, MOTIVOS_RECHAZO)
        });
      }
    }
  }

  // Generar alertas mock
  const alertas: Alerta[] = [
    {
      id: 'ALT-001',
      severidad: 'High',
      regla: 'Tiempo promedio > 20 días',
      fecha: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
      activa: true
    },
    {
      id: 'ALT-002',
      severidad: 'Med',
      regla: 'Tasa de éxito < 85%',
      fecha: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
      activa: true
    },
    {
      id: 'ALT-003',
      severidad: 'Low',
      regla: 'Volumen bajo vs promedio',
      fecha: dayjs().subtract(1, 'week').format('YYYY-MM-DD'),
      activa: false
    }
  ];

  return {
    solicitudes,
    eventosEstado,
    motivosRechazo,
    alianzas,
    companias,
    usuarios,
    alertas,
    rango: { desde: hace6Meses, hasta: hoy }
  };
}

// Instancia por defecto
export const mockData = generateMockData(20250820);