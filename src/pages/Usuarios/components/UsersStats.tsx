import { Users, ShieldCheck, Headphones, UserCheck, UserX } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { UserV2 } from '../types/userTypesV2'

interface Props {
  users: UserV2[]
}

export function UsersStats({ users }: Props) {
  const total = users.length
  const active = users.filter((u) => u.state === 'ACTIVE').length
  const inactive = users.filter((u) => u.state === 'INACTIVE').length
  const admins = users.filter((u) => u.role === 'ADMIN').length
  const callcenter = users.filter((u) => u.role === 'CALLCENTER').length

  const items = [
    { label: 'Total', value: total, icon: Users, color: 'text-foreground', bg: 'bg-muted' },
    { label: 'Activos', value: active, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Inactivos', value: inactive, icon: UserX, color: 'text-muted-foreground', bg: 'bg-muted' },
    { label: 'Administradores', value: admins, icon: ShieldCheck, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Call Center', value: callcenter, icon: Headphones, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{it.label}</p>
                <p className={`text-2xl font-semibold ${it.color}`}>{it.value}</p>
              </div>
              <div className={`rounded-md p-2 ${it.bg}`}>
                <it.icon className={`h-4 w-4 ${it.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}