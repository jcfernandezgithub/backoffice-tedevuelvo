import { useState, useCallback } from 'react';
import { INSTITUCIONES_DISPONIBLES } from '@/lib/calculadoraUtils';

export interface SafetyMargin {
  institution: string;
  margin: number; // %
  visibleInCalculator: boolean;
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
    visibleInCalculator: true,
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
      return saved
        ? {
            ...def,
            margin: saved.margin,
            visibleInCalculator:
              typeof saved.visibleInCalculator === 'boolean'
                ? saved.visibleInCalculator
                : true,
          }
        : def;
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

/**
 * Mapeo de institutionId (slug usado en snapshots / refunds) al label
 * de la institución mostrado en `INSTITUCIONES_DISPONIBLES`.
 */
const INSTITUTION_ID_TO_LABEL: Record<string, string> = {
  santander: 'Santander',
  bci: 'BCI',
  'lider-bci': 'Lider BCI',
  scotiabank: 'Scotiabank',
  chile: 'Chile',
  security: 'Security',
  'itau-corpbanca': 'Itaú - Corpbanca',
  itau: 'Itaú - Corpbanca',
  bice: 'BICE',
  estado: 'Estado',
  ripley: 'Banco Ripley',
  'banco-ripley': 'Banco Ripley',
  falabella: 'Falabella',
  consorcio: 'Consorcio',
  coopeuch: 'Coopeuch',
  cencosud: 'Cencosud',
  forum: 'Forum',
  tanner: 'Tanner',
  cooperativas: 'Cooperativas',
  'chevrolet-sf': 'Chevrolet SF',
  marubeni: 'Marubeni',
  'santander-consumer': 'Santander Consumer',
};

/** Obtiene el margen configurado a partir del institutionId (slug). */
export function getSafetyMarginByInstitutionId(
  institutionId: string | undefined | null,
): number {
  if (!institutionId) return 10;
  const key = institutionId.toLowerCase().trim();
  const label = INSTITUTION_ID_TO_LABEL[key];
  if (label) return getSafetyMarginFor(label);
  return getSafetyMarginFor(institutionId);
}

/** ¿La institución se muestra en la calculadora de TeDevuelvo? */
export function isInstitutionVisibleInCalculator(
  institution: string | undefined | null,
): boolean {
  if (!institution) return true;
  const all = loadFromStorage();
  const found = all.find(
    (m) => m.institution.toLowerCase().trim() === institution.toLowerCase().trim()
  );
  return found?.visibleInCalculator ?? true;
}