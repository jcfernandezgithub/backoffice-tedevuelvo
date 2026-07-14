import { authenticatedFetch } from '@/services/apiClient'

/**
 * Servicio HTTP de conciliaciones bancarias contra
 * `/api/v1/bank/reconciliation`. Reemplaza el antiguo store local: toda la
 * información de conciliaciones vive en el backend y se consulta on-demand.
 */

export interface CartolaLink {
  id: string
  /** publicId de la solicitud asociada (viene como refundId desde el backend). */
  refundId: string
  amountApplied: number
  /** Monto real de devolución que se guarda en la solicitud. */
  realAmount?: number
  createdAt: string
  createdBy?: string | null
}

export interface ReconciliationDetail {
  documentoNumero: string
  totalApplied: number
  count: number
  links: CartolaLink[]
}

export interface ReconciliationSummary {
  totalApplied: number
  count: number
}

export interface ApplyMatchInput {
  /** publicId de la solicitud (ej. TDV-12345) */
  publicId: string
  amountApplied: number
  /** Monto real de devolución (opcional; si no se envía, el backend puede usar amountApplied). */
  realAmount?: number
}


async function parseOrThrow(res: Response): Promise<any> {
  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      `Error ${res.status} al consultar conciliaciones bancarias`
    throw new Error(msg)
  }
  return data
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeLink(raw: any): CartolaLink {
  return {
    id: String(raw?.id ?? raw?._id ?? ''),
    refundId: String(raw?.refundId ?? raw?.publicId ?? ''),
    amountApplied: Number(raw?.amountApplied ?? 0),
    createdAt: String(raw?.createdAt ?? new Date().toISOString()),
    createdBy: raw?.createdBy ?? null,
  }
}

export const cartolaLinksService = {
  /** GET /bank/reconciliation/:documentoNumero */
  async getByMovement(documentoNumero: string): Promise<ReconciliationDetail> {
    if (!documentoNumero) {
      return { documentoNumero: '', totalApplied: 0, count: 0, links: [] }
    }
    const res = await authenticatedFetch(
      `/bank/reconciliation/${encodeURIComponent(documentoNumero)}`,
    )
    if (res.status === 404) {
      return { documentoNumero, totalApplied: 0, count: 0, links: [] }
    }
    const data = await parseOrThrow(res)
    const links = Array.isArray(data?.links) ? data.links.map(normalizeLink) : []
    return {
      documentoNumero: String(data?.documentoNumero ?? documentoNumero),
      totalApplied: Number(data?.totalApplied ?? 0),
      count: Number(data?.count ?? links.length),
      links,
    }
  },

  /** POST /bank/reconciliation/bulk */
  async getBulk(
    documentoNumeros: string[],
  ): Promise<Record<string, ReconciliationSummary>> {
    const list = Array.from(new Set(documentoNumeros.filter(Boolean)))
    if (list.length === 0) return {}
    const res = await authenticatedFetch(`/bank/reconciliation/bulk`, {
      method: 'POST',
      body: JSON.stringify({ documentoNumeros: list }),
    })
    const data = await parseOrThrow(res)
    const map = (data?.byDocumentoNumero ?? {}) as Record<
      string,
      { totalApplied?: number; count?: number }
    >
    const out: Record<string, ReconciliationSummary> = {}
    for (const key of Object.keys(map)) {
      out[key] = {
        totalApplied: Number(map[key]?.totalApplied ?? 0),
        count: Number(map[key]?.count ?? 0),
      }
    }
    return out
  },

  /** POST /bank/reconciliation */
  async applyMatches(
    documentoNumero: string,
    matches: ApplyMatchInput[],
  ): Promise<void> {
    if (!documentoNumero) throw new Error('El movimiento no tiene documento_numero')
    if (matches.length === 0) throw new Error('Debes agregar al menos una solicitud')
    const res = await authenticatedFetch(`/bank/reconciliation`, {
      method: 'POST',
      body: JSON.stringify({
        documentoNumero,
        matches: matches.map((m) => {
          const payload: Record<string, unknown> = {
            publicId: m.publicId,
            amountApplied: Math.round(m.amountApplied),
          }
          if (m.realAmount !== undefined && m.realAmount !== null) {
            payload.realAmount = Math.round(m.realAmount)
          }
          return payload
        }),
      }),
    })
    await parseOrThrow(res)
  },


  /** DELETE /bank/reconciliation/:id */
  async removeLink(linkId: string): Promise<void> {
    if (!linkId) return
    const res = await authenticatedFetch(
      `/bank/reconciliation/${encodeURIComponent(linkId)}`,
      { method: 'DELETE' },
    )
    await parseOrThrow(res)
  },
}
