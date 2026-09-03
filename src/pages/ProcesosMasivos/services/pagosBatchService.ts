import { refundAdminApi } from '@/services/refundAdminApi'
import type { RefundRequest } from '@/types/refund'

// ──────────────────────────────────────────────────────
// Carga masiva de pagos: archivo "carga_tdv_*.csv" generado
// en Nómina de Devoluciones.
// Header: ID Solicitud;Nombre Cliente;RUT;Institucion Financiera;Monto Devolucion
// ──────────────────────────────────────────────────────

export const MASSIVE_PAID_NOTE = 'Proceso masivo de cambio de estado'

export interface CargaTdvRow {
  lineNumber: number
  refundId: string
  fullName: string
  rut: string
  institucion: string
  monto: number
}

export type RowStatus = 'ready' | 'invalid' | 'not_found' | 'wrong_status'

export interface ResolvedRow extends CargaTdvRow {
  rowStatus: RowStatus
  reason: string
  refund?: RefundRequest
  currentStatus?: string
  realAmount?: number
}

export type ResultStatus = 'success' | 'skipped' | 'error'

export interface PaidResult {
  lineNumber: number
  refundId: string
  publicId?: string
  fullName: string
  rut: string
  monto: number
  status: ResultStatus
  reason: string
}

// ── CSV parsing ───────────────────────────────────────
function detectDelimiter(line: string): string {
  const candidates = [';', ',', '\t', '|']
  let best = ';'
  let bestCount = -1
  for (const c of candidates) {
    const n = line.split(c).length
    if (n > bestCount) { best = c; bestCount = n }
  }
  return best
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === delim) { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^"|"$/g, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAmount(raw: string): number {
  const cleaned = (raw || '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? Math.round(n) : 0
}

const HEADER_ALIASES: Record<keyof Omit<CargaTdvRow, 'lineNumber'>, string[]> = {
  refundId: ['id solicitud', 'idsolicitud', 'id', 'refundid', 'publicid'],
  fullName: ['nombre cliente', 'nombre', 'cliente', 'fullname'],
  rut: ['rut', 'rut cliente'],
  institucion: ['institucion financiera', 'institucion', 'entidad financiera', 'banco'],
  monto: ['monto devolucion', 'monto', 'monto devolución', 'montodevolucion'],
}

export function parseCargaTdvCsv(text: string): { rows: CargaTdvRow[]; error?: string } {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = cleaned.split('\n').filter(l => l.trim().length > 0)
  if (lines.length === 0) return { rows: [], error: 'El archivo está vacío.' }

  const delim = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delim).map(normalizeHeader)

  const idx: Record<string, number> = {}
  ;(Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]).forEach((key) => {
    idx[key] = headers.findIndex(h => HEADER_ALIASES[key].includes(h))
  })

  if (idx.refundId < 0 || idx.monto < 0) {
    return {
      rows: [],
      error: 'El archivo no tiene el formato esperado. Debe ser el CSV "carga_tdv_*" con las columnas: ID Solicitud; Nombre Cliente; RUT; Institucion Financiera; Monto Devolucion.',
    }
  }

  const rows: CargaTdvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delim).map(c => c.replace(/^"|"$/g, '').trim())
    rows.push({
      lineNumber: i + 1,
      refundId: idx.refundId >= 0 ? (cols[idx.refundId] || '') : '',
      fullName: idx.fullName >= 0 ? (cols[idx.fullName] || '') : '',
      rut: idx.rut >= 0 ? (cols[idx.rut] || '') : '',
      institucion: idx.institucion >= 0 ? (cols[idx.institucion] || '') : '',
      monto: parseAmount(idx.monto >= 0 ? (cols[idx.monto] || '') : ''),
    })
  }
  return { rows }
}

// ── Resolución de solicitudes ─────────────────────────
function normalizeRut(rut: string) {
  return (rut || '').replace(/[.\s]/g, '').toLowerCase()
}

function matchesId(r: RefundRequest, id: string) {
  const anyR = r as RefundRequest & { _id?: string }
  return r.id === id || anyR._id === id || r.publicId === id
}

function lastRealAmount(r: RefundRequest): number | undefined {
  if (typeof (r as any).realAmount === 'number') return (r as any).realAmount
  const history = Array.isArray(r.statusHistory) ? r.statusHistory : []
  for (let i = history.length - 1; i >= 0; i--) {
    if (typeof history[i]?.realAmount === 'number') return history[i].realAmount as number
  }
  return undefined
}

export async function resolveRow(row: CargaTdvRow): Promise<ResolvedRow> {
  if (!row.refundId) {
    return {
      ...row,
      rowStatus: 'invalid',
      reason: 'La fila no tiene ID de solicitud. Vuelve a generar la nómina desde "Agregar desde solicitudes".',
    }
  }

  let refund: RefundRequest | undefined
  try {
    refund = await refundAdminApi.getById(row.refundId)
  } catch {
    refund = undefined
  }

  if (!refund && row.rut) {
    try {
      const res = await refundAdminApi.search({ q: normalizeRut(row.rut), limit: 50 })
      refund = res.items.find(r => matchesId(r, row.refundId))
        ?? res.items.find(r => normalizeRut(r.rut) === normalizeRut(row.rut) && r.status === 'payment_scheduled')
    } catch {
      /* ignore */
    }
  }

  if (!refund) {
    return { ...row, rowStatus: 'not_found', reason: 'No se encontró la solicitud en el sistema.' }
  }

  const currentStatus = refund.status
  if (currentStatus === 'paid') {
    return { ...row, refund, currentStatus, rowStatus: 'wrong_status', reason: 'La solicitud ya está en estado Pagada.' }
  }
  if (currentStatus !== 'payment_scheduled') {
    return {
      ...row, refund, currentStatus,
      rowStatus: 'wrong_status',
      reason: 'Solo se pueden pagar solicitudes en estado Pago programado.',
    }
  }

  return {
    ...row,
    refund,
    currentStatus,
    realAmount: lastRealAmount(refund),
    rowStatus: 'ready',
    reason: 'Lista para marcar como Pagada.',
  }
}

export async function markRowAsPaid(row: ResolvedRow): Promise<PaidResult> {
  const base = {
    lineNumber: row.lineNumber,
    refundId: row.refundId,
    publicId: row.refund?.publicId,
    fullName: row.fullName || row.refund?.fullName || '',
    rut: row.rut || row.refund?.rut || '',
    monto: row.monto,
  }
  try {
    const target = row.refund?.publicId || row.refundId
    await refundAdminApi.updateStatus(target, {
      status: 'paid' as any,
      force: true,
      note: MASSIVE_PAID_NOTE,
      ...(row.monto > 0 ? { realAmount: Math.round(row.monto) } : {}),
    })
    return { ...base, status: 'success', reason: 'Estado actualizado a Pagada.' }
  } catch (err: any) {
    return { ...base, status: 'error', reason: err?.message || 'No se pudo actualizar el estado.' }
  }
}

export function buildPagosSummaryCsv(results: PaidResult[]): string {
  const headers = ['Linea', 'ID Solicitud', 'publicId', 'Nombre Cliente', 'RUT', 'Monto Devolucion', 'Resultado', 'Detalle']
  const lines = [headers.join(';')]
  results.forEach(r => {
    lines.push([
      r.lineNumber, r.refundId, r.publicId || '', r.fullName, r.rut, r.monto,
      r.status === 'success' ? 'Pagada' : r.status === 'skipped' ? 'Omitida' : 'Error',
      r.reason,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
  })
  return '\uFEFF' + lines.join('\r\n')
}
