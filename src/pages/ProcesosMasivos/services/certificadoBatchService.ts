import firmaAugustarImg from '@/assets/firma-augustar.jpeg'
import firmaTdvImg from '@/assets/firma-tdv.png'
import firmaCngImg from '@/assets/firma-cng.jpeg'
import { authService } from '@/services/authService'
import { refundAdminApi } from '@/services/refundAdminApi'
import {
  isBancoChile,
  usesBancoChileTemplate,
  generateBancoChilePol347PDF,
  generateGenericPol347PDF,
  generateChevroletSfPol347PDF,
  type BancoChileCertificateData,
} from '@/pages/Refunds/components/pdfGenerators/bancoChilePdfGenerator'
import type { RefundRequest, RefundDocument, RefundStatus } from '@/types/refund'

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'

// Minimum allowed refund status (inclusive). Anything earlier is skipped.
const ALLOWED_STATUSES: RefundStatus[] = [
  'docs_received',
  'submitted',
  'approved',
  'payment_scheduled',
  'paid',
]

// Kind used to detect duplicates and uploaded by the dialog today.
export const CERTIFICATE_KIND = 'certificado-de-cobertura-desgravamen'
// Legacy kind kept around in the platform; if present we also treat it as "already exists"
const LEGACY_CERTIFICATE_KIND = 'n-desgravamen'

// ──────────────────────────────────────────────────────
// CSV row + result types
// ──────────────────────────────────────────────────────
export interface CertificadoCsvRow {
  lineNumber: number
  publicId: string
  nroOperacion: string
  saldoInsoluto: string
  fechaInicioCobertura: string
  fechaFinCobertura: string
  direccion: string
  numero: string
  depto: string
  ciudad: string
  comuna: string
  celular: string
  sexo: string
  autorizaEmail: string
  beneficiarioNombre: string
  beneficiarioRut: string
}

export type ResultStatus = 'success' | 'skipped' | 'error'

export interface CertificadoResult {
  lineNumber: number
  publicId: string
  fullName?: string
  institutionId?: string
  folio?: string
  nroOperacion: string
  saldoInsoluto: string
  status: ResultStatus
  reason: string
  pdfBlob?: Blob
  kind?: string
}

// ──────────────────────────────────────────────────────
// CSV parsing (reuses the same RFC4180-lite splitter as cartas-de-corte)
// ──────────────────────────────────────────────────────
const REQUIRED_HEADERS = [
  'publicId',
  'nroOperacion',
  'saldoInsoluto',
  'fechaInicioCobertura',
  'fechaFinCobertura',
  'direccion',
  'numero',
  'depto',
  'ciudad',
  'comuna',
  'celular',
  'sexo',
  'autorizaEmail',
  'beneficiarioNombre',
  'beneficiarioRut',
] as const

function detectDelimiter(line: string): string {
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestCount = -1
  for (const c of candidates) {
    const n = line.split(c).length
    if (n > bestCount) {
      best = c
      bestCount = n
    }
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
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'; i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === delim) { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

export function parseCsv(text: string): { rows: CertificadoCsvRow[]; error?: string } {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = cleaned.split('\n').filter(l => l.trim().length > 0)
  if (lines.length === 0) return { rows: [], error: 'El archivo está vacío.' }

  const delim = detectDelimiter(lines[0])
  const headers = splitCsvLine(lines[0], delim).map(h => h.replace(/^"|"$/g, ''))

  const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
  if (missing.length > 0) {
    return {
      rows: [],
      error: `Faltan columnas obligatorias en el header: ${missing.join(', ')}. Header esperado: ${REQUIRED_HEADERS.join(',')}`,
    }
  }

  const idx: Record<string, number> = {}
  REQUIRED_HEADERS.forEach(h => { idx[h] = headers.indexOf(h) })

  const rows: CertificadoCsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delim)
    const pick = (h: string) => (cols[idx[h]] || '').trim()
    rows.push({
      lineNumber: i + 1,
      publicId: pick('publicId'),
      nroOperacion: pick('nroOperacion'),
      saldoInsoluto: pick('saldoInsoluto'),
      fechaInicioCobertura: pick('fechaInicioCobertura'),
      fechaFinCobertura: pick('fechaFinCobertura'),
      direccion: pick('direccion'),
      numero: pick('numero'),
      depto: pick('depto'),
      ciudad: pick('ciudad'),
      comuna: pick('comuna'),
      celular: pick('celular'),
      sexo: pick('sexo'),
      autorizaEmail: pick('autorizaEmail'),
      beneficiarioNombre: pick('beneficiarioNombre'),
      beneficiarioRut: pick('beneficiarioRut'),
    })
  }
  return { rows }
}

export function buildExampleCsv(): string {
  const header = REQUIRED_HEADERS.join(',')
  const examples = [
    '"abc-1234-5678","CRD-66666","5000000","","","Av. Providencia","1234","301","Santiago","Providencia","+56 9 1234 5678","M","SI","Banco de Chile","97.004.000-5"',
    '"def-2345-6789","CRD-77777","8000000","09/06/2026","09/04/2028","Los Alerces","456","","Concepción","Concepción","+56 9 8765 4321","F","SI","",""',
  ]
  return [header, ...examples].join('\n') + '\n'
}

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────

// Robust dd/mm/yyyy formatter accepting ISO (YYYY-MM-DD) or dd/mm/yyyy input.
function normalizeDate(input: string | undefined): string {
  if (!input) return ''
  const s = input.trim()
  if (!s) return ''
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (dmy) {
    const dd = dmy[1].padStart(2, '0')
    const mm = dmy[2].padStart(2, '0')
    const yy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${dd}/${mm}/${yy}`
  }
  return s
}

// Compute coverage dates from the moment refund transitioned to 'submitted' (Ingresada).
function getCoverageDatesFromSubmitted(refund: RefundRequest): { fechaInicio: string; fechaFin: string } {
  const history = refund.statusHistory || []
  const submittedEntry = [...history].reverse().find((h) => h.to === 'submitted')
  if (!submittedEntry?.at) return { fechaInicio: '', fechaFin: '' }
  const start = new Date(submittedEntry.at)
  if (isNaN(start.getTime())) return { fechaInicio: '', fechaFin: '' }
  const remaining =
    refund.calculationSnapshot?.confirmedRemainingInstallments ||
    refund.calculationSnapshot?.remainingInstallments ||
    0
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}/${d.getFullYear()}`
  }
  const fechaInicio = fmt(start)
  let fechaFin = ''
  if (typeof remaining === 'number' && remaining > 0) {
    const end = new Date(start)
    end.setMonth(end.getMonth() + remaining)
    fechaFin = fmt(end)
  }
  return { fechaInicio, fechaFin }
}

function resolveSaldoInsoluto(refund: RefundRequest, fromCsv: string): number {
  if (fromCsv) {
    const n = parseFloat(fromCsv.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(n) && n > 0) return n
  }
  const snap = refund.calculationSnapshot || {}
  return (
    snap.confirmedAverageInsuredBalance ||
    snap.averageInsuredBalance ||
    snap.remainingBalance ||
    refund.estimatedAmountCLP ||
    0
  )
}

// Chilean RUT validation (mirrors the dialog).
const rutRegex = /^(\d{7,8}-[\dkK]|\d{1,2}\.\d{3}\.\d{3}-[\dkK])$/i
function validateRutDigit(rut: string): boolean {
  const clean = rut.replace(/\./g, '').replace(/-/g, '')
  if (clean.length < 2) return false
  const num = clean.slice(0, -1)
  const dv = clean.slice(-1).toUpperCase()
  if (!/^\d+$/.test(num)) return false
  let sum = 0, mult = 2
  for (let i = num.length - 1; i >= 0; i--) {
    sum += parseInt(num[i]) * mult
    mult = mult === 7 ? 2 : mult + 1
  }
  const rem = sum % 11
  const calc = rem === 0 ? '0' : rem === 1 ? 'K' : String(11 - rem)
  return dv === calc
}
function validateRut(rut: string): boolean {
  if (!rut) return false
  if (!rutRegex.test(rut)) return false
  return validateRutDigit(rut)
}

// ──────────────────────────────────────────────────────
// API helpers
// ──────────────────────────────────────────────────────
export async function fetchExperianStatus(publicId: string): Promise<{ hasSignedPdf?: boolean } | null> {
  const token = authService.getAccessToken()
  try {
    const response = await fetch(
      `${API_BASE_URL}/refund-requests/${publicId}/experian/status`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    )
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function uploadCertificateToFolder(
  docsPublicId: string,
  filePublicId: string,
  pdfBlob: Blob,
  folio: string,
): Promise<void> {
  const token = authService.getAccessToken()
  const formData = new FormData()
  const folioSuffix = folio ? `-folio-${folio}` : ''
  const timestamp = Date.now()
  formData.append('file', pdfBlob, `certificado-cobertura-${filePublicId}${folioSuffix}-${timestamp}.pdf`)
  formData.append('kind', CERTIFICATE_KIND)

  const response = await fetch(`${API_BASE_URL}/refund-requests/${docsPublicId}/upload-file`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Error al subir certificado')
  }
}

async function persistSnapshotData(
  publicId: string,
  refund: RefundRequest,
  patch: Record<string, any>,
): Promise<void> {
  // El endpoint PATCH /admin/:publicId/update busca por publicId, NO por _id de Mongo
  await refundAdminApi.updateData(publicId, {
    calculationSnapshot: {
      ...(refund.calculationSnapshot || {}),
      ...patch,
    },
  })
}

// ──────────────────────────────────────────────────────
// Firma loading (singletons cached per session)
// ──────────────────────────────────────────────────────
let firmasPromise: Promise<{ augustar: string; tdv: string; cng: string }> | null = null

function loadImageAsBase64(src: string, mime: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0)
      resolve(canvas.toDataURL(mime))
    }
    img.onerror = reject
    img.src = src
  })
}

export function preloadFirmas(): Promise<{ augustar: string; tdv: string; cng: string }> {
  if (!firmasPromise) {
    firmasPromise = Promise.all([
      loadImageAsBase64(firmaAugustarImg, 'image/jpeg').catch(() => ''),
      loadImageAsBase64(firmaTdvImg, 'image/png').catch(() => ''),
      loadImageAsBase64(firmaCngImg, 'image/jpeg').catch(() => ''),
    ]).then(([augustar, tdv, cng]) => ({ augustar, tdv, cng }))
  }
  return firmasPromise
}

// ──────────────────────────────────────────────────────
// Main pipeline
// ──────────────────────────────────────────────────────
export async function processSingleRow(row: CertificadoCsvRow): Promise<CertificadoResult> {
  const base = {
    lineNumber: row.lineNumber,
    publicId: row.publicId,
    nroOperacion: row.nroOperacion,
    saldoInsoluto: row.saldoInsoluto,
    kind: CERTIFICATE_KIND,
  }

  // 1. CSV-level required fields
  if (!row.publicId) {
    return { ...base, status: 'skipped', reason: 'Falta publicId' }
  }
  if (!row.nroOperacion) {
    return { ...base, status: 'skipped', reason: 'Falta nroOperacion (Nº de crédito) en el CSV' }
  }

  // 2. Fetch refund
  let refund: RefundRequest
  try {
    refund = await refundAdminApi.getById(row.publicId)
  } catch {
    return { ...base, status: 'skipped', reason: 'Solicitud no encontrada' }
  }

  const enriched = {
    ...base,
    fullName: refund.fullName,
    institutionId: refund.institutionId,
  }

  // 3. Minimum status check
  if (!ALLOWED_STATUSES.includes(refund.status)) {
    return {
      ...enriched,
      status: 'skipped',
      reason: `Estado de la solicitud (${refund.status}) es anterior a "Ingresada"`,
    }
  }

  // 4. Signed mandate check
  const experian = await fetchExperianStatus(row.publicId)
  if (!experian?.hasSignedPdf) {
    return { ...enriched, status: 'skipped', reason: 'Mandato no firmado' }
  }

  // 5. Existing certificate check (use sibling folder if cloned)
  const docsPublicId =
    (refund as any).cloned && (refund as any).siblingId
      ? (refund as any).siblingId
      : refund.publicId
  let docs: RefundDocument[] = []
  try {
    docs = await refundAdminApi.listDocs(docsPublicId)
  } catch {
    docs = []
  }
  const existing = docs.find(
    (d: any) => d.kind === CERTIFICATE_KIND || d.kind === LEGACY_CERTIFICATE_KIND,
  )
  if (existing) {
    return {
      ...enriched,
      status: 'skipped',
      reason: `Ya existe un certificado de cobertura cargado (kind="${(existing as any).kind}"). Elimínalo antes de reprocesar.`,
    }
  }

  // 6. Snapshot must have remaining installments for prima única
  const snap = refund.calculationSnapshot || {}
  const remaining = snap.confirmedRemainingInstallments || snap.remainingInstallments
  if (!remaining || remaining <= 0) {
    return {
      ...enriched,
      status: 'skipped',
      reason: 'Snapshot sin cuotas pendientes — no se puede calcular la prima única',
    }
  }
  const saldoInsolutoNum = resolveSaldoInsoluto(refund, row.saldoInsoluto)
  if (saldoInsolutoNum <= 0) {
    return {
      ...enriched,
      status: 'skipped',
      reason: 'Saldo insoluto no disponible en el snapshot ni en el CSV',
    }
  }

  // 7. Banco de Chile / Chevrolet SF require beneficiary
  const isBC = isBancoChile(refund.institutionId)
  const usesChileTpl = usesBancoChileTemplate(refund.institutionId)
  // For Banco de Chile the generator forces a fixed beneficiary internally, so the
  // CSV columns are only mandatory for Chevrolet SF. We still validate the RUT when
  // provided.
  if (usesChileTpl && !isBC) {
    if (!row.beneficiarioNombre || !row.beneficiarioRut) {
      return {
        ...enriched,
        status: 'skipped',
        reason: 'Para Chevrolet SF se requieren beneficiarioNombre y beneficiarioRut',
      }
    }
  }
  if (row.beneficiarioRut && !validateRut(row.beneficiarioRut)) {
    return {
      ...enriched,
      status: 'skipped',
      reason: `RUT del beneficiario inválido: ${row.beneficiarioRut}`,
    }
  }

  // 8. Assign folio if missing
  let folio = ''
  try {
    const folioRes = await refundAdminApi.assignFolio(row.publicId, false)
    folio = folioRes?.nroFolio || ''
  } catch (err: any) {
    return {
      ...enriched,
      status: 'error',
      reason: `Error al asignar folio: ${err?.message || 'desconocido'}`,
    }
  }
  if (!folio) {
    return { ...enriched, status: 'error', reason: 'No se obtuvo número de folio' }
  }

  // 9. Persist snapshot updates with the data from the CSV (mirrors what the dialog produces)
  try {
    const snapPatch: Record<string, any> = { nroCredito: row.nroOperacion }
    if (row.saldoInsoluto) snapPatch.csvSaldoInsoluto = saldoInsolutoNum
    await persistSnapshotData(row.publicId, refund, snapPatch)
    // keep our local refund snapshot in sync for the PDF call
    refund.calculationSnapshot = { ...(refund.calculationSnapshot || {}), ...snapPatch }
  } catch (err: any) {
    return {
      ...enriched,
      status: 'error',
      reason: `No se pudo actualizar el snapshot: ${err?.message || 'error desconocido'}`,
    }
  }

  // 10. Build formData for the PDF generator
  const fallbackDates = getCoverageDatesFromSubmitted(refund)
  const sexoNorm =
    row.sexo.toUpperCase() === 'M' || row.sexo.toUpperCase() === 'F'
      ? (row.sexo.toUpperCase() as 'M' | 'F')
      : ''
  const autorizaNorm = row.autorizaEmail.toUpperCase() === 'NO' ? 'NO' : 'SI'

  const formData: BancoChileCertificateData = {
    folio,
    direccion: row.direccion,
    numero: row.numero,
    depto: row.depto,
    ciudad: row.ciudad,
    comuna: row.comuna,
    celular: row.celular || refund.phone || '',
    sexo: sexoNorm,
    autorizaEmail: autorizaNorm,
    nroOperacion: row.nroOperacion,
    fechaInicioCredito: normalizeDate(row.fechaInicioCobertura) || fallbackDates.fechaInicio,
    fechaFinCredito: normalizeDate(row.fechaFinCobertura) || fallbackDates.fechaFin,
    saldoInsoluto: String(saldoInsolutoNum),
    beneficiarioNombre: row.beneficiarioNombre || refund.fullName || '',
    beneficiarioRut: row.beneficiarioRut || refund.rut || '',
  }

  // 11. Generate PDF
  const { augustar, tdv, cng } = await preloadFirmas()
  let pdfBlob: Blob
  try {
    if (isBC) {
      pdfBlob = await generateBancoChilePol347PDF(refund, formData, augustar, tdv, cng)
    } else if (usesChileTpl) {
      pdfBlob = await generateChevroletSfPol347PDF(refund, formData, augustar, tdv, cng)
    } else {
      pdfBlob = await generateGenericPol347PDF(refund, formData, augustar, tdv, cng)
    }
  } catch (err: any) {
    return {
      ...enriched,
      folio,
      status: 'error',
      reason: `Error generando el PDF: ${err?.message || 'error desconocido'}`,
    }
  }

  // 12. Upload to client folder
  try {
    await uploadCertificateToFolder(docsPublicId, refund.publicId, pdfBlob, folio)
  } catch (err: any) {
    return {
      ...enriched,
      folio,
      status: 'error',
      reason: `Error subiendo el PDF: ${err?.message || 'error desconocido'}`,
      pdfBlob,
    }
  }

  return {
    ...enriched,
    folio,
    status: 'success',
    reason: `Certificado generado y subido (folio ${folio})`,
    pdfBlob,
  }
}

// ──────────────────────────────────────────────────────
// Summary CSV
// ──────────────────────────────────────────────────────
export function buildSummaryCsv(results: CertificadoResult[]): string {
  const header = [
    'linea', 'publicId', 'cliente', 'institucion', 'folio',
    'nroOperacion', 'saldoInsoluto', 'kind', 'estado', 'motivo',
  ].join(',')
  const esc = (v: any) => {
    const s = String(v ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }
  const statusLabel = (s: ResultStatus) =>
    s === 'success' ? 'PROCESADO' : s === 'skipped' ? 'OMITIDO' : 'ERROR'
  const lines = results.map(r => [
    r.lineNumber,
    r.publicId,
    r.fullName || '',
    r.institutionId || '',
    r.folio || '',
    r.nroOperacion,
    r.saldoInsoluto,
    r.kind || '',
    statusLabel(r.status),
    r.reason,
  ].map(esc).join(','))
  return [header, ...lines].join('\n') + '\n'
}