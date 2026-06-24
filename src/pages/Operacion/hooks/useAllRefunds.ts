import { useQuery } from '@tanstack/react-query';
import { refundAdminApi } from '@/services/refundAdminApi';
import type { RefundRequest } from '@/types/refund';

const STALE_TIME = 10 * 60 * 1000; // 10 minutos
const PAGE_SIZE = 500;

export interface UseAllRefundsOptions {
  /** Fecha inicio en formato YYYY-MM-DD (se envía como `since` al backend). */
  fechaDesde?: string;
  /** Fecha fin en formato YYYY-MM-DD (se envía como `to` al backend). */
  fechaHasta?: string;
  /**
   * Endpoint a consultar:
   * - `listV2` (default): filtra por `createdAt`. Ideal para Dashboard.
   * - `listV3`: filtra por `updatedAt`. Ideal para Operación (cubre transiciones de estado).
   */
  endpoint?: 'listV2' | 'listV3';
  /** Si es `false`, el query no se ejecuta. Default: `true`. */
  enabled?: boolean;
}

/**
 * Hook compartido que carga TODOS los refunds (paginado interno) para una ventana de fechas.
 * El backend filtra por fecha → drásticamente menos datos cuando se acota el rango.
 * El queryKey incluye los parámetros, por lo que cambios de rango invalidan el caché correctamente.
 */
export function useAllRefunds(options: UseAllRefundsOptions = {}) {
  const { fechaDesde, fechaHasta, endpoint = 'listV2', enabled = true } = options;
  return useQuery<RefundRequest[]>({
    queryKey: ['all-refunds', endpoint, fechaDesde || null, fechaHasta || null],
    enabled,
    queryFn: async ({ signal }) => {
      const baseParams = {
        pageSize: PAGE_SIZE,
        endpoint,
        from: fechaDesde,
        to: fechaHasta,
      };
      // Primera página para conocer el total
      const firstPage = await refundAdminApi.list({ ...baseParams, page: 1 }, signal);
      const total = firstPage.total || 0;
      // Usar el pageSize REAL devuelto por el backend (meta.limit), no el solicitado.
      // Si el backend recorta el límite (ej: pide 500, entrega 200), recalculamos para no perder páginas.
      const effectivePageSize = firstPage.pageSize || (firstPage.items?.length ?? PAGE_SIZE) || PAGE_SIZE;
      const totalPages = firstPage.totalPages && firstPage.totalPages > 0
        ? firstPage.totalPages
        : Math.ceil(total / effectivePageSize);

      // [DEBUG] Validación de desfase: log de los meta de la primera página
      console.groupCollapsed(`[useAllRefunds] ${endpoint} → page 1 meta`);
      console.log({
        requestedPageSize: PAGE_SIZE,
        metaLimit: firstPage.pageSize,
        metaTotal: total,
        metaPages: firstPage.totalPages,
        itemsReturned: firstPage.items?.length ?? 0,
        effectivePageSize,
        totalPagesUsed: totalPages,
        expectedByCalc: effectivePageSize > 0 ? Math.ceil(total / effectivePageSize) : 1,
      });
      console.groupEnd();

      let allItems = [...(firstPage.items || [])];

      // Páginas restantes en paralelo (lotes de 10 para no saturar)
      if (totalPages > 1) {
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
        const BATCH_SIZE = 10;

        for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          const batch = remainingPages.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(
            batch.map(page => refundAdminApi.list({ ...baseParams, page }, signal))
          );
          results.forEach((r, idx) => {
            const pageNum = batch[idx];
            const got = r.items?.length ?? 0;
            // Última página puede traer menos; el resto debería traer effectivePageSize
            const isLast = pageNum === totalPages;
            const expected = isLast
              ? Math.max(0, total - effectivePageSize * (totalPages - 1))
              : effectivePageSize;
            if (got !== expected) {
              console.warn(
                `[useAllRefunds] ${endpoint} page ${pageNum}: esperaba ${expected}, recibió ${got}`,
                { metaLimit: r.pageSize, metaTotal: r.total, metaPages: r.totalPages }
              );
            }
            allItems = allItems.concat(r.items || []);
          });
        }
      }

      // [DEBUG] Resumen final: comparar acumulado vs total reportado
      if (allItems.length !== total) {
        console.warn(
          `[useAllRefunds] ${endpoint} DESFASE: acumulé ${allItems.length} items, meta.total=${total} (diff=${total - allItems.length})`
        );
      } else {
        console.info(`[useAllRefunds] ${endpoint} OK: ${allItems.length} items === meta.total`);
      }

      // Normalizar status Y statusHistory a minúsculas
      // (la API devuelve los estados en MAYÚSCULAS, ej: "QUALIFYING", "DOCS_RECEIVED")
      return allItems.map(r => ({
        ...r,
        status: (r.status?.toLowerCase?.() || r.status) as any,
        statusHistory: (r.statusHistory || []).map(h => ({
          ...h,
          to: (h.to?.toLowerCase?.() || h.to) as any,
          from: h.from ? ((h.from?.toLowerCase?.() || h.from) as any) : h.from,
        })),
      }));
    },
    staleTime: STALE_TIME,
    gcTime: 15 * 60 * 1000, // Mantener en caché 15 minutos
  });
}
