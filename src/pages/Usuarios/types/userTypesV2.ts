export type RoleV2 = 'ADMIN' | 'CALLCENTER'
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
  state: UserStateV2
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  activity: ActivityEvent[]
}

export interface UserFiltersV2 {
  search: string
  role: RoleV2 | 'ALL'
  state: UserStateV2 | 'ALL'
}