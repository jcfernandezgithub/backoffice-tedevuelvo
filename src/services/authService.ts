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
    roles: string[]
  }
  accessToken: string
  refreshToken: string
}

const mapRoleToFrontend = (roles: string[]): Rol => {
  if (roles.includes('admin')) return 'ADMIN'
  if (roles.includes('operaciones')) return 'OPERACIONES'
  if (roles.includes('alianzas')) return 'ALIANZAS'
  return 'READONLY'
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
      rol: mapRoleToFrontend(data.user.roles),
      activo: true,
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

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: user.id, refreshToken }),
    })

    if (!response.ok) {
      // Si falla el refresh, limpiar todo
      save(AUTH_KEY, null)
      save(ACCESS_TOKEN_KEY, null)
      save(REFRESH_TOKEN_KEY, null)
      throw new Error('Sesión expirada')
    }

    const data: LoginResponse = await response.json()

    // Actualizar tokens
    save(ACCESS_TOKEN_KEY, data.accessToken)
    save(REFRESH_TOKEN_KEY, data.refreshToken)

    // Actualizar usuario
    const updatedUser: Usuario = {
      id: data.user.id,
      nombre: data.user.fullName,
      email: data.user.email,
      rol: mapRoleToFrontend(data.user.roles),
      activo: true,
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
