import Papa from 'papaparse'
import type { PendingRefund } from '../types'
import type { ReconciliationSummary } from './cartolaLinksService'

export type CsvRowStatus =
  | 'valid'
  | 'not_found'
  | 'duplicated_in_csv'
  | 'duplicated_in_system'
  | 'already_reconciled_here'
  | 'linked_to_other_movement'
  | 'format_error'
  | 'reconciled'
  | 'apply_error'
  | 'status_updated_no_link'

export interface CsvRowRaw {
  nombre_cliente: string
  rut: string
  numero_operacion: string
  poliza: string
  monto: string
}

export interface ProcessedRow {
  rowNumber: number
  nombre_cliente: string
  rut: string
  numero_operacion: string
  poliza: string
  monto: number
  montoRaw: string
  status: CsvRowStatus
  detail: string
  matchedPublicId?: string
  /** id interno de la solicitud (Mongo _id) — necesario para PATCH de status. */
  matchedRefundId?: string
  /** Monto estimado de la solicitud, para comparar con el `monto` del CSV. */
  matchedEstimated?: number
  /** Nombre completo del cliente asociado (para mostrar en la tabla). */
  matchedFullName?: string
  /** Aprobado explícitamente por el usuario para conciliar. */
  approved?: boolean
  matchedLinkedMovement?: string
}

export const REQUIRED_COLUMNS = [
  'nombre_cliente',
  'rut',
  'numero_operacion',
  'poliza',
  'monto',
] as const

export const MAX_ROWS = 5000
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

export interface ParseResult {
  rows: ProcessedRow[]
  headerError?: string
  fatalError?: string
}

function parseAmount(raw: string): number {
  if (!raw) return NaN
  const cleaned = String(raw)
    .trim()
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

function normalizeOp(v: string): string {
  return String(v ?? '').trim().toUpperCase()
}

/**
 * Parsea el CSV y aplica las validaciones estructurales de fila.
 * NO ejecuta el matching contra el sistema (eso lo hace `matchAgainstSystem`).
 */
export async function parseCsv(file: File): Promise<ParseResult> {
  if (!/\.csv$/i.test(file.name)) {
    return { rows: [], fatalError: 'El archivo debe tener extensión .csv.' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      rows: [],
      fatalError: `El archivo supera el tamaño máximo permitido (5 MB).`,
    }
  }

  const text = await file.text()
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
    dynamicTyping: false,
  })

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0]
    if (first.code === 'UndetectableDelimiter' || first.type === 'Delimiter') {
      return { rows: [], fatalError: 'No se pudo detectar el separador del CSV. Usa coma (,).' }
    }
  }

  const fields = (parsed.meta.fields ?? []).map((f) => f.toLowerCase())
  const missing = REQUIRED_COLUMNS.filter((c) => !fields.includes(c))
  if (missing.length > 0) {
    return {
      rows: [],
      headerError: `Faltan columnas obligatorias: ${missing.join(', ')}. Descarga la plantilla para ver el formato esperado.`,
    }
  }

  const raw = parsed.data
  if (raw.length === 0) {
    return { rows: [], fatalError: 'El archivo no contiene filas de datos.' }
  }
  if (raw.length > MAX_ROWS) {
    return {
      rows: [],
      fatalError: `El archivo tiene ${raw.length} filas. Máximo permitido: ${MAX_ROWS}.`,
    }
  }

  const rows: ProcessedRow[] = []
  const seenOps = new Map<string, number>() // normalized op -> first rowNumber

  raw.forEach((r, idx) => {
    const rowNumber = idx + 2 // +1 header, +1 base 1
    const nombre_cliente = String(r.nombre_cliente ?? '').trim()
    const rut = String(r.rut ?? '').trim()
    const numero_operacion = String(r.numero_operacion ?? '').trim()
    const poliza = String(r.poliza ?? '').trim()
    const montoRaw = String(r.monto ?? '').trim()

    // Fila totalmente vacía → se ignora (ya la debería filtrar skipEmptyLines,
    // pero por si vienen sólo separadores).
    if (!nombre_cliente && !rut && !numero_operacion && !poliza && !montoRaw) return

    const errors: string[] = []
    if (!numero_operacion) errors.push('numero_operacion vacío')
    const monto = parseAmount(montoRaw)
    if (!Number.isFinite(monto) || monto <= 0)
      errors.push('monto debe ser numérico y mayor que 0')

    let status: CsvRowStatus = 'valid'
    let detail = 'Fila válida, lista para conciliar.'

    if (errors.length > 0) {
      status = 'format_error'
      detail = errors.join(' · ')
    } else {
      const key = normalizeOp(numero_operacion)
      if (seenOps.has(key)) {
        status = 'duplicated_in_csv'
        detail = `Número de operación repetido en la fila ${seenOps.get(key)}.`
      } else {
        seenOps.set(key, rowNumber)
      }
    }

    rows.push({
      rowNumber,
      nombre_cliente,
      rut,
      numero_operacion,
      poliza,
      monto: Number.isFinite(monto) ? monto : 0,
      montoRaw,
      status,
      detail,
    })
  })

  return { rows }
}

export interface MatchContext {
  documentoNumero: string
  refunds: PendingRefund[]
  linksByDoc: Record<string, ReconciliationSummary>
  /** publicId -> documentoNumero donde ya está asociada (si aplica). */
  publicIdToDoc: Record<string, string>
}

/**
 * Cruza cada fila contra el universo de solicitudes y los links existentes.
 * Devuelve una copia de las filas con `status` y `detail` actualizados.
 */
export function matchAgainstSystem(
  rows: ProcessedRow[],
  ctx: MatchContext,
): ProcessedRow[] {
  // Index refunds by nroCredito (puede haber múltiples).
  const byOp = new Map<string, PendingRefund[]>()
  for (const r of ctx.refunds) {
    const key = normalizeOp(r.nroCredito ?? '')
    if (!key) continue
    const list = byOp.get(key) ?? []
    list.push(r)
    byOp.set(key, list)
  }

  return rows.map((row) => {
    if (row.status === 'format_error' || row.status === 'duplicated_in_csv') return row

    const key = normalizeOp(row.numero_operacion)
    let matches = byOp.get(key) ?? []

    // Cuando varias solicitudes comparten nroCredito (típicamente desgravamen +
    // cesantía sobre el mismo crédito) desambiguar por número de póliza si el
    // CSV lo trae.
    if (matches.length > 1) {
      const polizaKey = normalizeOp(row.poliza)
      if (polizaKey) {
        const byPoliza = matches.filter(
          (m) => normalizeOp((m as any).nroPoliza ?? '') === polizaKey,
        )
        if (byPoliza.length >= 1) matches = byPoliza
      }
    }

    if (matches.length === 0) {
      return {
        ...row,
        status: 'not_found',
        detail: 'No se encontró una solicitud en estado Ingresada con ese número de operación.',
      }
    }
    if (matches.length > 1) {
      return {
        ...row,
        status: 'duplicated_in_system',
        detail: `Hay ${matches.length} solicitudes con el mismo número de operación y no fue posible desambiguar por póliza. Agrega la columna "poliza" al CSV o concilia manualmente.`,
      }
    }
    const refund = matches[0]
    const linkedDoc = ctx.publicIdToDoc[refund.publicId]
    if (linkedDoc && linkedDoc === ctx.documentoNumero) {
      return {
        ...row,
        status: 'already_reconciled_here',
        matchedPublicId: refund.publicId,
        matchedRefundId: refund.id,
        matchedEstimated: refund.estimatedAmount,
        matchedFullName: refund.fullName,
        detail: `La solicitud ${refund.publicId} ya está asociada a este movimiento.`,
      }
    }
    if (linkedDoc && linkedDoc !== ctx.documentoNumero) {
      return {
        ...row,
        status: 'linked_to_other_movement',
        matchedPublicId: refund.publicId,
        matchedRefundId: refund.id,
        matchedEstimated: refund.estimatedAmount,
        matchedFullName: refund.fullName,
        matchedLinkedMovement: linkedDoc,
        detail: `La solicitud ${refund.publicId} ya está asociada al movimiento ${linkedDoc}.`,
      }
    }
    return {
      ...row,
      status: 'valid',
      matchedPublicId: refund.publicId,
      matchedRefundId: refund.id,
      matchedEstimated: refund.estimatedAmount,
      matchedFullName: refund.fullName,
      approved: true,
      detail: 'Coincide con una solicitud Ingresada. Lista para conciliar.',
    }
  })
}

/** Genera CSV a partir de filas + headers. */
export function rowsToCsv(rows: ProcessedRow[], statusLabel: (s: CsvRowStatus) => string): string {
  return Papa.unparse({
    fields: [
      'fila',
      'nombre_cliente',
      'rut',
      'numero_operacion',
      'poliza',
      'monto',
      'estado',
      'detalle',
    ],
    data: rows.map((r) => [
      r.rowNumber,
      r.nombre_cliente,
      r.rut,
      r.numero_operacion,
      r.poliza,
      r.monto,
      statusLabel(r.status),
      r.detail,
    ]),
  })
}

/** CSV plantilla descargable. */
export function templateCsv(): string {
  return (
    'nombre_cliente,rut,numero_operacion,poliza,monto\n' +
    'Juan Pérez,12345678-9,OP-000123,POL-456789,150000\n'
  )
}

export function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob(['\uFEFF' + contents], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 500)
}

// -----------------------------------------------------------------------------
// Historial local (TODO: migrar a endpoint cuando exista)
// -----------------------------------------------------------------------------

export interface CsvHistoryEntry {
  id: string
  documentoNumero: string
  fileName: string
  at: string
  user?: string
  totals: Record<CsvRowStatus, number> & { total: number }
  overallStatus: 'success' | 'partial' | 'error'
  rows: ProcessedRow[]
}

const HISTORY_PREFIX = 'cartola-csv-history:'
const HISTORY_MAX_ENTRIES = 20

export function loadHistory(documentoNumero: string): CsvHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_PREFIX + documentoNumero)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveHistory(entry: CsvHistoryEntry): void {
  try {
    const current = loadHistory(entry.documentoNumero)
    const next = [entry, ...current].slice(0, HISTORY_MAX_ENTRIES)
    localStorage.setItem(HISTORY_PREFIX + entry.documentoNumero, JSON.stringify(next))
  } catch {
    /* noop */
  }
}

export function computeTotals(rows: ProcessedRow[]) {
  const totals = {
    total: rows.length,
    valid: 0,
    reconciled: 0,
    not_found: 0,
    duplicated_in_csv: 0,
    duplicated_in_system: 0,
    already_reconciled_here: 0,
    linked_to_other_movement: 0,
    format_error: 0,
    apply_error: 0,
    status_updated_no_link: 0,
  } as Record<CsvRowStatus, number> & { total: number }
  for (const r of rows) totals[r.status] = (totals[r.status] ?? 0) + 1
  return totals
}

export const STATUS_LABELS: Record<CsvRowStatus, string> = {
  valid: 'Lista para conciliar',
  reconciled: 'Conciliada',
  not_found: 'Solicitud no encontrada',
  duplicated_in_csv: 'Duplicada en CSV',
  duplicated_in_system: 'Coincidencia duplicada en sistema',
  already_reconciled_here: 'Ya conciliada',
  linked_to_other_movement: 'Asociada a otro movimiento',
  format_error: 'Error de formato',
  apply_error: 'Error al aplicar',
  status_updated_no_link: 'Estado actualizado sin asociar',
}