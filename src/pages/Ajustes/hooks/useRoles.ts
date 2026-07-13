import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rolesApi, type CreateRolePayload, type RoleApi, type UpdateRolePayload } from '../services/rolesApi'
import type { RoleDefinition } from '../services/rolesStore'

const ROLES_QUERY_KEY = ['ajustes', 'roles'] as const

export function useRoles() {
  const qc = useQueryClient()

  const query = useQuery<RoleApi[]>({
    queryKey: ROLES_QUERY_KEY,
    queryFn: () => rolesApi.list(),
    staleTime: 30_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ROLES_QUERY_KEY })

  const createMutation = useMutation({
    mutationFn: (payload: CreateRolePayload) => rolesApi.create(payload),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRolePayload }) => rolesApi.update(id, data),
    onSuccess: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: invalidate,
  })

  const roles = query.data ?? []

  return {
    roles,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
    getRole: (id: string) => roles.find((r) => r.id === id),
    createRole: createMutation.mutateAsync,
    updateRole: (id: string, data: UpdateRolePayload) => updateMutation.mutateAsync({ id, data }),
    removeRole: removeMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRemoving: removeMutation.isPending,
  }
}

export type { RoleDefinition }