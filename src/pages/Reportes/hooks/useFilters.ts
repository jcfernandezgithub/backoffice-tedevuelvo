import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import type { FiltrosReporte, EstadoSolicitud, TipoSeguro } from '../types/reportTypes';

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Inicializar filtros desde URL o valores por defecto
  const [filtros, setFiltros] = useState<FiltrosReporte>(() => {
    const hoy = dayjs();
    const hace3Meses = hoy.subtract(3, 'month');
    
    // Validar que las fechas de la URL sean razonables (no en el futuro)
    let fechaDesde = searchParams.get('fechaDesde');
    let fechaHasta = searchParams.get('fechaHasta');
    
    // Si las fechas están en el futuro, usar valores por defecto
    if (fechaDesde && dayjs(fechaDesde).isAfter(hoy, 'day')) {
      fechaDesde = hace3Meses.format('YYYY-MM-DD');
    }
    if (fechaHasta && dayjs(fechaHasta).isAfter(hoy, 'day')) {
      fechaHasta = hoy.format('YYYY-MM-DD');
    }
    
    // Si no hay fechas, usar valores por defecto
    if (!fechaDesde) fechaDesde = hace3Meses.format('YYYY-MM-DD');
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