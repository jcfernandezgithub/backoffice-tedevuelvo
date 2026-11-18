import type { StatusHistoryEntry } from '../types/refund'

type AuthorEntry = Pick<StatusHistoryEntry, 'by' | 'byName' | 'byType' | 'byResolution'>

export function resolveStatusHistoryAuthor(entry: AuthorEntry) {
  const id = entry.by?.trim() || undefined
  const name = entry.byName?.trim()
  const provenance = entry.byResolution === 'LOOKUP' || entry.byResolution === 'SNAPSHOT'
    ? entry.byResolution : undefined
  if (name) return { kind: 'named' as const, label: name, provenance }
  if (entry.byType === 'SYSTEM' && entry.byResolution === 'SYSTEM') {
    return { kind: 'system' as const, label: 'Sistema' }
  }
  // An omitted name is not proof of a failed lookup: permissions and older
  // servers may omit it. Preserve the original presentation in that case.
  if (entry.byName === undefined) {
    return { kind: 'legacy' as const, label: entry.by || undefined }
  }
  if (entry.byResolution === 'NOT_RECORDED' || !id) {
    return { kind: 'unrecorded' as const, label: 'Autor no registrado' }
  }
  return { kind: 'unavailable' as const, label: 'Usuario no disponible', reference: id, provenance }
}