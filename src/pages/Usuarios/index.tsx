import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Plus, Users2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useIsMobile } from '@/hooks/use-mobile'
import { UsersStats } from './components/UsersStats'
import { UsersFilters, DEFAULT_FILTERS } from './components/UsersFilters'
import { UsersTable } from './components/UsersTable'
import { UsersMobileList } from './components/UsersMobileList'
import { UserFormSheet } from './components/UserFormSheet'
import { UserDetailsSheet } from './components/UserDetailsSheet'
import { DeleteUserConfirm } from './components/DeleteUserConfirm'
import { ChangeRoleDialog } from './components/ChangeRoleDialog'
import { useUsers } from './hooks/useUsers'
import { UsersApiError } from './services/usersApi'
import type { UserFiltersV2, UserV2 } from './types/userTypesV2'
import { useRoles } from '@/pages/Ajustes/hooks/useRoles'

const PAGE_SIZE = 20

function getCustomerRoleId(roles: { id: string; label: string }[]): string | undefined {
  return roles.find((r) => (r.label || '').trim().toUpperCase() === 'CUSTOMER')?.id
}

export default function UsuariosPage() {
  const isMobile = useIsMobile()
  const [filters, setFilters] = useState<UserFiltersV2>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)

  const { roles: allRoles } = useRoles({ includeCustomer: true })
  const customerRoleId = getCustomerRoleId(allRoles)

  // Reset page a 1 cuando cambie cualquier filtro.
  useEffect(() => {
    setPage(1)
  }, [filters.search, filters.role, filters.state, filters.backofficeOnly])

  const excludeRoleId =
    filters.backofficeOnly && filters.role === 'ALL' ? customerRoleId : undefined

  const {
    users,
    pagination,
    isLoading,
    isFetching,
    error,
    refetch,
    emailExists,
    createUser,
    updateUser,
    setState,
    changeRole,
    resendInvitation,
    deleteUser,
  } = useUsers({
    page,
    limit: PAGE_SIZE,
    search: filters.search || undefined,
    state: filters.state === 'ALL' ? undefined : filters.state,
    roleId: filters.role === 'ALL' ? undefined : filters.role,
    excludeRoleId,
  })

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UserV2 | null>(null)
  const [viewing, setViewing] = useState<UserV2 | null>(null)
  const [changingRole, setChangingRole] = useState<UserV2 | null>(null)
  const [deleting, setDeleting] = useState<UserV2 | null>(null)

  const totalPages = Math.max(1, pagination.totalPages || 1)
  const canPrev = page > 1
  const canNext = page < totalPages

  const errMsg = (e: unknown, fallback: string) =>
    e instanceof UsersApiError ? e.message : (e instanceof Error ? e.message : fallback)

  const handleCreate = async (values: Parameters<typeof createUser>[0]) => {
    try {
      await createUser(values)
      toast.success('Usuario creado correctamente')
      setCreating(false)
    } catch (e) {
      toast.error(errMsg(e, 'No se pudo crear el usuario'))
    }
  }

  const handleUpdate = async (values: Parameters<typeof createUser>[0]) => {
    if (!editing) return
    try {
      await updateUser(editing.id, values)
      toast.success('Usuario actualizado')
      setEditing(null)
    } catch (e) {
      toast.error(errMsg(e, 'No se pudo actualizar el usuario'))
    }
  }

  const handleToggleState = async (u: UserV2) => {
    const next = u.state === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      await setState(u.id, next)
      toast.success(next === 'ACTIVE' ? 'Usuario activado' : 'Usuario desactivado')
    } catch (e) {
      toast.error(errMsg(e, 'No se pudo cambiar el estado'))
    }
  }

  const handleResend = async (u: UserV2) => {
    try {
      await resendInvitation(u.id)
      toast.success('Invitación reenviada')
    } catch (e) {
      toast.error(errMsg(e, 'No se pudo reenviar la invitación'))
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteUser(deleting.id)
      toast.success('Usuario eliminado')
      if (viewing?.id === deleting.id) setViewing(null)
      setDeleting(null)
    } catch (e) {
      toast.error(errMsg(e, 'No se pudo eliminar el usuario'))
    }
  }

  const handleChangeRoleConfirm = async (role: UserV2['role']) => {
    if (!changingRole) return
    try {
      await changeRole(changingRole.id, role)
      toast.success('Rol actualizado')
      setChangingRole(null)
    } catch (e) {
      toast.error(errMsg(e, 'No se pudo cambiar el rol'))
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Users2 className="h-7 w-7 text-primary" />
            Administración de usuarios
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Administra las personas que pueden acceder a la plataforma y define su nivel de acceso.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Crear usuario
        </Button>
      </header>

      {error ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="font-medium">No pudimos cargar los usuarios</p>
              <p className="text-sm text-muted-foreground">{errMsg(error, 'Error de conexión')}</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando usuarios…</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <UsersStats customerRoleId={customerRoleId} />

          <UsersFilters
            filters={filters}
            onChange={setFilters}
            resultCount={users.length}
            total={pagination.total}
          />

          {users.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Users2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No encontramos usuarios</p>
              <p className="text-sm text-muted-foreground">
                {pagination.total === 0
                  ? 'Aún no hay usuarios registrados.'
                  : 'Prueba a ajustar los filtros o crear un nuevo usuario.'}
              </p>
            </div>
            <Button variant="outline" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" /> Crear usuario
            </Button>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <UsersMobileList
          users={users}
          onView={setViewing}
          onEdit={setEditing}
          onChangeRole={setChangingRole}
          onToggleState={handleToggleState}
          onResendInvitation={handleResend}
          onDelete={setDeleting}
        />
      ) : (
        <UsersTable
          users={users}
          onView={setViewing}
          onEdit={setEditing}
          onChangeRole={setChangingRole}
          onToggleState={handleToggleState}
          onResendInvitation={handleResend}
          onDelete={setDeleting}
        />
          )}

          {pagination.total > 0 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Página <span className="font-medium text-foreground">{pagination.page}</span> de{' '}
                <span className="font-medium text-foreground">{totalPages}</span> ·{' '}
                <span className="font-medium text-foreground">{pagination.total}</span> usuarios
                {isFetching && <span className="ml-2 opacity-70">actualizando…</span>}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canPrev || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canNext || isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <UserFormSheet
        open={creating}
        onOpenChange={setCreating}
        onSubmit={handleCreate}
        emailExists={emailExists}
      />
      <UserFormSheet
        open={!!editing}
        user={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSubmit={handleUpdate}
        emailExists={emailExists}
      />
      <UserDetailsSheet
        user={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={(u) => { setViewing(null); setEditing(u) }}
        onChangeRole={(u) => { setViewing(null); setChangingRole(u) }}
        onToggleState={(u) => { handleToggleState(u); setViewing(null) }}
      />
      <ChangeRoleDialog
        user={changingRole}
        open={!!changingRole}
        onOpenChange={(o) => !o && setChangingRole(null)}
        onConfirm={handleChangeRoleConfirm}
      />
      <DeleteUserConfirm
        user={deleting}
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}