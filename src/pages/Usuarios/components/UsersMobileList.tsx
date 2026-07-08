import { Card, CardContent } from '@/components/ui/card'
import type { UserV2 } from '../types/userTypesV2'
import { RoleBadge, StateBadge } from './StateRoleBadges'
import { UserRowActionsV2 } from './UserRowActionsV2'
import { CURRENT_USER_EMAIL } from '../constants/roleAccess'

interface Props {
  users: UserV2[]
  onView: (u: UserV2) => void
  onEdit: (u: UserV2) => void
  onChangeRole: (u: UserV2) => void
  onToggleState: (u: UserV2) => void
  onResendInvitation: (u: UserV2) => void
  onDelete: (u: UserV2) => void
}

function fmt(iso?: string) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function UsersMobileList(props: Props) {
  return (
    <div className="space-y-3">
      {props.users.map((u) => {
        const isCurrent = u.email.toLowerCase() === CURRENT_USER_EMAIL.toLowerCase()
        return (
          <Card key={u.id} className="cursor-pointer" onClick={() => props.onView(u)}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <RoleBadge role={u.role} />
                  <StateBadge state={u.state} />
                </div>
                <div onClick={(e) => e.stopPropagation()}>
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
                </div>
              </div>
              <div>
                <div className="font-medium flex items-center gap-2">
                  {u.firstName} {u.lastName}
                  {isCurrent && <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Tú</span>}
                </div>
                <div className="text-sm text-muted-foreground truncate">{u.email}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <div className="font-medium text-foreground/70">Último acceso</div>
                  <div>{fmt(u.lastLoginAt)}</div>
                </div>
                <div>
                  <div className="font-medium text-foreground/70">Creación</div>
                  <div>{fmt(u.createdAt)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}