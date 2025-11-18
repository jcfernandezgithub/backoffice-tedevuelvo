import type { Alianza } from "../types/alianzas"
import { alianzaSchema } from "../schemas/alianzaSchema"
import { authenticatedFetch } from "./apiClient"

const API_BASE = "/partners"

export const alianzasService = {
  async list(query?: {
    search?: string
    page?: number
    pageSize?: number
    sortBy?: "nombre" | "comisionDegravamen"
    sortDir?: "asc" | "desc"
  }) {
    try {
      const response = await authenticatedFetch(API_BASE)
      const partners = await response.json()
      
      let rows = partners.map((p: any) => ({
        id: p._id || p.id,
        nombre: p.name,
        code: p.code,
        rut: p.rut,
        contacto: {
          email: p.contactEmail,
          fono: p.contactPhone,
        },
        direccion: p.direccion || '',
        descripcion: p.descripcion || p.displayName || p.name,
        comisionDegravamen: p.degravamen || 0,
        comisionCesantia: p.cesantia || 0,
        activo: p.status === 'ACTIVE',
        fechaInicio: p.inicioVigencia || p.createdAt,
        fechaTermino: p.terminoVigencia || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))

      if (query?.search) {
        const s = query.search.toLowerCase()
        rows = rows.filter(
          (a: Alianza) =>
            a.nombre.toLowerCase().includes(s) ||
            a.contacto.email?.toLowerCase().includes(s) ||
            a.contacto.fono?.toLowerCase().includes(s) ||
            a.rut?.toLowerCase().includes(s)
        )
      }
      
      if (query?.sortBy) {
        rows.sort((a: Alianza, b: Alianza) => {
          const dir = query.sortDir === "desc" ? -1 : 1
          const va = query.sortBy === "nombre" ? a.nombre : a.comisionDegravamen
          const vb = query.sortBy === "nombre" ? b.nombre : b.comisionDegravamen
          return (va > vb ? 1 : va < vb ? -1 : 0) * dir
        })
      }
      
      const page = query?.page ?? 1
      const pageSize = query?.pageSize ?? 10
      const total = rows.length
      const start = (page - 1) * pageSize
      const items = rows.slice(start, start + pageSize)
      return { items, total, page, pageSize }
    } catch (error) {
      console.error('Error fetching partners:', error)
      return { items: [], total: 0, page: 1, pageSize: 10 }
    }
  },

  async create(input: unknown) {
    const parsed = alianzaSchema.parse(input)
    
    const payload = {
      name: parsed.nombre,
      code: parsed.code,
      status: parsed.activo ? 'ACTIVE' : 'INACTIVE',
      rut: parsed.rut,
      descripcion: parsed.descripcion,
      degravamen: parsed.comisionDegravamen,
      cesantia: parsed.comisionCesantia,
      telefono: parsed.contacto.fono || undefined,
      direccion: parsed.direccion || undefined,
      inicioVigencia: parsed.fechaInicio.toISOString(),
      terminoVigencia: parsed.fechaTermino.toISOString(),
      contactEmail: parsed.contacto.email || undefined,
    }

    try {
      const response = await authenticatedFetch(API_BASE, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Error al crear la alianza')
      }
      
      const created = await response.json()
      
      return {
        id: created._id || created.id,
        nombre: created.name,
        code: created.code,
        rut: created.rut,
        contacto: {
          email: created.contactEmail,
          fono: created.telefono,
        },
        direccion: created.direccion || '',
        descripcion: created.descripcion || created.name,
        comisionDegravamen: created.degravamen || 0,
        comisionCesantia: created.cesantia || 0,
        activo: created.status === 'ACTIVE',
        fechaInicio: created.inicioVigencia || created.createdAt,
        fechaTermino: created.terminoVigencia || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      }
    } catch (error: any) {
      throw new Error(error.message || 'Error al crear la alianza')
    }
  },

  async update(id: string, input: unknown) {
    const parsed = alianzaSchema.parse(input)
    
    const payload = {
      name: parsed.nombre,
      code: parsed.code,
      status: parsed.activo ? 'ACTIVE' : 'INACTIVE',
      rut: parsed.rut,
      descripcion: parsed.descripcion,
      degravamen: parsed.comisionDegravamen,
      cesantia: parsed.comisionCesantia,
      telefono: parsed.contacto.fono || undefined,
      direccion: parsed.direccion || undefined,
      inicioVigencia: parsed.fechaInicio.toISOString(),
      terminoVigencia: parsed.fechaTermino.toISOString(),
      contactEmail: parsed.contacto.email || undefined,
    }

    try {
      const response = await authenticatedFetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Error al actualizar la alianza')
      }
      
      const updated = await response.json()
      
      return {
        id: updated._id || updated.id,
        nombre: updated.name,
        code: updated.code,
        rut: updated.rut,
        contacto: {
          email: updated.contactEmail,
          fono: updated.telefono,
        },
        direccion: updated.direccion || '',
        descripcion: updated.descripcion || updated.name,
        comisionDegravamen: updated.degravamen || 0,
        comisionCesantia: updated.cesantia || 0,
        activo: updated.status === 'ACTIVE',
        fechaInicio: updated.inicioVigencia || updated.createdAt,
        fechaTermino: updated.terminoVigencia || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      }
    } catch (error: any) {
      throw new Error(error.message || 'Error al actualizar la alianza')
    }
  },

  async remove(id: string) {
    try {
      const response = await authenticatedFetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Error al eliminar la alianza')
      }
      
      return await response.json()
    } catch (error: any) {
      throw new Error(error.message || 'Error al eliminar la alianza')
    }
  },
}
