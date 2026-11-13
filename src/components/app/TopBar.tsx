import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/state/AuthContext'
import { Menu } from 'lucide-react'
import { usePublicInstitutions } from '@/hooks/useInstitutions'
import { NotificationsBell } from './NotificationsBell'

export function TopBar() {
  const { user, logout } = useAuth()
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
        <NotificationsBell />
        <Button variant="outline" size="sm" className="shrink-0 h-11 sm:h-9" onClick={() => logout()}>Salir</Button>
      </div>
    </header>
  )
}
