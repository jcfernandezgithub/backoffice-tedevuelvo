import { authenticatedFetch } from '@/services/apiClient'

export type BackendUserStatus = 'invited' | 'active' | 'inactive' | 'blocked'

export interface BackendRoleRef {
  id?: string
  _id?: string
  label?: string
  name?: string
  normalizedName?: string
  pages?: string[]
}

export interface BackendUser {
  id?: string
  _id?: string
  email: string
  fullName: string
  rut?: string
  phone?: string
  status: BackendUserStatus
  roleId?: string | null
  role?: BackendRoleRef | null
  createdAt?: string
  updatedAt?: string
  lastLoginAt?: string
}

export interface CreateUserPayload {
  email: string
  fullName: string
  rut?: string
  phone?: string
  roleId?: string
  password?: string
  status?: BackendUserStatus
}

export interface UpdateUserPayload {
  fullName?: string
  rut?: string
  phone?: string
  status?: BackendUserStatus
}

export class UsersApiError extends Error {
  status: number
  fieldErrors?: Record<string, string[]>
  constructor(message: string, opts: { status: number; fieldErrors?: Record<string, string[]> }) {
    super(message)
    this.status = opts.status
    this.fieldErrors = opts.fieldErrors
  }
}

async function parseError(res: Response): Promise<never> {
  let body: any = null
  try { body = await res.json() } catch { /* ignore */ }
  const err = body?.error ?? body?.message
  if (err && typeof err === 'object' && !Array.isArray(err)) {
    const first = Object.values(err)[0]
    const message = Array.isArray(first) ? String(first[0]) : 'Error de validación'
    throw new UsersApiError(message, { status: res.status, fieldErrors: err as Record<string, string[]> })
  }
  const message = Array.isArray(err) ? String(err[0]) : (typeof err === 'string' ? err : `Error ${res.status}`)
  throw new UsersApiError(message, { status: res.status })
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') out[k] = v
  }
  return out
}

export const usersApi = {
  async list(): Promise<BackendUser[]> {
    const res = await authenticatedFetch('/users')
    if (!res.ok) return parseError(res)
    const data = await res.json()
    // Soporta { items: [] } o array directo.
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.items)) return data.items
    if (Array.isArray(data?.data)) return data.data
    return []
  },
  async create(payload: CreateUserPayload): Promise<BackendUser> {
    const res = await authenticatedFetch('/users', {
      method: 'POST',
      body: JSON.stringify(stripUndefined(payload as any)),
    })
    if (!res.ok) return parseError(res)
    return res.json()
  },
  async update(id: string, payload: UpdateUserPayload): Promise<BackendUser> {
    const res = await authenticatedFetch(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(stripUndefined(payload as any)),
    })
    if (!res.ok) return parseError(res)
    return res.json()
  },
  async assignRole(id: string, roleId: string): Promise<BackendUser> {
    const res = await authenticatedFetch(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ roleId }),
    })
    if (!res.ok) return parseError(res)
    return res.json()
  },
  async remove(id: string): Promise<void> {
    const res = await authenticatedFetch(`/users/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) return parseError(res)
  },
}