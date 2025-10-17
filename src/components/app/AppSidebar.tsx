import { NavLink, useLocation } from 'react-router-dom'
import { BarChart3, Briefcase, FileText, Home, Settings, Shield, Users, FileCheck2 } from 'lucide-react'
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
  { title: 'Dashboard', url: '/dashboard', icon: Home, status: 'dev' as const },
  { title: 'Solicitudes', url: '/solicitudes', icon: FileText, status: 'live' as const },
  { title: 'Alianzas', url: '/alianzas', icon: Briefcase, status: 'dev' as const },
  { title: 'Certificados', url: '/certificados', icon: FileCheck2, status: 'dev' as const },
  { title: 'Usuarios', url: '/usuarios', icon: Users, status: 'dev' as const },
  { title: 'Reportes', url: '/reportes', icon: BarChart3, status: 'dev' as const },
  { title: 'Ajustes', url: '/ajustes', icon: Settings, status: 'dev' as const },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  const location = useLocation()
  const currentPath = location.pathname
  const isActive = (path: string) => currentPath === path
  const isExpanded = items.some((i) => isActive(i.url))
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-muted text-primary font-medium' : 'hover:bg-muted/60'

  return (
    <Sidebar className={collapsed ? 'w-14' : 'w-64'}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && (
                        <div className="flex items-center justify-between flex-1 gap-2">
                          <span>{item.title}</span>
                          {item.status === 'live' && (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white text-[10px] px-1.5 py-0">
                              Productiva
                            </Badge>
                          )}
                          {item.status === 'dev' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              En construcción
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
