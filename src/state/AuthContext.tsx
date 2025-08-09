import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Usuario, Rol } from '@/types/domain'
import { authService } from '@/services/authService'

interface AuthContextValue {
  user: Usuario | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasRole: (...roles: Rol[]) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null)

  useEffect(() => {
    setUser(authService.getCurrent())
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    async login(email, password) {
      const { user } = await authService.login(email, password)
      setUser(user)
    },
    async logout() {
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
