import { credencialesMock } from "@/mocks/usuarios"
import { Usuario } from "@/types/domain"
import { load, save } from "./storage"

const AUTH_KEY = "td_auth_user"

export type LoginResult = { user: Usuario }

export const authService = {
  getCurrent(): Usuario | null {
    return load<Usuario | null>(AUTH_KEY, null)
  },
  async login(email: string, password: string): Promise<LoginResult> {
    await new Promise((r) => setTimeout(r, 500))
    const cred = credencialesMock[email]
    if (!cred || cred.password !== password) {
      throw new Error("Credenciales inválidas")
    }
    const user: Usuario = {
      id: cred.id,
      nombre: cred.nombre,
      email,
      rol: cred.rol,
      activo: true,
    }
    save(AUTH_KEY, user)
    return { user }
  },
  async logout() {
    await new Promise((r) => setTimeout(r, 200))
    save(AUTH_KEY, null)
  },
}
