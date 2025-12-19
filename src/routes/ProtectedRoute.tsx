import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/state/AuthContext'
import { Rol } from '@/types/domain'

export default function ProtectedRoute({ roles }: { roles?: Rol[] }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Si el usuario es admin@callcenter.cl, solo puede acceder a /gestion-callcenter y /calculadora
  if (user.email === 'admin@callcenter.cl') {
    const allowedPaths = ['/gestion-callcenter', '/calculadora']
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
