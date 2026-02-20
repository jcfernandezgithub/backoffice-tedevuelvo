import { reportsApiClient } from './reportsApiClient';
import type { RefundRequest } from '@/types/refund';
import type {
  FiltrosReporte,
  KpiData,
  TimeSeriesPoint,
  DistribucionItem,
  SlaMetric,
  FunnelStep,
  Granularidad,
} from '../types/reportTypes';

// Delegamos toda la lógica al nuevo cliente de API.
// Todos los métodos ahora reciben allRefunds para evitar fetches duplicados.
export const reportsClient = {
  getKpisResumen(filtros: FiltrosReporte, allRefunds: RefundRequest[]): KpiData[] {
    return reportsApiClient.getKpisResumen(filtros, allRefunds);
  },

  getSerieTemporal(
    filtros: FiltrosReporte,
    granularidad: Granularidad,
    campo: 'cantidad' | 'montoRecuperado' | 'montoPagado' | 'tasaExito',
    allRefunds: RefundRequest[]
  ): TimeSeriesPoint[] {
    return reportsApiClient.getSerieTemporal(filtros, granularidad, campo, allRefunds);
  },

  getDistribucionPorEstado(filtros: FiltrosReporte, allRefunds: RefundRequest[]): DistribucionItem[] {
    return reportsApiClient.getDistribucionPorEstado(filtros, allRefunds);
  },

  getDistribucionPorAlianza(filtros: FiltrosReporte, allRefunds: RefundRequest[]): DistribucionItem[] {
    return reportsApiClient.getDistribucionPorAlianza(filtros, allRefunds);
  },

  getDistribucionPorTipoSeguro(filtros: FiltrosReporte, allRefunds: RefundRequest[]): DistribucionItem[] {
    return reportsApiClient.getDistribucionPorTipoSeguro(filtros, allRefunds);
  },

  getKpisSegmentos(filtros: FiltrosReporte, allRefunds: RefundRequest[]) {
    return reportsApiClient.getKpisSegmentos(filtros, allRefunds);
  },

  getFunnelData(filtros: FiltrosReporte, allRefunds: RefundRequest[]): FunnelStep[] {
    return reportsApiClient.getFunnelData(filtros, allRefunds);
  },

  getSlaMetrics(filtros: FiltrosReporte, allRefunds: RefundRequest[]): SlaMetric[] {
    return reportsApiClient.getSlaMetrics(filtros, allRefunds);
  },

  getAlertas() {
    return reportsApiClient.getAlertas();
  },

  getTablaResumen(filtros: FiltrosReporte, allRefunds: RefundRequest[], page = 1, pageSize = 10) {
    return reportsApiClient.getTablaResumen(filtros, allRefunds, page, pageSize);
  },

  getAlianzas() {
    return reportsApiClient.getAlianzas();
  },

  getCompanias() {
    return reportsApiClient.getCompanias();
  },
};
