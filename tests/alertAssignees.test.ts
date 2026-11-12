import { expect, test } from 'bun:test'
import { loadAlertAssignees } from '../src/services/alertAssignees'
import { rolesApi } from '../src/pages/Ajustes/services/rolesApi'
import { usersApi, type ListUsersParams } from '../src/pages/Usuarios/services/usersApi'

test('queries active administrators and operations by role before pagination, never the customer directory', async () => {
  const calls: ListUsersParams[] = []
  const roles = { ...rolesApi, list: async () => [
    { id: 'admin-role', name: 'ADMIN' }, { _id: 'ops-role', normalizedName: 'OPERADOR' }, { id: 'customer-role', name: 'CUSTOMER' },
  ] as Awaited<ReturnType<typeof rolesApi.list>> }
  const users = { ...usersApi, list: async (params: ListUsersParams = {}) => {
    calls.push(params)
    if (!params.roleId) throw new Error('Unfiltered directory must not be requested')
    const role = params.roleId === 'admin-role' ? 'ADMIN' : 'OPERADOR'
    const hasMore = params.roleId === 'ops-role' && params.page === 1
    return { data: [
      { id: `${params.roleId}-${params.page}`, fullName: role, email: 'test@example.test', status: 'active' as const, role: { name: role } },
      { id: 'excluded', fullName: 'Customer', email: 'excluded@example.test', status: 'active' as const, role: { name: 'CUSTOMER' } },
    ], pagination: { page: params.page ?? 1, limit: 100, total: 3, totalPages: hasMore ? 2 : 1, hasMore, isEstimated: false } }
  } }
  const result = await loadAlertAssignees('Prueba', roles, users)
  expect(result.map(u => u.id).sort()).toEqual(['admin-role-1', 'ops-role-1', 'ops-role-2'])
  expect(calls).toHaveLength(3)
  for (const call of calls) {
    expect(['admin-role','ops-role']).toContain(call.roleId)
    expect(call.status).toBe('active')
    expect(call.search).toBe('Prueba')
  }
})

test('a failed role page rejects the whole candidate list rather than showing incomplete results', async () => {
  const roles = { ...rolesApi, list: async () => [{ id: 'admin-role', name: 'ADMIN' }] as Awaited<ReturnType<typeof rolesApi.list>> }
  const users = { ...usersApi, list: async () => { throw new Error('Read failed') } }
  await expect(loadAlertAssignees('', roles, users)).rejects.toThrow('Read failed')
})