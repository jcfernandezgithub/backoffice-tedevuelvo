import jsPDF from 'jspdf'
import firmaImg from '@/assets/firma-cng.jpeg'
import corteCedulaImg from '@/assets/corte-cedula-legalizada.jpg'
import corteNotarialImg from '@/assets/corte-certificado-notarial.jpg'
import corteConservadorImg from '@/assets/corte-certificado-conservador.jpg'
import { refundAdminApi } from '@/services/refundAdminApi'
import { getInstitutionDisplayName } from '@/lib/institutionHomologation'
import type { RefundRequest, RefundDocument } from '@/types/refund'

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'

const FIXED_ACCOUNT_DATA = {
  accountNumber: '992866721',
  accountBank: 'Banco Scotiabank',
  accountHolder: 'TDV SERVICIOS SPA',
  accountHolderRut: '78.168.126-1',
  contactEmail: 'contacto@tedevuelvo.cl',
  contactPhone: '+569 84295935',
}

export interface CsvRow {
  lineNumber: number
  publicId: string
  nroCredito: string
  nroPoliza: string
  companyName: string
}

export type ResultStatus = 'success' | 'skipped' | 'error'

export interface ProcessResult {
  lineNumber: number
  publicId: string
  fullName?: string
  institutionId?: string
  insuranceType?: string | null
  kind?: string
  nroCredito: string
  nroPoliza: string
  companyName: string
  status: ResultStatus
  reason: string
  pdfBlob?: Blob
}

// ──────────────────────────────────────────────────────
// CSV parsing
// ──────────────────────────────────────────────────────
const REQUIRED_HEADERS = ['publicId', 'nroCredito', 'nroPoliza', 'companyName'] as const

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

export function parseCsv(text: string): { rows: CsvRow[]; error?: string } {
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

  const idx = {
    publicId: headers.indexOf('publicId'),
    nroCredito: headers.indexOf('nroCredito'),
    nroPoliza: headers.indexOf('nroPoliza'),
    companyName: headers.indexOf('companyName'),
  }

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delim)
    rows.push({
      lineNumber: i + 1,
      publicId: (cols[idx.publicId] || '').trim(),
      nroCredito: (cols[idx.nroCredito] || '').trim(),
      nroPoliza: (cols[idx.nroPoliza] || '').trim(),
      companyName: (cols[idx.companyName] || '').trim(),
    })
  }
  return { rows }
}

export function buildExampleCsv(): string {
  const header = REQUIRED_HEADERS.join(',')
  const examples = [
    '"abc-1234-5678","CRD-998877","POL-112233","COMPAÑIA DE SEGUROS GENERALES CONSORCIO NACIONAL S.A."',
    '"def-2345-6789","CRD-554433","POL-998877","BICE VIDA COMPAÑIA DE SEGUROS S.A."',
    '"ghi-3456-7890","CRD-112233","POL-445566","HDI SEGUROS S.A."',
  ]
  return [header, ...examples].join('\n') + '\n'
}

// ──────────────────────────────────────────────────────
// Insurance / kind helpers (mirror GenerateCorteDialog)
// ──────────────────────────────────────────────────────
export function getInsuranceTypeFromSnapshot(snapshot: any): string | null {
  if (!snapshot) return null
  if (snapshot.tipoSeguro) return snapshot.tipoSeguro
  if (snapshot.insuranceToEvaluate) return snapshot.insuranceToEvaluate
  return null
}

export function getInsuranceDisplayName(insuranceType: string | null): string {
  if (!insuranceType) return ''
  const t = insuranceType.toLowerCase()
  if (t === 'desgravamen') return 'Seguro de Desgravamen'
  if (t === 'cesantia') return 'Seguro de Cesantía'
  if (t === 'ambos') return 'Seguro de Desgravamen y Cesantía'
  return insuranceType
}

export function getCorteKind(insuranceType: string | null): string {
  const t = (insuranceType || '').toLowerCase()
  if (t === 'cesantia') return 'carta-de-corte-cesantia'
  if (t === 'desgravamen') return 'carta-de-corte-desgravamen'
  return 'carta-de-corte'
}

export function isExtendedFormatInstitution(institutionId: string | undefined | null): boolean {
  const i = (institutionId || '').toLowerCase()
  return (
    i === 'santander' || i === 'santander-consumer' || i === 'santander consumer' ||
    i === 'tanner' ||
    i === 'financorp' || i === 'finacorp' || i === 'financoop'
  )
}

// ──────────────────────────────────────────────────────
// PDF blob generators (same templates as GenerateCorteDialog)
// ──────────────────────────────────────────────────────
export function generateGenericCorteBlob(
  refund: RefundRequest,
  formData: { creditNumber: string; policyNumber: string; bankName: string; companyName: string },
): Blob {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = 20

  const today = new Date()
  const dateStr = `Santiago, ${today.getDate()} de ${today.toLocaleDateString('es-CL', { month: 'long' })} de ${today.getFullYear()}`

  doc.setFontSize(10)
  doc.text(dateStr, margin, y); y += 10
  doc.text(`Sres.: ${formData.companyName}`, margin, y); y += 5
  doc.text('Atención: Servicio al Cliente (Post-Venta)', margin, y); y += 5
  doc.text('Ref: Carta de Renuncia al seguro que indica', margin, y); y += 12

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('INFORMA TÉRMINO ANTICIPADO DE SEGURO', pageWidth / 2, y, { align: 'center' }); y += 5
  doc.text('Y SOLICITA DEVOLUCIÓN DE PRIMA NO DEVENGADA', pageWidth / 2, y, { align: 'center' }); y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const maxWidth = pageWidth - margin * 2

  const p1 = `Por medio de la presente Carta de Renuncia, la sociedad TDV SERVICIOS SPA RUT: ${FIXED_ACCOUNT_DATA.accountHolderRut}, actuando en representación y por cuenta de don (doña) ${refund.fullName}, cédula de identidad ${refund.rut}, comunicamos formalmente a esa Compañía Aseguradora la renuncia al seguro y su cobertura que fuera contratado junto con el crédito de consumo otorgado por el Banco ${formData.bankName}, que corresponde a la operación de crédito N°${formData.creditNumber} asociada a la Póliza N° ${formData.policyNumber}, todo ello conforme a lo dispuesto en el artículo 537 del Código de Comercio.`
  const lines1 = doc.splitTextToSize(p1, maxWidth)
  doc.text(lines1, margin, y); y += lines1.length * 4.5 + 4

  const p2 = `Asimismo, de acuerdo con lo estipulado en la Circular N°2114 de 2013 de la Comisión para el Mercado Financiero (CMF), solicitamos la devolución de la prima pagada y no devengada o consumida, la que deberá ser abonada a la cuenta corriente N° ${FIXED_ACCOUNT_DATA.accountNumber} del Banco ${FIXED_ACCOUNT_DATA.accountBank} cuyo titular es ${FIXED_ACCOUNT_DATA.accountHolder}, RUT: ${FIXED_ACCOUNT_DATA.accountHolderRut}, correo electrónico ${FIXED_ACCOUNT_DATA.contactEmail}.`
  const lines2 = doc.splitTextToSize(p2, maxWidth)
  doc.text(lines2, margin, y); y += lines2.length * 4.5 + 4

  const p3 = `Finalmente, se adjunta a la presente carta una copia del mandato que nos faculta para solicitar y tramitar la renuncia del seguro antes mencionado y recaudar a nombre del asegurado la devolución de las primas pagadas no devengadas, por lo cual solicitamos que se nos informe el resultado de esta gestión al correo electrónico ${FIXED_ACCOUNT_DATA.contactEmail} y al número telefónico ${FIXED_ACCOUNT_DATA.contactPhone}.`
  const lines3 = doc.splitTextToSize(p3, maxWidth)
  doc.text(lines3, margin, y); y += lines3.length * 4.5 + 8

  doc.text('Sin otro particular, se despiden atentamente,', margin, y); y += 20

  doc.setFont('helvetica', 'bold')
  doc.text('Cristian Andrés Nieto Gavilán', pageWidth / 2, y, { align: 'center' }); y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`p.p TDV SERVICIOS SPA RUT: ${FIXED_ACCOUNT_DATA.accountHolderRut}`, pageWidth / 2, y, { align: 'center' })

  return doc.output('blob')
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function generateExtendedCorteBlob(
  refund: RefundRequest,
  formData: { creditNumber: string; policyNumber: string; bankName: string; companyName: string; insuranceName: string },
): Promise<Blob> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let y = 20
  const maxWidth = pageWidth - margin * 2

  const today = new Date()
  const dateStr = `Santiago, ${today.getDate()} de ${today.toLocaleDateString('es-CL', { month: 'long' })} de ${today.getFullYear()}`

  doc.setFontSize(10)
  doc.text(dateStr, margin, y); y += 10
  doc.text(`Sres.: ${formData.companyName}`, margin, y); y += 7
  doc.text('Ref: Carta de Renuncia al seguro que indica', margin, y); y += 12

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('INFORMA TÉRMINO ANTICIPADO DE SEGURO Y SOLICITA', pageWidth / 2, y, { align: 'center' }); y += 5
  doc.text('DEVOLUCIÓN DE PRIMA NO DEVENGADA', pageWidth / 2, y, { align: 'center' }); y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const p1 = `Por medio de la presente, TDV SERVICIOS SPA, RUT N° ${FIXED_ACCOUNT_DATA.accountHolderRut}, debidamente facultada y actuando en representación y por cuenta de don/doña ${refund.fullName}, cédula de identidad N° ${refund.rut}, viene a comunicar formalmente a esa Compañía Aseguradora ${formData.companyName} la renuncia expresa al seguro ${formData.insuranceName}, incluyendo todas sus coberturas asociadas.`
  const lines1 = doc.splitTextToSize(p1, maxWidth)
  doc.text(lines1, margin, y); y += lines1.length * 4.5 + 4

  const p2 = `El referido seguro fue contratado en conjunto con el crédito de consumo otorgado por el Banco ${formData.bankName}, correspondiente a la operación de crédito N° ${formData.creditNumber}, asociado a la Póliza N° ${formData.policyNumber}.`
  const lines2 = doc.splitTextToSize(p2, maxWidth)
  doc.text(lines2, margin, y); y += lines2.length * 4.5 + 4

  const p3 = `La presente renuncia se formula conforme a lo dispuesto en el artículo 537 del Código de Comercio y demás normativa aplicable, solicitando se sirva proceder a la cancelación del seguro indicado y a la determinación y devolución de las primas no devengadas que correspondan.`
  const lines3 = doc.splitTextToSize(p3, maxWidth)
  doc.text(lines3, margin, y); y += lines3.length * 4.5 + 4

  const p4 = `Asimismo, de acuerdo con lo estipulado en la Circular N°2114 de fecha año 2013 de la Comisión para el Mercado Financiero (CMF), solicitamos la devolución de la prima pagada y no devengada o consumida, la que deberá ser abonada a la cuenta corriente N° ${FIXED_ACCOUNT_DATA.accountNumber} del Banco ${FIXED_ACCOUNT_DATA.accountBank} cuyo titular es ${FIXED_ACCOUNT_DATA.accountHolder}, RUT: ${FIXED_ACCOUNT_DATA.accountHolderRut}, correo electrónico ${FIXED_ACCOUNT_DATA.contactEmail}. Se hace presente que el monto a restituir deberá abonarse en la cuenta bancaria señalada dentro de los próximos 10 días hábiles, conforme a la normativa vigente.`
  const lines4 = doc.splitTextToSize(p4, maxWidth)
  doc.text(lines4, margin, y); y += lines4.length * 4.5 + 4

  const p5 = `Finalmente, se adjunta a la presente carta una copia del mandato que nos faculta para solicitar y tramitar la renuncia del seguro antes mencionado y recaudar a nombre del asegurado la devolución de las primas pagadas no devengadas, por lo cual solicitamos que se nos informe el resultado de esta gestión al correo electrónico ${FIXED_ACCOUNT_DATA.contactEmail} y al número telefónico ${FIXED_ACCOUNT_DATA.contactPhone}.`
  const lines5 = doc.splitTextToSize(p5, maxWidth)
  doc.text(lines5, margin, y); y += lines5.length * 4.5 + 4

  doc.text('Sin otro particular, se despiden atentamente,', margin, y); y += 20

  doc.setFont('helvetica', 'bold')
  doc.text('Cristian Andrés Nieto Gavilán / Rut: 13040385-9', pageWidth / 2, y, { align: 'center' }); y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`p.p TDV SERVICIOS SPA RUT: ${FIXED_ACCOUNT_DATA.accountHolderRut}`, pageWidth / 2, y, { align: 'center' })

  const addImagePage = async (imgSrc: string, altText: string) => {
    const img = await loadImageElement(imgSrc)
    doc.addPage()
    if (!img) {
      doc.setFontSize(12)
      doc.text(altText, pageWidth / 2, pageHeight / 2, { align: 'center' })
      return
    }
    const imgRatio = img.width / img.height
    const pageRatio = (pageWidth - 20) / (pageHeight - 20)
    let imgW: number, imgH: number
    if (imgRatio > pageRatio) {
      imgW = pageWidth - 20
      imgH = imgW / imgRatio
    } else {
      imgH = pageHeight - 20
      imgW = imgH * imgRatio
    }
    const x = (pageWidth - imgW) / 2
    const yPos = (pageHeight - imgH) / 2
    doc.addImage(img, 'JPEG', x, yPos, imgW, imgH)
  }

  await addImagePage(corteCedulaImg, 'Cédula de Identidad Legalizada')
  await addImagePage(corteNotarialImg, 'Certificado Notarial')
  await addImagePage(corteConservadorImg, 'Certificado Conservador de Bienes Raíces')

  return doc.output('blob')
}

// ──────────────────────────────────────────────────────
// API helpers
// ──────────────────────────────────────────────────────
export async function uploadCorteToFolder(publicId: string, pdfBlob: Blob, kind: string): Promise<void> {
  const { authService } = await import('@/services/authService')
  const token = authService.getAccessToken()
  const formData = new FormData()
  formData.append('file', pdfBlob, `${kind}-${publicId}.pdf`)
  formData.append('kind', kind)

  const response = await fetch(`${API_BASE_URL}/refund-requests/${publicId}/upload-file`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Error al subir carta de corte')
  }
}

export async function persistSnapshotCreditData(
  refund: RefundRequest,
  nroCredito: string,
  nroPoliza: string,
  companyName: string,
): Promise<void> {
  const id = refund.publicId || (refund as any)._id || (refund as any).id
  await refundAdminApi.updateData(id, {
    calculationSnapshot: {
      ...(refund.calculationSnapshot || {}),
      nroPoliza,
      nroCredito,
      companyName,
    },
  })
}

// ──────────────────────────────────────────────────────
// Main pipeline: process a single row
// ──────────────────────────────────────────────────────
export interface ProcessOptions {
  signal?: AbortSignal
}

export async function processSingleRow(row: CsvRow, _opts: ProcessOptions = {}): Promise<ProcessResult> {
  const baseResult = {
    lineNumber: row.lineNumber,
    publicId: row.publicId,
    nroCredito: row.nroCredito,
    nroPoliza: row.nroPoliza,
    companyName: row.companyName,
  }

  // 1. CSV-level required fields
  if (!row.publicId) {
    return { ...baseResult, status: 'skipped', reason: 'Falta publicId' }
  }
  if (!row.nroCredito) {
    return { ...baseResult, status: 'skipped', reason: 'Falta nroCredito en el CSV' }
  }
  if (!row.nroPoliza) {
    return { ...baseResult, status: 'skipped', reason: 'Falta nroPoliza en el CSV' }
  }
  if (!row.companyName) {
    return { ...baseResult, status: 'skipped', reason: 'Falta companyName en el CSV' }
  }

  // 2. Fetch refund
  let refund: RefundRequest
  try {
    refund = await refundAdminApi.getById(row.publicId)
  } catch (err: any) {
    return { ...baseResult, status: 'skipped', reason: 'Solicitud no encontrada' }
  }

  const insuranceType = getInsuranceTypeFromSnapshot(refund.calculationSnapshot)
  const kind = getCorteKind(insuranceType)

  const enrichedBase = {
    ...baseResult,
    fullName: refund.fullName,
    institutionId: refund.institutionId,
    insuranceType,
    kind,
  }

  // 3. Signed mandate check: derivado de los campos de firma de listV2/search.
  const r3: any = refund
  const isSigned3 =
    r3.signatureStatus === 'signed' ||
    !!r3.signedPdfUrl ||
    !!r3.signaturePdfKey ||
    !!r3.signedPdfS3Key ||
    !!r3.hasSignedPdf
  if (!isSigned3) {
    return { ...enrichedBase, status: 'skipped', reason: 'Mandato no firmado' }
  }

  // 4. Existing corte document check (respect current kind)
  let docs: RefundDocument[] = []
  try {
    docs = await refundAdminApi.listDocs(row.publicId)
  } catch {
    docs = []
  }
  const existing = docs.find((d: any) => d.kind === kind)
  if (existing) {
    return {
      ...enrichedBase,
      status: 'skipped',
      reason: `Ya existe una "${kind}" cargada. Elimínala antes de reprocesar.`,
    }
  }

  // 5. Persist snapshot updates (credit, policy, company)
  try {
    await persistSnapshotCreditData(refund, row.nroCredito, row.nroPoliza, row.companyName)
  } catch (err: any) {
    return {
      ...enrichedBase,
      status: 'error',
      reason: `No se pudo actualizar el snapshot: ${err?.message || 'error desconocido'}`,
    }
  }

  // 6. Build PDF (per institution format)
  const bankName = getInstitutionDisplayName(refund.institutionId)
  let pdfBlob: Blob
  try {
    if (isExtendedFormatInstitution(refund.institutionId)) {
      pdfBlob = await generateExtendedCorteBlob(refund, {
        creditNumber: row.nroCredito,
        policyNumber: row.nroPoliza,
        bankName,
        companyName: row.companyName,
        insuranceName: getInsuranceDisplayName(insuranceType),
      })
    } else {
      pdfBlob = generateGenericCorteBlob(refund, {
        creditNumber: row.nroCredito,
        policyNumber: row.nroPoliza,
        bankName,
        companyName: row.companyName,
      })
    }
  } catch (err: any) {
    return {
      ...enrichedBase,
      status: 'error',
      reason: `Error generando el PDF: ${err?.message || 'error desconocido'}`,
    }
  }

  // 7. Upload to client folder
  try {
    await uploadCorteToFolder(row.publicId, pdfBlob, kind)
  } catch (err: any) {
    return {
      ...enrichedBase,
      status: 'error',
      reason: `Error subiendo el PDF: ${err?.message || 'error desconocido'}`,
      pdfBlob,
    }
  }

  return {
    ...enrichedBase,
    status: 'success',
    reason: 'Generada y subida a la carpeta del cliente',
    pdfBlob,
  }
}

// ──────────────────────────────────────────────────────
// Summary CSV
// ──────────────────────────────────────────────────────
export function buildSummaryCsv(results: ProcessResult[]): string {
  const header = [
    'linea', 'publicId', 'cliente', 'institucion', 'tipoSeguro', 'kind',
    'nroCredito', 'nroPoliza', 'companyName', 'estado', 'motivo',
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
    r.insuranceType || '',
    r.kind || '',
    r.nroCredito,
    r.nroPoliza,
    r.companyName,
    statusLabel(r.status),
    r.reason,
  ].map(esc).join(','))
  return [header, ...lines].join('\n') + '\n'
}
