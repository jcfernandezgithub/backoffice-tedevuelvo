import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/state/AuthContext'
import { firstAllowedRoute, hasPageAccess, pageKeyForPath } from '@/lib/pageAccess'

export default function AdminRoute() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Si el backend entrega pages, priorizamos ese control por página.
  if (user.pages && user.pages.length > 0) {
    const key = pageKeyForPath(location.pathname)
    if (key && !hasPageAccess(user.pages, key)) {
      return <Navigate to={firstAllowedRoute(user.pages)} replace />
    }
  } else if (user.rol !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
