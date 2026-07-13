import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserV2 } from '../types/userTypesV2'
import { RoleBadge, StateBadge } from './StateRoleBadges'
import { UserRowActionsV2 } from './UserRowActionsV2'
import { CURRENT_USER_EMAIL } from '../constants/roleAccess'

interface Props {
  users: UserV2[]
  loading?: boolean
  onView: (u: UserV2) => void
  onEdit: (u: UserV2) => void
  onChangeRole: (u: UserV2) => void
  onToggleState: (u: UserV2) => void
  onResendInvitation: (u: UserV2) => void
  onDelete: (u: UserV2) => void
}

function formatDate(iso?: string) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function formatDateTime(iso?: string) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function UsersTable(props: Props) {
  const { users, loading } = props

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Último acceso</TableHead>
            <TableHead>Fecha de creación</TableHead>
            <TableHead className="w-12 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const isCurrent = u.email.toLowerCase() === CURRENT_USER_EMAIL.toLowerCase()
            return (
              <TableRow
                key={u.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => props.onView(u)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{u.firstName} {u.lastName}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Tú
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell><RoleBadge role={u.role} roleName={u.roleName} /></TableCell>
                <TableCell><StateBadge state={u.state} /></TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDateTime(u.lastLoginAt)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatDate(u.createdAt)}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                  <UserRowActionsV2
                    user={u}
                    isCurrentUser={isCurrent}
                    onView={() => props.onView(u)}
                    onEdit={() => props.onEdit(u)}
                    onChangeRole={() => props.onChangeRole(u)}
                    onToggleState={() => props.onToggleState(u)}
                    onResendInvitation={() => props.onResendInvitation(u)}
                    onDelete={() => props.onDelete(u)}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}