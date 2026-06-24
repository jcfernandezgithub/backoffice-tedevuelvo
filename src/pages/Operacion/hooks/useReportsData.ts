import { useMemo } from 'react';
import { reportsClient } from '../services/reportsClient';
import { useAllRefunds } from './useAllRefunds';
import type { FiltrosReporte, Granularidad } from '../types/reportTypes';

const STALE_TIME = 10 * 60 * 1000; // 10 minutos (usado solo en useAlertas que sigue siendo async)

/**
 * Todos los hooks de reportes ahora consumen el caché compartido useAllRefunds.
 * Los cálculos son síncronos (useMemo) — sin fetches adicionales.
 */

export function useKpisResumen(filtros: FiltrosReporte) {
  const { data: allRefunds = [], isLoading } = useAllRefunds();
  const data = useMemo(
    () => allRefunds.length ? reportsClient.getKpisResumen(filtros, allRefunds) : undefined,
    [allRefunds, filtros]
  );
  return { data, isLoading };
}

export function useSerieTemporal(
  filtros: FiltrosReporte,
  granularidad: Granularidad,
  campo: 'cantidad' | 'montoRecuperado' | 'montoPagado' | 'tasaExito'
) {
  const { data: allRefunds = [], isLoading } = useAllRefunds();
  const data = useMemo(
    () => allRefunds.length ? reportsClient.getSerieTemporal(filtros, granularidad, campo, allRefunds) : undefined,
    [allRefunds, filtros, granularidad, campo]
  );
  return { data, isLoading };
}

export function useDistribucionPorEstado(filtros: FiltrosReporte) {
  const { data: allRefunds = [], isLoading } = useAllRefunds();
  const data = useMemo(
    () => allRefunds.length ? reportsClient.getDistribucionPorEstado(filtros, allRefunds) : undefined,
    [allRefunds, filtros]
  );
  return { data, isLoading };
}

export function useDistribucionPorAlianza(filtros: FiltrosReporte) {
  const { data: allRefunds = [], isLoading } = useAllRefunds();
  const data = useMemo(
    () => allRefunds.length ? reportsClient.getDistribucionPorAlianza(filtros, allRefunds) : undefined,
    [allRefunds, filtros]
  );
  return { data, isLoading };
}

export function useDistribucionPorTipoSeguro(filtros: FiltrosReporte) {
  const { data: allRefunds = [], isLoading } = useAllRefunds();
  const data = useMemo(
    () => allRefunds.length ? reportsClient.getDistribucionPorTipoSeguro(filtros, allRefunds) : undefined,
    [allRefunds, filtros]
  );
  return { data, isLoading };
}

export function useKpisSegmentos(filtros: FiltrosReporte) {
  const { data: allRefunds = [], isLoading } = useAllRefunds();
  const data = useMemo(
    () => allRefunds.length ? reportsClient.getKpisSegmentos(filtros, allRefunds) : undefined,
    [allRefunds, filtros]
  );
  return { data, isLoading };
}

export function useFunnelData(filtros: FiltrosReporte) {
  const { data: allRefunds = [], isLoading } = useAllRefunds();
  const data = useMemo(
    () => allRefunds.length ? reportsClient.getFunnelData(filtros, allRefunds) : undefined,
    [allRefunds, filtros]
  );
  return { data, isLoading };
}

export function useSlaMetrics(filtros: FiltrosReporte) {
  const { data: allRefunds = [], isLoading } = useAllRefunds();
  const data = useMemo(
    () => allRefunds.length ? reportsClient.getSlaMetrics(filtros, allRefunds) : undefined,
    [allRefunds, filtros]
  );
  return { data, isLoading };
}

export function useAlertas() {
  // Las alertas son estáticas por ahora — no requieren fetch
  const data = useMemo(() => reportsClient.getAlertas(), []);
  return { data, isLoading: false };
}

export function useTablaResumen(filtros: FiltrosReporte, page = 1, pageSize = 10) {
  const { data: allRefunds = [], isLoading } = useAllRefunds();
  const data = useMemo(
    () => allRefunds.length ? reportsClient.getTablaResumen(filtros, allRefunds, page, pageSize) : undefined,
    [allRefunds, filtros, page, pageSize]
  );
  return { data, isLoading };
}

export function useAlianzas() {
  return { data: [], isLoading: false };
}

export function useCompanias() {
  return { data: [], isLoading: false };
}
