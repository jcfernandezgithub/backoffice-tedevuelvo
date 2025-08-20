import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import type { FiltrosReporte, EstadoSolicitud, TipoSeguro } from '../types/reportTypes';

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Inicializar filtros desde URL o valores por defecto
  const [filtros, setFiltros] = useState<FiltrosReporte>(() => {
    const fechaHasta = searchParams.get('fechaHasta') || dayjs().format('YYYY-MM-DD');
    const fechaDesde = searchParams.get('fechaDesde') || dayjs().subtract(3, 'month').format('YYYY-MM-DD');
    
    return {
      fechaDesde,
      fechaHasta,
      estados: searchParams.get('estados')?.split(',') as EstadoSolicitud[] || [],
      alianzas: searchParams.get('alianzas')?.split(',') || [],
      companias: searchParams.get('companias')?.split(',') || [],
      tiposSeguro: searchParams.get('tiposSeguro')?.split(',') as TipoSeguro[] || [],
      montoMin: searchParams.get('montoMin') ? Number(searchParams.get('montoMin')) : undefined,
      montoMax: searchParams.get('montoMax') ? Number(searchParams.get('montoMax')) : undefined,
    };
  });

  const actualizarFiltros = useCallback((nuevosFiltros: Partial<FiltrosReporte>) => {
    const filtrosActualizados = { ...filtros, ...nuevosFiltros };
    setFiltros(filtrosActualizados);
    
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
    
    setSearchParams(newParams);
  }, [filtros, setSearchParams]);

  const limpiarFiltros = useCallback(() => {
    const filtrosLimpios: FiltrosReporte = {
      fechaDesde: dayjs().subtract(3, 'month').format('YYYY-MM-DD'),
      fechaHasta: dayjs().format('YYYY-MM-DD'),
      estados: [],
      alianzas: [],
      companias: [],
      tiposSeguro: [],
      montoMin: undefined,
      montoMax: undefined,
    };
    
    setFiltros(filtrosLimpios);
    setSearchParams(new URLSearchParams({
      fechaDesde: filtrosLimpios.fechaDesde!,
      fechaHasta: filtrosLimpios.fechaHasta!,
    }));
  }, [setSearchParams]);

  return {
    filtros,
    actualizarFiltros,
    limpiarFiltros,
  };
}