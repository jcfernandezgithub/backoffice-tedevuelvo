import { useAllRefunds } from './useAllRefunds';
import { useMemo } from 'react';

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
 * CAJA REAL: solicitudes que pasaron a "paid" dentro del año en curso,
 * sin importar cuándo se crearon.
 *
 * - Pedimos al backend listV3 (filtra por updatedAt) acotado al año → conjunto
 *   reducido de candidatos que tuvieron actividad en el año.
 * - Luego filtramos client-side por la fecha real del transición a "paid".
 * - `queryKey` propio → caché independiente; convive con la cohorte sin
 *   invalidarse mutuamente.
 */
export function useDetalleFinancieroCashflow() {
  const year = new Date().getFullYear();
  const query = useAllRefunds({
    fechaDesde: `${year}-01-01`,
    fechaHasta: `${year}-12-31`,
    endpoint: 'listV3',
  });

  const data = useMemo(() => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return (query.data || []).filter((r: any) => {
      // Buscar la transición a "paid" más reciente (statusHistory ya viene lowercased)
      const paidEntry = r.statusHistory
        ?.slice()
        .reverse()
        .find((e: any) => e.to === 'paid');
      const dateStr = paidEntry?.at;
      if (!dateStr) return false;
      const day = dateStr.split('T')[0];
      return day >= start && day <= end;
    });
  }, [query.data, year]);

  return { ...query, data };
}