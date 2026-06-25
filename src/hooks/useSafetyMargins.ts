/**
 * Shim retro-compatible: las instituciones y márgenes ahora vienen del
 * backend (`GET /public/institutions`). Mantenemos los exports
 * `getSafetyMarginByInstitutionId` y `isInstitutionVisibleInCalculator` para
 * los consumidores existentes (Refunds/Detail, EditSnapshotDialog).
 */
import {
  getInstitutionMargin,
  isInstitutionActive,
} from './useInstitutions';

export function getSafetyMarginByInstitutionId(
  institutionId: string | undefined | null,
): number {
  return getInstitutionMargin(institutionId);
}

export function getSafetyMarginFor(institution: string | undefined | null): number {
  return getInstitutionMargin(institution);
}

export function isInstitutionVisibleInCalculator(
  institution: string | undefined | null,
): boolean {
  return isInstitutionActive(institution);
}