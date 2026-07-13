import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Headphones, CheckCircle2, XCircle, Clock, UserCog } from 'lucide-react'
import type { UserStateV2 } from '../types/userTypesV2'
import { useRoles } from '@/pages/Ajustes/hooks/useRoles'

function isLikelyBackendId(value: string) {
  return /^[a-f0-9]{24}$/i.test(value)
}

export function RoleBadge({ role, roleName }: { role: string; roleName?: string }) {
  const { getRole } = useRoles()
  const def = getRole(role)
  if (!def) {
    const label = roleName || (role ? (isLikelyBackendId(role) ? 'Rol no encontrado' : role) : 'Sin rol')
    return (
      <Badge variant="outline" className="gap-1 border-muted-foreground/30 bg-muted text-muted-foreground">
        <UserCog className="h-3 w-3" /> {label}
      </Badge>
    )
  }
  if (role === 'ADMIN') {
    return (
      <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary">
        <ShieldCheck className="h-3 w-3" /> {def.label}
      </Badge>
    )
  }
  if (role === 'CALLCENTER') {
    return (
      <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700">
        <Headphones className="h-3 w-3" /> {def.label}
      </Badge>
    )
  }
  const isFull = def.scope === 'FULL'
  return (
    <Badge
      variant="outline"
      className={`gap-1 ${isFull ? 'border-primary/30 bg-primary/5 text-primary' : 'border-slate-300 bg-slate-50 text-slate-700'}`}
    >
      <UserCog className="h-3 w-3" /> {def.label}
    </Badge>
  )
}

export function StateBadge({ state }: { state: UserStateV2 }) {
  if (state === 'ACTIVE') {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Activo
      </Badge>
    )
  }
  if (state === 'INACTIVE') {
    return (
      <Badge variant="outline" className="gap-1 border-slate-300 bg-slate-50 text-slate-600">
        <XCircle className="h-3 w-3" /> Inactivo
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 border-blue-300 bg-blue-50 text-blue-700">
      <Clock className="h-3 w-3" /> Invitación pendiente
    </Badge>
  )
}