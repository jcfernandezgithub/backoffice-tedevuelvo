import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/state/AuthContext'

export default function AdminRoute() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.rol !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
