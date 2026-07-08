import { useCallback, useMemo, useState } from 'react'
import { MOCK_USERS_SEED } from '../mocks/mockUsers.seed'
import type {
  ActivityEvent,
  RoleV2,
  UserFiltersV2,
  UserStateV2,
  UserV2,
} from '../types/userTypesV2'
import { ROLE_ACCESS } from '../constants/roleAccess'

// Store en memoria compartido durante la sesión — se reemplazará por API real.
let STORE: UserV2[] = [...MOCK_USERS_SEED]
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

const newId = () => `u-${Math.random().toString(36).slice(2, 10)}`
const nowIso = () => new Date().toISOString()

function pushActivity(user: UserV2, type: ActivityEvent['type'], description: string) {
  return {
    ...user,
    activity: [
      ...user.activity,
      { id: `a-${Math.random().toString(36).slice(2, 8)}`, at: nowIso(), type, description },
    ],
    updatedAt: nowIso(),
  }
}

export interface CreateUserInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: RoleV2
  state: UserStateV2
}

export interface UpdateUserInput extends Partial<CreateUserInput> {}

export function useMockUsers() {
  const [, setTick] = useState(0)
  const rerender = useCallback(() => setTick((n) => n + 1), [])

  // Suscribirse
  useMemo(() => {
    listeners.add(rerender)
    return () => listeners.delete(rerender)
  }, [rerender])

  const users = STORE

  const emailExists = useCallback(
    (email: string, exceptId?: string) =>
      STORE.some(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.id !== exceptId,
      ),
    [],
  )

  const createUser = useCallback((input: CreateUserInput) => {
    const user: UserV2 = {
      id: newId(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() || undefined,
      role: input.role,
      state: input.state,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      activity: [
        {
          id: `a-${Math.random().toString(36).slice(2, 8)}`,
          at: nowIso(),
          type: 'USER_CREATED',
          description:
            input.state === 'PENDING'
              ? 'Usuario creado e invitación enviada'
              : 'Usuario creado',
        },
      ],
    }
    STORE = [user, ...STORE]
    notify()
    return user
  }, [])

  const updateUser = useCallback((id: string, input: UpdateUserInput) => {
    STORE = STORE.map((u) => {
      if (u.id !== id) return u
      const prevRole = u.role
      const next: UserV2 = {
        ...u,
        firstName: input.firstName?.trim() ?? u.firstName,
        lastName: input.lastName?.trim() ?? u.lastName,
        email: input.email?.trim() ?? u.email,
        phone: input.phone !== undefined ? input.phone.trim() || undefined : u.phone,
        role: input.role ?? u.role,
        state: input.state ?? u.state,
        updatedAt: nowIso(),
      }
      let withActivity = next
      if (input.role && input.role !== prevRole) {
        withActivity = pushActivity(
          withActivity,
          'ROLE_CHANGED',
          `Rol actualizado de ${ROLE_ACCESS[prevRole].label} a ${ROLE_ACCESS[input.role].label}`,
        )
      } else {
        withActivity = pushActivity(withActivity, 'USER_UPDATED', 'Datos del usuario actualizados')
      }
      return withActivity
    })
    notify()
  }, [])

  const setState = useCallback((id: string, state: UserStateV2) => {
    STORE = STORE.map((u) => {
      if (u.id !== id) return u
      const label = state === 'ACTIVE' ? 'Usuario activado' : state === 'INACTIVE' ? 'Usuario desactivado' : 'Invitación pendiente'
      const type: ActivityEvent['type'] = state === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED'
      return pushActivity({ ...u, state }, type, label)
    })
    notify()
  }, [])

  const changeRole = useCallback((id: string, role: RoleV2) => {
    updateUser(id, { role })
  }, [updateUser])

  const resendInvitation = useCallback((id: string) => {
    STORE = STORE.map((u) =>
      u.id === id ? pushActivity(u, 'INVITATION_RESENT', 'Invitación reenviada') : u,
    )
    notify()
  }, [])

  const deleteUser = useCallback((id: string) => {
    STORE = STORE.filter((u) => u.id !== id)
    notify()
  }, [])

  return {
    users,
    emailExists,
    createUser,
    updateUser,
    setState,
    changeRole,
    resendInvitation,
    deleteUser,
  }
}

export function applyFilters(users: UserV2[], filters: UserFiltersV2): UserV2[] {
  const q = filters.search.trim().toLowerCase()
  return users.filter((u) => {
    if (filters.role !== 'ALL' && u.role !== filters.role) return false
    if (filters.state !== 'ALL' && u.state !== filters.state) return false
    if (q) {
      const full = `${u.firstName} ${u.lastName}`.toLowerCase()
      if (!full.includes(q) && !u.email.toLowerCase().includes(q)) return false
    }
    return true
  })
}