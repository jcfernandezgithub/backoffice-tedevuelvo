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

export interface ListUsersParams {
  page?: number
  limit?: number
  search?: string
  status?: BackendUserStatus
  roleId?: string
  /** Frontend-only param: instruct backend to exclude a role from results. */
  excludeRoleId?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PaginatedUsers {
  data: BackendUser[]
  pagination: PaginationMeta
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
  async list(params: ListUsersParams = {}): Promise<PaginatedUsers> {
    const qs = new URLSearchParams()
    const page = params.page ?? 1
    const limit = params.limit ?? 20
    qs.set('page', String(page))
    qs.set('limit', String(limit))
    if (params.search && params.search.trim()) qs.set('search', params.search.trim())
    if (params.status) qs.set('status', params.status)
    if (params.roleId) qs.set('roleId', params.roleId)
    if (params.excludeRoleId) qs.set('excludeRoleId', params.excludeRoleId)

    const res = await authenticatedFetch(`/users?${qs.toString()}`)
    if (!res.ok) return parseError(res)
    const body = await res.json()

    const data: BackendUser[] = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body)
          ? body
          : []

    const paginationRaw = body?.pagination ?? {}
    const total = Number(paginationRaw.total ?? data.length)
    const effectiveLimit = Number(paginationRaw.limit ?? limit) || limit
    const totalPages = Number(
      paginationRaw.totalPages ?? Math.max(1, Math.ceil(total / effectiveLimit)),
    )
    return {
      data,
      pagination: {
        page: Number(paginationRaw.page ?? page),
        limit: effectiveLimit,
        total,
        totalPages,
      },
    }
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