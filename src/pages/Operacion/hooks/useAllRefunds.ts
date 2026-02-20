import { useQuery } from '@tanstack/react-query';
import { refundAdminApi } from '@/services/refundAdminApi';
import type { RefundRequest } from '@/types/refund';

const STALE_TIME = 10 * 60 * 1000; // 10 minutos
const PAGE_SIZE = 100;

/**
 * Hook compartido que carga TODOS los refunds una sola vez para toda la pantalla Operación.
 * Todos los tabs consumen este mismo caché — sin fetches duplicados.
 */
export function useAllRefunds() {
  return useQuery<RefundRequest[]>({
    queryKey: ['operacion-all-refunds'],
    queryFn: async () => {
      // Primera página para conocer el total
      const firstPage = await refundAdminApi.list({ pageSize: PAGE_SIZE, page: 1 });
      const total = firstPage.total || 0;
      const totalPages = Math.ceil(total / PAGE_SIZE);

      let allItems = [...(firstPage.items || [])];

      // Páginas restantes en paralelo (lotes de 10 para no saturar)
      if (totalPages > 1) {
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        const BATCH_SIZE = 10;

        for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
          const batch = remainingPages.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(
            batch.map(page => refundAdminApi.list({ pageSize: PAGE_SIZE, page }))
          );
          results.forEach(r => { allItems = allItems.concat(r.items || []); });
        }
      }

      // Normalizar status a minúsculas
      return allItems.map(r => ({
        ...r,
        status: (r.status?.toLowerCase?.() || r.status) as any,
      }));
    },
    staleTime: STALE_TIME,
    gcTime: 15 * 60 * 1000, // Mantener en caché 15 minutos
  });
}
