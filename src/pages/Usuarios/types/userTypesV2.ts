// Role id: system roles ('ADMIN' | 'CALLCENTER') o custom (`role-xxxxxx`).
export type RoleV2 = string
export type UserStateV2 = 'ACTIVE' | 'INACTIVE' | 'PENDING'

export interface ActivityEvent {
  id: string
  at: string
  type:
    | 'USER_CREATED'
    | 'ROLE_CHANGED'
    | 'USER_ACTIVATED'
    | 'USER_DEACTIVATED'
    | 'INVITATION_RESENT'
    | 'USER_UPDATED'
  description: string
}

export interface UserV2 {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: RoleV2
  roleName?: string
  state: UserStateV2
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  activity: ActivityEvent[]
}

export interface UserFiltersV2 {
  search: string
  role: string | 'ALL'
  state: UserStateV2 | 'ALL'
  /** Cuando true y no hay rol seleccionado, excluye usuarios CUSTOMER. */
  backofficeOnly: boolean
}