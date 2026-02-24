import { NavLink, useLocation } from 'react-router-dom'
import { Briefcase, FileText, Home, Headphones, Settings, Users, Activity, Calculator } from 'lucide-react'
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
  const collapsed = state === 'collapsed'
  const location = useLocation()
  const currentPath = location.pathname
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/')
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-muted text-primary font-medium' : 'hover:bg-muted/60'

  const isCallCenterUser = user?.email === 'admin@callcenter.cl'
  
  const visibleItems = items.filter(item => {
    if (isCallCenterUser) {
      return item.callCenterOnly || item.url === '/calculadora'
    }
    return !item.adminOnly || user?.rol === 'ADMIN'
  })

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
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls} onClick={handleLinkClick}>
                      <item.icon className={collapsed ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                      {!collapsed && (
                        <div className="flex items-center justify-between flex-1 gap-2">
                          <span>{item.title}</span>
                          {item.status === 'dev' && item.url === '/usuarios' && (
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0">
                              En desarrollo
                            </Badge>
                          )}
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
