import { Link } from 'react-router-dom'
import { Bell, Landmark, ShieldAlert, UserCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/state/AuthContext'
import { useAlertNotifications } from '@/hooks/useAlertNotifications'
import { alertNotificationLink } from '@/lib/alertNotifications'
import { bankInfoChangesApi } from '@/services/bankInfoChangesApi'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useState } from 'react'

export function NotificationsBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const isAdmin = user?.rol === 'ADMIN'
  const alerts = useAlertNotifications()
  const bank = useQuery({
    queryKey: ['bank-info-changes-count', user?.id],
    queryFn: () => bankInfoChangesApi.countPending().then(response => response?.count ?? 0),
    enabled: isAdmin, refetchInterval: 60_000, retry: false,
  })
  if (!isAdmin && !alerts.allowed) return null
  const bankCount = isAdmin && !bank.isError ? bank.data ?? 0 : 0
  const count = bankCount + alerts.count
  const stale = alerts.pending.data?.meta.stale || alerts.assigned.data?.meta.stale
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" className={`relative shrink-0 h-11 w-11 sm:h-9 sm:w-9 rounded-full ${count > 0 ? 'animate-bell-glow' : ''}`} aria-label={count > 0 ? `Notificaciones: ${count} casos por atender` : 'Notificaciones'} title="Notificaciones">
        <Bell className={`h-5 w-5 ${count > 0 ? 'animate-bell-ring text-primary' : ''}`} />
        {count > 0 && <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px] font-bold">{count > 99 ? '99+' : count}</Badge>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-4">
      <h2 className="text-sm font-semibold">Notificaciones</h2>
      {alerts.allowed && <>
        <Notice icon={<ShieldAlert className="h-4 w-4" />} title="Alertas pendientes" loading={alerts.pending.isLoading} error={alerts.pending.isError} count={alerts.pendingCount} empty="No hay alertas pendientes." text={`${alerts.pendingCount} ${alerts.pendingCount === 1 ? 'alerta pendiente' : 'alertas pendientes'} de revisión.`} link={alertNotificationLink('pending')} action="Ver pendientes" close={() => setOpen(false)} />
        <Notice icon={<UserCheck className="h-4 w-4" />} title="Asignadas a ti" loading={alerts.assigned.isLoading} error={alerts.assigned.isError} count={alerts.assignedCount} empty="No tienes alertas asignadas sin resolver." text={`${alerts.assignedCount} ${alerts.assignedCount === 1 ? 'caso asignado' : 'casos asignados'} sin resolver.`} link={alertNotificationLink('assigned')} action="Ver mis casos" close={() => setOpen(false)} />
        {stale && <p className="text-xs text-destructive">El análisis de alertas está pendiente de actualizar.</p>}
      </>}
      {isAdmin && <Notice icon={<Landmark className="h-4 w-4" />} title="Cambios bancarios" loading={bank.isLoading} error={bank.isError} count={bankCount} empty="No hay cambios pendientes." text={`${bankCount} ${bankCount === 1 ? 'cambio requiere' : 'cambios requieren'} revisión.`} link="/cambios-bancarios" action="Revisar cambios bancarios" close={() => setOpen(false)} />}
    </PopoverContent>
  </Popover>
}

function Notice({ icon, title, loading, error, count, empty, text, link, action, close }: {
  icon: React.ReactNode; title: string; loading: boolean; error: boolean; count: number;
  empty: string; text: string; link: string; action: string; close: () => void;
}) {
  return <div className="space-y-2 border-t pt-3">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-md bg-muted p-2 text-primary">{icon}</div>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p>
        <p role={error ? 'alert' : undefined} className={`mt-1 text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{loading ? 'Consultando pendientes…' : error ? 'No fue posible consultar los pendientes.' : count > 0 ? text : empty}</p>
      </div>
    </div>
    <Button asChild variant="outline" className="w-full" size="sm"><Link to={link} onClick={close}>{action}</Link></Button>
  </div>
}