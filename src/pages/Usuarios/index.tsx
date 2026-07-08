import { useMemo, useState } from 'react'
import { Plus, Users2 } from 'lucide-react'
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
import { useMockUsers, applyFilters } from './hooks/useMockUsers'
import type { UserFiltersV2, UserV2 } from './types/userTypesV2'

export default function UsuariosPage() {
  const isMobile = useIsMobile()
  const {
    users,
    emailExists,
    createUser,
    updateUser,
    setState,
    changeRole,
    resendInvitation,
    deleteUser,
  } = useMockUsers()

  const [filters, setFilters] = useState<UserFiltersV2>(DEFAULT_FILTERS)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UserV2 | null>(null)
  const [viewing, setViewing] = useState<UserV2 | null>(null)
  const [changingRole, setChangingRole] = useState<UserV2 | null>(null)
  const [deleting, setDeleting] = useState<UserV2 | null>(null)

  const filtered = useMemo(() => applyFilters(users, filters), [users, filters])

  const handleCreate = (values: Parameters<typeof createUser>[0]) => {
    createUser(values)
    toast.success('Usuario creado correctamente')
    setCreating(false)
  }

  const handleUpdate = (values: Parameters<typeof createUser>[0]) => {
    if (!editing) return
    updateUser(editing.id, values)
    toast.success('Usuario actualizado')
    setEditing(null)
  }

  const handleToggleState = (u: UserV2) => {
    const next = u.state === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setState(u.id, next)
    toast.success(next === 'ACTIVE' ? 'Usuario activado' : 'Usuario desactivado')
  }

  const handleResend = (u: UserV2) => {
    resendInvitation(u.id)
    toast.success('Invitación reenviada')
  }

  const handleDelete = () => {
    if (!deleting) return
    deleteUser(deleting.id)
    toast.success('Usuario eliminado')
    setDeleting(null)
    if (viewing?.id === deleting.id) setViewing(null)
  }

  const handleChangeRoleConfirm = (role: UserV2['role']) => {
    if (!changingRole) return
    changeRole(changingRole.id, role)
    toast.success('Rol actualizado')
    setChangingRole(null)
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

      <UsersStats users={users} />

      <UsersFilters
        filters={filters}
        onChange={setFilters}
        resultCount={filtered.length}
        total={users.length}
      />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Users2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No encontramos usuarios</p>
              <p className="text-sm text-muted-foreground">
                {users.length === 0
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
          users={filtered}
          onView={setViewing}
          onEdit={setEditing}
          onChangeRole={setChangingRole}
          onToggleState={handleToggleState}
          onResendInvitation={handleResend}
          onDelete={setDeleting}
        />
      ) : (
        <UsersTable
          users={filtered}
          onView={setViewing}
          onEdit={setEditing}
          onChangeRole={setChangingRole}
          onToggleState={handleToggleState}
          onResendInvitation={handleResend}
          onDelete={setDeleting}
        />
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