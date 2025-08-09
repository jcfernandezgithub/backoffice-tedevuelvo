import { db } from "./db"
import { uid } from "./storage"
import { Alianza, Comision } from "@/types/domain"

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const alianzasService = {
  async list(): Promise<Alianza[]> {
    await delay(200)
    return db.getAlianzas()
  },
  async get(id: string): Promise<Alianza | undefined> {
    await delay(150)
    return db.getAlianzas().find((a) => a.id === id)
  },
  async create(input: Omit<Alianza, "id" | "createdAt" | "updatedAt">): Promise<Alianza> {
    await delay(250)
    const now = new Date().toISOString()
    const nuevo: Alianza = { ...input, id: uid("al-"), createdAt: now, updatedAt: now }
    const arr = db.getAlianzas()
    arr.unshift(nuevo)
    db.setAlianzas(arr)
    return nuevo
  },
  async update(id: string, patch: Partial<Alianza>): Promise<Alianza> {
    await delay(250)
    const arr = db.getAlianzas()
    const idx = arr.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error("Alianza no encontrada")
    const updated: Alianza = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() }
    arr[idx] = updated
    db.setAlianzas(arr)
    return updated
  },
  async remove(id: string) {
    await delay(200)
    db.setAlianzas(db.getAlianzas().filter((a) => a.id !== id))
  },
  async comisionesByAlianza(alianzaId: string): Promise<Comision[]> {
    await delay(150)
    return db.getComisiones().filter((c) => c.alianzaId === alianzaId)
  },
}
