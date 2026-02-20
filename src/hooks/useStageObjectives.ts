import { useState, useCallback } from 'react';

export interface StageObjective {
  key: string;
  label: string;
  objetivo: number; // días
}

// 'qualifying' se excluye: es el punto de entrada del proceso, no tiene etapa previa medible
export const DEFAULT_STAGE_OBJECTIVES: StageObjective[] = [
  { key: 'docs_received',     label: 'Docs Recibidos',  objetivo: 5  },
  { key: 'submitted',         label: 'Ingresadas',       objetivo: 2  },
  { key: 'approved',          label: 'Aprobadas',        objetivo: 14 },
  { key: 'payment_scheduled', label: 'Pago Programado', objetivo: 3  },
  { key: 'paid',              label: 'Pagadas',          objetivo: 2  },
];

const STORAGE_KEY = 'tdv:stage-objectives';

function loadFromStorage(): StageObjective[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STAGE_OBJECTIVES;
    const parsed = JSON.parse(raw) as StageObjective[];
    // Aseguramos que todos los keys del default estén presentes
    return DEFAULT_STAGE_OBJECTIVES.map(def => {
      const saved = parsed.find(p => p.key === def.key);
      return saved ? { ...def, objetivo: saved.objetivo } : def;
    });
  } catch {
    return DEFAULT_STAGE_OBJECTIVES;
  }
}

/**
 * Hook que expone los objetivos por etapa con persistencia en localStorage.
 * Todos los consumidores (CuellosBotella, etc.) deben leer desde aquí.
 */
export function useStageObjectives() {
  const [objectives, setObjectives] = useState<StageObjective[]>(loadFromStorage);

  const save = useCallback((updated: StageObjective[]) => {
    setObjectives(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setObjectives(DEFAULT_STAGE_OBJECTIVES);
  }, []);

  const totalObjetivo = objectives.reduce((sum, s) => sum + s.objetivo, 0);

  return { objectives, save, reset, totalObjetivo };
}

/** Lectura síncrona (sin hook) para usarla fuera de componentes React */
export function readStageObjectives(): StageObjective[] {
  return loadFromStorage();
}
