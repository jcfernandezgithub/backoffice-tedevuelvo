import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAuth } from '@/state/AuthContext'
import { Bell, Landmark, Menu } from 'lucide-react'
import { usePublicInstitutions } from '@/hooks/useInstitutions'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { bankInfoChangesApi } from '@/services/bankInfoChangesApi'

export function TopBar() {
  const { user, logout } = useAuth()
  const isAdmin = user?.rol === 'ADMIN'
  const pendingChanges = useQuery({
    queryKey: ['bank-info-changes-count'],
    queryFn: () => bankInfoChangesApi.countPending().then((response) => response?.count ?? 0),
    enabled: isAdmin,
    refetchInterval: 60_000,
    retry: false,
  })
  const pendingCount = pendingChanges.data ?? 0
  const roleLabel = user?.rolNombre ?? ({
    ADMIN: 'Administrador',
    OPERACIONES: 'Operaciones',
    ALIANZAS: 'Alianzas',
    READONLY: 'Solo lectura',
    CALLCENTER: 'Call Center',
  } as const)[user?.rol ?? 'READONLY']
  // Mantiene la cache de instituciones públicas tibia para que los helpers
  // sincrónicos (`getSafetyMarginByInstitutionId`) tengan datos disponibles.
  usePublicInstitutions()
  return (
    <header className="h-14 flex items-center justify-between border-b bg-background px-3">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="hover:bg-muted rounded-md p-2 transition-all duration-200">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <h1 className="text-lg font-semibold">Te devuelvo · Backoffice</h1>
      </div>
      <div className="flex items-center gap-3">
        {user && <span className="text-sm text-muted-foreground">{user.nombre} · {roleLabel}</span>}
        {isAdmin && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                aria-label={pendingCount > 0 ? `${pendingCount} cambios bancarios pendientes` : 'Cambios bancarios'}
                title="Cambios bancarios"
              >
                <Bell className={`h-5 w-5 ${pendingCount > 0 ? 'animate-bell-ring text-primary' : ''}`} />
                {pendingCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 min-w-5 animate-pulse justify-center px-1 text-[10px]">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-muted p-2 text-primary">
                  <Landmark className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Cambios bancarios</p>
                  {pendingChanges.isLoading ? (
                    <p className="mt-1 text-sm text-muted-foreground">Consultando pendientes…</p>
                  ) : pendingChanges.isError ? (
                    <p className="mt-1 text-sm text-destructive">No fue posible consultar los pendientes.</p>
                  ) : pendingCount > 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pendingCount} {pendingCount === 1 ? 'cambio requiere' : 'cambios requieren'} revisión.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">No hay cambios pendientes.</p>
                  )}
                </div>
              </div>
              <Button asChild className="w-full" size="sm">
                <Link to="/cambios-bancarios">Revisar cambios bancarios</Link>
              </Button>
            </PopoverContent>
          </Popover>
        )}
        <Button variant="outline" size="sm" onClick={() => logout()}>Salir</Button>
      </div>
    </header>
  )
}
