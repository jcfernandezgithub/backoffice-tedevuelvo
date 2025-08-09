import { alianzasMock } from "@/mocks/alianzas"
import { comisionesMock } from "@/mocks/comisiones"
import { solicitudesMock } from "@/mocks/solicitudes"
import { usuariosMock } from "@/mocks/usuarios"
import { Alianza, Comision, Solicitud, Usuario } from "@/types/domain"
import { load, save } from "./storage"

export const KEYS = {
  alianzas: "td_alianzas",
  solicitudes: "td_solicitudes",
  comisiones: "td_comisiones",
  usuarios: "td_usuarios",
}

export const ensureSeed = () => {
  const a = load<Alianza[]>(KEYS.alianzas, [])
  if (a.length === 0) save(KEYS.alianzas, alianzasMock)

  const s = load<Solicitud[]>(KEYS.solicitudes, [])
  if (s.length === 0) save(KEYS.solicitudes, solicitudesMock)

  const c = load<Comision[]>(KEYS.comisiones, [])
  if (c.length === 0) save(KEYS.comisiones, comisionesMock)

  const u = load<Usuario[]>(KEYS.usuarios, [])
  if (u.length === 0) save(KEYS.usuarios, usuariosMock)
}

export const db = {
  getAlianzas: () => load<Alianza[]>(KEYS.alianzas, []),
  setAlianzas: (v: Alianza[]) => save(KEYS.alianzas, v),
  getSolicitudes: () => load<Solicitud[]>(KEYS.solicitudes, []),
  setSolicitudes: (v: Solicitud[]) => save(KEYS.solicitudes, v),
  getComisiones: () => load<Comision[]>(KEYS.comisiones, []),
  setComisiones: (v: Comision[]) => save(KEYS.comisiones, v),
  getUsuarios: () => load<Usuario[]>(KEYS.usuarios, []),
  setUsuarios: (v: Usuario[]) => save(KEYS.usuarios, v),
}

ensureSeed()
