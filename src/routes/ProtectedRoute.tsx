import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/state/AuthContext'
import { Rol } from '@/types/domain'

export default function ProtectedRoute({ roles }: { roles?: Rol[] }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Si el usuario es CALLCENTER, solo puede acceder a /gestion-callcenter
  if (user.rol === 'CALLCENTER') {
    const allowedPaths = ['/gestion-callcenter']
    const isAllowed = allowedPaths.some(path => 
      location.pathname === path || location.pathname.startsWith(path + '/')
    )
    if (!isAllowed) {
      return <Navigate to="/gestion-callcenter" replace />
    }
  }

  if (roles && !roles.includes(user.rol)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
