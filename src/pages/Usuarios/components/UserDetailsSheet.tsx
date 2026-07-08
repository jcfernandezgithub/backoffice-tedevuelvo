import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Pencil, ShieldCheck, Power, Mail, Phone, Calendar, Clock, UserCircle } from 'lucide-react'
import type { UserV2 } from '../types/userTypesV2'
import { RoleBadge, StateBadge } from './StateRoleBadges'
import { RoleAccessInfo } from './RoleAccessInfo'
import { CURRENT_USER_EMAIL } from '../constants/roleAccess'
import { useRoles } from '@/pages/Ajustes/hooks/useRoles'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  user: UserV2 | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onEdit: (u: UserV2) => void
  onChangeRole: (u: UserV2) => void
  onToggleState: (u: UserV2) => void
}

function formatDateTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium break-words">{value ?? '—'}</div>
      </div>
    </div>
  )
}

export function UserDetailsSheet({ user, open, onOpenChange, onEdit, onChangeRole, onToggleState }: Props) {
  const { getRole } = useRoles()
  if (!user) return null
  const isCurrent = user.email.toLowerCase() === CURRENT_USER_EMAIL.toLowerCase()
  const isFullAccess = getRole(user.role)?.scope === 'FULL'
  const selfTip = 'No puedes realizar esta acción sobre tu propio usuario'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {user.firstName} {user.lastName}
          </SheetTitle>
          <SheetDescription>Detalle del usuario y nivel de acceso.</SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <RoleBadge role={user.role} />
            <StateBadge state={user.state} />
          </div>
        </SheetHeader>

        <TooltipProvider delayDuration={200}>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(user)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </Button>
            {isCurrent && isFullAccess ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" variant="outline" disabled>
                      <ShieldCheck className="h-4 w-4 mr-2" /> Cambiar rol
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>No puedes reducir tu propio nivel de acceso</TooltipContent>
              </Tooltip>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onChangeRole(user)}>
                <ShieldCheck className="h-4 w-4 mr-2" /> Cambiar rol
              </Button>
            )}
            {isCurrent ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button size="sm" variant="outline" disabled>
                      <Power className="h-4 w-4 mr-2" /> {user.state === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{selfTip}</TooltipContent>
              </Tooltip>
            ) : (
              <Button size="sm" variant="outline" onClick={() => onToggleState(user)}>
                <Power className="h-4 w-4 mr-2" />
                {user.state === 'ACTIVE' ? 'Desactivar' : 'Activar'}
              </Button>
            )}
          </div>
        </TooltipProvider>

        <Separator className="my-6" />

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoRow icon={UserCircle} label="Nombre completo" value={`${user.firstName} ${user.lastName}`} />
            <InfoRow icon={Mail} label="Correo" value={user.email} />
            <InfoRow icon={Phone} label="Teléfono" value={user.phone || '—'} />
            <InfoRow icon={Calendar} label="Fecha de creación" value={formatDateTime(user.createdAt)} />
            <InfoRow icon={Clock} label="Último acceso" value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Nunca'} />
          </div>
        </div>

        <Separator className="my-6" />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Nivel de acceso</h3>
          <RoleAccessInfo role={user.role} />
        </div>

        <Separator className="my-6" />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Historial de actividad</h3>
          <ol className="relative border-l border-muted-foreground/20 ml-2 space-y-4">
            {[...user.activity].reverse().map((ev) => (
              <li key={ev.id} className="ml-4">
                <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary/60 border-2 border-background" />
                <p className="text-sm font-medium">{ev.description}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(ev.at)}</p>
              </li>
            ))}
          </ol>
        </div>
      </SheetContent>
    </Sheet>
  )
}