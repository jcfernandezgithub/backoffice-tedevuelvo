export type RefundStatus =
  | 'simulated'
  | 'requested'
  | 'qualifying'
  | 'docs_pending'
  | 'docs_received'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'payment_scheduled'
  | 'paid'
  | 'canceled'

export interface StatusHistoryEntry {
  at: string
  from: RefundStatus | null
  to: RefundStatus
  note?: string
  by?: string
}

export interface RefundRequest {
  id: string
  publicId: string
  status: RefundStatus
  statusHistory: StatusHistoryEntry[]
  fullName: string
  email: string
  rut: string
  phone?: string
  institutionId: string
  estimatedAmountCLP: number
  currency: string
  calculationSnapshot?: any
  createdAt: string
  updatedAt: string
  signatureUrl?: string
  signedAt?: string
  clientTokenHash?: string
}

export interface RefundDocument {
  id: string
  kind: string
  key: string
  contentType: string
  size: number
  createdAt: string
}

export interface AdminQueryParams {
  search?: string
  email?: string
  rut?: string
  publicId?: string
  status?: RefundStatus
  from?: string
  to?: string
  page?: number
  pageSize?: number
  sort?: 'createdAt:desc' | 'createdAt:asc' | 'status:asc' | 'status:desc'
}

export interface AdminListResponse {
  total: number
  page: number
  pageSize: number
  items: RefundRequest[]
}

export interface AdminUpdateStatusDto {
  status: RefundStatus
  note?: string
  by?: string
  force?: boolean
}
