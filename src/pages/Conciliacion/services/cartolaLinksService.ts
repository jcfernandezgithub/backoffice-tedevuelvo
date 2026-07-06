import type { PendingRefund } from '../types'

const KEY = 'td_cartola_links_v1'

export interface CartolaLink {
  id: string
  documentoNumero: string
  refundId: string
  refundPublicId: string
  refundClientName: string
  refundClientRut: string
  amountApplied: number
  appliedAt: string
  appliedBy?: string
  note?: string
}

type Store = Record<string, CartolaLink[]>

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function save(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store))
}

function uid() {
  return `cl-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

function emitChange() {
  try {
    window.dispatchEvent(new CustomEvent('cartola-links-changed'))
  } catch {
    /* noop */
  }
}

export const cartolaLinksService = {
  all(): Store {
    return load()
  },

  listByMovement(documentoNumero: string): CartolaLink[] {
    return load()[documentoNumero] ?? []
  },

  reconciledByRefund(refundId: string): number {
    const store = load()
    let sum = 0
    for (const arr of Object.values(store)) {
      for (const l of arr) if (l.refundId === refundId) sum += l.amountApplied
    }
    return sum
  },

  addMatches(
    documentoNumero: string,
    matches: Array<{ refund: PendingRefund; amount: number; note?: string }>,
    appliedBy?: string,
  ): CartolaLink[] {
    if (!documentoNumero) throw new Error('El movimiento no tiene documento_numero')
    const store = load()
    const existing = store[documentoNumero] ?? []
    const created: CartolaLink[] = matches.map((m) => ({
      id: uid(),
      documentoNumero,
      refundId: m.refund.id,
      refundPublicId: m.refund.publicId,
      refundClientName: m.refund.fullName,
      refundClientRut: m.refund.rut,
      amountApplied: m.amount,
      appliedAt: new Date().toISOString(),
      appliedBy,
      note: m.note,
    }))
    store[documentoNumero] = [...existing, ...created]
    save(store)
    emitChange()
    return created
  },

  removeLink(linkId: string): void {
    const store = load()
    let changed = false
    for (const key of Object.keys(store)) {
      const before = store[key].length
      store[key] = store[key].filter((l) => l.id !== linkId)
      if (store[key].length !== before) changed = true
      if (store[key].length === 0) delete store[key]
    }
    if (changed) {
      save(store)
      emitChange()
    }
  },

  clearMovement(documentoNumero: string): void {
    const store = load()
    if (store[documentoNumero]) {
      delete store[documentoNumero]
      save(store)
      emitChange()
    }
  },
}
