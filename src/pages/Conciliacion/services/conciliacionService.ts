import type { BankMovement, ReconciliationLink } from '../types'

const KEYS = {
  movements: 'td_conciliacion_movements_v1',
  links: 'td_conciliacion_links_v1',
  seeded: 'td_conciliacion_seeded_v1',
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

function uid(prefix = 'mov-') {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

function seedIfNeeded() {
  if (localStorage.getItem(KEYS.seeded)) return
  const today = new Date()
  const iso = (offsetDays: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() - offsetDays)
    return d.toISOString()
  }

  const seedMovements: BankMovement[] = [
    {
      id: uid(),
      date: iso(0),
      description: 'TRANSFERENCIA RECIBIDA - BANCO DE CHILE',
      reference: 'TRX-998812',
      counterpartName: 'BANCO DE CHILE - DEVOLUCIONES',
      amount: 1850000,
      type: 'deposit',
      remaining: 1850000,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: uid(),
      date: iso(1),
      description: 'ABONO - SCOTIABANK CHILE',
      reference: 'TRX-887651',
      counterpartName: 'SCOTIABANK CHILE',
      amount: 945200,
      type: 'deposit',
      remaining: 945200,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: uid(),
      date: iso(2),
      description: 'TRANSFERENCIA ELECTRÓNICA - SANTANDER',
      reference: 'TRX-776540',
      counterpartName: 'BANCO SANTANDER',
      amount: 532800,
      type: 'deposit',
      remaining: 532800,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: uid(),
      date: iso(3),
      description: 'COMISIÓN BANCARIA',
      reference: 'COM-001',
      amount: -3500,
      type: 'charge',
      remaining: -3500,
      status: 'ignored',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: uid(),
      date: iso(4),
      description: 'ABONO - BCI',
      reference: 'TRX-665432',
      counterpartName: 'BANCO BCI',
      amount: 287400,
      type: 'deposit',
      remaining: 287400,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  save(KEYS.movements, seedMovements)
  save(KEYS.links, [])
  localStorage.setItem(KEYS.seeded, '1')
}

seedIfNeeded()

function recomputeMovementStatus(mov: BankMovement): BankMovement {
  if (mov.type === 'charge') return mov
  const orig = mov.amount
  const remaining = Math.max(0, mov.remaining)
  let status: BankMovement['status'] = 'pending'
  if (remaining <= 0.5) status = 'reconciled'
  else if (remaining < orig) status = 'partial'
  else status = 'pending'
  return { ...mov, remaining, status, updatedAt: new Date().toISOString() }
}

export const conciliacionService = {
  listMovements(): BankMovement[] {
    return load<BankMovement[]>(KEYS.movements, []).sort((a, b) =>
      a.date < b.date ? 1 : -1,
    )
  },

  listLinks(): ReconciliationLink[] {
    return load<ReconciliationLink[]>(KEYS.links, [])
  },

  linksByMovement(movementId: string): ReconciliationLink[] {
    return this.listLinks().filter((l) => l.movementId === movementId)
  },

  linksByRefund(refundId: string): ReconciliationLink[] {
    return this.listLinks().filter((l) => l.refundId === refundId)
  },

  applyMatches(
    movementId: string,
    matches: Array<{
      refundId: string
      refundPublicId: string
      refundClientName: string
      refundClientRut: string
      amountApplied: number
      note?: string
    }>,
    appliedBy?: string,
  ): { movement: BankMovement; links: ReconciliationLink[] } {
    const movements = load<BankMovement[]>(KEYS.movements, [])
    const idx = movements.findIndex((m) => m.id === movementId)
    if (idx === -1) throw new Error('Movimiento no encontrado')

    const mov = movements[idx]
    const total = matches.reduce((s, m) => s + m.amountApplied, 0)
    if (total <= 0) throw new Error('El monto a aplicar debe ser mayor a 0')
    if (total > mov.remaining + 0.5)
      throw new Error('El monto total excede el saldo del movimiento')

    const existing = load<ReconciliationLink[]>(KEYS.links, [])
    const newLinks: ReconciliationLink[] = matches.map((m) => ({
      id: uid('rl-'),
      movementId,
      refundId: m.refundId,
      refundPublicId: m.refundPublicId,
      refundClientName: m.refundClientName,
      refundClientRut: m.refundClientRut,
      amountApplied: m.amountApplied,
      appliedAt: new Date().toISOString(),
      appliedBy,
      note: m.note,
    }))

    save(KEYS.links, [...existing, ...newLinks])

    const updated = recomputeMovementStatus({
      ...mov,
      remaining: mov.remaining - total,
    })
    movements[idx] = updated
    save(KEYS.movements, movements)

    return { movement: updated, links: newLinks }
  },

  removeLink(linkId: string): void {
    const links = load<ReconciliationLink[]>(KEYS.links, [])
    const link = links.find((l) => l.id === linkId)
    if (!link) return
    const remaining = links.filter((l) => l.id !== linkId)
    save(KEYS.links, remaining)

    const movements = load<BankMovement[]>(KEYS.movements, [])
    const idx = movements.findIndex((m) => m.id === link.movementId)
    if (idx !== -1) {
      const mov = movements[idx]
      const updated = recomputeMovementStatus({
        ...mov,
        remaining: mov.remaining + link.amountApplied,
      })
      movements[idx] = updated
      save(KEYS.movements, movements)
    }
  },

  setIgnored(movementId: string, ignored: boolean): BankMovement | null {
    const movements = load<BankMovement[]>(KEYS.movements, [])
    const idx = movements.findIndex((m) => m.id === movementId)
    if (idx === -1) return null
    const mov = movements[idx]
    const updated: BankMovement = ignored
      ? { ...mov, status: 'ignored', updatedAt: new Date().toISOString() }
      : recomputeMovementStatus({ ...mov })
    movements[idx] = updated
    save(KEYS.movements, movements)
    return updated
  },

  refreshFromBank(): BankMovement[] {
    // Mock: agrega un nuevo movimiento ficticio
    const movements = load<BankMovement[]>(KEYS.movements, [])
    const amount = Math.floor(200000 + Math.random() * 1500000)
    const banks = ['BANCO ESTADO', 'BANCO ITAÚ', 'BANCO FALABELLA', 'BANCO RIPLEY']
    const bank = banks[Math.floor(Math.random() * banks.length)]
    const nuevo: BankMovement = {
      id: uid(),
      date: new Date().toISOString(),
      description: `ABONO - ${bank}`,
      reference: `TRX-${Math.floor(Math.random() * 999999)}`,
      counterpartName: bank,
      amount,
      type: 'deposit',
      remaining: amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const next = [nuevo, ...movements]
    save(KEYS.movements, next)
    return next
  },
}