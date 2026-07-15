import { Usuario, Rol } from "@/types/domain"
import { load, save } from "./storage"

const AUTH_KEY = "td_auth_user"
const ACCESS_TOKEN_KEY = "td_access_token"
const REFRESH_TOKEN_KEY = "td_refresh_token"
const API_BASE_URL = "https://tedevuelvo-app-be.onrender.com/api/v1"

export type LoginResult = { user: Usuario }

interface LoginResponse {
  user: {
    id: string
    email: string
    fullName: string
    roles?: string[]
    role?: {
      name?: string
      normalizedName?: string
      pages?: string[]
    } | string
    pages?: string[]
  }
  accessToken: string
  refreshToken: string
}

const mapRoleToFrontend = (roles: string[]): Rol => {
  const safe = Array.isArray(roles) ? roles.map((r) => String(r).toLowerCase()) : []
  if (safe.includes('admin')) return 'ADMIN'
  if (safe.includes('operaciones')) return 'OPERACIONES'
  if (safe.includes('alianzas')) return 'ALIANZAS'
  if (safe.includes('callcenter') || safe.includes('call_center')) return 'CALLCENTER'
  return 'READONLY'
}

const extractRoles = (u: LoginResponse['user']): string[] => {
  if (Array.isArray(u.roles) && u.roles.length) return u.roles
  if (u.role && typeof u.role === 'object') {
    const n = u.role.normalizedName || u.role.name
    if (n) return [n]
  }
  if (typeof u.role === 'string') return [u.role]
  return []
}

const extractPages = (data: LoginResponse): string[] => {
  const u = data.user
  if (Array.isArray(u.pages)) return u.pages
  if (u.role && typeof u.role === 'object' && Array.isArray(u.role.pages)) return u.role.pages
  // Fallback: decodificar JWT
  try {
    const payload = JSON.parse(atob(data.accessToken.split('.')[1]))
    if (Array.isArray(payload.pages)) return payload.pages
  } catch { /* noop */ }
  return []
}

export const authService = {
  getCurrent(): Usuario | null {
    return load<Usuario | null>(AUTH_KEY, null)
  },
  getAccessToken(): string | null {
    return load<string | null>(ACCESS_TOKEN_KEY, null)
  },
  getRefreshToken(): string | null {
    return load<string | null>(REFRESH_TOKEN_KEY, null)
  },
  isTokenExpiringSoon(): boolean {
    const token = this.getAccessToken()
    if (!token) return true
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expiresAt = payload.exp * 1000
      const now = Date.now()
      // Considerar que expira pronto si quedan menos de 2 minutos
      return (expiresAt - now) < 2 * 60 * 1000
    } catch {
      return true
    }
  },
  async login(email: string, password: string): Promise<LoginResult> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Credenciales inválidas' }))
      throw new Error(error.message || 'Credenciales inválidas')
    }

    const data: LoginResponse = await response.json()

    // Guardar tokens
    save(ACCESS_TOKEN_KEY, data.accessToken)
    save(REFRESH_TOKEN_KEY, data.refreshToken)

    // Mapear respuesta del backend al tipo Usuario del frontend
    const user: Usuario = {
      id: data.user.id,
      nombre: data.user.fullName,
      email: data.user.email,
      rol: mapRoleToFrontend(extractRoles(data.user)),
      activo: true,
      pages: extractPages(data),
    }

    save(AUTH_KEY, user)
    return { user }
  },
  async refresh(): Promise<LoginResult> {
    const user = load<Usuario | null>(AUTH_KEY, null)
    const refreshToken = load<string | null>(REFRESH_TOKEN_KEY, null)

    if (!user || !refreshToken) {
      throw new Error('No hay sesión para renovar')
    }

    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, refreshToken }),
      })
    } catch (networkErr) {
      // Error de red (offline / cold-start). No invalidamos la sesión: dejamos reintentar.
      throw new Error('Refresh network error')
    }

    if (!response.ok) {
      // Solo consideramos la sesión inválida cuando el backend rechaza credenciales.
      if (response.status === 401 || response.status === 403) {
        save(AUTH_KEY, null)
        save(ACCESS_TOKEN_KEY, null)
        save(REFRESH_TOKEN_KEY, null)
        throw new Error('Sesión expirada')
      }
      // 5xx u otros → transitorio, no tocamos storage.
      throw new Error(`Refresh failed (${response.status})`)
    }

    const data: LoginResponse = await response.json()

    // Actualizar tokens
    save(ACCESS_TOKEN_KEY, data.accessToken)
    save(REFRESH_TOKEN_KEY, data.refreshToken)

    // Actualizar usuario preservando datos previos cuando el refresh venga incompleto.
    const rolesFromResponse = extractRoles(data.user)
    const pagesFromResponse = extractPages(data)
    const updatedUser: Usuario = {
      id: data.user?.id ?? user.id,
      nombre: data.user?.fullName ?? user.nombre,
      email: data.user?.email ?? user.email,
      rol: rolesFromResponse.length ? mapRoleToFrontend(rolesFromResponse) : user.rol,
      activo: true,
      pages: pagesFromResponse.length ? pagesFromResponse : (user.pages ?? []),
    }

    save(AUTH_KEY, updatedUser)
    return { user: updatedUser }
  },
  async logout() {
    save(AUTH_KEY, null)
    save(ACCESS_TOKEN_KEY, null)
    save(REFRESH_TOKEN_KEY, null)
  },
}
