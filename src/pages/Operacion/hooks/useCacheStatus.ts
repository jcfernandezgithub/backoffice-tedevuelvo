import { useQueryClient } from '@tanstack/react-query';
import { useOperacionRefunds } from './useOperacionRefunds';
import { useCallback } from 'react';

/**
 * Expone el estado del caché compartido de refunds para la pantalla Operación:
 * cuándo se cargaron los datos por última vez, si está actualizando y un refetch manual.
 */
export function useCacheStatus() {
  const queryClient = useQueryClient();
  const { isFetching, dataUpdatedAt } = useOperacionRefunds();

  const refresh = useCallback(() => {
    // Invalida todas las variantes de all-refunds (cualquier rango/endpoint)
    queryClient.invalidateQueries({ queryKey: ['all-refunds'] });
  }, [queryClient]);

  return { isFetching, dataUpdatedAt, refresh };
}
