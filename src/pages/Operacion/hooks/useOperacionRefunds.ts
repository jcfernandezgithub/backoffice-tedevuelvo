import { useAllRefunds } from './useAllRefunds';
import { useFilters } from './useFilters';

/**
 * Wrapper que carga refunds para la pantalla Operación usando el rango de fechas
 * activo en los filtros (URL) y el endpoint listV3 (filtra por updatedAt, ideal
 * para cubrir transiciones de estado dentro del rango).
 *
 * Todos los tabs de Operación deben consumir este hook — al compartir el mismo
 * queryKey (mismas fechas + listV3), React Query sirve el mismo caché sin refetch.
 */
export function useOperacionRefunds() {
  const { filtros } = useFilters();
  return useAllRefunds({
    fechaDesde: filtros.fechaDesde,
    fechaHasta: filtros.fechaHasta,
    endpoint: 'listV3',
  });
}