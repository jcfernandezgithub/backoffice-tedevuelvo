import { useAllRefunds } from './useAllRefunds';

/**
 * Detalle Financiero requiere una mirada financiera completa del año en curso,
 * independiente del rango de fechas del URL (que afecta al resto de Operación).
 *
 * - Usa `listV2` → filtra por `createdAt` (las solicitudes creadas en el año).
 * - Rango fijo: 1 enero – 31 diciembre del año actual.
 * - `queryKey` propio → caché independiente del resto de tabs; no se invalida
 *   al cambiar el date picker de Operación, y se reutiliza al volver al tab.
 */
export function useDetalleFinancieroRefunds() {
  const year = new Date().getFullYear();
  return useAllRefunds({
    fechaDesde: `${year}-01-01`,
    fechaHasta: `${year}-12-31`,
    endpoint: 'listV2',
  });
}