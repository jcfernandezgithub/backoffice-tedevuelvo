import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import type { FiltrosReporte, EstadoSolicitud, TipoSeguro } from '../types/reportTypes';

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Derivar filtros directamente desde la URL (única fuente de verdad)
  const filtros = useMemo<FiltrosReporte>(() => {
    const hoy = dayjs();
    const primerDiaMesActual = hoy.startOf('month');
    
    // Obtener fechas de la URL
    let fechaDesde = searchParams.get('fechaDesde');
    let fechaHasta = searchParams.get('fechaHasta');
    
    // Si no hay fechas, usar el mes actual como valor por defecto
    if (!fechaDesde) fechaDesde = primerDiaMesActual.format('YYYY-MM-DD');
    if (!fechaHasta) fechaHasta = hoy.format('YYYY-MM-DD');
    
    return {
      fechaDesde,
      fechaHasta,
      estados: searchParams.get('estados')?.split(',').filter(Boolean) as EstadoSolicitud[] || [],
      alianzas: searchParams.get('alianzas')?.split(',').filter(Boolean) || [],
      companias: searchParams.get('companias')?.split(',').filter(Boolean) || [],
      tiposSeguro: searchParams.get('tiposSeguro')?.split(',').filter(Boolean) as TipoSeguro[] || [],
      montoMin: searchParams.get('montoMin') ? Number(searchParams.get('montoMin')) : undefined,
      montoMax: searchParams.get('montoMax') ? Number(searchParams.get('montoMax')) : undefined,
    };
  }, [searchParams]);

  const actualizarFiltros = useCallback((nuevosFiltros: Partial<FiltrosReporte>) => {
    console.log('[useFilters] actualizarFiltros called with:', nuevosFiltros);
    
    // Merge con los filtros actuales derivados de la URL
    const filtrosActualizados = { ...filtros, ...nuevosFiltros };
    console.log('[useFilters] filtrosActualizados:', filtrosActualizados);
    
    // Sincronizar con URL
    const newParams = new URLSearchParams();
    if (filtrosActualizados.fechaDesde) newParams.set('fechaDesde', filtrosActualizados.fechaDesde);
    if (filtrosActualizados.fechaHasta) newParams.set('fechaHasta', filtrosActualizados.fechaHasta);
    if (filtrosActualizados.estados?.length) newParams.set('estados', filtrosActualizados.estados.join(','));
    if (filtrosActualizados.alianzas?.length) newParams.set('alianzas', filtrosActualizados.alianzas.join(','));
    if (filtrosActualizados.companias?.length) newParams.set('companias', filtrosActualizados.companias.join(','));
    if (filtrosActualizados.tiposSeguro?.length) newParams.set('tiposSeguro', filtrosActualizados.tiposSeguro.join(','));
    if (filtrosActualizados.montoMin) newParams.set('montoMin', filtrosActualizados.montoMin.toString());
    if (filtrosActualizados.montoMax) newParams.set('montoMax', filtrosActualizados.montoMax.toString());
    
    console.log('[useFilters] Setting URL params:', newParams.toString());
    setSearchParams(newParams);
  }, [filtros, setSearchParams]);

  const limpiarFiltros = useCallback(() => {
    const filtrosLimpios = {
      fechaDesde: dayjs().startOf('month').format('YYYY-MM-DD'),
      fechaHasta: dayjs().format('YYYY-MM-DD'),
    };
    
    setSearchParams(new URLSearchParams(filtrosLimpios));
  }, [setSearchParams]);

  return {
    filtros,
    actualizarFiltros,
    limpiarFiltros,
  };
}
