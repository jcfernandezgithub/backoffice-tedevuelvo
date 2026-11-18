import { describe, expect, it } from 'bun:test'
import { resolveStatusHistoryAuthor as resolve } from '../src/lib/statusHistoryAuthor'

describe('Server-owned history author identity', () => {
  it('uses the supplied current name without deriving an historical identity', () => {
    expect(resolve({ by: 'ID_EXISTENTE', byName: 'Nombre actual', byType: 'USER', byResolution: 'LOOKUP' }))
      .toMatchObject({ kind: 'named', label: 'Nombre actual', provenance: 'LOOKUP' })
  })
  it('preserves the server snapshot identity', () => {
    expect(resolve({ by: 'ID_AUTENTICADO', byName: 'Nombre al actuar', byType: 'USER', byResolution: 'SNAPSHOT' }))
      .toMatchObject({ kind: 'named', label: 'Nombre al actuar', provenance: 'SNAPSHOT' })
  })
  it('keeps an unresolved identifier only as a reference', () => {
    expect(resolve({ by: 'ID_NO_ENCONTRADO', byName: null, byType: 'UNKNOWN', byResolution: 'UNAVAILABLE' }))
      .toMatchObject({ kind: 'unavailable', reference: 'ID_NO_ENCONTRADO' })
  })
  it('does not invent an author for NOT_RECORDED events', () => {
    expect(resolve({ byName: null, byType: 'UNKNOWN', byResolution: 'NOT_RECORDED' }).kind).toBe('unrecorded')
  })
  it('requires both explicit server markers to identify a system event', () => {
    expect(resolve({ by: 'system', byName: null, byType: 'SYSTEM', byResolution: 'SYSTEM' }).kind).toBe('system')
    expect(resolve({ by: 'system', byName: null, byType: 'UNKNOWN', byResolution: 'UNAVAILABLE' }).kind).toBe('unavailable')
    expect(resolve({ by: 'system', byName: null, byType: 'SYSTEM', byResolution: 'UNAVAILABLE' }).kind).toBe('unavailable')
  })
  it('does not re-resolve a snapshot lacking a name', () => {
    expect(resolve({ by: 'ID_AUTENTICADO', byName: null, byType: 'USER', byResolution: 'SNAPSHOT' }))
      .toMatchObject({ kind: 'unavailable', reference: 'ID_AUTENTICADO', provenance: 'SNAPSHOT' })
  })
  it('preserves legacy attribution when the name is omitted, including permission-limited responses', () => {
    for (const by of ['ID_EXISTENTE', 'admin', 'system', 'correo@example.test']) {
      expect(resolve({ by })).toMatchObject({ kind: 'legacy', label: by })
      expect(resolve({ by, byType: 'USER', byResolution: 'SNAPSHOT' })).toMatchObject({ kind: 'legacy', label: by })
    }
    expect(resolve({})).toMatchObject({ kind: 'legacy', label: undefined })
  })
  it('treats a blank supplied name as unavailable rather than inventing a name', () => {
    expect(resolve({ by: 'ID_EXISTENTE', byName: '  ', byResolution: 'LOOKUP' }).kind).toBe('unavailable')
  })
})