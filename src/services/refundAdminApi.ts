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

// Formatear fecha de YYYY-MM-DD a dd/mm/aaaa
function formatDateForApi(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export interface SearchParams {
  q?: string
  status?: string
  origin?: string
  sort?: 'recent' | 'old'
  preset?: 'today' | 'yesterday' | 'week' | 'month'
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface SearchResponse {
  items: RefundRequest[]
  pagination: {
    page: number
    limit: number
    total: number
  }
}

class RefundAdminApiClient {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = authService.getAccessToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async search(params: SearchParams): Promise<AdminListResponse> {
    const query = new URLSearchParams()
    
    if (params.q) query.append('q', params.q)
    if (params.status) query.append('status', params.status.toUpperCase())
    if (params.origin) query.append('origin', params.origin)
    if (params.sort) query.append('sort', params.sort)
    if (params.preset) query.append('preset', params.preset)
    if (params.from) query.append('from', formatDateForApi(params.from))
    if (params.to) query.append('to', formatDateForApi(params.to))
    if (params.page) query.append('page', String(params.page))
    if (params.limit) query.append('limit', String(params.limit))

    const response = await fetch(`${API_BASE_URL}/refund-requests/admin/search?${query}`, {
      headers: await this.getAuthHeaders(),
    })

    if (response.status === 401) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al buscar refunds' }))
      throw new Error(error.message || 'Error al buscar refunds')
    }

    const responseData: SearchResponse = await response.json()
    
    // Normalizar estados y adaptar respuesta
    const items = (responseData.items || []).map((item: any) => ({
      ...item,
      status: normalizeStatus(item.status)
    }))
    
    const pagination = responseData.pagination || { page: 1, limit: 20, total: 0 }
    
    return {
      total: pagination.total,
      page: pagination.page,
      pageSize: pagination.limit,
      totalPages: Math.ceil(pagination.total / pagination.limit) || 1,
      hasNext: pagination.page * pagination.limit < pagination.total,
      hasPrev: pagination.page > 1,
      items
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

  async getById(publicId: string): Promise<RefundRequest> {
    const response = await fetch(`${API_BASE_URL}/refund-requests/admin/detail/${publicId}`, {
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
