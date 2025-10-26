import { createContext, useContext, useEffect, useMemo, useState, useRef } from 'react'
import { Usuario, Rol } from '@/types/domain'
import { authService } from '@/services/authService'

interface AuthContextValue {
  user: Usuario | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasRole: (...roles: Rol[]) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Refrescar el token 1 minuto antes de que expire (4 minutos)
const REFRESH_INTERVAL = 4 * 60 * 1000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Configurar auto-refresh del token
  useEffect(() => {
    const currentUser = authService.getCurrent()
    setUser(currentUser)

    if (currentUser) {
      // Iniciar el refresh automático
      startRefreshTimer()
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [])

  const startRefreshTimer = () => {
    // Limpiar timer anterior si existe
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
    }

    // Configurar refresh automático cada 4 minutos
    refreshTimerRef.current = setInterval(async () => {
      try {
        const { user: refreshedUser } = await authService.refresh()
        setUser(refreshedUser)
      } catch (error) {
        console.error('Error al refrescar token:', error)
        // Si falla el refresh, cerrar sesión
        await authService.logout()
        setUser(null)
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current)
        }
        window.location.href = '/login'
      }
    }, REFRESH_INTERVAL)
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    async login(email, password) {
      const { user } = await authService.login(email, password)
      setUser(user)
      // Iniciar el refresh automático después del login
      startRefreshTimer()
    },
    async logout() {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
      await authService.logout()
      setUser(null)
    },
    hasRole: (...roles: Rol[]) => (user ? roles.includes(user.rol) : false),
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
