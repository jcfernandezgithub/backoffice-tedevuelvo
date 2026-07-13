import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  usersApi,
  type BackendUser,
  type BackendUserStatus,
  type CreateUserPayload,
  type ListUsersParams,
  type PaginationMeta,
} from '../services/usersApi'
import type { UserStateV2, UserV2 } from '../types/userTypesV2'

const USERS_QUERY_KEY = ['usuarios', 'list'] as const
const USERS_COUNT_QUERY_KEY = ['usuarios', 'count'] as const

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function statusToState(status?: BackendUserStatus): UserStateV2 {
  switch (status) {
    case 'active': return 'ACTIVE'
    case 'invited': return 'PENDING'
    case 'inactive':
    case 'blocked':
    default: return 'INACTIVE'
  }
}

function stateToStatus(state: UserStateV2): BackendUserStatus {
  switch (state) {
    case 'ACTIVE': return 'active'
    case 'PENDING': return 'invited'
    case 'INACTIVE': return 'inactive'
  }
}

function normalize(u: BackendUser): UserV2 {
  const { firstName, lastName } = splitFullName(u.fullName)
  const roleId = u.roleId ?? u.role?.id ?? u.role?._id ?? ''
  const roleName = u.role?.label ?? u.role?.name ?? u.role?.normalizedName ?? undefined
  return {
    id: (u.id ?? u._id ?? '') as string,
    firstName,
    lastName,
    email: u.email,
    phone: u.phone || undefined,
    role: roleId,
    roleName,
    state: statusToState(u.status),
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt ?? new Date().toISOString(),
    updatedAt: u.updatedAt ?? new Date().toISOString(),
    activity: [],
  }
}

export interface CreateUserInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: string
  state: UserStateV2
  password?: string
  rut?: string
}

export type UpdateUserInput = Partial<CreateUserInput>

export interface UseUsersParams {
  page: number
  limit: number
  search?: string
  state?: UserStateV2
  roleId?: string
  excludeRoleId?: string
}

function stateToStatusOpt(state?: UserStateV2): BackendUserStatus | undefined {
  return state ? stateToStatus(state) : undefined
}

export function useUsers(params: UseUsersParams) {
  const qc = useQueryClient()

  const listParams: ListUsersParams = {
    page: params.page,
    limit: params.limit,
    search: params.search,
    status: stateToStatusOpt(params.state),
    roleId: params.roleId,
    excludeRoleId: params.excludeRoleId,
  }

  const query = useQuery({
    queryKey: [...USERS_QUERY_KEY, listParams] as const,
    queryFn: async () => {
      const res = await usersApi.list(listParams)
      return {
        users: res.data.map(normalize),
        pagination: res.pagination,
      }
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const users = query.data?.users ?? []
  const pagination: PaginationMeta = query.data?.pagination ?? {
    page: params.page,
    limit: params.limit,
    total: 0,
    totalPages: 1,
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: USERS_QUERY_KEY })
    qc.invalidateQueries({ queryKey: USERS_COUNT_QUERY_KEY })
  }

  const emailExists = useCallback(
    (email: string, exceptId?: string) =>
      users.some(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.id !== exceptId,
      ),
    [users],
  )

  const createMutation = useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const payload: CreateUserPayload = {
        email: input.email.trim(),
        fullName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
        phone: input.phone?.trim() || undefined,
        rut: input.rut?.trim() || undefined,
        roleId: input.role || undefined,
        password: input.password || undefined,
        status: stateToStatus(input.state),
      }
      return usersApi.create(payload)
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, input, prev }: { id: string; input: UpdateUserInput; prev: UserV2 }) => {
      const fullName = (input.firstName !== undefined || input.lastName !== undefined)
        ? `${input.firstName ?? prev.firstName} ${input.lastName ?? prev.lastName}`.trim()
        : undefined
      await usersApi.update(id, {
        fullName,
        phone: input.phone,
        rut: input.rut,
        status: input.state ? stateToStatus(input.state) : undefined,
      })
      // Rol se actualiza vía endpoint dedicado.
      if (input.role && input.role !== prev.role) {
        await usersApi.assignRole(id, input.role)
      }
    },
    onSuccess: invalidate,
  })

  const setStateMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: UserStateV2 }) =>
      usersApi.update(id, { status: stateToStatus(state) }),
    onSuccess: invalidate,
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: string }) => usersApi.assignRole(id, roleId),
    onSuccess: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: invalidate,
  })

  const api = useMemo(
    () => ({
      users,
      pagination,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      error: query.error as Error | null,
      refetch: query.refetch,
      emailExists,
      createUser: (input: CreateUserInput) => createMutation.mutateAsync(input),
      updateUser: (id: string, input: UpdateUserInput) => {
        const prev = users.find((u) => u.id === id)
        if (!prev) throw new Error('Usuario no encontrado')
        return updateMutation.mutateAsync({ id, input, prev })
      },
      setState: (id: string, state: UserStateV2) => setStateMutation.mutateAsync({ id, state }),
      changeRole: (id: string, roleId: string) => changeRoleMutation.mutateAsync({ id, roleId }),
      deleteUser: (id: string) => removeMutation.mutateAsync(id),
      // No hay endpoint dedicado; forzamos status=invited para "reenviar".
      resendInvitation: (id: string) =>
        setStateMutation.mutateAsync({ id, state: 'PENDING' }),
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isRemoving: removeMutation.isPending,
    }),
    [users, pagination, query.isLoading, query.isFetching, query.error, query.refetch, emailExists, createMutation, updateMutation, setStateMutation, changeRoleMutation, removeMutation],
  )

  return api
}

/**
 * Lightweight count query — pide 1 registro y usa `pagination.total`.
 */
export function useUsersCount(params: Omit<ListUsersParams, 'page' | 'limit'> = {}) {
  const query = useQuery({
    queryKey: [...USERS_COUNT_QUERY_KEY, params] as const,
    queryFn: async () => {
      const res = await usersApi.list({ ...params, page: 1, limit: 1 })
      return res.pagination.total
    },
    staleTime: 30_000,
  })
  return {
    total: query.data ?? 0,
    isLoading: query.isLoading,
  }
}