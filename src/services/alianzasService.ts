import { alianzasMock } from "../mocks/alianzas_v2"
import type { Alianza } from "../types/alianzas"
import { alianzaSchema } from "../schemas/alianzaSchema"

let data: Alianza[] = [...alianzasMock]

const delay = (ms = 250) => new Promise((res) => setTimeout(res, ms))
const idGen = () => "AL-" + Math.random().toString(36).slice(2, 8).toUpperCase()

export const alianzasService = {
  async list(query?: {
    search?: string
    page?: number
    pageSize?: number
    sortBy?: "nombre" | "comision"
    sortDir?: "asc" | "desc"
  }) {
    await delay()
    let rows = [...data]
    if (query?.search) {
      const s = query.search.toLowerCase()
      rows = rows.filter(
        (a) =>
          a.nombre.toLowerCase().includes(s) ||
          a.contacto.email?.toLowerCase().includes(s) ||
          a.contacto.fono?.toLowerCase().includes(s)
      )
    }
    if (query?.sortBy) {
      rows.sort((a, b) => {
        const dir = query.sortDir === "desc" ? -1 : 1
        const va = query.sortBy === "nombre" ? a.nombre : a.comision
        const vb = query.sortBy === "nombre" ? b.nombre : b.comision
        return (va > vb ? 1 : va < vb ? -1 : 0) * dir
      })
    }
    const page = query?.page ?? 1
    const pageSize = query?.pageSize ?? 10
    const total = rows.length
    const start = (page - 1) * pageSize
    const items = rows.slice(start, start + pageSize)
    return { items, total, page, pageSize }
  },

  async create(input: unknown) {
    await delay()
    const parsed = alianzaSchema.parse(input)
    if (data.some((a) => a.nombre.toLowerCase() === parsed.nombre.toLowerCase())) {
      throw new Error("Ya existe una alianza con ese nombre")
    }
    const now = new Date().toISOString()
    const nuevo: Alianza = {
      id: idGen(),
      nombre: parsed.nombre,
      contacto: parsed.contacto,
      direccion: parsed.direccion,
      comision: parsed.comision,
      activo: parsed.activo ?? true,
      vigencia: parsed.vigencia ?? true,
      fechaInicio: parsed.fechaInicio.toISOString(),
      fechaTermino: parsed.fechaTermino.toISOString(),
      logo: parsed.logo,
      createdAt: now,
      updatedAt: now,
    }
    data.unshift(nuevo)
    return nuevo
  },

  async remove(id: string) {
    await delay()
    const idx = data.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error("Alianza no encontrada")
    const [removed] = data.splice(idx, 1)
    return removed
  },
}

