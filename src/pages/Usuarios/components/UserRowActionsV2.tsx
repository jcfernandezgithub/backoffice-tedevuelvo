import { MoreHorizontal, Eye, Pencil, ShieldCheck, Power, Mail, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { UserV2 } from '../types/userTypesV2'
import { useRoles } from '@/pages/Ajustes/hooks/useRoles'

interface Props {
  user: UserV2
  isCurrentUser: boolean
  onView: () => void
  onEdit: () => void
  onChangeRole: () => void
  onToggleState: () => void
  onResendInvitation: () => void
  onDelete: () => void
}

function DisabledItem({ label, tooltip, icon: Icon, destructive }: { label: string; tooltip: string; icon: any; destructive?: boolean }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="menuitem"
            aria-disabled="true"
            className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm opacity-50 cursor-not-allowed ${destructive ? 'text-destructive' : ''}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function UserRowActionsV2({
  user,
  isCurrentUser,
  onView,
  onEdit,
  onChangeRole,
  onToggleState,
  onResendInvitation,
  onDelete,
}: Props) {
  const { getRole } = useRoles()
  const isFullAccess = getRole(user.role)?.scope === 'FULL'
  const selfTooltip = 'No puedes realizar esta acción sobre tu propio usuario'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Acciones para ${user.firstName} ${user.lastName}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" /> Ver detalle
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" /> Editar usuario
        </DropdownMenuItem>

        {isCurrentUser && isFullAccess ? (
          <DisabledItem label="Cambiar rol" tooltip="No puedes reducir tu propio nivel de acceso" icon={ShieldCheck} />
        ) : (
          <DropdownMenuItem onClick={onChangeRole}>
            <ShieldCheck className="h-4 w-4 mr-2" /> Cambiar rol
          </DropdownMenuItem>
        )}

        {isCurrentUser ? (
          <DisabledItem label={user.state === 'ACTIVE' ? 'Desactivar' : 'Activar'} tooltip={selfTooltip} icon={Power} />
        ) : (
          <DropdownMenuItem onClick={onToggleState}>
            <Power className="h-4 w-4 mr-2" />
            {user.state === 'ACTIVE' ? 'Desactivar' : 'Activar'}
          </DropdownMenuItem>
        )}

        {user.state === 'PENDING' && (
          <DropdownMenuItem onClick={onResendInvitation}>
            <Mail className="h-4 w-4 mr-2" /> Reenviar invitación
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {isCurrentUser ? (
          <DisabledItem label="Eliminar usuario" tooltip={selfTooltip} icon={Trash2} destructive />
        ) : (
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Eliminar usuario
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}