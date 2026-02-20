import { NavLink, useLocation } from 'react-router-dom'
import { Briefcase, FileText, Home, Headphones, Settings, Shield, Users, Activity, Calculator } from 'lucide-react'
import { useAuth } from '@/state/AuthContext'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { useUrgentAlerts } from '@/hooks/useUrgentAlerts'

const items = [
  { title: 'Dashboard', url: '/dashboard', icon: Home, status: 'live' as const, adminOnly: false, callCenterOnly: false },
  { title: 'Solicitudes', url: '/refunds', icon: FileText, status: 'live' as const, adminOnly: true, callCenterOnly: false },
  { title: 'Call Center', url: '/gestion-callcenter', icon: Headphones, status: 'live' as const, adminOnly: false, callCenterOnly: true },
  { title: 'Alianzas', url: '/alianzas', icon: Briefcase, status: 'live' as const, adminOnly: false, callCenterOnly: false },
  { title: 'Usuarios', url: '/usuarios', icon: Users, status: 'dev' as const, adminOnly: false, callCenterOnly: false },
  { title: 'Operación', url: '/operacion', icon: Activity, status: 'live' as const, adminOnly: false, callCenterOnly: false },
  { title: 'Calculadora', url: '/calculadora', icon: Calculator, status: 'live' as const, adminOnly: false, callCenterOnly: false },
  { title: 'Ajustes', url: '/ajustes', icon: Settings, status: 'dev' as const, adminOnly: false, callCenterOnly: false },
]

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar()
  const { user } = useAuth()
  const { urgentCount } = useUrgentAlerts()
  const collapsed = state === 'collapsed'
  const location = useLocation()
  const currentPath = location.pathname
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/')
  const isExpanded = items.some((i) => isActive(i.url))
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-muted text-primary font-medium' : 'hover:bg-muted/60'

  // Filtrar items según email del usuario (restricción especial para Call Center)
  const isCallCenterUser = user?.email === 'admin@callcenter.cl'
  
  const visibleItems = items.filter(item => {
    // Si el usuario es admin@callcenter.cl, mostrar Call Center y Calculadora
    if (isCallCenterUser) {
      return item.callCenterOnly || item.url === '/calculadora'
    }
    // Para otros usuarios, aplicar filtro adminOnly
    return !item.adminOnly || user?.rol === 'ADMIN'
  })

  // Cerrar sidebar en móvil al hacer clic en un enlace
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <Sidebar 
      className={collapsed ? 'w-14' : 'w-64'} 
      collapsible="icon"
    >
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Principal</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isOperacion = item.url === '/operacion'
                const showAlert = isOperacion && urgentCount > 0

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavCls} onClick={handleLinkClick}>
                        {/* Icono con badge pulsante en modo colapsado */}
                        <div className="relative">
                          <item.icon className={collapsed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                          {showAlert && collapsed && (
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                            </span>
                          )}
                        </div>

                        {!collapsed && (
                          <div className="flex items-center justify-between flex-1 gap-2">
                            <span>{item.title}</span>
                            {/* Badge de alertas urgentes (tiene prioridad sobre el badge de estado) */}
                            {showAlert ? (
                              <span className="relative flex items-center gap-1">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-40" />
                                <Badge
                                  variant="destructive"
                                  className="relative text-[10px] px-1.5 py-0 min-w-[18px] text-center"
                                >
                                  {urgentCount}
                                </Badge>
                              </span>
                            ) : item.status === 'live' ? (
                              <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-1.5 py-0">
                                Productiva
                              </Badge>
                            ) : item.status === 'dev' ? (
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0">
                                En desarrollo
                              </Badge>
                            ) : null}
                          </div>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
