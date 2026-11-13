import { authenticatedFetch } from './apiClient'
import { documentUploadQuery, type DocumentUploadFilters } from '@/lib/callCenterDocumentUploads'
import type { RefundRequest, AdminListResponse } from '@/types/refund'

export interface DocumentUploadMetrics {
  countInRange: number
  lastUploadedAtInRange: string
  kindsInRange: string[]
}
export interface DocumentUploadMeta {
  timezone: 'America/Santiago'
  uploadedFrom: string
  uploadedTo: string
  preset: 'current_week' | null
  fromUTC: string
  toExclusiveUTC: string
  currentStatus: 'DOCS_PENDING'
  minimumRefundApplied: true
  minimumRefundValueCLP: number
  minimumRefundField: 'estimatedAmountCLP'
  minimumRefundComparison: 'GT'
  minimumRefundConfigurationId: string
  availableDocumentKinds: string[]
  maxRangeDays: 366
  maxLimit: 100
  scope: 'GLOBAL' | 'SCOPED'
  generatedAt: string
}
export interface DocumentUploadResponse {
  items: RefundRequest[]
  pagination: { page: number; limit: number; total: number }
  meta: DocumentUploadMeta
}
export class DocumentUploadsError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
const messages: Record<number, string> = {
  401: 'Tu sesión venció. Inicia sesión nuevamente.',
  403: 'No tienes permiso para consultar estos documentos.',
  400: 'Revisa los filtros de la búsqueda.',
  404: 'No hay una devolución mínima activa configurada. Solicita su configuración en Ajustes.',
  503: 'La consulta no está disponible. Inténtalo nuevamente.',
}
export function createDocumentUploadsClient(fetcher: typeof authenticatedFetch) {
  return async (filters: DocumentUploadFilters, signal?: AbortSignal): Promise<DocumentUploadResponse> => {
    const response = await fetcher(`/refund-requests/admin/call-center/document-uploads?${documentUploadQuery(filters)}`, { signal, cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) {
      const code = body.error?.code ?? 'DOCUMENT_UPLOADS_UNAVAILABLE'
      const message = response.status === 404 && code !== 'MINIMUM_REFUND_NOT_CONFIGURED'
        ? 'El servicio de Documentos subidos no está disponible en este ambiente.'
        : messages[response.status] ?? body.error?.message ?? 'No se pudo consultar Documentos subidos.'
      throw new DocumentUploadsError(response.status, code, message)
    }
    return { ...body, items: body.items.map((item: RefundRequest & { _id?: string }) => ({ ...item, id: item.id || item._id, status: item.status.toLowerCase(), statusHistory: item.statusHistory.map(entry => ({ ...entry, from: entry.from?.toLowerCase() ?? null, to: entry.to?.toLowerCase() })) })) }
  }
}
export const loadDocumentUploads = createDocumentUploadsClient(authenticatedFetch)
export function documentUploadsList(response?: DocumentUploadResponse): AdminListResponse | undefined {
  if (!response) return undefined
  const { page, limit, total } = response.pagination
  return { items: response.items, total, page, pageSize: limit, totalPages: Math.max(1, Math.ceil(total / limit)), hasNext: page * limit < total, hasPrev: page > 1 }
}