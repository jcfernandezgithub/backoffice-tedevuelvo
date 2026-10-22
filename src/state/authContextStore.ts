import { createContext, type Context } from 'react'
import type { Usuario, Rol } from '@/types/domain'

export interface AuthContextValue {
  user: Usuario | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasRole: (...roles: Rol[]) => boolean
}

// Keep provider and consumers on the same context during Vite hot updates.
const previous: Context<AuthContextValue | undefined> | undefined = import.meta.hot?.data.authContext
export const AuthContext = previous ?? createContext<AuthContextValue | undefined>(undefined)
if (import.meta.hot) import.meta.hot.data.authContext = AuthContext