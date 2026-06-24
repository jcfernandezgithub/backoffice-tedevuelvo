import { useAllRefunds } from './useAllRefunds';

/**
 * COHORTE: solicitudes CREADAS en el año en curso (listV2 → createdAt).
 * Útil para ver qué porcentaje de lo creado este año ya se pagó.
 */
export function useDetalleFinancieroRefunds() {
  const year = new Date().getFullYear();
  return useAllRefunds({
    fechaDesde: `${year}-01-01`,
    fechaHasta: `${year}-12-31`,
    endpoint: 'listV2',
  });
}

/**
 * UNIVERSO COMPLETO / listV3: solicitudes actualizadas dentro del año en curso,
 * sin filtrar en frontend por estado.
 *
 * - Pedimos al backend listV3 (filtra por updatedAt) desde diciembre del año
 *   anterior para conservar el mes base de comparación del Δ de enero.
 * - No aplicamos un segundo filtro client-side por `paid`: el servicio ya trae
 *   el universo requerido para Detalle Financiero y la vista debe dibujar todo
 *   lo que retorna.
 * - `queryKey` propio → caché independiente; convive con la cohorte sin
 *   invalidarse mutuamente.
 */
export function useDetalleFinancieroCashflow() {
  const year = new Date().getFullYear();
  const baselineStart = `${year - 1}-12-01`;
  return useAllRefunds({
    fechaDesde: baselineStart,
    fechaHasta: `${year}-12-31`,
    endpoint: 'listV3',
  });
}