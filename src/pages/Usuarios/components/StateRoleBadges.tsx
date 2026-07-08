import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Headphones, CheckCircle2, XCircle, Clock } from 'lucide-react'
import type { RoleV2, UserStateV2 } from '../types/userTypesV2'

export function RoleBadge({ role }: { role: RoleV2 }) {
  if (role === 'ADMIN') {
    return (
      <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary">
        <ShieldCheck className="h-3 w-3" /> Administrador
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700">
      <Headphones className="h-3 w-3" /> Call Center
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