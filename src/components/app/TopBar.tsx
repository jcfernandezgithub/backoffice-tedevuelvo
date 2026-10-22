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
    <header className="min-h-14 shrink-0 flex items-center justify-between border-b bg-background px-3 py-2 sm:py-0">
      <div className="flex shrink-0 items-center gap-2">
        <SidebarTrigger className="hover:bg-muted rounded-md p-2 transition-all duration-200">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <h1 className="hidden lg:block text-lg font-semibold">Te devuelvo · Backoffice</h1>
      </div>
      <div className="min-w-0 flex items-center gap-2 sm:gap-3">
        {user && <span className="min-w-0 text-right text-xs sm:text-sm text-muted-foreground"><span className="block max-w-40 truncate sm:max-w-none sm:inline" title={user.nombre}>{user.nombre}</span><span className="block sm:inline"> <span className="hidden sm:inline">· </span>{roleLabel}</span></span>}
        {isAdmin && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`relative shrink-0 h-11 w-11 sm:h-9 sm:w-9 rounded-full ${pendingCount > 0 ? 'animate-bell-glow' : ''}`}
                aria-label={pendingCount > 0 ? `${pendingCount} cambios bancarios pendientes` : 'Cambios bancarios'}
                title="Cambios bancarios"
              >
                <Bell className={`h-5 w-5 ${pendingCount > 0 ? 'animate-bell-ring text-primary' : ''}`} />
                {pendingCount > 0 && (
                  <>
                    <span className="animate-bell-dot-ping absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive" />
                    <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px] font-bold">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </Badge>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] space-y-4">
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
        <Button variant="outline" size="sm" className="shrink-0 h-11 sm:h-9" onClick={() => logout()}>Salir</Button>
      </div>
    </header>
  )
}
