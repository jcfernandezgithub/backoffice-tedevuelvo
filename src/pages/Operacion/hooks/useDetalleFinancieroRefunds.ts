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
 * - Pedimos al backend listV3 (filtra por updatedAt) desde diciembre del año
 *   anterior para conservar el mes base de comparación del Δ de enero.
 * - Luego filtramos client-side por la fecha real de pago. Si el historial no
 *   trae una transición explícita a "paid", usamos updatedAt como fallback para
 *   no perder pagos históricos que sí vienen con status paid.
 * - `queryKey` propio → caché independiente; convive con la cohorte sin
 *   invalidarse mutuamente.
 */
export function useDetalleFinancieroCashflow() {
  const year = new Date().getFullYear();
  const baselineStart = `${year - 1}-12-01`;
  const query = useAllRefunds({
    fechaDesde: baselineStart,
    fechaHasta: `${year}-12-31`,
    endpoint: 'listV3',
  });

  const data = useMemo(() => {
    const start = baselineStart;
    const end = `${year}-12-31`;
    return (query.data || []).filter((r: any) => {
      if (r.status !== 'paid') return false;

      // Buscar la transición a "paid" más reciente (statusHistory ya viene lowercased)
      const paidEntry = r.statusHistory
        ?.slice()
        .reverse()
        .find((e: any) => e.to === 'paid');
      const dateStr = paidEntry?.at || r.updatedAt || r.createdAt;
      if (!dateStr) return false;
      const day = dateStr.split('T')[0];
      return day >= start && day <= end;
    });
  }, [query.data, baselineStart, year]);

  return { ...query, data };
}