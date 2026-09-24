import { authService } from './authService'
import type { BankInfo } from '@/types/refund'

const BASE = 'https://tedevuelvo-app-be.onrender.com/api/v1/refund-requests/admin'

export type BankChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | 'EXPIRED' | 'APPLIED_DIRECT'

export const BANK_CHANGE_STATUS_LABELS: Record<BankChangeStatus, string> = {
  PENDING: 'Pendiente de aprobación',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CANCELED: 'Cancelado',
  EXPIRED: 'Expirado',
  APPLIED_DIRECT: 'Aplicado directamente por administrador',
}

export interface BankChangeUser { userId?: string; email?: string; name?: string }

export interface BankInfoChange {
  _id: string
  refundId: string
  status: BankChangeStatus
  previousBankInfo: BankInfo | null
  newBankInfo: BankInfo
  reason?: string
  requestedBy?: BankChangeUser
  requestedAt?: string
  reviewedBy?: BankChangeUser
  reviewedAt?: string
  reviewComment?: string
  // Solo en la bandeja
  fullName?: string
  rut?: string
  institutionId?: string
  realAmount?: number
}

export interface BankCatalog { banks: string[]; accountTypes: string[] }

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_STATUS: 'El estado actual de la solicitud no permite esta operación.',
  PENDING_CHANGE_EXISTS: 'Ya existe un cambio de cuenta pendiente para esta solicitud.',
  BANK_CHANGE_PENDING: 'Hay un cambio de cuenta bancaria pendiente. El pago está bloqueado hasta resolverlo.',
  STALE_CHANGE: 'Los datos bancarios cambiaron desde que se creó la propuesta. Recarga y crea una nueva si corresponde.',
  CHANGE_NOT_PENDING: 'Otro usuario ya resolvió este cambio.',
  SELF_APPROVAL_NOT_ALLOWED: 'No puedes aprobar tu propia propuesta. Debe aprobarla otro administrador.',
  FORBIDDEN: 'No tienes permisos para realizar esta acción.',
  INVALID_PAYMENT_DATA: 'Faltan datos para realizar el pago.',
  BANK_CATALOG_NOT_CONFIGURED: 'Falta configurar el catálogo de bancos en el servidor.',
  TRANSACTIONS_REQUIRED: 'El servicio necesita configuración del servidor. Contacta al equipo técnico.',
}

export class BankChangeError extends Error {
  code?: string
  status: number
  details?: any
  constructor(message: string, status: number, code?: string, details?: any) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = authService.getAccessToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.status === 401) throw new BankChangeError('Sesión expirada', 401, 'UNAUTHORIZED')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const code: string | undefined = body?.code
    const raw = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
    const msg = code === 'VALIDATION_ERROR'
      ? raw || 'Datos inválidos'
      : (code && ERROR_MESSAGES[code]) || raw || 'Error en el servicio de cambios bancarios'
    throw new BankChangeError(msg, res.status, code, body)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const bankInfoChangesApi = {
  catalog: () => request<BankCatalog>('/bank-info-changes/catalog'),
  listForRefund: (publicId: string) =>
    request<BankInfoChange[]>(`/${publicId}/bank-info-changes`).then((r: any) => (Array.isArray(r) ? r : r?.data ?? [])),
  create: (publicId: string, bankInfo: Required<BankInfo>, reason?: string) =>
    request<{ change: BankInfoChange; applied: boolean }>(`/${publicId}/bank-info-changes`, {
      method: 'POST',
      body: JSON.stringify({ bankInfo, ...(reason ? { reason } : {}) }),
    }),
  listPending: (page = 1, limit = 20) =>
    request<{ data: BankInfoChange[]; meta: { total: number; page: number; limit: number } }>(
      `/bank-info-changes?status=PENDING&page=${page}&limit=${limit}`,
    ),
  countPending: () => request<{ count: number }>('/bank-info-changes/count?status=PENDING'),
  approve: (changeId: string, comment?: string) =>
    request(`/bank-info-changes/${changeId}/approve`, { method: 'POST', body: JSON.stringify(comment ? { comment } : {}) }),
  reject: (changeId: string, comment: string) =>
    request(`/bank-info-changes/${changeId}/reject`, { method: 'POST', body: JSON.stringify({ comment }) }),
  cancel: (changeId: string) =>
    request(`/bank-info-changes/${changeId}/cancel`, { method: 'POST', body: JSON.stringify({}) }),
  validatePayroll: (publicIds: string[]) =>
    request<any>('/bank-info-changes/validate-payroll', { method: 'POST', body: JSON.stringify({ publicIds }) }),
}

export function maskAccount(n?: string | null) {
  if (!n) return '—'
  const digits = n.replace(/\D/g, '')
  return digits.length <= 4 ? '****' : `****${digits.slice(-4)}`
}

/** Invalida todo lo relacionado con cambios bancarios. */
export function invalidateBankChanges(qc: import('@tanstack/react-query').QueryClient, publicId?: string) {
  if (publicId) {
    qc.invalidateQueries({ queryKey: ['refund', publicId] })
    qc.invalidateQueries({ queryKey: ['bank-info-changes', publicId] })
  }
  qc.invalidateQueries({ queryKey: ['bank-info-changes-pending'] })
  qc.invalidateQueries({ queryKey: ['bank-info-changes-count'] })
  qc.invalidateQueries({ queryKey: ['refunds'] })
}
