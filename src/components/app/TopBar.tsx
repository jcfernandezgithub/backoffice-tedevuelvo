import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/state/AuthContext'
import { Menu } from 'lucide-react'

export function TopBar() {
  const { user, logout } = useAuth()
  return (
    <header className="h-14 flex items-center justify-between border-b bg-background px-3">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="hover:bg-muted rounded-md p-2 transition-all duration-200">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <h1 className="text-lg font-semibold">Te devuelvo · Backoffice</h1>
      </div>
      <div className="flex items-center gap-3">
        {user && <span className="text-sm text-muted-foreground">{user.nombre} · {user.rol}</span>}
        <Button variant="outline" size="sm" onClick={() => logout()}>Salir</Button>
      </div>
    </header>
  )
}
