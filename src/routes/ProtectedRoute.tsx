import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/state/AuthContext'
import { Rol } from '@/types/domain'
import { firstAllowedRoute, hasPageAccess, pageKeyForPath } from '@/lib/pageAccess'

export default function ProtectedRoute({ roles }: { roles?: Rol[] }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Control de acceso por páginas asignadas al rol (backend login).
  if (user.pages && user.pages.length > 0) {
    const key = pageKeyForPath(location.pathname)
    if (key && !hasPageAccess(user.pages, key)) {
      return <Navigate to={firstAllowedRoute(user.pages)} replace />
    }
  } else if (user.email === 'admin@callcenter.cl') {
    // Fallback legacy si el usuario aún no tiene pages en el token.
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
