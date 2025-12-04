import { Usuario, Rol } from "@/types/domain"

const seed: Usuario[] = [
  { id: "u-admin", nombre: "Admin", email: "admin@tedevuelvo.cl", rol: "ADMIN", activo: true },
  { id: "u-op", nombre: "Operaciones", email: "ops@tedevuelvo.cl", rol: "OPERACIONES", activo: true },
  { id: "u-al", nombre: "Alianzas", email: "alianzas@tedevuelvo.cl", rol: "ALIANZAS", activo: true },
  { id: "u-ro", nombre: "Solo Lectura", email: "readonly@tedevuelvo.cl", rol: "READONLY", activo: true },
  { id: "u-cc", nombre: "Call Center", email: "admin@callcenter.cl", rol: "CALLCENTER", activo: true },
]

export const usuariosMock = seed

export const credencialesMock: Record<string, { password: string; rol: Rol; id: string; nombre: string }> = {
  "admin@tedevuelvo.cl": { password: "123456", rol: "ADMIN", id: "u-admin", nombre: "Admin" },
  "ops@tedevuelvo.cl": { password: "123456", rol: "OPERACIONES", id: "u-op", nombre: "Operaciones" },
  "alianzas@tedevuelvo.cl": { password: "123456", rol: "ALIANZAS", id: "u-al", nombre: "Alianzas" },
  "readonly@tedevuelvo.cl": { password: "123456", rol: "READONLY", id: "u-ro", nombre: "Solo Lectura" },
  "admin@callcenter.cl": { password: "123456", rol: "CALLCENTER", id: "u-cc", nombre: "Call Center" },
}
