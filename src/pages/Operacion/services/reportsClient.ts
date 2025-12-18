import { reportsApiClient } from './reportsApiClient';
import type {
  FiltrosReporte,
  KpiData,
  TimeSeriesPoint,
  DistribucionItem,
  SlaMetric,
  FunnelStep,
  Granularidad,
} from '../types/reportTypes';

// Delegamos toda la lógica al nuevo cliente de API
export const reportsClient = {
  async getKpisResumen(filtros: FiltrosReporte): Promise<KpiData[]> {
    return reportsApiClient.getKpisResumen(filtros);
  },

  async getSerieTemporal(
    filtros: FiltrosReporte,
    granularidad: Granularidad,
    campo: 'cantidad' | 'montoRecuperado' | 'montoPagado' | 'tasaExito'
  ): Promise<TimeSeriesPoint[]> {
    return reportsApiClient.getSerieTemporal(filtros, granularidad, campo);
  },

  async getDistribucionPorEstado(filtros: FiltrosReporte): Promise<DistribucionItem[]> {
    return reportsApiClient.getDistribucionPorEstado(filtros);
  },

  async getDistribucionPorAlianza(filtros: FiltrosReporte): Promise<DistribucionItem[]> {
    return reportsApiClient.getDistribucionPorAlianza(filtros);
  },

  async getFunnelData(filtros: FiltrosReporte): Promise<FunnelStep[]> {
    return reportsApiClient.getFunnelData(filtros);
  },

  async getSlaMetrics(filtros: FiltrosReporte): Promise<SlaMetric[]> {
    return reportsApiClient.getSlaMetrics(filtros);
  },

  async getAlertas() {
    return reportsApiClient.getAlertas();
  },

  async getTablaResumen(filtros: FiltrosReporte, page = 1, pageSize = 10) {
    return reportsApiClient.getTablaResumen(filtros, page, pageSize);
  },

  async getAlianzas() {
    return reportsApiClient.getAlianzas();
  },

  async getCompanias() {
    return reportsApiClient.getCompanias();
  }
};