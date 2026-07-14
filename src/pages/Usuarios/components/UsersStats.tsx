import { Users, UserCheck, UserX, Briefcase, Sparkles, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useUsersCount } from '../hooks/useUsers'

interface Props {
  customerRoleId?: string
}

export function UsersStats({ customerRoleId }: Props) {
  const total = useUsersCount({})
  const active = useUsersCount({ status: 'active' })
  const inactive = useUsersCount({ status: 'inactive' })
  const customers = useUsersCount(customerRoleId ? { roleId: customerRoleId } : {})

  const customersTotal = customerRoleId ? customers.total : 0
  const backoffice = Math.max(0, total.total - customersTotal)

  const items = [
    { label: 'Total', value: total.total, loading: total.isLoading, icon: Users, color: 'text-foreground', bg: 'bg-muted' },
    { label: 'Usuarios BackOffice', value: backoffice, loading: total.isLoading || customers.isLoading, icon: Briefcase, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Usuarios TDV', value: customersTotal, loading: customers.isLoading, icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Activos', value: active.total, loading: active.isLoading, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Inactivos', value: inactive.total, loading: inactive.isLoading, icon: UserX, color: 'text-muted-foreground', bg: 'bg-muted' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{it.label}</p>
                <p className={`text-2xl font-semibold ${it.color} flex items-center gap-1.5`}>
                  {it.loading ? <Loader2 className="h-4 w-4 animate-spin opacity-60" /> : it.value}
                </p>
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