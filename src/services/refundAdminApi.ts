import { authService } from './authService'
import type {
  RefundRequest,
  RefundDocument,
  AdminQueryParams,
  AdminListResponse,
  AdminUpdateStatusDto,
} from '@/types/refund'

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'

class RefundAdminApiClient {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = authService.getAccessToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async list(params: AdminQueryParams): Promise<AdminListResponse> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value))
      }
    })

    const response = await fetch(`${API_BASE_URL}/refund-requests/admin?${query}`, {
      headers: await this.getAuthHeaders(),
    })

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al cargar refunds' }))
      throw new Error(error.message || 'Error al cargar refunds')
    }

    return response.json()
  }

  async getById(id: string): Promise<RefundRequest> {
    const response = await fetch(`${API_BASE_URL}/refund-requests/admin/${id}`, {
      headers: await this.getAuthHeaders(),
    })

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al cargar detalle' }))
      throw new Error(error.message || 'Error al cargar detalle')
    }

    return response.json()
  }

  async updateStatus(id: string, dto: AdminUpdateStatusDto): Promise<RefundRequest> {
    const response = await fetch(`${API_BASE_URL}/refund-requests/admin/${id}/status`, {
      method: 'PATCH',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(dto),
    })

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al actualizar estado' }))
      throw new Error(error.message || 'Error al actualizar estado')
    }

    return response.json()
  }

  async listDocs(publicId: string, kinds?: string[]): Promise<RefundDocument[]> {
    const query = kinds?.length ? `?kinds=${kinds.join(',')}` : ''
    const response = await fetch(
      `${API_BASE_URL}/refund-requests/admin/${publicId}/refund-documents${query}`,
      {
        headers: await this.getAuthHeaders(),
      }
    )

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al cargar documentos' }))
      throw new Error(error.message || 'Error al cargar documentos')
    }

    return response.json()
  }

  downloadDoc(publicId: string, docId: string): void {
    const token = authService.getAccessToken()
    const url = `${API_BASE_URL}/refund-requests/admin/${publicId}/refund-documents/${docId}`
    const authUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url
    window.open(authUrl, '_blank')
  }
}

export const refundAdminApi = new RefundAdminApiClient()
