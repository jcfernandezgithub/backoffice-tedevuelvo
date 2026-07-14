import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rolesApi, type CreateRolePayload, type RoleApi, type UpdateRolePayload } from '../services/rolesApi'
import { ALL_PLATFORM_PAGES, pageKeysToLabels } from '@/pages/Usuarios/constants/roleAccess'
import type { RoleDefinition } from '../services/rolesStore'

const ROLES_QUERY_KEY = ['ajustes', 'roles'] as const

function normalize(r: any): RoleApi {
  const label = r?.label ?? r?.name ?? ''
  const rawPages = Array.isArray(r?.allowedPages)
    ? r.allowedPages
    : Array.isArray(r?.pages)
      ? r.pages
      : []
  // El backend envía claves en mayúscula (DASHBOARD, GESTION_CALLCENTER, …).
  // Convertimos a etiquetas visibles usadas por la UI.
  const allowedPages = pageKeysToLabels(rawPages.map(String))
  const restrictedPages = Array.isArray(r?.restrictedPages)
    ? pageKeysToLabels(r.restrictedPages.map(String))
    : ALL_PLATFORM_PAGES.filter((p) => !allowedPages.includes(p))
  const scope = r?.scope ?? (allowedPages.length === ALL_PLATFORM_PAGES.length ? 'FULL' : 'LIMITED')
  return {
    id: (r?.id ?? r?._id ?? '') as string,
    label,
    shortLabel: r?.shortLabel ?? label,
    description: r?.description ?? '',
    summary: r?.summary ?? (scope === 'FULL' ? 'Acceso completo a la plataforma' : `Acceso limitado (${allowedPages.length} páginas)`),
    scope,
    allowedPages,
    restrictedPages,
    isSystem: !!r?.isSystem,
    createdAt: r?.createdAt ?? '',
    updatedAt: r?.updatedAt ?? '',
    usersAssigned: typeof r?.usersAssigned === 'number' ? r.usersAssigned : undefined,
  }
}

export function useRoles(options: { includeCustomer?: boolean } = {}) {
  const { includeCustomer = false } = options
  const qc = useQueryClient()

  const query = useQuery<RoleApi[]>({
    queryKey: [...ROLES_QUERY_KEY, { includeCustomer }] as const,
    queryFn: async () => {
      const data = await rolesApi.list()
      return (Array.isArray(data) ? data : [])
        .map(normalize)
        .filter((r) => {
          if (includeCustomer) return true
          const key = (r.label || '').toString().trim().toUpperCase()
          return key !== 'CUSTOMER'
        })
    },
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