import { rolesApi } from '@/pages/Ajustes/services/rolesApi'
import { usersApi, type BackendUser } from '@/pages/Usuarios/services/usersApi'
import { isAlertAssignee, isAlertAssigneeRole } from '@/lib/operationalAlerts'

// Filter on the server before paging: never scan the customer directory.
export async function loadAlertAssignees(search: string, roles = rolesApi, users = usersApi): Promise<BackendUser[]> {
  const catalog = await roles.list()
  const roleIds = [...new Set(catalog.filter(isAlertAssigneeRole).map(r => r.id ?? r._id).filter((id): id is string => Boolean(id)))]
  if (!roleIds.length) throw new Error('No se pudieron identificar los roles de Administración y Operaciones.')
  const groups = await Promise.all(roleIds.map(async roleId => {
    const result: BackendUser[] = []
    let page = 1
    while (page <= 100) {
      const response = await users.list({ status: 'active', roleId, search, page, limit: 100 })
      result.push(...response.data.filter(isAlertAssignee))
      if (!response.pagination.hasMore) return result
      page++
    }
    throw new Error('No se pudo completar la lista de responsables. Acota la búsqueda por nombre.')
  }))
  const unique = new Map<string, BackendUser>()
  for (const user of groups.flat()) {
    const id = user.id ?? user._id
    if (id) unique.set(id, user)
  }
  return [...unique.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
}