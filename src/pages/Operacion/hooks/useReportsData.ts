import { useQuery } from '@tanstack/react-query';
import { reportsClient } from '../services/reportsClient';
import type { FiltrosReporte, Granularidad } from '../types/reportTypes';

export function useKpisResumen(filtros: FiltrosReporte) {
  return useQuery({
    queryKey: ['reportes', 'kpis', filtros],
    queryFn: () => reportsClient.getKpisResumen(filtros),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useSerieTemporal(
  filtros: FiltrosReporte, 
  granularidad: Granularidad, 
  campo: 'cantidad' | 'montoRecuperado' | 'montoPagado' | 'tasaExito'
) {
  return useQuery({
    queryKey: ['reportes', 'serie-temporal', filtros, granularidad, campo],
    queryFn: () => reportsClient.getSerieTemporal(filtros, granularidad, campo),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDistribucionPorEstado(filtros: FiltrosReporte) {
  return useQuery({
    queryKey: ['reportes', 'distribucion-estado', filtros],
    queryFn: () => reportsClient.getDistribucionPorEstado(filtros),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDistribucionPorAlianza(filtros: FiltrosReporte) {
  return useQuery({
    queryKey: ['reportes', 'distribucion-alianza', filtros],
    queryFn: () => reportsClient.getDistribucionPorAlianza(filtros),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDistribucionPorTipoSeguro(filtros: FiltrosReporte) {
  return useQuery({
    queryKey: ['reportes', 'distribucion-tipo-seguro', filtros],
    queryFn: () => reportsClient.getDistribucionPorTipoSeguro(filtros),
    staleTime: 5 * 60 * 1000,
  });
}

export function useKpisSegmentos(filtros: FiltrosReporte) {
  return useQuery({
    queryKey: ['reportes', 'kpis-segmentos', filtros],
    queryFn: () => reportsClient.getKpisSegmentos(filtros),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFunnelData(filtros: FiltrosReporte) {
  return useQuery({
    queryKey: ['reportes', 'funnel', filtros],
    queryFn: () => reportsClient.getFunnelData(filtros),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSlaMetrics(filtros: FiltrosReporte) {
  return useQuery({
    queryKey: ['reportes', 'sla', filtros],
    queryFn: () => reportsClient.getSlaMetrics(filtros),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAlertas() {
  return useQuery({
    queryKey: ['reportes', 'alertas'],
    queryFn: () => reportsClient.getAlertas(),
    staleTime: 2 * 60 * 1000, // 2 minutos para alertas
  });
}

export function useTablaResumen(filtros: FiltrosReporte, page = 1, pageSize = 10) {
  return useQuery({
    queryKey: ['reportes', 'tabla-resumen', filtros, page, pageSize],
    queryFn: () => reportsClient.getTablaResumen(filtros, page, pageSize),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAlianzas() {
  return useQuery({
    queryKey: ['reportes', 'alianzas'],
    queryFn: () => reportsClient.getAlianzas(),
    staleTime: 30 * 60 * 1000, // 30 minutos
  });
}

export function useCompanias() {
  return useQuery({
    queryKey: ['reportes', 'companias'],
    queryFn: () => reportsClient.getCompanias(),
    staleTime: 30 * 60 * 1000,
  });
}