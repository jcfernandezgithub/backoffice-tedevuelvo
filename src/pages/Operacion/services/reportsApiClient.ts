import dayjs from 'dayjs';
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
  'rejected': null,
  'canceled': null,
  'datos_sin_simulacion': 'DATOS_SIN_SIMULACION',
};

// ── Filtrado local por fechas y estados ────────────────────────────────────────

function applyFiltros(items: RefundRequest[], filtros: FiltrosReporte): RefundRequest[] {
  let result = items;

  if (filtros.fechaDesde || filtros.fechaHasta) {
    result = result.filter(r => {
      // Filtrar por fecha del último cambio al estado actual (no por createdAt)
      const history = (r as any).statusHistory;
      if (!history?.length) return false;
      const lastChange = [...history].reverse().find(
        (entry: any) => entry.to === r.status && entry.from !== entry.to
      );
      if (!lastChange?.at) return false;
      const match = lastChange.at.match(/^(\d{4}-\d{2}-\d{2})/);
      const statusDate = match ? match[1] : lastChange.at.split('T')[0];
      if (filtros.fechaDesde && statusDate < filtros.fechaDesde) return false;
      if (filtros.fechaHasta && statusDate > filtros.fechaHasta) return false;
      return true;
    });
  }

  if (filtros.estados?.length) {
    result = result.filter(r => {
      const mapped = STATUS_MAP[r.status];
      return mapped && filtros.estados!.includes(mapped);
    });
  }

  if (filtros.montoMin !== undefined) {
    result = result.filter(r => r.estimatedAmountCLP >= filtros.montoMin!);
  }
  if (filtros.montoMax !== undefined) {
    result = result.filter(r => r.estimatedAmountCLP <= filtros.montoMax!);
  }

  return result;
}

function filterActive(items: RefundRequest[]): RefundRequest[] {
  return items.filter(r => r.status !== 'rejected' && r.status !== 'canceled');
}

// ── Cálculos puros (sin fetch — reciben los datos ya cargados) ────────────────

function calcularKpis(refunds: RefundRequest[]): KpiData[] {
  const total = refunds.length;
  const pagadas = refunds.filter(r => r.status === 'paid').length;
  const tasaExito = total > 0 ? (pagadas / total) * 100 : 0;
  const totalRecuperado = refunds.reduce((acc, r) => acc + r.estimatedAmountCLP, 0);
  const totalPagado = refunds
    .filter(r => r.status === 'paid')
    .reduce((acc, r) => acc + r.estimatedAmountCLP * 0.85, 0);
  const comisiones = totalPagado * 0.12;

  return [
    { titulo: 'Solicitudes Totales', valor: total, formato: 'numero', icono: 'FileText', tooltip: 'Total de solicitudes en el período' },
    { titulo: 'Tasa de Éxito', valor: tasaExito, formato: 'porcentaje', icono: 'TrendingUp', tooltip: 'Porcentaje de solicitudes pagadas' },
    { titulo: 'Monto Estimado Total', valor: totalRecuperado, formato: 'moneda', icono: 'DollarSign', tooltip: 'Total estimado a recuperar' },
    { titulo: 'Monto Pagado a Clientes', valor: totalPagado, formato: 'moneda', icono: 'Wallet', tooltip: 'Total estimado pagado a clientes' },
    { titulo: 'Ingresos por Comisiones', valor: comisiones, formato: 'moneda', icono: 'Percent', tooltip: 'Comisiones estimadas (12%)' },
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
    if (granularidad === 'week') clave = dayjs(r.createdAt).startOf('week').format('YYYY-MM-DD');
    else if (granularidad === 'month') clave = dayjs(r.createdAt).startOf('month').format('YYYY-MM-DD');
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(r);
  });

  return Array.from(grupos.entries())
    .map(([fecha, grupo]) => {
      let valor = 0;
      switch (campo) {
        case 'cantidad': valor = grupo.length; break;
        case 'montoRecuperado': valor = grupo.reduce((acc, r) => acc + r.estimatedAmountCLP, 0); break;
        case 'montoPagado': {
          const pg = grupo.filter(r => r.status === 'paid');
          valor = pg.reduce((acc, r) => acc + r.estimatedAmountCLP * 0.85, 0);
          break;
        }
        case 'tasaExito': {
          const pg = grupo.filter(r => r.status === 'paid').length;
          valor = grupo.length > 0 ? (pg / grupo.length) * 100 : 0;
          break;
        }
      }
      return { fecha, valor };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ── Cliente de reportes — ahora recibe refunds ya cargados (sin fetch propio) ─

export const reportsApiClient = {
  // Todos los métodos reciben allRefunds del caché compartido
  getKpisResumen(filtros: FiltrosReporte, allRefunds: RefundRequest[]): KpiData[] {
    return calcularKpis(filterActive(applyFiltros(allRefunds, filtros)));
  },

  getSerieTemporal(
    filtros: FiltrosReporte,
    granularidad: Granularidad,
    campo: 'cantidad' | 'montoRecuperado' | 'montoPagado' | 'tasaExito',
    allRefunds: RefundRequest[]
  ): TimeSeriesPoint[] {
    return generarSerieTemporal(filterActive(applyFiltros(allRefunds, filtros)), granularidad, campo);
  },

  getDistribucionPorEstado(filtros: FiltrosReporte, allRefunds: RefundRequest[]): DistribucionItem[] {
    const refunds = filterActive(applyFiltros(allRefunds, filtros));
    const conteos = new Map<string, number>();
    refunds.forEach(r => {
      const mapped = STATUS_MAP[r.status];
      if (mapped) conteos.set(mapped, (conteos.get(mapped) || 0) + 1);
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
      porcentaje: total > 0 ? (cantidad / total) * 100 : 0,
    }));
  },

  getDistribucionPorAlianza(filtros: FiltrosReporte, allRefunds: RefundRequest[]): DistribucionItem[] {
    const refunds = filterActive(applyFiltros(allRefunds, filtros));
    const conteos = new Map<string, number>();
    refunds.forEach(r => {
      if (r.institutionId && !r.institutionId.match(/^[0-9a-fA-F]{24}$/)) {
        conteos.set(r.institutionId, (conteos.get(r.institutionId) || 0) + 1);
      }
    });
    const total = Array.from(conteos.values()).reduce((acc, v) => acc + v, 0);
    return Array.from(conteos.entries())
      .map(([nombre, cantidad]) => ({
        categoria: nombre, name: nombre, valor: cantidad,
        porcentaje: total > 0 ? (cantidad / total) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  },

  getDistribucionPorTipoSeguro(filtros: FiltrosReporte, allRefunds: RefundRequest[]): DistribucionItem[] {
    const refunds = filterActive(applyFiltros(allRefunds, filtros));
    const conteos = new Map<string, { cantidad: number; montoTotal: number; pagadas: number }>();
    refunds.forEach(r => {
      const tipo = r.calculationSnapshot?.insuranceToEvaluate || 'Sin tipo';
      const cur = conteos.get(tipo) || { cantidad: 0, montoTotal: 0, pagadas: 0 };
      cur.cantidad += 1;
      cur.montoTotal += r.estimatedAmountCLP || 0;
      if (r.status === 'paid') cur.pagadas += 1;
      conteos.set(tipo, cur);
    });
    const total = refunds.length;
    return Array.from(conteos.entries()).map(([tipo, data]) => ({
      categoria: tipo,
      name: tipo === 'CESANTIA' ? 'Cesantía' : tipo === 'DESGRAVAMEN' ? 'Desgravamen' : tipo === 'AMBOS' ? 'Ambos' : tipo,
      valor: data.cantidad,
      porcentaje: total > 0 ? (data.cantidad / total) * 100 : 0,
      montoPromedio: data.cantidad > 0 ? Math.round(data.montoTotal / data.cantidad) : 0,
      conversion: data.cantidad > 0 ? (data.pagadas / data.cantidad) * 100 : 0,
    }));
  },

  getKpisSegmentos(filtros: FiltrosReporte, allRefunds: RefundRequest[]) {
    const refunds = applyFiltros(allRefunds, filtros);
    const estadosParaTicket = ['simulated', 'requested', 'qualifying', 'docs_pending', 'docs_received', 'submitted', 'approved', 'payment_scheduled', 'paid'];
    const refundsParaTicket = refunds.filter(r => r.estimatedAmountCLP > 0 && estadosParaTicket.includes(r.status));
    const totalMonto = refundsParaTicket.reduce((acc, r) => acc + r.estimatedAmountCLP, 0);
    const ticketPromedio = refundsParaTicket.length > 0 ? Math.round(totalMonto / refundsParaTicket.length) : 0;

    const refundsConPrima = refundsParaTicket.filter(r =>
      r.calculationSnapshot?.newMonthlyPremium > 0 && r.calculationSnapshot?.remainingInstallments > 0
    );
    const totalPrimas = refundsConPrima.reduce((acc, r) => {
      return acc + (r.calculationSnapshot?.newMonthlyPremium || 0) * (r.calculationSnapshot?.remainingInstallments || 0);
    }, 0);
    const primaPromedio = refundsConPrima.length > 0 ? Math.round(totalPrimas / refundsConPrima.length) : 0;
    const pagadas = refundsParaTicket.filter(r => r.status === 'paid').length;
    const tasaConversion = refundsParaTicket.length > 0 ? (pagadas / refundsParaTicket.length) * 100 : 0;

    return { ticketPromedio, primaPromedio, tasaConversion };
  },

  getFunnelData(filtros: FiltrosReporte, allRefunds: RefundRequest[]): FunnelStep[] {
    // Usar la misma lógica de filtrado que las calugas del Resumen:
    // filtrar por fecha del último cambio al estado ACTUAL
    const filtered = applyFiltros(allRefunds, filtros);

    // Etapas del pipeline (mismo orden y nombres que las calugas de Resumen)
    const PIPELINE_STAGES: { etapa: string; label: string }[] = [
      { etapa: 'qualifying',         label: 'En Calificación' },
      { etapa: 'docs_received',      label: 'Docs Recibidos' },
      { etapa: 'submitted',          label: 'Ingresadas' },
      { etapa: 'approved',           label: 'Aprobadas' },
      { etapa: 'rejected',           label: 'Rechazadas' },
      { etapa: 'payment_scheduled',  label: 'Pago Programado' },
      { etapa: 'paid',               label: 'Pagadas' },
    ];

    // Contar por estado ACTUAL (igual que las calugas)
    const totalBase = filtered.length;

    return PIPELINE_STAGES.map(stage => {
      const cantidad = filtered.filter(r => r.status === stage.etapa).length;
      return {
        etapa: stage.etapa,
        label: stage.label,
        cantidad,
        porcentaje: totalBase > 0 ? (cantidad / totalBase) * 100 : 0,
      };
    });
  },

  getSlaMetrics(filtros: FiltrosReporte, allRefunds: RefundRequest[]): SlaMetric[] {
    const refunds = filterActive(applyFiltros(allRefunds, filtros));
    const porInstitucion = new Map<string, RefundRequest[]>();
    refunds.forEach(r => {
      const inst = r.institutionId || 'Sin institución';
      if (!porInstitucion.has(inst)) porInstitucion.set(inst, []);
      porInstitucion.get(inst)!.push(r);
    });
    return Array.from(porInstitucion.entries()).map(([institucion, items]) => {
      const cerradas = items.filter(r => r.status === 'paid' || r.status === 'rejected');
      const promedios = cerradas.map(r => dayjs(r.updatedAt).diff(dayjs(r.createdAt), 'day'));
      const promedio = promedios.length > 0 ? promedios.reduce((a, b) => a + b, 0) / promedios.length : 0;
      let estado: 'green' | 'yellow' | 'red' = 'green';
      if (promedio > 20) estado = 'yellow';
      if (promedio > 25) estado = 'red';
      return {
        compania: institucion,
        promedio: Math.round(promedio * 10) / 10,
        p95: Math.round(promedio * 1.5 * 10) / 10,
        p99: Math.round(promedio * 2 * 10) / 10,
        estado,
      };
    });
  },

  getAlertas() {
    return [];
  },

  getTablaResumen(filtros: FiltrosReporte, allRefunds: RefundRequest[], page = 1, pageSize = 10) {
    const refunds = filterActive(applyFiltros(allRefunds, filtros));
    const start = (page - 1) * pageSize;
    const items = refunds.slice(start, start + pageSize);
    return {
      items: items.map(r => ({
        id: r.publicId,
        fechaCreacion: dayjs(r.createdAt).format('YYYY-MM-DD'),
        estado: STATUS_MAP[r.status] || 'SIMULACION_CONFIRMADA',
        tipoSeguro: 'cesantia',
        montoRecuperado: r.estimatedAmountCLP,
        montoPagado: r.status === 'paid' ? r.estimatedAmountCLP * 0.85 : 0,
        alianza: r.institutionId || 'N/A',
        compania: 'Por determinar',
      })),
      total: refunds.length,
      page,
      pageSize,
    };
  },

  getAlianzas() { return []; },
  getCompanias() { return []; },
};
