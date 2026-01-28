import dayjs from 'dayjs';
import { refundAdminApi } from '@/services/refundAdminApi';
import type { RefundRequest, RefundStatus } from '@/types/refund';
import type {
  FiltrosReporte,
  KpiData,
  TimeSeriesPoint,
  DistribucionItem,
  SlaMetric,
  FunnelStep,
  Granularidad,
  EstadoSolicitud,
} from '../types/reportTypes';

// Mapeo de estados de API a estados de reportes
const STATUS_MAP: Record<RefundStatus, EstadoSolicitud | null> = {
  'simulated': 'SIMULACION_CONFIRMADA',
  'requested': 'SIMULACION_CONFIRMADA',
  'qualifying': 'SIMULACION_CONFIRMADA',
  'docs_pending': 'SIMULACION_CONFIRMADA',
  'docs_received': 'DEVOLUCION_CONFIRMADA_COMPANIA',
  'submitted': 'FONDOS_RECIBIDOS_TD',
  'approved': 'CERTIFICADO_EMITIDO',
  'payment_scheduled': 'CLIENTE_NOTIFICADO',
  'paid': 'PAGADA_CLIENTE',
  'rejected': null, // No se incluye en reportes
  'canceled': null, // No se incluye en reportes
  'datos_sin_simulacion': 'DATOS_SIN_SIMULACION',
};

// Fetch todas las solicitudes aplicando filtros con paginación paralela
async function fetchRefunds(filtros: FiltrosReporte): Promise<RefundRequest[]> {
  console.log('[ReportsAPI] Filtros recibidos:', filtros);
  
  const PAGE_SIZE = 100;
  
  // Primera llamada para obtener el total
  const firstPage = await refundAdminApi.list({ pageSize: PAGE_SIZE, page: 1 });
  const total = firstPage.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  
  console.log(`[ReportsAPI] Total registros: ${total}, Páginas: ${totalPages}`);
  
  let allItems = [...(firstPage.items || [])];
  
  // Si hay más páginas, obtenerlas en paralelo
  if (totalPages > 1) {
    const pagePromises = [];
    for (let page = 2; page <= totalPages; page++) {
      pagePromises.push(refundAdminApi.list({ pageSize: PAGE_SIZE, page }));
    }
    
    const additionalPages = await Promise.all(pagePromises);
    additionalPages.forEach(pageResult => {
      allItems = allItems.concat(pageResult.items || []);
    });
  }

  console.log('[ReportsAPI] Items totales obtenidos de API:', allItems.length);
  
  // Normalizar status a minúsculas (la API puede devolver en mayúsculas)
  let items = allItems.map(r => ({
    ...r,
    status: (r.status?.toLowerCase() || r.status) as any
  }));
  
  console.log('[ReportsAPI] Primeros 3 items (normalizados):', items.slice(0, 3).map(r => ({ 
    id: r.publicId, 
    createdAt: r.createdAt, 
    status: r.status 
  })));

  // Filtrar por rango de fechas (comparación de strings para evitar problemas de timezone)
  if (filtros.fechaDesde || filtros.fechaHasta) {
    items = items.filter(r => {
      if (!r.createdAt) return false;
      const createdDateStr = r.createdAt.split('T')[0];
      
      if (filtros.fechaDesde && createdDateStr < filtros.fechaDesde) {
        return false;
      }
      if (filtros.fechaHasta && createdDateStr > filtros.fechaHasta) {
        return false;
      }
      return true;
    });
    console.log('[ReportsAPI] Items después de filtrar por fechas:', items.length);
  }

  // Filtrar solo solicitudes no rechazadas/canceladas
  items = items.filter(r => r.status !== 'rejected' && r.status !== 'canceled');
  console.log('[ReportsAPI] Items después de filtrar rechazadas:', items.length);

  // Aplicar filtros adicionales en cliente
  if (filtros.estados?.length) {
    items = items.filter(r => {
      const mappedStatus = STATUS_MAP[r.status];
      return mappedStatus && filtros.estados!.includes(mappedStatus);
    });
  }

  if (filtros.montoMin !== undefined) {
    items = items.filter(r => r.estimatedAmountCLP >= filtros.montoMin!);
  }
  if (filtros.montoMax !== undefined) {
    items = items.filter(r => r.estimatedAmountCLP <= filtros.montoMax!);
  }

  return items;
}

function calcularKpis(refunds: RefundRequest[]): KpiData[] {
  const total = refunds.length;
  const pagadas = refunds.filter(r => r.status === 'paid').length;
  const tasaExito = total > 0 ? (pagadas / total) * 100 : 0;
  const totalRecuperado = refunds.reduce((acc, r) => acc + r.estimatedAmountCLP, 0);
  
  // Estimamos que el monto pagado al cliente es ~85% del monto recuperado
  const totalPagado = refunds
    .filter(r => r.status === 'paid')
    .reduce((acc, r) => acc + r.estimatedAmountCLP * 0.85, 0);

  // Estimamos comisiones en ~12% del monto pagado
  const comisiones = totalPagado * 0.12;

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
      titulo: 'Monto Estimado Total',
      valor: totalRecuperado,
      formato: 'moneda',
      icono: 'DollarSign',
      tooltip: 'Total estimado a recuperar'
    },
    {
      titulo: 'Monto Pagado a Clientes',
      valor: totalPagado,
      formato: 'moneda',
      icono: 'Wallet',
      tooltip: 'Total estimado pagado a clientes'
    },
    {
      titulo: 'Ingresos por Comisiones',
      valor: comisiones,
      formato: 'moneda',
      icono: 'Percent',
      tooltip: 'Comisiones estimadas (12%)'
    }
  ];
}

function generarSerieTemporal(
  refunds: RefundRequest[], 
  granularidad: Granularidad,
  campo: 'cantidad' | 'montoRecuperado' | 'montoPagado' | 'tasaExito'
): TimeSeriesPoint[] {
  const grupos = new Map<string, RefundRequest[]>();
  
  refunds.forEach(r => {
    let clave = dayjs(r.createdAt).format('YYYY-MM-DD');
    if (granularidad === 'week') {
      clave = dayjs(r.createdAt).startOf('week').format('YYYY-MM-DD');
    } else if (granularidad === 'month') {
      clave = dayjs(r.createdAt).startOf('month').format('YYYY-MM-DD');
    }
    
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(r);
  });

  return Array.from(grupos.entries())
    .map(([fecha, refundsGrupo]) => {
      let valor = 0;
      
      switch (campo) {
        case 'cantidad':
          valor = refundsGrupo.length;
          break;
        case 'montoRecuperado':
          valor = refundsGrupo.reduce((acc, r) => acc + r.estimatedAmountCLP, 0);
          break;
        case 'montoPagado':
          const pagadas = refundsGrupo.filter(r => r.status === 'paid');
          valor = pagadas.reduce((acc, r) => acc + r.estimatedAmountCLP * 0.85, 0);
          break;
        case 'tasaExito':
          const pagadasCount = refundsGrupo.filter(r => r.status === 'paid').length;
          valor = refundsGrupo.length > 0 ? (pagadasCount / refundsGrupo.length) * 100 : 0;
          break;
      }
      
      return { fecha, valor };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export const reportsApiClient = {
  async getKpisResumen(filtros: FiltrosReporte): Promise<KpiData[]> {
    const refunds = await fetchRefunds(filtros);
    return calcularKpis(refunds);
  },

  async getSerieTemporal(
    filtros: FiltrosReporte,
    granularidad: Granularidad,
    campo: 'cantidad' | 'montoRecuperado' | 'montoPagado' | 'tasaExito'
  ): Promise<TimeSeriesPoint[]> {
    const refunds = await fetchRefunds(filtros);
    return generarSerieTemporal(refunds, granularidad, campo);
  },

  async getDistribucionPorEstado(filtros: FiltrosReporte): Promise<DistribucionItem[]> {
    const refunds = await fetchRefunds(filtros);
    const conteos = new Map<string, number>();
    
    refunds.forEach(r => {
      const mappedStatus = STATUS_MAP[r.status];
      if (mappedStatus) {
        conteos.set(mappedStatus, (conteos.get(mappedStatus) || 0) + 1);
      }
    });

    const ESTADO_LABELS: Record<string, string> = {
      'SIMULACION_CONFIRMADA': 'Simulado',
      'DEVOLUCION_CONFIRMADA_COMPANIA': 'Aprobado',
      'FONDOS_RECIBIDOS_TD': 'Docs recibidos',
      'CERTIFICADO_EMITIDO': 'Enviado',
      'CLIENTE_NOTIFICADO': 'Pago programado',
      'PAGADA_CLIENTE': 'Pagado',
    };

    const total = refunds.length;
    return Array.from(conteos.entries()).map(([estado, cantidad]) => ({
      categoria: estado,
      name: ESTADO_LABELS[estado] || estado,
      valor: cantidad,
      porcentaje: total > 0 ? (cantidad / total) * 100 : 0
    }));
  },

  async getDistribucionPorAlianza(filtros: FiltrosReporte): Promise<DistribucionItem[]> {
    const refunds = await fetchRefunds(filtros);
    const conteos = new Map<string, number>();
    
    refunds.forEach(r => {
      // Usamos partnerId si existe, sino "Sin alianza"
      const alianza = r.partnerId ? (r.institutionId || r.partnerId) : 'Sin alianza';
      conteos.set(alianza, (conteos.get(alianza) || 0) + 1);
    });

    // Filtrar "Sin alianza" ya que no es una institución válida
    const entradasFiltradas = Array.from(conteos.entries())
      .filter(([nombre]) => nombre !== 'Sin alianza');
    
    const totalFiltrado = entradasFiltradas.reduce((acc, [, cantidad]) => acc + cantidad, 0);
    
    return entradasFiltradas
      .map(([nombre, cantidad]) => ({
        categoria: nombre,
        name: nombre,
        valor: cantidad,
        porcentaje: totalFiltrado > 0 ? (cantidad / totalFiltrado) * 100 : 0
      }))
      .sort((a, b) => b.valor - a.valor);
  },

  async getDistribucionPorTipoSeguro(filtros: FiltrosReporte): Promise<DistribucionItem[]> {
    const refunds = await fetchRefunds(filtros);
    const conteos = new Map<string, { cantidad: number; montoTotal: number; pagadas: number }>();
    
    refunds.forEach(r => {
      const tipoSeguro = r.calculationSnapshot?.insuranceToEvaluate || 'Sin tipo';
      const current = conteos.get(tipoSeguro) || { cantidad: 0, montoTotal: 0, pagadas: 0 };
      current.cantidad += 1;
      current.montoTotal += r.estimatedAmountCLP || 0;
      if (r.status === 'paid') current.pagadas += 1;
      conteos.set(tipoSeguro, current);
    });

    const total = refunds.length;
    return Array.from(conteos.entries()).map(([tipo, data]) => ({
      categoria: tipo,
      name: tipo === 'CESANTIA' ? 'Cesantía' : tipo === 'DESGRAVAMEN' ? 'Desgravamen' : tipo === 'AMBOS' ? 'Ambos' : tipo,
      valor: data.cantidad,
      porcentaje: total > 0 ? (data.cantidad / total) * 100 : 0,
      montoPromedio: data.cantidad > 0 ? Math.round(data.montoTotal / data.cantidad) : 0,
      conversion: data.cantidad > 0 ? (data.pagadas / data.cantidad) * 100 : 0
    }));
  },

  async getKpisSegmentos(filtros: FiltrosReporte) {
    const refunds = await fetchRefunds(filtros);
    
    // Agrupar por partnerId (alianza)
    const porAlianza = new Map<string, RefundRequest[]>();
    refunds.forEach(r => {
      const alianza = r.partnerId || 'direct';
      if (!porAlianza.has(alianza)) porAlianza.set(alianza, []);
      porAlianza.get(alianza)!.push(r);
    });
    
    const alianzasCount = porAlianza.size;
    const solicitudesPromedio = alianzasCount > 0 ? Math.round(refunds.length / alianzasCount) : 0;
    
    const pagadas = refunds.filter(r => r.status === 'paid').length;
    const tasaConversion = refunds.length > 0 ? (pagadas / refunds.length) * 100 : 0;
    
    // Calcular comisión promedio estimada (12% por defecto)
    const comisionPromedio = 12;
    
    return {
      solicitudesPromedio,
      tasaConversion,
      comisionPromedio
    };
  },

  async getFunnelData(filtros: FiltrosReporte): Promise<FunnelStep[]> {
    const refunds = await fetchRefunds(filtros);
    
    const estadosOrdenados: EstadoSolicitud[] = [
      'SIMULACION_CONFIRMADA',
      'DEVOLUCION_CONFIRMADA_COMPANIA', 
      'FONDOS_RECIBIDOS_TD',
      'CLIENTE_NOTIFICADO',
      'PAGADA_CLIENTE'
    ];

    // Contar cuántas solicitudes han alcanzado cada etapa
    return estadosOrdenados.map(estado => {
      const cantidad = refunds.filter(r => {
        const mappedStatus = STATUS_MAP[r.status];
        if (!mappedStatus) return false;
        
        // Una solicitud ha "alcanzado" una etapa si su estado actual es igual o posterior
        const estadoActualIdx = estadosOrdenados.indexOf(mappedStatus);
        const etapaIdx = estadosOrdenados.indexOf(estado);
        return estadoActualIdx >= etapaIdx;
      }).length;
      
      return {
        etapa: estado,
        cantidad,
        porcentaje: refunds.length > 0 ? (cantidad / refunds.length) * 100 : 0
      };
    });
  },

  async getSlaMetrics(filtros: FiltrosReporte): Promise<SlaMetric[]> {
    const refunds = await fetchRefunds(filtros);
    
    // Agrupar por institución
    const porInstitucion = new Map<string, RefundRequest[]>();
    refunds.forEach(r => {
      const inst = r.institutionId || 'Sin institución';
      if (!porInstitucion.has(inst)) porInstitucion.set(inst, []);
      porInstitucion.get(inst)!.push(r);
    });

    return Array.from(porInstitucion.entries()).map(([institucion, refundsInst]) => {
      // Calcular días promedio de las solicitudes cerradas
      const cerradas = refundsInst.filter(r => r.status === 'paid' || r.status === 'rejected');
      const promedios = cerradas.map(r => {
        const inicio = dayjs(r.createdAt);
        const fin = dayjs(r.updatedAt);
        return fin.diff(inicio, 'day');
      });
      
      const promedio = promedios.length > 0 
        ? promedios.reduce((a, b) => a + b, 0) / promedios.length 
        : 0;
      
      const p95 = promedio * 1.5;
      const p99 = promedio * 2;
      
      let estado: 'green' | 'yellow' | 'red' = 'green';
      if (promedio > 20) estado = 'yellow';
      if (promedio > 25) estado = 'red';
      
      return {
        compania: institucion,
        promedio: Math.round(promedio * 10) / 10,
        p95: Math.round(p95 * 10) / 10,
        p99: Math.round(p99 * 10) / 10,
        estado
      };
    });
  },

  async getAlertas() {
    // Por ahora retornamos alertas vacías
    // En el futuro se pueden calcular alertas basadas en los datos reales
    return [];
  },

  async getTablaResumen(filtros: FiltrosReporte, page = 1, pageSize = 10) {
    const refunds = await fetchRefunds(filtros);
    
    const start = (page - 1) * pageSize;
    const items = refunds.slice(start, start + pageSize);
    
    return {
      items: items.map(r => ({
        id: r.publicId,
        fechaCreacion: dayjs(r.createdAt).format('YYYY-MM-DD'),
        estado: STATUS_MAP[r.status] || 'SIMULACION_CONFIRMADA',
        tipoSeguro: 'cesantia', // Por defecto, hasta que tengamos el dato
        montoRecuperado: r.estimatedAmountCLP,
        montoPagado: r.status === 'paid' ? r.estimatedAmountCLP * 0.85 : 0,
        alianza: r.institutionId || 'N/A',
        compania: 'Por determinar'
      })),
      total: refunds.length,
      page,
      pageSize
    };
  },

  // Datos para filtros (por ahora retornamos arrays vacíos)
  async getAlianzas() {
    // Retornar instituciones únicas de las solicitudes
    return [];
  },

  async getCompanias() {
    return [];
  }
};
