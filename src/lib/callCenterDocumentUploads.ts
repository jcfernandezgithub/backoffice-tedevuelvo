export interface DocumentUploadFilters {
  preset?: 'current_week'
  uploadedFrom?: string
  uploadedTo?: string
  q?: string
  documentKind?: string
  institutionId?: string
  insuranceToEvaluate?: 'CESANTIA' | 'DESGRAVAMEN' | 'AMBOS'
  isPartner?: '0' | '1'
  partnerId?: string
  sort?: 'document_uploaded_desc' | 'document_uploaded_asc'
  page: number
  limit: number
}

export const weeklyDocumentFilters: DocumentUploadFilters = { preset: 'current_week', page: 1, limit: 20 }
const keys = ['preset', 'uploadedFrom', 'uploadedTo', 'q', 'documentKind', 'institutionId', 'insuranceToEvaluate', 'isPartner', 'partnerId', 'sort', 'page', 'limit'] as const

export function documentUploadQuery(filters: DocumentUploadFilters): string {
  validateDocumentFilters(filters)
  const query = new URLSearchParams()
  for (const key of keys) {
    const value = filters[key]
    if (value !== undefined && String(value).trim()) query.set(key, String(value).trim())
  }
  return query.toString()
}

export function validateDocumentFilters(f: DocumentUploadFilters) {
  if (!Number.isInteger(f.page) || f.page < 1 || f.page > 100000) throw new Error('Página inválida.')
  if (!Number.isInteger(f.limit) || f.limit < 1 || f.limit > 100) throw new Error('La cantidad por página debe estar entre 1 y 100.')
  if ((f.q?.trim().length ?? 0) > 120) throw new Error('La búsqueda admite hasta 120 caracteres.')
  if (f.isPartner === '0' && f.partnerId) throw new Error('No se puede elegir una alianza para solicitudes directas.')
  if (f.preset) {
    if (f.preset !== 'current_week' || f.uploadedFrom || f.uploadedTo) throw new Error('Elige semana actual o un rango manual, no ambos.')
    return
  }
  const civil = (s?: string) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s)
  if (!civil(f.uploadedFrom) || !civil(f.uploadedTo)) throw new Error('Completa ambas fechas de carga válidas.')
  const days = (Date.parse(f.uploadedTo ?? '') - Date.parse(f.uploadedFrom ?? '')) / 86400000 + 1
  if (days < 1 || days > 366) throw new Error('El rango debe estar ordenado y no superar 366 días.')
}

export function santiagoShortcut(generatedAt: string, shortcut: 'today' | 'yesterday' | 'seven') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(generatedAt))
  const get = (type: string) => parts.find(p => p.type === type)?.value
  const today = `${get('year')}-${get('month')}-${get('day')}`
  const shift = (offset: number) => {
    const civil = new Date(`${today}T12:00:00Z`)
    civil.setUTCDate(civil.getUTCDate() + offset)
    return civil.toISOString().slice(0, 10)
  }
  return { uploadedFrom: shift(shortcut === 'seven' ? -6 : shortcut === 'yesterday' ? -1 : 0), uploadedTo: shortcut === 'yesterday' ? shift(-1) : today }
}

export function formatUploadDate(value?: string) {
  return value ? new Date(value).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' }) : '—'
}

export function readDocumentFilters(params: URLSearchParams): DocumentUploadFilters {
  const result: Record<string, string | number> = { page: 1, limit: 20 }
  for (const key of keys) {
    const value = params.get(`cc_${key}`)
    if (value) result[key] = key === 'page' || key === 'limit' ? Number(value) : value
  }
  if (!result.uploadedFrom && !result.uploadedTo) result.preset = 'current_week'
  return result as unknown as DocumentUploadFilters
}

export function writeDocumentFilters(params: URLSearchParams, filters: DocumentUploadFilters) {
  const next = new URLSearchParams(params)
  for (const key of keys) next.delete(`cc_${key}`)
  new URLSearchParams(documentUploadQuery(filters)).forEach((value, key) => next.set(`cc_${key}`, value))
  next.set('ccTab', 'documents')
  return next
}