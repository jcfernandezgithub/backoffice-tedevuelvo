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
  async logout() {
    save(AUTH_KEY, null)
    save(ACCESS_TOKEN_KEY, null)
    save(REFRESH_TOKEN_KEY, null)
  },
}
