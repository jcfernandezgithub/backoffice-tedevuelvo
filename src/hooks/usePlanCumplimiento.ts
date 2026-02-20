import { useState, useCallback } from 'react';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export type MesIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** Plan de cumplimiento para un año: monto objetivo de prima recuperada por mes (CLP) */
export type PlanAnual = Record<MesIndex, number>;

/** Todos los planes guardados, indexados por año */
export type PlanesGuardados = Record<number, PlanAnual>;

const STORAGE_KEY = 'tdv:plan-cumplimiento';

export function planAnualVacio(): PlanAnual {
  return Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [i, 0])
  ) as PlanAnual;
}

function loadFromStorage(): PlanesGuardados {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PlanesGuardados;
  } catch {
    return {};
  }
}

/**
 * Hook para gestionar el plan de cumplimiento mensual de primas recuperadas.
 * Persiste en localStorage. Cada año tiene su propio plan de 12 meses.
 */
export function usePlanCumplimiento() {
  const [planes, setPlanes] = useState<PlanesGuardados>(loadFromStorage);

  const getPlanAnio = useCallback(
    (anio: number): PlanAnual => planes[anio] ?? planAnualVacio(),
    [planes]
  );

  const savePlanAnio = useCallback((anio: number, plan: PlanAnual) => {
    setPlanes(prev => {
      const next = { ...prev, [anio]: plan };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetPlanAnio = useCallback((anio: number) => {
    setPlanes(prev => {
      const next = { ...prev };
      delete next[anio];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  /** ¿Tiene al menos un mes configurado? */
  const tieneплан = useCallback(
    (anio: number) => {
      const plan = planes[anio];
      if (!plan) return false;
      return Object.values(plan).some(v => v > 0);
    },
    [planes]
  );

  const aniosConPlan = Object.keys(planes)
    .map(Number)
    .filter(y => tieneplan(y))
    .sort((a, b) => b - a);

  function tieneplan(anio: number) {
    const plan = planes[anio];
    if (!plan) return false;
    return Object.values(plan).some(v => v > 0);
  }

  return { planes, getPlanAnio, savePlanAnio, resetPlanAnio, tieneplan, aniosConPlan };
}

/** Lectura síncrona sin hook (para usarla fuera de React) */
export function readPlanCumplimiento(): PlanesGuardados {
  return loadFromStorage();
}
