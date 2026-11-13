import { describe, expect, test } from 'bun:test'
import { documentUploadQuery, readDocumentFilters, writeDocumentFilters, santiagoShortcut, validateDocumentFilters, weeklyDocumentFilters } from '../src/lib/callCenterDocumentUploads'
import { createDocumentUploadsClient, documentUploadsList } from '../src/services/callCenterDocumentUploadsApi'

describe('Call Center document uploads contract', () => {
  test('initial weekly query has page 1 and limit 20, with no minimum or status override', () => {
    const query = documentUploadQuery({ ...weeklyDocumentFilters, status: 'PAID', minimumEstimatedAmountCLP: 0 } as typeof weeklyDocumentFilters)
    expect(query).toBe('preset=current_week&page=1&limit=20')
  })
  test('manual dates remain civil and never combine with the weekly preset', () => {
    expect(documentUploadQuery({ uploadedFrom: '2026-11-01', uploadedTo: '2026-11-13', page: 1, limit: 20 })).toContain('uploadedFrom=2026-11-01&uploadedTo=2026-11-13')
    expect(() => validateDocumentFilters({ ...weeklyDocumentFilters, uploadedFrom: '2026-11-01', uploadedTo: '2026-11-13' })).toThrow()
  })
  test('requires both valid ordered dates and at most 366 inclusive days', () => {
    const f = { uploadedFrom: '2026-01-01', uploadedTo: '2027-01-01', page: 1, limit: 20 }
    expect(() => validateDocumentFilters(f)).not.toThrow()
    expect(() => validateDocumentFilters({ ...f, uploadedTo: '2027-01-02' })).toThrow()
    expect(() => validateDocumentFilters({ ...f, uploadedTo: undefined })).toThrow()
    expect(() => validateDocumentFilters({ ...f, uploadedTo: '2025-12-31' })).toThrow()
    expect(() => validateDocumentFilters({ ...f, uploadedFrom: '2026-02-30' })).toThrow()
  })
  test('enforces page and limit bounds without adjusting them', () => {
    for (const limit of [0, 101, 1.5]) expect(() => documentUploadQuery({ ...weeklyDocumentFilters, limit })).toThrow()
    for (const page of [0, 100001, 1.5]) expect(() => documentUploadQuery({ ...weeklyDocumentFilters, page })).toThrow()
    expect(documentUploadQuery({ ...weeklyDocumentFilters, limit: 100 })).toContain('limit=100')
  })
  test('Santiago shortcuts use server time and seven days means today plus six previous days', () => {
    expect(santiagoShortcut('2026-11-14T01:00:00Z', 'today')).toEqual({ uploadedFrom: '2026-11-13', uploadedTo: '2026-11-13' })
    expect(santiagoShortcut('2026-11-14T01:00:00Z', 'yesterday')).toEqual({ uploadedFrom: '2026-11-12', uploadedTo: '2026-11-12' })
    expect(santiagoShortcut('2026-11-14T01:00:00Z', 'seven')).toEqual({ uploadedFrom: '2026-11-07', uploadedTo: '2026-11-13' })
    expect(santiagoShortcut('2026-09-06T03:30:00Z', 'today').uploadedFrom).toBe('2026-09-05')
  })
  test('omits empty fields, uses exact catalog values and disallows direct plus alliance', () => {
    const q = new URLSearchParams(documentUploadQuery({ ...weeklyDocumentFilters, q: '  ', institutionId: 'santander', documentKind: 'cedula_frente', insuranceToEvaluate: 'AMBOS' }))
    expect(q.has('q')).toBe(false)
    expect(q.get('institutionId')).toBe('santander')
    expect(q.get('documentKind')).toBe('cedula_frente')
    expect(q.get('insuranceToEvaluate')).toBe('AMBOS')
    expect(() => documentUploadQuery({ ...weeklyDocumentFilters, isPartner: '0', partnerId: '123456789012345678901234' })).toThrow()
  })
  test('keeps documents filters and page separate from general search', () => {
    const filters = { uploadedFrom: '2026-11-01', uploadedTo: '2026-11-13', q: 'Cliente', page: 2, limit: 20 }
    const params = writeDocumentFilters(new URLSearchParams('status=approved&page=3'), filters)
    expect(readDocumentFilters(params)).toEqual(filters)
    expect(params.get('page')).toBe('3')
    expect(params.get('status')).toBe('approved')
    expect(params.get('ccTab')).toBe('documents')
  })
  test('normalizes identity and status while preserving optional financial data and server total', async () => {
    const client = createDocumentUploadsClient(async () => Response.json({ items: [{ _id: 'id-1', publicId: 'SOL-1', status: 'DOCS_PENDING', statusHistory: [{ from: 'REQUESTED', to: 'DOCS_PENDING', at: '2026-11-13T12:00:00Z' }], documentUploads: { countInRange: 2, kindsInRange: ['attachment'], lastUploadedAtInRange: '2026-11-13T15:00:00Z' } }], pagination: { page: 1, limit: 20, total: 42 }, meta: {} }))
    const response = await client(weeklyDocumentFilters)
    expect(response.items[0].id).toBe('id-1')
    expect(response.items[0].status).toBe('docs_pending')
    expect(response.items[0].statusHistory[0].from).toBe('requested')
    expect(response.items[0].calculationSnapshot).toBeUndefined()
    expect(documentUploadsList(response)?.total).toBe(42)
    expect(documentUploadsList(response)?.totalPages).toBe(3)
    expect(documentUploadsList(response)?.items[0].documentUploads?.countInRange).toBe(2)
  })
  test('distinct errors are never converted into successful empty results', async () => {
    for (const [status, code] of [[401, 'UNAUTHORIZED'], [403, 'CALL_CENTER_FORBIDDEN'], [400, 'INVALID_DOCUMENT_UPLOAD_QUERY'], [404, 'MINIMUM_REFUND_NOT_CONFIGURED'], [503, 'MINIMUM_REFUND_INVALID']] as const) {
      const client = createDocumentUploadsClient(async () => Response.json({ error: { code, message: 'backend' } }, { status }))
      try { await client(weeklyDocumentFilters); throw new Error('expected rejection') }
      catch (error) { expect(error).toMatchObject({ status, code }) }
    }
  })
})