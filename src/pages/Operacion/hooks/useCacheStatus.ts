import { useQueryClient } from '@tanstack/react-query';
import { useAllRefunds } from './useAllRefunds';
import { useCallback, useMemo } from 'react';
import dayjs from 'dayjs';

/**
 * Expone el estado del caché compartido de refunds para la pantalla Operación:
 * cuándo se cargaron los datos por última vez, si está actualizando y un refetch manual.
 */
export function useCacheStatus() {
  const queryClient = useQueryClient();
  // Usar el mismo rango por defecto (mes actual) que Dashboard/Operación/UrgentAlerts
  // para reutilizar el caché compartido y no disparar un listV2 sin fechas.
  const since = useMemo(() => dayjs().startOf('month').format('YYYY-MM-DD'), []);
  const to = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const { isFetching, dataUpdatedAt } = useAllRefunds({ since, to });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['operacion-all-refunds'] });
  }, [queryClient]);

  return { isFetching, dataUpdatedAt, refresh };
}
