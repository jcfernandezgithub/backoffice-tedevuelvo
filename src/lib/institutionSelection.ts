import type { Institution } from '@/services/institutionsService'

export function institutionOptions(institutions: Institution[]) {
  return institutions
    .filter(i => i.active && i.value.trim())
    .map(i => ({ ...i, value: i.value.trim().toLowerCase() }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

export function selectedInstitution(value: string | undefined, institutions: Institution[]) {
  const key = value?.trim().toLowerCase()
  return institutionOptions(institutions).find(i => i.value === key || i.label.trim().toLowerCase() === key)
}

export function validInstitutionChange(value: string | undefined, original: string | undefined, institutions: Institution[], available: boolean) {
  // Preserve legacy values when editing unrelated fields; never silently migrate them.
  if (value === original) return true
  return available && institutionOptions(institutions).some(i => i.value === value)
}