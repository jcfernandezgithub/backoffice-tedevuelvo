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

// Verificar cada minuto si el token está por expirar; solo se refresca cuando falta poco.
const REFRESH_CHECK_INTERVAL = 60 * 1000
const MAX_REFRESH_FAILURES = 3

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const failuresRef = useRef<number>(0)

  // Configurar auto-refresh del token
  useEffect(() => {
    const initAuth = async () => {
      const currentUser = authService.getCurrent()
      
      if (currentUser) {
        // Cargar el usuario actual siempre; el timer se encargará de refrescar cuando toque.
        setUser(currentUser)
        if (authService.isTokenExpiringSoon()) {
          try {
            const { user: refreshedUser } = await authService.refresh()
            setUser(refreshedUser)
          } catch (error) {
            console.warn('[Auth] Refresh inicial falló, se reintentará automáticamente', error)
          }
        }
        startRefreshTimer()
      } else {
        setUser(null)
      }
      
      setIsInitialized(true)
    }

    initAuth()

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [])

  const startRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
    }

    refreshTimerRef.current = setInterval(async () => {
      // Solo refrescamos si el token está a punto de expirar.
      if (!authService.isTokenExpiringSoon()) {
        return
      }
      try {
        const { user: refreshedUser } = await authService.refresh()
        setUser(refreshedUser)
        failuresRef.current = 0
      } catch (error) {
        failuresRef.current += 1
        console.warn(
          `[Auth] Fallo al refrescar token (intento ${failuresRef.current}/${MAX_REFRESH_FAILURES})`,
          error,
        )
        // Solo cerramos sesión si el token ya expiró Y agotamos los reintentos.
        // Así evitamos deslogueos por errores transitorios de red (Render cold-start, etc.).
        if (
          failuresRef.current >= MAX_REFRESH_FAILURES &&
          !authService.getAccessToken()
        ) {
          if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
          await authService.logout()
          setUser(null)
          window.location.href = '/login'
        }
      }
    }, REFRESH_CHECK_INTERVAL)
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    async login(email, password) {
      const { user } = await authService.login(email, password)
      setUser(user)
      failuresRef.current = 0
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

  if (!isInitialized) {
    return null
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
