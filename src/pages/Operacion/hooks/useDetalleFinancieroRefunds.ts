import { useAllRefunds } from './useAllRefunds';

/**
 * DETALLE FINANCIERO: histórico completo vía listV2 sin filtro de fechas.
 *
 * - Pedimos a listV2 sin `since`/`to` → backend retorna todo el histórico.
 * - El filtro por estado "Pagado" se aplica en el frontend (en la vista),
 *   manteniendo el comportamiento original del Detalle Financiero.
 */
export function useDetalleFinancieroRefunds() {
  return useAllRefunds({ endpoint: 'listV2' });
}