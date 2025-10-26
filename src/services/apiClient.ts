import { authService } from './authService'

const API_BASE_URL = "https://tedevuelvo-app-be.onrender.com/api/v1"

let isRefreshing = false
let refreshPromise: Promise<void> | null = null

async function refreshTokenIfNeeded(): Promise<void> {
  if (isRefreshing) {
    return refreshPromise!
  }

  isRefreshing = true
  refreshPromise = authService.refresh()
    .then(() => {
      isRefreshing = false
      refreshPromise = null
    })
    .catch((error) => {
      isRefreshing = false
      refreshPromise = null
      throw error
    })

  return refreshPromise
}

export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = authService.getAccessToken()

  if (!accessToken) {
    throw new Error('No hay sesión activa')
  }

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('Content-Type', 'application/json')

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  // Si obtenemos 401, intentar refrescar el token y reintentar
  if (response.status === 401) {
    try {
      await refreshTokenIfNeeded()
      
      // Reintentar con el nuevo token
      const newAccessToken = authService.getAccessToken()
      headers.set('Authorization', `Bearer ${newAccessToken}`)
      
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      })
    } catch (error) {
      // Si falla el refresh, redirigir al login
      window.location.href = '/login'
      throw error
    }
  }

  return response
}
