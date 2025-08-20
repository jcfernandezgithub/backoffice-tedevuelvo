import dayjs from 'dayjs';
import { mockData } from '../mocks/seed';
import type {
  FiltrosReporte,
  KpiData,
  TimeSeriesPoint,
  DistribucionItem,
  SlaMetric,
  FunnelStep,
  Granularidad,
  Solicitud
} from '../types/reportTypes';

const delay = (ms = 300) => new Promise(res => setTimeout(res, ms));

function aplicarFiltros(solicitudes: Solicitud[], filtros: FiltrosReporte): Solicitud[] {
  return solicitudes.filter(s => {
    // Filtro de fechas
    if (filtros.fechaDesde && dayjs(s.fechaCreacion).isBefore(filtros.fechaDesde)) return false;
    if (filtros.fechaHasta && dayjs(s.fechaCreacion).isAfter(filtros.fechaHasta)) return false;
    
    // Filtro de estados
    if (filtros.estados?.length && !filtros.estados.includes(s.estadoActual)) return false;
    
    // Filtro de alianzas
    if (filtros.alianzas?.length && !filtros.alianzas.includes(s.alianzaId)) return false;
    
    // Filtro de compañías
    if (filtros.companias?.length && !filtros.companias.includes(s.companiaId)) return false;
    
    // Filtro de tipos de seguro
    if (filtros.tiposSeguro?.length && !filtros.tiposSeguro.includes(s.tipoSeguro)) return false;
    
    // Filtro de montos
    if (filtros.montoMin !== undefined && s.montoRecuperado < filtros.montoMin) return false;
    if (filtros.montoMax !== undefined && s.montoRecuperado > filtros.montoMax) return false;
    
    return true;
  });
}

function calcularKpis(solicitudes: Solicitud[]): KpiData[] {
  const total = solicitudes.length;
  const pagadas = solicitudes.filter(s => s.estadoActual === 'PAGADA_CLIENTE').length;
  const tasaExito = total > 0 ? (pagadas / total) * 100 : 0;
  const totalRecuperado = solicitudes.reduce((acc, s) => acc + s.montoRecuperado, 0);
  const totalPagado = solicitudes.reduce((acc, s) => acc + s.montoPagadoCliente, 0);

  // Calcular comisiones
  const comisiones = solicitudes
    .filter(s => s.montoPagadoCliente > 0)
    .reduce((acc, s) => {
      const alianza = mockData.alianzas.find(a => a.id === s.alianzaId);
      if (alianza) {
        acc += s.montoPagadoCliente * (alianza.comisionPct / 100);
      }
      return acc;
    }, 0);

  return [
    {
      titulo: 'Solicitudes Totales',
      valor: total,
      formato: 'numero',
      icono: 'FileText',
      tooltip: 'Total de solicitudes en el período'
    },
    {
      titulo: 'Tasa de Éxito',
      valor: tasaExito,
      formato: 'porcentaje',
      icono: 'TrendingUp',
      tooltip: 'Porcentaje de solicitudes pagadas'
    },
    {
      titulo: 'Monto Recuperado',
      valor: totalRecuperado,
      formato: 'moneda',
      icono: 'DollarSign',
      tooltip: 'Total recuperado de compañías'
    },
    {
      titulo: 'Monto Pagado a Clientes',
      valor: totalPagado,
      formato: 'moneda',
      icono: 'Wallet',
      tooltip: 'Total pagado a clientes'
    },
    {
      titulo: 'Ingresos por Comisiones',
      valor: comisiones,
      formato: 'moneda',
      icono: 'Percent',
      tooltip: 'Comisiones generadas por alianzas'
    }
  ];
}

function generarSerieTemporal(
  solicitudes: Solicitud[], 
  granularidad: Granularidad,
  campo: 'cantidad' | 'montoRecuperado' | 'montoPagado' | 'tasaExito'
): TimeSeriesPoint[] {
  const grupos = new Map<string, Solicitud[]>();
  
  solicitudes.forEach(s => {
    let clave = s.fechaCreacion;
    if (granularidad === 'week') {
      clave = dayjs(s.fechaCreacion).startOf('week').format('YYYY-MM-DD');
    } else if (granularidad === 'month') {
      clave = dayjs(s.fechaCreacion).startOf('month').format('YYYY-MM-DD');
    }
    
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(s);
  });

  return Array.from(grupos.entries())
    .map(([fecha, solicitudesGrupo]) => {
      let valor = 0;
      
      switch (campo) {
        case 'cantidad':
          valor = solicitudesGrupo.length;
          break;
        case 'montoRecuperado':
          valor = solicitudesGrupo.reduce((acc, s) => acc + s.montoRecuperado, 0);
          break;
        case 'montoPagado':
          valor = solicitudesGrupo.reduce((acc, s) => acc + s.montoPagadoCliente, 0);
          break;
        case 'tasaExito':
          const pagadas = solicitudesGrupo.filter(s => s.estadoActual === 'PAGADA_CLIENTE').length;
          valor = solicitudesGrupo.length > 0 ? (pagadas / solicitudesGrupo.length) * 100 : 0;
          break;
      }
      
      return { fecha, valor };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export const reportsClient = {
  async getKpisResumen(filtros: FiltrosReporte): Promise<KpiData[]> {
    await delay();
    const solicitudesFiltradas = aplicarFiltros(mockData.solicitudes, filtros);
    return calcularKpis(solicitudesFiltradas);
  },

  async getSerieTemporal(
    filtros: FiltrosReporte,
    granularidad: Granularidad,
    campo: 'cantidad' | 'montoRecuperado' | 'montoPagado' | 'tasaExito'
  ): Promise<TimeSeriesPoint[]> {
    await delay();
    const solicitudesFiltradas = aplicarFiltros(mockData.solicitudes, filtros);
    return generarSerieTemporal(solicitudesFiltradas, granularidad, campo);
  },

  async getDistribucionPorEstado(filtros: FiltrosReporte): Promise<DistribucionItem[]> {
    await delay();
    const solicitudesFiltradas = aplicarFiltros(mockData.solicitudes, filtros);
    const conteos = new Map<string, number>();
    
    solicitudesFiltradas.forEach(s => {
      conteos.set(s.estadoActual, (conteos.get(s.estadoActual) || 0) + 1);
    });

    const total = solicitudesFiltradas.length;
    return Array.from(conteos.entries()).map(([estado, cantidad]) => ({
      categoria: estado,
      valor: cantidad,
      porcentaje: total > 0 ? (cantidad / total) * 100 : 0
    }));
  },

  async getDistribucionPorAlianza(filtros: FiltrosReporte): Promise<DistribucionItem[]> {
    await delay();
    const solicitudesFiltradas = aplicarFiltros(mockData.solicitudes, filtros);
    const conteos = new Map<string, number>();
    
    solicitudesFiltradas.forEach(s => {
      const alianza = mockData.alianzas.find(a => a.id === s.alianzaId);
      const nombre = alianza?.nombre || 'Sin alianza';
      conteos.set(nombre, (conteos.get(nombre) || 0) + 1);
    });

    const total = solicitudesFiltradas.length;
    return Array.from(conteos.entries()).map(([nombre, cantidad]) => ({
      categoria: nombre,
      valor: cantidad,
      porcentaje: total > 0 ? (cantidad / total) * 100 : 0
    }));
  },

  async getFunnelData(filtros: FiltrosReporte): Promise<FunnelStep[]> {
    await delay();
    const solicitudesFiltradas = aplicarFiltros(mockData.solicitudes, filtros);
    const total = solicitudesFiltradas.length;
    
    const etapas = [
      'SIMULACION_CONFIRMADA',
      'DEVOLUCION_CONFIRMADA_COMPANIA', 
      'FONDOS_RECIBIDOS_TD',
      'CERTIFICADO_EMITIDO',
      'CLIENTE_NOTIFICADO',
      'PAGADA_CLIENTE'
    ];

    return etapas.map(etapa => {
      const eventos = mockData.eventosEstado.filter(e => 
        e.estado === etapa && 
        solicitudesFiltradas.some(s => s.id === e.solicitudId)
      );
      const cantidad = eventos.length;
      
      return {
        etapa,
        cantidad,
        porcentaje: total > 0 ? (cantidad / total) * 100 : 0
      };
    });
  },

  async getSlaMetrics(filtros: FiltrosReporte): Promise<SlaMetric[]> {
    await delay();
    const solicitudesFiltradas = aplicarFiltros(mockData.solicitudes, filtros);
    
    return mockData.companias.map(compania => {
      const solicitudesCompania = solicitudesFiltradas.filter(s => s.companiaId === compania.id);
      
      // Simular métricas SLA
      const promedio = 15 + Math.random() * 10; // 15-25 días
      const p95 = promedio * 1.5;
      const p99 = promedio * 2;
      
      let estado: 'green' | 'yellow' | 'red' = 'green';
      if (promedio > 20) estado = 'yellow';
      if (promedio > 25) estado = 'red';
      
      return {
        compania: compania.nombre,
        promedio: Math.round(promedio * 10) / 10,
        p95: Math.round(p95 * 10) / 10,
        p99: Math.round(p99 * 10) / 10,
        estado
      };
    });
  },

  async getAlertas() {
    await delay();
    return mockData.alertas;
  },

  async getTablaResumen(filtros: FiltrosReporte, page = 1, pageSize = 10) {
    await delay();
    const solicitudesFiltradas = aplicarFiltros(mockData.solicitudes, filtros);
    
    const start = (page - 1) * pageSize;
    const items = solicitudesFiltradas.slice(start, start + pageSize);
    
    return {
      items: items.map(s => ({
        id: s.id,
        fechaCreacion: s.fechaCreacion,
        estado: s.estadoActual,
        tipoSeguro: s.tipoSeguro,
        montoRecuperado: s.montoRecuperado,
        montoPagado: s.montoPagadoCliente,
        alianza: mockData.alianzas.find(a => a.id === s.alianzaId)?.nombre || 'N/A',
        compania: mockData.companias.find(c => c.id === s.companiaId)?.nombre || 'N/A'
      })),
      total: solicitudesFiltradas.length,
      page,
      pageSize
    };
  },

  // Datos para filtros
  async getAlianzas() {
    await delay();
    return mockData.alianzas;
  },

  async getCompanias() {
    await delay();
    return mockData.companias;
  }
};