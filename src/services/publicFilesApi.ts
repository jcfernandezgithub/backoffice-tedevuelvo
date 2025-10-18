const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://tedevuelvo-app-be.onrender.com/api/v1'

export interface DocumentMeta {
  id: string
  kind: string
  key: string
  contentType: string
  size: number
  createdAt: string
}

export interface SignedPdfInfo {
  url?: string
  hasSignedPdf?: boolean
  signedPdfUrl?: string
}

class PublicFilesApiClient {
  async listRefundDocuments(publicId: string, kinds?: string[]): Promise<DocumentMeta[]> {
    const query = kinds?.length ? `?kinds=${kinds.join(',')}`  : ''
    const response = await fetch(`${API_BASE_URL}/refund-requests/${publicId}/refund-documents${query}`)

    if (!response.ok) {
      if (response.status === 404) return []
      const error = await response.json().catch(() => ({ message: 'Error al cargar documentos' }))
      throw new Error(error.message || 'Error al cargar documentos')
    }

    return response.json()
  }

  async getRefundDocumentBlob(publicId: string, docId: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/refund-requests/${publicId}/refund-documents/${docId}`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al descargar documento' }))
      throw new Error(error.message || 'Error al descargar documento')
    }

    return response.blob()
  }

  async getSignedPdfInfo(publicId: string): Promise<SignedPdfInfo> {
    const response = await fetch(`${API_BASE_URL}/refund-requests/${publicId}/signed-pdf`)

    if (!response.ok) {
      if (response.status === 404) return { hasSignedPdf: false }
      const error = await response.json().catch(() => ({ message: 'Error al obtener PDF firmado' }))
      throw new Error(error.message || 'Error al obtener PDF firmado')
    }

    return response.json()
  }

  async getIdImageBlob(publicId: string, kind: 'id-front' | 'id-back', clientToken: string): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/refund-requests/${publicId}/docs/${kind}?clientToken=${encodeURIComponent(clientToken)}`
    )

    if (!response.ok) {
      if (response.status === 404 || response.status === 401) {
        throw new Error('Documento no disponible')
      }
      const error = await response.json().catch(() => ({ message: 'Error al cargar imagen' }))
      throw new Error(error.message || 'Error al cargar imagen')
    }

    return response.blob()
  }
}

export const publicFilesApi = new PublicFilesApiClient()
