import { useState, useCallback } from 'react';
import { INSTITUCIONES_DISPONIBLES } from '@/lib/calculadoraUtils';

export interface SafetyMargin {
  institution: string;
  margin: number; // %
}

const HIGH_RISK = new Set([
  'Itaú - Corpbanca',
  'Santander Consumer',
  'Consorcio',
  'Scotiabank',
]);

export const DEFAULT_SAFETY_MARGINS: SafetyMargin[] = INSTITUCIONES_DISPONIBLES.map(
  (institution) => ({
    institution,
    margin: HIGH_RISK.has(institution) ? 20 : 10,
  })
);

const STORAGE_KEY = 'tdv:safety-margins';

function loadFromStorage(): SafetyMargin[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SAFETY_MARGINS;
    const parsed = JSON.parse(raw) as SafetyMargin[];
    // Asegurar que todas las instituciones del default estén
    return DEFAULT_SAFETY_MARGINS.map((def) => {
      const saved = parsed.find((p) => p.institution === def.institution);
      return saved ? { ...def, margin: saved.margin } : def;
    });
  } catch {
    return DEFAULT_SAFETY_MARGINS;
  }
}

/**
 * Hook para márgenes de seguridad configurables por institución financiera.
 * El margen es el % de resguardo aplicado sobre la devolución bruta.
 */
export function useSafetyMargins() {
  const [margins, setMargins] = useState<SafetyMargin[]>(loadFromStorage);

  const save = useCallback((updated: SafetyMargin[]) => {
    setMargins(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMargins(DEFAULT_SAFETY_MARGINS);
  }, []);

  return { margins, save, reset };
}

/** Lectura síncrona (sin hook) para usar fuera de componentes React */
export function readSafetyMargins(): SafetyMargin[] {
  return loadFromStorage();
}

/** Obtiene el margen configurado para una institución (default 10%) */
export function getSafetyMarginFor(institution: string | undefined | null): number {
  if (!institution) return 10;
  const all = loadFromStorage();
  const found = all.find(
    (m) => m.institution.toLowerCase().trim() === institution.toLowerCase().trim()
  );
  return found?.margin ?? 10;
}