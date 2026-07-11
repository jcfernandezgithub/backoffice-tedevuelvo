import { useSyncExternalStore } from 'react'
import { rolesStore, type RoleDefinition } from '../services/rolesStore'

export function useRoles() {
  const roles = useSyncExternalStore(
    (cb) => rolesStore.subscribe(cb),
    () => rolesStore.list(),
    () => rolesStore.list(),
  )
  return {
    roles,
    getRole: (id: string) => roles.find((r) => r.id === id),
    createRole: rolesStore.create,
    updateRole: rolesStore.update,
    removeRole: rolesStore.remove,
  }
}

export type { RoleDefinition }