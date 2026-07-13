import { authenticatedFetch } from '@/services/apiClient'
import type { PlatformPage } from '@/pages/Usuarios/constants/roleAccess'
import type { RoleDefinition } from './rolesStore'

export interface RoleApi extends RoleDefinition {
  usersAssigned?: number
}

export interface CreateRolePayload {
  label: string
  description: string
  allowedPages: PlatformPage[]
}

export type UpdateRolePayload = Partial<CreateRolePayload>

export class RolesApiError extends Error {
  status: number
  fieldErrors?: Record<string, string[]>
  usersAssigned?: number
  constructor(message: string, opts: { status: number; fieldErrors?: Record<string, string[]>; usersAssigned?: number }) {
    super(message)
    this.status = opts.status
    this.fieldErrors = opts.fieldErrors
    this.usersAssigned = opts.usersAssigned
  }
}

async function parseError(res: Response): Promise<never> {
  let body: any = null
  try { body = await res.json() } catch { /* ignore */ }
  const err = body?.error
  if (err && typeof err === 'object') {
    // Formato { error: { field: [msgs] } }
    const first = Object.values(err)[0]
    const message = Array.isArray(first) ? String(first[0]) : 'Error de validación'
    throw new RolesApiError(message, { status: res.status, fieldErrors: err })
  }
  const message = typeof err === 'string' ? err : body?.message || `Error ${res.status}`
  throw new RolesApiError(message, {
    status: res.status,
    usersAssigned: typeof body?.usersAssigned === 'number' ? body.usersAssigned : undefined,
  })
}

export const rolesApi = {
  async list(): Promise<RoleApi[]> {
    const res = await authenticatedFetch('/roles')
    if (!res.ok) return parseError(res)
    return res.json()
  },
  async get(id: string): Promise<RoleApi> {
    const res = await authenticatedFetch(`/roles/${id}`)
    if (!res.ok) return parseError(res)
    return res.json()
  },
  async create(data: CreateRolePayload): Promise<RoleApi> {
    const res = await authenticatedFetch('/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    if (!res.ok) return parseError(res)
    return res.json()
  },
  async update(id: string, data: UpdateRolePayload): Promise<RoleApi> {
    const res = await authenticatedFetch(`/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    if (!res.ok) return parseError(res)
    return res.json()
  },
  async remove(id: string): Promise<void> {
    const res = await authenticatedFetch(`/roles/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) return parseError(res)
  },
}