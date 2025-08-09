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

const items = [
  { title: 'Dashboard', url: '/dashboard', icon: Home },
  { title: 'Solicitudes', url: '/solicitudes', icon: FileText },
  { title: 'Alianzas', url: '/alianzas', icon: Briefcase },
  { title: 'Certificados', url: '/certificados', icon: FileCheck2 },
  { title: 'Usuarios', url: '/usuarios', icon: Users },
  { title: 'Reportes', url: '/reportes', icon: BarChart3 },
  { title: 'Ajustes', url: '/ajustes', icon: Settings },
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
                      {!collapsed && <span>{item.title}</span>}
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
