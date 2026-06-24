import { useQueryClient } from '@tanstack/react-query';
import { useAllRefunds } from './useAllRefunds';
import { useCallback } from 'react';

/**
 * Expone el estado del caché compartido de refunds para la pantalla Operación:
 * cuándo se cargaron los datos por última vez, si está actualizando y un refetch manual.
 */
export function useCacheStatus() {
  const queryClient = useQueryClient();
  const { isFetching, dataUpdatedAt } = useAllRefunds();

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['operacion-all-refunds'] });
  }, [queryClient]);

  return { isFetching, dataUpdatedAt, refresh };
}
