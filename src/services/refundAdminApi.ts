import { authService } from './authService'
import type {
  RefundRequest,
  RefundDocument,
  AdminQueryParams,
  AdminListResponse,
  AdminUpdateStatusDto,
} from '@/types/refund'

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'

// Normalizar el status del servicio a nuestro formato interno
function normalizeStatus(status: string): string {
  return status.toLowerCase()
}

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
    
    // Mapear parámetros al nuevo endpoint listV2
    query.append('page', String(params.page || 1))
    query.append('limit', String(params.pageSize || 20))
    
    // Pasar filtros adicionales si el backend los soporta
    if (params.search) query.append('search', params.search)
    if (params.status) query.append('status', params.status.toUpperCase())
    if (params.from) query.append('from', params.from)
    if (params.to) query.append('to', params.to)
    if (params.sort) query.append('sort', params.sort)

    const response = await fetch(`${API_BASE_URL}/refund-requests/admin/listV2?${query}`, {
      headers: await this.getAuthHeaders(),
    })

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al cargar refunds' }))
      throw new Error(error.message || 'Error al cargar refunds')
    }

    const responseData = await response.json()
    
    // Adaptar respuesta del nuevo formato a nuestro formato interno
    // El nuevo endpoint retorna: { data: [...], meta: { page, limit, total, pages, hasNext, hasPrev } }
    const items = (responseData.data || []).map((item: any) => ({
      ...item,
      status: normalizeStatus(item.status)
    }))
    
    const meta = responseData.meta || {}
    
    return {
      total: meta.total || items.length,
      page: meta.page || params.page || 1,
      pageSize: meta.limit || params.pageSize || 20,
      totalPages: meta.pages || 1,
      hasNext: meta.hasNext || false,
      hasPrev: meta.hasPrev || false,
      items
    }
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

    const data = await response.json()
    return {
      ...data,
      status: normalizeStatus(data.status)
    }
  }

  async updateStatus(id: string, dto: AdminUpdateStatusDto): Promise<RefundRequest> {
    // Convertir el status a mayúsculas para el backend
    const backendDto = {
      ...dto,
      status: dto.status.toUpperCase()
    }
    
    const response = await fetch(`${API_BASE_URL}/refund-requests/admin/${id}/status`, {
      method: 'PATCH',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(backendDto),
    })

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al actualizar estado' }))
      throw new Error(error.message || 'Error al actualizar estado')
    }

    const data = await response.json()
    return {
      ...data,
      status: normalizeStatus(data.status)
    }
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

  async downloadDoc(publicId: string, docId: string): Promise<void> {
    const headers = await this.getAuthHeaders()
    const url = `${API_BASE_URL}/refund-requests/admin/${publicId}/refund-documents/${docId}`
    
    try {
      const response = await fetch(url, { headers })
      
      if (!response.ok) {
        throw new Error('Error al descargar documento')
      }
      
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      // Extraer nombre del archivo del header o usar ID
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const filename = filenameMatch ? filenameMatch[1].replace(/['"]/g, '') : `documento-${docId}`
      
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Liberar memoria
      URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Error downloading document:', error)
      throw error
    }
  }

  async listByPartner(partnerId: string): Promise<RefundRequest[]> {
    const response = await fetch(`${API_BASE_URL}/partner-refunds/partner/${partnerId}`, {
      headers: await this.getAuthHeaders(),
    })

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al cargar solicitudes del partner' }))
      throw new Error(error.message || 'Error al cargar solicitudes del partner')
    }

    const data = await response.json()
    
    // Normalizar los estados en la respuesta
    if (Array.isArray(data)) {
      return data.map(item => ({
        ...item,
        status: normalizeStatus(item.status)
      }))
    }
    
    return data
  }
}

export const refundAdminApi = new RefundAdminApiClient()
