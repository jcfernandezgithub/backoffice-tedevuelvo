/**
 * Generador de PDF para Certificado de Cobertura - BANCO DE CHILE
 * Póliza N° 347 (vigente desde mayo 2026). Reemplaza pólizas 342 y 344.
 *
 * Layout copia fiel del PDF Pol347_BCO_CHILE.pdf (10 páginas):
 *   Páginas 1-3: Carátula uniforme (códigos CMF, contratante, asegurado,
 *                tipo de póliza, planes 1/2/3, coberturas, beneficiarios,
 *                condiciones, exclusiones, sistema de notificación,
 *                definiciones).
 *   Página 4:    Solicitud de Incorporación / Certificado de Cobertura
 *                (datos del asegurado, antecedentes, datos del seguro,
 *                fórmula de prima única, tabla de tasas por Plan).
 *   Página 5:    Descripción de coberturas y condiciones de asegurabilidad.
 *   Página 6:    Inalterabilidad, cobertura de desgravamen, exclusiones,
 *                comisiones (CEF).
 *   Página 7:    Comisión de intermediación, denuncia de siniestro, plazo.
 *   Página 8:    Notas importantes (1-6) y disposiciones finales.
 *   Página 9:    Firmas.
 *   Página 10:   Procedimiento de liquidación de siniestros (Circular 2106).
 *
 * Beneficiario irrevocable fijo del template Banco de Chile:
 *   Nombre: Banco de Chile  /  RUT: 97.004.000-5
 *
 * Datos dinámicos provienen de `refund` (snapshot) y `formData` (campos del
 * diálogo). Plan, TBM y Prima Única se calculan con `pol347Config`.
 */

import jsPDF from 'jspdf'
import { RefundRequest } from '@/types/refund'
import {
  POL347_CONFIG,
  calcPrimaUnicaPol347,
  formatCLP,
  formatTasa,
  type Pol347Plan,
} from './pol347Config'

export interface BancoChileCertificateData {
  folio: string
  direccion: string
  numero: string
  depto: string
  ciudad: string
  comuna: string
  celular: string
  sexo: 'M' | 'F' | ''
  autorizaEmail: 'SI' | 'NO'
  nroOperacion: string
  fechaInicioCredito: string
  fechaFinCredito: string
  saldoInsoluto: string
  beneficiarioNombre: string
  beneficiarioRut: string
}

/** Compatibilidad con código que aún importa BANCO_CHILE_CONFIG. */
export const BANCO_CHILE_CONFIG = {
  pol347: {
    numero: POL347_CONFIG.numero,
    codigoCMF: POL347_CONFIG.codigoCMF,
    vigenciaInicio: POL347_CONFIG.vigenciaInicio,
    vigenciaFin: POL347_CONFIG.vigenciaFin,
    capitalMaximo: POL347_CONFIG.capitalMaximo,
    corredor: POL347_CONFIG.corredor,
  },
}

/** Beneficiario irrevocable fijo del template Banco de Chile. */
const BENEFICIARIO_BANCO_CHILE = {
  nombre: 'Banco de Chile',
  rut: '97.004.000-5',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatDate = (dateString?: string): string => {
  if (!dateString) return ''
  try {
    const m = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return dateString
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  } catch {
    return dateString || ''
  }
}

const todayFormatted = (): string => {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const parseSaldo = (s: string): number =>
  parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0

/** Determina si una entidad es estrictamente Banco de Chile (para fallback de beneficiario fijo). */
export const isBancoChile = (institution: string | undefined | null): boolean => {
  if (!institution) return false
  const n = institution.toLowerCase().trim()
  return (
    n === 'chile' ||
    n === 'banco de chile' ||
    n === 'banco chile' ||
    n.includes('banco de chile') ||
    n.includes('banco chile')
  )
}

/** Determina si una entidad utiliza la plantilla Pol347 de Banco de Chile
 *  (mismo layout: bloque "Beneficiario Irrevocable Designado" y label "Tasa Bruta Mensual").
 *  Aplica a Banco de Chile y a Chevrolet SF. */
export const usesBancoChileTemplate = (institution: string | undefined | null): boolean => {
  if (!institution) return false
  const n = institution.toLowerCase().trim()
  if (isBancoChile(n)) return true
  return n === 'chevrolet sf' || n === 'chevrolet-sf' || n.includes('chevrolet')
}

/**
 * Devuelve la TBM (por mil) usada en Banco de Chile (Pol347).
 * Ahora se calcula según Plan y edad — `isPrime` se ignora (legacy).
 */
export const getBancoChileTasaBrutaMensual = (
  _isPrime: boolean,
  age?: number,
  saldoInsoluto: number = 0,
): number => {
  const { tbm } = calcPrimaUnicaPol347(saldoInsoluto, age, 1)
  return tbm
}

// ─────────────────────────────────────────────────────────────────────────────
// Generador principal
// ─────────────────────────────────────────────────────────────────────────────

const generatePol347PDF = async (
  refund: RefundRequest,
  formData: BancoChileCertificateData,
  firmaAugustarBase64: string,
  firmaTdvBase64: string,
  _firmaCngBase64: string,
  options: { useBancoChileTemplate: boolean; useBancoChileBeneficiaryFallback: boolean },
): Promise<Blob> => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = 15

  const drawCheckbox = (x: number, yPos: number, checked = false) => {
    doc.setDrawColor(0)
    doc.setLineWidth(0.3)
    doc.rect(x, yPos - 2.5, 4, 4, 'S')
    if (checked) {
      doc.setFont('helvetica', 'bold')
      doc.text('X', x + 0.8, yPos)
      doc.setFont('helvetica', 'normal')
    }
  }

  const sectionHeader = (title: string, fill = 240) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(fill, fill, fill)
    doc.rect(margin, y - 4, contentWidth, 6, 'F')
    doc.text(title, margin + 2, y)
    y += 7
  }

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage()
      y = 15
    }
  }

  // ── Datos calculados ──
  const saldoInsoluto = parseSaldo(formData.saldoInsoluto)
  const nper =
    refund.calculationSnapshot?.confirmedRemainingInstallments ||
    refund.calculationSnapshot?.remainingInstallments ||
    0
  const age = refund.calculationSnapshot?.age
  const { plan, tbm, primaUnica } = calcPrimaUnicaPol347(saldoInsoluto, age, nper)
  const saldoFmt = formatCLP(saldoInsoluto)
  const primaFmt = formatCLP(primaUnica)

  const beneficiario = {
    nombre: formData.beneficiarioNombre || (options.useBancoChileBeneficiaryFallback ? BENEFICIARIO_BANCO_CHILE.nombre : ''),
    rut: formData.beneficiarioRut || (options.useBancoChileBeneficiaryFallback ? BENEFICIARIO_BANCO_CHILE.rut : ''),
  }

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — Carátula (códigos, contratante, asegurado, tipo, vigencia, plan)
  // ════════════════════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('CARÁTULA UNIFORME PARA PÓLIZA DE DESGRAVAMEN', pageWidth / 2, y, { align: 'center' })
  y += 5
  doc.setFontSize(10)
  doc.text('CERTIFICADO DE COBERTURA', pageWidth / 2, y, { align: 'center' })
  y += 8

  // Códigos CMF / Póliza N°
  doc.setFontSize(9)
  doc.text('CÓDIGOS CMF DE LA PÓLIZA', margin, y)
  doc.text('PÓLIZA N°', pageWidth - margin - 40, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 80, 6, 'S')
  doc.text(POL347_CONFIG.codigoCMF, margin + 2, y + 1)
  doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
  doc.text(POL347_CONFIG.numero, pageWidth - margin - 38, y + 1)
  y += 10

  // Contratante
  doc.setFont('helvetica', 'bold')
  doc.text('CONTRATANTE (SI ES DISTINTO DEL ASEGURADO)', margin, y)
  doc.text('RUT', pageWidth - margin - 40, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 100, 6, 'S')
  doc.text(POL347_CONFIG.contratante.nombre, margin + 2, y + 1)
  doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
  doc.text(POL347_CONFIG.contratante.rut, pageWidth - margin - 38, y + 1)
  y += 10

  // Asegurado
  doc.setFont('helvetica', 'bold')
  doc.text('ASEGURADO', margin, y)
  doc.text('RUT', pageWidth - margin - 40, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 100, 6, 'S')
  doc.text(refund.fullName || '', margin + 2, y + 1)
  doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
  doc.text(refund.rut || '', pageWidth - margin - 38, y + 1)
  y += 10

  // Tipo de Póliza
  doc.setFont('helvetica', 'bold')
  doc.text('TIPO DE PÓLIZA', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  drawCheckbox(margin, y, true)
  doc.text('Póliza sin cuenta única de inversión', margin + 7, y)
  y += 5
  drawCheckbox(margin, y, false)
  doc.text('Póliza con cuenta única de inversión', margin + 7, y)
  y += 5
  drawCheckbox(margin, y, false)
  doc.text('Póliza con ahorro previsional voluntario APV', margin + 7, y)
  y += 9

  // Póliza / Vigencia / Renovación
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PÓLIZA', margin, y)
  doc.text('VIGENCIA', margin + 35, y)
  doc.text('RENOVACIÓN AUTOMÁTICA', margin + 100, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  drawCheckbox(margin, y, false)
  doc.text('Individual', margin + 7, y)
  doc.rect(margin + 35, y - 3, 30, 5, 'S')
  doc.text(POL347_CONFIG.vigenciaInicio, margin + 37, y)
  doc.text('Inicio', margin + 70, y)
  drawCheckbox(margin + 100, y, true)
  doc.text('SI', margin + 107, y)
  y += 6
  drawCheckbox(margin, y, true)
  doc.text('Colectiva', margin + 7, y)
  doc.rect(margin + 35, y - 3, 30, 5, 'S')
  doc.text(POL347_CONFIG.vigenciaFin, margin + 37, y)
  doc.text('Termino', margin + 70, y)
  drawCheckbox(margin + 100, y, false)
  doc.text('NO', margin + 107, y)
  y += 10

  // PLAN y PRIMA — 3 planes con checkbox según monto
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PLAN', margin, y)
  doc.text('PRIMA Monto', margin + 50, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  for (let p: Pol347Plan = 1; p <= 3; p = (p + 1) as Pol347Plan) {
    drawCheckbox(margin, y, plan === p)
    doc.text(`Plan ${p}`, margin + 7, y)
    doc.rect(margin + 50, y - 3, 50, 5, 'S')
    if (plan === p) doc.text(primaFmt, margin + 52, y)
    y += 6
    if (p === 3) break
  }
  y += 4

  // Moneda / Periodo / Condiciones / Comisión
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('MONEDA', margin, y)
  doc.text('PERIODO DE PAGO', margin + 30, y)
  doc.text('CONDICIONES', margin + 75, y)
  doc.text('COMISIÓN TOTAL CORREDOR', margin + 120, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  drawCheckbox(margin, y, false)
  doc.text('UF', margin + 7, y)
  drawCheckbox(margin + 30, y, false)
  doc.text('Anual', margin + 37, y)
  drawCheckbox(margin + 75, y, true)
  doc.text('Fija', margin + 82, y)
  doc.text('15% + IVA por prima', margin + 122, y)
  y += 5
  drawCheckbox(margin, y, true)
  doc.text('Peso', margin + 7, y)
  drawCheckbox(margin + 30, y, false)
  doc.text('Mensual', margin + 37, y)
  drawCheckbox(margin + 75, y, false)
  doc.text('Ajustable Según Contrato', margin + 82, y)
  doc.text('recaudada', margin + 122, y)
  y += 5
  drawCheckbox(margin, y, false)
  doc.text('Otra', margin + 7, y)
  drawCheckbox(margin + 30, y, true)
  doc.text('Otro', margin + 37, y)

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA 2 — Carátula (coberturas, beneficiarios, condiciones, exclusiones)
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('COBERTURAS', margin, y)
  doc.text('MONTO / MONEDA', margin + 60, y)
  doc.text('ART. CG', margin + 120, y)
  doc.text('ART. CP', margin + 145, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  drawCheckbox(margin, y, true)
  doc.text('Fallecimiento', margin + 7, y)
  doc.rect(margin + 60, y - 3, 35, 5, 'S')
  doc.text(saldoFmt, margin + 62, y)
  doc.rect(margin + 98, y - 3, 15, 5, 'S')
  doc.text('CLP', margin + 100, y)
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.text('3', margin + 126, y)
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  doc.text('4', margin + 151, y)
  y += 6

  for (const cobertura of ['Invalidez T&P 2/3', 'Sobrevivencia', 'Muerte Accidental']) {
    drawCheckbox(margin, y, false)
    doc.text(cobertura, margin + 7, y)
    doc.rect(margin + 60, y - 3, 35, 5, 'S')
    doc.rect(margin + 98, y - 3, 15, 5, 'S')
    doc.rect(margin + 120, y - 3, 15, 5, 'S')
    doc.rect(margin + 145, y - 3, 15, 5, 'S')
    y += 6
  }
  y += 2

  doc.setFontSize(7)
  doc.text(
    'Esta póliza contiene otras coberturas adicionales, cuyo detalle debe ser consultado en las condiciones particulares.',
    margin,
    y,
  )
  y += 9

  // Beneficiarios
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('BENEFICIARIOS EN CASO DE FALLECIMIENTO', margin, y)
  doc.text('ART. CG', margin + 120, y)
  doc.text('ART. CP', margin + 145, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  drawCheckbox(margin, y, false)
  doc.text('Beneficiarios designados por ley', margin + 7, y)
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 6
  drawCheckbox(margin, y, true)
  doc.text('Otros beneficiarios', margin + 7, y)
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.text('2', margin + 126, y)
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  doc.text('2', margin + 151, y)
  y += 9

  // Condiciones especiales de asegurabilidad
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CONDICIONES ESPECIALES DE ASEGURABILIDAD', margin, y)
  doc.text('ART. CG', margin + 120, y)
  doc.text('ART. CP', margin + 145, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  drawCheckbox(margin, y, true)
  doc.text('Si', margin + 7, y)
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.text('3', margin + 126, y)
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  doc.text('5', margin + 151, y)
  y += 6
  drawCheckbox(margin, y, false)
  doc.text('No', margin + 7, y)
  y += 9

  // Periodo de carencia
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PERIODO DE CARENCIA', margin, y)
  doc.text('ART. CG', margin + 120, y)
  doc.text('ART. CP', margin + 145, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('NO APLICA', margin, y)
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 9

  // Exclusiones
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('EXCLUSIONES', margin, y)
  doc.text('ART. CG', margin + 120, y)
  doc.text('ART. CP', margin + 145, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  drawCheckbox(margin, y, true)
  doc.text('Si', margin + 7, y)
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.text('4', margin + 126, y)
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  doc.text('4', margin + 151, y)
  y += 6
  drawCheckbox(margin, y, false)
  doc.text('No', margin + 7, y)
  y += 9

  // Sistema de notificación
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('SISTEMA DE NOTIFICACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    'El asegurado ha autorizado a la compañía para efectuar las notificaciones asociadas a esta póliza por el siguiente medio:',
    margin,
    y,
  )
  y += 5
  doc.setFontSize(8)
  drawCheckbox(margin, y, formData.autorizaEmail === 'SI')
  doc.text('e-mail al correo electrónico', margin + 7, y)
  doc.rect(margin + 55, y - 3, 80, 5, 'S')
  doc.text(refund.email || '', margin + 57, y)
  y += 6
  drawCheckbox(margin, y, false)
  doc.text('Carta a la siguiente dirección', margin + 7, y)
  doc.rect(margin + 60, y - 3, 100, 5, 'S')
  doc.text(formData.direccion || '', margin + 62, y)
  y += 6
  drawCheckbox(margin, y, false)
  doc.text('Otro', margin + 7, y)
  y += 8

  doc.setFontSize(6)
  const notaCaratula =
    'La presente carátula es un resumen de la información más relevante de la póliza y los conceptos fundamentales se encuentran definidos al reverso. Para una comprensión integral, se debe consultar las condiciones generales y particulares de la póliza. En cada punto se señala el artículo del condicionado general (CG) o condicionado particular (CP) donde puede revisarse el detalle respectivo.'
  const notaLines = doc.splitTextToSize(notaCaratula, contentWidth)
  doc.text(notaLines, margin, y)

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA 3 — Notas y definiciones
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 15

  const writeWrapped = (text: string, fontSize = 7, gap = 2.5, extra = 4) => {
    doc.setFontSize(fontSize)
    const lines = doc.splitTextToSize(text, contentWidth)
    doc.text(lines, margin, y)
    y += lines.length * gap + extra
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('Nota 1:', margin, y)
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    '   El asegurado tiene la obligación de entregar la información que la compañía requiera acerca de su estado de riesgo, en los casos y en la forma que determina la normativa vigente. La infracción a esta obligación puede acarrear la terminación del contrato o que no sea pagado el siniestro.',
  )

  doc.setFont('helvetica', 'bold')
  doc.text('Nota 2:', margin, y)
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    '   (Para Seguros Colectivos) Importante. "Usted está solicitando su incorporación como asegurado a una póliza o contrato de seguro colectivo cuyas condiciones han sido convenidas por TDV SERVICIOS SPA directamente con Augustar Seguros de Vida S.A."',
  )

  doc.setFont('helvetica', 'bold')
  doc.text('Nota 3:', margin, y)
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    '   Póliza es de prima única y se encuentra pagada en su totalidad a la compañía de seguros Augustar Seguros de Vida S.A.',
  )

  y += 3
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('DEFINICIONES', margin, y)
  y += 5

  const definiciones: Array<[string, string]> = [
    [
      'CÓDIGO CMF DE LA PÓLIZA:',
      'Es el Código con que la póliza fue depositada en la Comisión para el Mercado Financiero, conocido también como "código Pol". Si la póliza incluye más de uno, se incluye sólo el de la cobertura principal.',
    ],
    ['PÓLIZA:', 'Documento justificativo del seguro.'],
    [
      'CERTIFICADO DE COBERTURA:',
      'Documento que da cuenta de un seguro emitido con sujeción a los términos de una póliza de seguro colectivo.',
    ],
    [
      'CONTRATANTE:',
      'La persona que contrata el seguro con la compañía aseguradora y sobre quien recaen, en general, las obligaciones y cargas del contrato. Puede ser una persona diferente al asegurado.',
    ],
    ['ASEGURADO:', 'La persona a quien afecta el riesgo que se transfiere a la compañía aseguradora.'],
    [
      'BENEFICIARIO:',
      'La persona que, aun sin ser asegurado, tiene derecho a la indemnización en caso de siniestro.',
    ],
    [
      'TIPO DE PÓLIZA:',
      'Según si tienen o no asociada una cuenta única de inversión, la póliza puede ser sin cuenta única de inversión, con cuenta única de inversión o con ahorro previsional voluntario (APV).',
    ],
    ['VIGENCIA:', 'Tiempo durante el cual se extiende la cobertura de riesgo de la póliza contratada.'],
    [
      'RENOVACIÓN:',
      'Se refiere a si la póliza se extingue al vencimiento de su plazo o si se renueva. Es automática cuando se entiende renovada si el cliente o la compañía no deciden terminarla, conforme a la póliza. Es sin renovación, cuando la póliza se extingue al vencimiento de su vigencia.',
    ],
    ['PRIMA:', 'El precio que se cobra por el seguro. Éste incluye los adicionales, en su caso.'],
    [
      'CONDICIONES DE PRIMA:',
      'La prima puede ser fija, si el monto es el mismo durante toda la vigencia de la póliza, o puede ser ajustable, si ese precio puede ser modificado conforme a las normas incluidas en la póliza.',
    ],
    [
      'COMISIÓN CORREDOR:',
      'Es la parte de la prima que recibe un corredor de seguros, que ha vendido el seguro por cuenta de la compañía. Puede expresarse como un monto fijo o un porcentaje de la prima.',
    ],
    ['COBERTURA:', 'El tipo de riesgo cubierto por la póliza.'],
    ['CARENCIA:', 'Período establecido en la póliza durante el cual no rige la cobertura del seguro.'],
    ['EXCLUSIONES:', 'Aquellos riesgos especificados en la póliza que no son cubiertos por el seguro.'],
    [
      'CONDICIONES ESPECIALES DE ASEGURABILIDAD:',
      'Son los requisitos específicos que debe cumplir el asegurado para que la compañía cubra el riesgo y pague el seguro, en caso de siniestro.',
    ],
    [
      'SISTEMA DE NOTIFICACIÓN:',
      'Sistema de comunicación que el cliente autoriza para que la compañía le efectúe todas las notificaciones requeridas conforme a la póliza o que la compañía requiera realizar. Es responsabilidad del cliente actualizar los datos cuando exista un cambio en ellos.',
    ],
  ]

  doc.setFontSize(6)
  for (const [term, desc] of definiciones) {
    newPageIfNeeded(8)
    doc.setFont('helvetica', 'bold')
    doc.text(term, margin, y)
    const tw = doc.getTextWidth(term)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(desc, contentWidth - tw - 2)
    doc.text(lines[0], margin + tw + 2, y)
    if (lines.length > 1) {
      y += 2.5
      for (let i = 1; i < lines.length; i++) {
        doc.text(lines[i], margin, y)
        y += 2.5
      }
    }
    y += 3
  }

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA 4 — Solicitud de Incorporación / Certificado de Cobertura
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('SOLICITUD DE INCORPORACIÓN, PROPUESTA Y CERTIFICADO DE COBERTURA INMEDIATA', pageWidth / 2, y, { align: 'center' })
  y += 5
  doc.setFontSize(10)
  doc.text('SEGURO DE DESGRAVAMEN', pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Fecha: ${todayFormatted()}`, margin, y)
  doc.text(`Folio: ${formData.folio || '____________'}`, 70, y)
  doc.text(`Nro. Póliza: ${POL347_CONFIG.numero}`, 140, y)
  y += 8

  sectionHeader('Certificado de Cobertura', 220)
  sectionHeader('Identificación del Asegurado Titular')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Nombre:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.fullName || '', margin + 18, y)
  doc.setFont('helvetica', 'normal')
  doc.text('RUT:', 110, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.rut || '', 120, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Fecha Nacimiento:', 150, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formatDate(refund.calculationSnapshot?.birthDate), 178, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Dirección:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.direccion || '', margin + 22, y)
  doc.setFont('helvetica', 'normal')
  doc.text('N°:', 110, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.numero || '', 117, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Depto/Block:', 140, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.depto || '', 165, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Ciudad:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.ciudad || '', margin + 16, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Comuna:', 60, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.comuna || '', 78, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Teléfono:', 110, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.phone || '-', 128, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Celular:', 155, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.celular || '', 173, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Sexo:', margin, y)
  drawCheckbox(margin + 13, y, formData.sexo === 'M')
  doc.text('M', margin + 19, y)
  drawCheckbox(margin + 28, y, formData.sexo === 'F')
  doc.text('F', margin + 34, y)
  y += 5

  doc.text('Correo Electrónico:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.email || '', margin + 36, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    'Autorizo que toda comunicación y notificación que diga relación con el presente seguro me sea enviada al correo electrónico señalado en esta Solicitud de Incorporación.',
    margin,
    y,
  )
  y += 4
  doc.setFontSize(8)
  drawCheckbox(margin, y, formData.autorizaEmail === 'SI')
  doc.text('SI', margin + 6, y)
  drawCheckbox(margin + 18, y, formData.autorizaEmail === 'NO')
  doc.text('NO', margin + 24, y)
  y += 7

  sectionHeader('Antecedentes de la Compañía Aseguradora')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(POL347_CONFIG.aseguradora.nombre, margin, y)
  doc.text(`RUT: ${POL347_CONFIG.aseguradora.rut}`, 120, y)
  y += 6

  sectionHeader('Antecedentes del Contratante')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(POL347_CONFIG.contratante.nombre, margin, y)
  doc.text(`RUT: ${POL347_CONFIG.contratante.rut}`, 120, y)
  y += 6

  sectionHeader('Antecedentes del Corredor')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(POL347_CONFIG.corredor.nombre, margin, y)
  doc.text(`RUT: ${POL347_CONFIG.corredor.rut}`, 120, y)
  y += 7

  sectionHeader('Datos del Seguro')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Monto Inicial del Crédito*:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(saldoFmt, margin + 50, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Nro. Operación:', 120, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.nroOperacion || '', 150, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Fecha Inicio del Crédito:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.fechaInicioCredito || '', margin + 45, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Fecha Fin del Crédito**:', 120, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.fechaFinCredito || '', 158, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Prima Única del Seguro (Exenta de IVA):', margin, y)
  doc.text(primaFmt, margin + 75, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Fórmula: Saldo Insoluto Inicial × (TBM / 1000) × Nper', margin, y)
  y += 4
  doc.text('Donde:', margin, y)
  y += 3
  doc.text(`• SI: Saldo Insoluto Inicial = ${saldoFmt}`, margin + 5, y)
  y += 3
  const tbmLabel = options.useBancoChileTemplate ? 'Tasa Bruta Mensual' : 'Tasa Comercial Bruta Mensual'
  doc.text(`• TBM: ${tbmLabel} (Plan ${plan}) = ${formatTasa(tbm)} por mil`, margin + 5, y)
  y += 3
  doc.text(`• Nper: plazo del crédito en meses = ${nper}`, margin + 5, y)
  y += 5

  doc.setFontSize(7)
  doc.text(
    'La Tasa Bruta Mensual dependerá de la edad del asegurado al momento de la emisión del certificado y del Plan contratado, según la siguiente tabla:',
    margin,
    y,
  )
  y += 5

  // Tabla de tasas (3 planes)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(230, 230, 230)
  const colW = [40, 35, 35, 35]
  let cx = margin
  const drawCell = (text: string, w: number, fill = false) => {
    if (fill) doc.setFillColor(230, 230, 230)
    doc.rect(cx, y - 3, w, 5, fill ? 'FD' : 'S')
    doc.text(text, cx + 2, y)
    cx += w
  }
  drawCell('Rangos de Edad', colW[0], true)
  drawCell('Plan 1', colW[1], true)
  drawCell('Plan 2', colW[2], true)
  drawCell('Plan 3', colW[3], true)
  y += 5
  doc.setFont('helvetica', 'normal')
  cx = margin
  drawCell('18 – 55 años', colW[0])
  drawCell(formatTasa(POL347_CONFIG.tasas['18-55'][0]), colW[1])
  drawCell(formatTasa(POL347_CONFIG.tasas['18-55'][1]), colW[2])
  drawCell(formatTasa(POL347_CONFIG.tasas['18-55'][2]), colW[3])
  y += 5
  cx = margin
  drawCell('56 – 65 años', colW[0])
  drawCell(formatTasa(POL347_CONFIG.tasas['56-65'][0]), colW[1])
  drawCell(formatTasa(POL347_CONFIG.tasas['56-65'][1]), colW[2])
  drawCell(formatTasa(POL347_CONFIG.tasas['56-65'][2]), colW[3])
  y += 8

  sectionHeader('Asegurados')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const asegText =
    'Personas naturales que suscriban el respectivo documento de "Términos y Condiciones" con el contratante de esta Póliza y mantengan un crédito de consumo o automotriz vigente con un acreedor financiero, que cumplan con la edad de permanencia establecida para este producto a la fecha del siniestro, siempre que este ocurra dentro del período de vigencia de la correspondiente cobertura.'
  const asegLines = doc.splitTextToSize(asegText, contentWidth)
  doc.text(asegLines, margin, y)
  y += asegLines.length * 3 + 4

  doc.setFont('helvetica', 'bold')
  doc.text('IMPORTANTE:', margin, y)
  doc.setFont('helvetica', 'normal')
  const impText =
    'Usted está solicitando su incorporación como asegurado a una póliza o contrato de seguro colectivo cuyas condiciones han sido convenidas por TDV SERVICIOS SPA, directamente con Augustar Seguros de Vida S.A.'
  const impLines = doc.splitTextToSize(impText, contentWidth - 23)
  doc.text(impLines, margin + 23, y)
  y += impLines.length * 3 + 4

  sectionHeader('Detalle de Coberturas')
  doc.setFontSize(8)
  doc.setFillColor(230, 230, 230)
  doc.rect(margin, y - 3, 100, 5, 'FD')
  doc.rect(margin + 100, y - 3, 60, 5, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.text('Coberturas', margin + 2, y)
  doc.text('Código C.M.F.', margin + 102, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 100, 5, 'S')
  doc.rect(margin + 100, y - 3, 60, 5, 'S')
  doc.text('Cobertura de Fallecimiento', margin + 2, y)
  doc.text(POL347_CONFIG.codigoCMF, margin + 102, y)
  y += 7

  doc.setFontSize(7)
  doc.text(
    'El presente contrato no cuenta con Sello SERNAC conforme al Artículo 55, Ley 20.555.',
    margin,
    y,
  )

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA 5 — Descripción de Coberturas y Condiciones de Asegurabilidad
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Descripción de Coberturas y Condiciones de Asegurabilidad', pageWidth / 2, y, { align: 'center' })
  y += 8

  sectionHeader('Materia y Capital Asegurado')
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    'Acreditado el fallecimiento del asegurado, la compañía de seguros pagará el saldo insoluto del asegurado al momento de ocurrir el siniestro, con tope máximo de acuerdo con el plan contratado cualquiera sea la época y lugar donde ocurra, siempre que el certificado se encuentre vigente.',
  )

  // Tabla de planes (capital)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setFillColor(230, 230, 230)
  const planColW = [22, 110, 38]
  cx = margin
  drawCell('Plan', planColW[0], true)
  drawCell('Capital', planColW[1], true)
  drawCell('Plan Seleccionado*', planColW[2], true)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const planRows: Array<[string, string]> = [
    ['Plan 1', 'Saldo Insoluto. Monto inicial con tope máximo de $20.000.000 Pesos'],
    ['Plan 2', 'Saldo Insoluto. Monto inicial entre $20.000.001 y $60.000.000 Pesos'],
    ['Plan 3', 'Saldo Insoluto. Monto inicial entre $60.000.001 y $100.000.000 Pesos'],
  ]
  planRows.forEach((row, idx) => {
    cx = margin
    drawCell(row[0], planColW[0])
    drawCell(row[1], planColW[1])
    // Tercera columna con marca si corresponde
    doc.rect(cx, y - 3, planColW[2], 5, 'S')
    if (plan === ((idx + 1) as Pol347Plan)) doc.text('X', cx + planColW[2] / 2, y, { align: 'center' })
    cx += planColW[2]
    y += 5
  })
  y += 1
  doc.setFontSize(6)
  doc.text('(*) Debe quedar seleccionado el plan contratado por el asegurado.', margin, y)
  y += 6

  sectionHeader('Plazo Crédito')
  doc.setFont('helvetica', 'normal')
  writeWrapped(`El plazo del crédito asociado al presente seguro no podrá superar los ${POL347_CONFIG.plazoMaximoMeses} meses.`)

  sectionHeader('Interés Asegurable')
  doc.setFont('helvetica', 'normal')
  writeWrapped('El interés asegurable por parte del asegurado corresponde a saldo insoluto de la deuda.')

  sectionHeader('Asegurados')
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    'Son asegurados los titulares que firmen un contrato de mandato con TDV SERVICIOS SPA y mantengan un crédito de consumo o automotriz vigente con un acreedor financiero, que cumplan con la edad de permanencia establecida para este producto a la fecha del siniestro y con los demás requisitos de asegurabilidad, siempre que este ocurra dentro del período de vigencia de la correspondiente cobertura.',
  )

  sectionHeader('Requisitos de Asegurabilidad')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`Edad Mínima de Ingreso: ${POL347_CONFIG.edadMinimaIngreso} años`, margin, y); y += 3
  doc.text(`Edad Máxima de Ingreso: ${POL347_CONFIG.edadMaximaIngreso} años y 364 días`, margin, y); y += 3
  doc.text(`Edad máxima de Permanencia: ${POL347_CONFIG.edadMaximaPermanenciaTexto}`, margin, y); y += 4
  writeWrapped(
    'La edad del asegurado al inicio del crédito más el plazo del crédito, no deberá superar la edad máxima de permanencia.',
  )

  sectionHeader('Beneficiarios')
  doc.setFont('helvetica', 'normal')
  if (options.useBancoChileTemplate) {
    writeWrapped(
      'Será beneficiario, en carácter irrevocable, el acreedor, entidad bancaria o financiera del crédito de consumo o automotriz otorgado al asegurado siempre que dicho crédito se encuentre vigente al momento del siniestro, es decir, que no se haya extinguido por pago u otra causa.',
    )
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Beneficiario Irrevocable Designado:', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`Nombre: ${beneficiario.nombre}`, margin + 3, y); y += 3
    doc.text(`RUT: ${beneficiario.rut}`, margin + 3, y); y += 6
  } else {
    writeWrapped(
      'El beneficiario para la cobertura de Desgravamen es el acreedor del crédito de consumo o automotriz.',
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA 6 — Inalterabilidad, Cobertura, Exclusiones, Comisiones
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 15

  sectionHeader('Inalterabilidad')
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    'El Contratante y la Compañía Aseguradora no podrán, sin autorización escrita del beneficiario, efectuar modificaciones que alteren la naturaleza del seguro contratado ya sea en su vigencia, monto asegurado y condiciones particulares. Para tal efecto, el contratante deberá requerir y presentar a la Compañía Aseguradora la autorización del beneficiario.',
  )

  sectionHeader('Cobertura de Desgravamen (POL220150573)')
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    'Conforme a los términos de la presente póliza y en sus condiciones particulares, la Compañía Aseguradora asegura la vida de los deudores asegurados que se hayan incorporado a la póliza, pagado la prima correspondiente, cumpliendo con los demás requisitos de asegurabilidad.',
  )
  writeWrapped(
    'De acuerdo a lo anterior, la indemnización correspondiente al capital asegurado de un Deudor-Asegurado según lo indicado en las Condiciones Particulares de la póliza, será pagado por la Compañía Aseguradora al acreedor Beneficiario de esta póliza, inmediatamente después de haberse comprobado por ésta que el fallecimiento del Asegurado ocurrió durante la vigencia de la cobertura para dicho Asegurado, y que no se produjo bajo algunas de las exclusiones señaladas en el artículo 4° las Condiciones Generales. Si el Asegurado sobrevive a la fecha de vencimiento de la cobertura otorgada por esta póliza, no habrá derecho a indemnización alguna.',
  )

  sectionHeader('Exclusiones')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Exclusiones Cobertura de Desgravamen (POL220150573, Artículo N°4)', margin, y); y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Este seguro no cubre el riesgo de muerte si el fallecimiento del Asegurado fuere causado por:', margin, y); y += 4
  doc.text('a) Guerra, terrorismo o cualquier conflicto armado.', margin + 5, y); y += 3
  writeWrapped('b) Suicidio. No obstante, esta exclusión cesará si hubieren transcurrido 2 años completos e ininterrumpidos de cobertura desde la contratación.', 7, 3, 1)
  doc.text('c) Acto delictivo cometido, en calidad de autor o cómplice, por el asegurado.', margin + 5, y); y += 3
  doc.text('d) Energía atómica o nuclear.', margin + 5, y); y += 7

  sectionHeader('Comisiones')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`Recaudador: ${POL347_CONFIG.contratante.nombre}, Rut: ${POL347_CONFIG.contratante.rut}`, margin, y); y += 4
  doc.setFont('helvetica', 'bold')
  doc.text('Comisión de Cobranza:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(' Porcentajes sobre la prima recaudada', margin + 35, y)
  y += 5

  // Tabla comisión de cobranza
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setFillColor(230, 230, 230)
  cx = margin
  drawCell('Rango Edad', 30, true)
  drawCell('Plan 1', 30, true)
  drawCell('Plan 2', 30, true)
  drawCell('Plan 3', 30, true)
  y += 4
  doc.setFont('helvetica', 'normal')
  cx = margin
  drawCell('18 – 55', 30)
  drawCell('39,30% + IVA', 30)
  drawCell('43,77% + IVA', 30)
  drawCell('38,21% + IVA', 30)
  y += 4
  cx = margin
  drawCell('56 – 65', 30)
  drawCell('40,16% + IVA', 30)
  drawCell('37,27% + IVA', 30)
  drawCell('34,93% + IVA', 30)
  y += 7

  doc.setFont('helvetica', 'bold')
  doc.text('Comisión CEF:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(' Se calculará de acuerdo con la siguiente fórmula.', margin + 23, y)
  y += 5
  doc.setFont('helvetica', 'bold'); doc.text('Primero:', margin, y); y += 4
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6)
  writeWrapped(
    'Resultado AUG Pre CEF t = Prima Cliente Bruta t - Comisión de Recaudación Bruta t - Comisión de Intermediación Bruta t – Siniestros t – IBNR t - Costos de Liq. de Siniestros t – Costos Fijos t',
    6, 2.5, 1,
  )
  doc.text('Resultado AUG tras CEF t = Resultado AUG Pre CEF t × 10%', margin, y); y += 4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.text('Segundo:', margin, y); y += 4
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6)
  doc.text('CEF t = Resultado Bruto Pre CEF t × 10% - Pérdida Acarreada t-1 (*)', margin, y); y += 3
  writeWrapped(
    'Existirá Pérdida Acarreada t-1 solo en caso de que en el ejercicio anterior se produzca lo siguiente: Resultado AUG Pre CEF t < 0',
    6, 2.5, 1,
  )
  doc.text('Dónde: Costos Fijos t = 3% × Prima Cliente Bruta t', margin, y); y += 5
  doc.setFontSize(7)
  doc.text(`Corredor: ${POL347_CONFIG.corredor.nombre.toUpperCase()}, Rut: ${POL347_CONFIG.corredor.rut}`, margin, y)

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA 7 — Comisión Intermediación + Denuncia Siniestro
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Comisión de Intermediación:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(' Porcentajes sobre la prima recaudada', margin + 50, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setFillColor(230, 230, 230)
  cx = margin
  drawCell('Rango Edad', 30, true)
  drawCell('Plan 1', 30, true)
  drawCell('Plan 2', 30, true)
  drawCell('Plan 3', 30, true)
  y += 4
  doc.setFont('helvetica', 'normal')
  for (const r of ['18 – 55', '56 – 65']) {
    cx = margin
    drawCell(r, 30)
    drawCell('15% + IVA', 30)
    drawCell('15% + IVA', 30)
    drawCell('15% + IVA', 30)
    y += 4
  }
  y += 5

  sectionHeader('Procedimiento de Denuncia de Siniestro')
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    'En caso de consultas, reclamos y denuncias de siniestro, el asegurado se deberá comunicar al teléfono 600 600 4490.',
  )
  writeWrapped(
    'En todos los casos la compañía se reserva el derecho de pedir mayores antecedentes para la liquidación del siniestro. En todas las denuncias deberá dejarse constancia del nombre, dirección y teléfono de la persona denunciante para posteriores contactos que sean necesarios.',
  )
  writeWrapped(
    'Para efectuar el denuncio de un siniestro, se deberá presentar al asegurador los siguientes antecedentes junto al formulario "Denuncio de Siniestros":',
  )

  doc.setFont('helvetica', 'bold')
  doc.text('Cobertura Fallecimiento', margin, y); y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const docs = [
    'Certificado de defunción original con causa de muerte.',
    'Formulario de denuncio de siniestro.',
    'Fotocopia de la cédula de identidad del asegurado.',
    'Nombre y rut del beneficiario: Acreedor financiero del crédito de consumo o automotriz.',
    'En caso de muerte presunta, ésta deberá acreditarse de conformidad a la ley.',
    'Certificado de saldo de la deuda, emitido por el acreedor financiero a la fecha de fallecimiento del deudor.',
    'Otros antecedentes que se estimen convenientes y necesarios para la evaluación del siniestro.',
  ]
  for (const d of docs) {
    const lines = doc.splitTextToSize(`• ${d}`, contentWidth - 5)
    doc.text(lines, margin + 5, y)
    y += lines.length * 3 + 1
  }
  y += 3

  sectionHeader('Plazo de Pago de Siniestros')
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    'El período de liquidación y pago de siniestro, a contar de la fecha de recepción conforme a todos los antecedentes indicados en la póliza, no podrá exceder de 15 días hábiles. Tratándose de siniestros que no vengan acompañados de la documentación pertinente o en que se requiera de un mayor análisis, la Compañía se reserva el derecho de contabilizar este plazo desde que se reciban tales antecedentes o los exigidos en forma excepcional. En este último evento, la Compañía deberá informar al Corredor a más tardar dentro de los 15 días hábiles siguientes a la presentación del siniestro.',
  )

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA 8 — Notas Importantes (1-6) y Disposiciones Finales
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 15

  sectionHeader('Notas Importantes')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)

  const writeNumbered = (n: string, text: string) => {
    newPageIfNeeded(10)
    const lines = doc.splitTextToSize(text, contentWidth - 8)
    doc.setFont('helvetica', 'bold'); doc.text(n, margin, y); doc.setFont('helvetica', 'normal')
    doc.text(lines, margin + 6, y)
    y += lines.length * 3 + 3
  }

  writeNumbered(
    '1.',
    'El Contratante declara que se encuentra debidamente mandatado por el Asegurado para suscribir la presente Solicitud de Incorporación, Propuesta y Certificado de Cobertura, así como para realizar el pago de la prima única correspondiente. Asimismo, declara que el Asegurado:',
  )
  doc.text('a) Ha sido previa y completamente informado y ha aceptado las condiciones señaladas en esta Solicitud de Incorporación y Certificado de Cobertura.', margin + 8, y); y += 3
  doc.text('b) Ha tomado conocimiento de su derecho a decidir libremente sobre la contratación voluntaria del seguro.', margin + 8, y); y += 3
  doc.text('c) Ha ejercido su derecho a la libre elección de la compañía aseguradora.', margin + 8, y); y += 3
  doc.text(`d) Que el contratante colectivo de la Póliza N°${POL347_CONFIG.numero} es ${POL347_CONFIG.contratante.nombre}.`, margin + 8, y); y += 5

  writeNumbered(
    '2.',
    'Vigencia de las Coberturas. Las coberturas tendrán vigencia desde la firma de esta Solicitud de Incorporación por parte del Contratante. En este caso, la presente solicitud hará las veces de Certificado de Cobertura conforme a lo dispuesto en la Circular N° 2123 de la Comisión para el Mercado Financiero. La presente Solicitud de Incorporación, Propuesta y Certificado de Cobertura es un resumen con la descripción general del seguro, sus coberturas y el procedimiento a seguir en caso de siniestro. El resumen de los seguros es parcial y no reemplaza a las condiciones particulares ni generales de las respectivas pólizas y sólo tienen un carácter informativo. En caso de requerir una copia de las Condiciones Generales y Particulares del seguro, el cliente debe solicitarlas al contratante colectivo de la póliza.',
  )

  writeNumbered(
    '3.',
    `Vigencia de la Póliza Colectiva: La póliza colectiva tendrá vigencia desde el ${POL347_CONFIG.vigenciaInicioLargo} hasta el ${POL347_CONFIG.vigenciaFinLargo} y se renovará tácita y sucesivamente en los mismos términos, por periodos de 1 año cada uno, salvo voluntad en contrario dada por el contratante o la aseguradora, según corresponda, por medio de carta certificada notarial enviado al domicilio de la parte correspondiente.`,
  )

  writeNumbered(
    '4.',
    'Vigencia de la Póliza Individual: Para aquellas personas que cumplan con los requisitos de asegurabilidad, la cobertura comenzará a regir desde la fecha de firma de la Solicitud de Incorporación y se mantendrá vigente hasta la extinción del crédito de consumo otorgado por la entidad acreedora.',
  )

  writeNumbered('5.', 'Término Anticipado: Las coberturas de esta póliza terminarán anticipadamente respecto de un Asegurado en los siguientes casos:')
  doc.text('5.1. En caso de renegociación, anulación o prepago del crédito de consumo.', margin + 8, y); y += 3
  doc.text('5.2. Al momento en que el Asegurado cumpla la edad máxima de permanencia establecida en las Condiciones Particulares de la póliza.', margin + 8, y); y += 3
  doc.text('5.3. En el instante en que el Asegurado deje de tener la calidad de deudor del Acreedor.', margin + 8, y); y += 3
  doc.text('5.4. Por la pérdida de la calidad de asegurado de conformidad a lo establecido en este certificado y en las condiciones particulares.', margin + 8, y); y += 5

  writeNumbered(
    '6.',
    'La contratación de estos seguros es de carácter voluntario. Usted puede retractarse si la contratación la efectuó por un medio a distancia. Además, usted puede terminar los seguros voluntarios anticipadamente en cualquier momento, independiente del medio utilizado para su contratación.',
  )

  newPageIfNeeded(20)
  sectionHeader('Disposiciones Finales')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Código de Autorregulación', margin, y); y += 4
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    'La compañía de seguros Augustar Seguros de Vida S.A. se encuentra adherida voluntariamente al código de autorregulación y al compendio de buenas prácticas de las compañías de seguros, cuyo propósito es propender al desarrollo del mercado de los seguros, en consonancia con los principios de libre competencia y buena fe que debe existir entre las empresas, y entre éstas y sus clientes. Copia del compendio de buenas prácticas corporativas de las compañías de seguros, se encuentra a disposición de los interesados en las oficinas de Augustar Seguros de Vida S.A. y en www.aach.cl',
  )

  // ════════════════════════════════════════════════════════════════════════
  // Autorización Datos Personales + Firmas (inline, sin página separada)
  // ════════════════════════════════════════════════════════════════════════
  newPageIfNeeded(60)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Autorización para el Tratamiento de Datos Personales', margin, y); y += 4
  doc.setFont('helvetica', 'normal')
  writeWrapped(
    'Por este acto, y según lo dispuesto en la Ley N°19.628 sobre protección de la vida privada y sus modificaciones, doy mi consentimiento y autorización expresa a Augustar Seguros de Vida S.A. y sus representantes, sucesores y cesionarios puedan proceder a la transmisión o transferencia de todos o parte de los datos personales e información que declaro haber entregado voluntariamente a esta y/o puesto voluntariamente a su disposición, a cualesquiera terceros prestadores de servicios que estuvieren ubicados dentro o fuera de chile, para efectos del presente contrato de seguro y, en particular, para poder hacer efectivo el (los) beneficio (s) que pudieren estar asociados al seguro contratado.',
  )

  // Dos firmas en línea (TDV SERVICIOS SPA y AuguStar Seguros de Vida S.A.)
  newPageIfNeeded(35)
  y += 8
  const sigW = 40
  const sigH = 15
  const col1X = margin + 20
  const col2X = pageWidth - margin - 20 - sigW
  if (firmaTdvBase64) {
    try { doc.addImage(firmaTdvBase64, 'PNG', col1X, y, sigW, sigH) } catch { /* noop */ }
  }
  if (firmaAugustarBase64) {
    try { doc.addImage(firmaAugustarBase64, 'JPEG', col2X, y, sigW, sigH) } catch { /* noop */ }
  }
  y += sigH + 2
  doc.setLineWidth(0.3)
  doc.line(col1X - 5, y, col1X + sigW + 5, y)
  doc.line(col2X - 5, y, col2X + sigW + 5, y)
  y += 4
  doc.setFontSize(8)
  doc.text('TDV SERVICIOS SPA', col1X + sigW / 2, y, { align: 'center' })
  doc.text('AuguStar Seguros de Vida S.A.', col2X + sigW / 2, y, { align: 'center' })

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA 10 — Procedimiento de Liquidación de Siniestros (Circular 2106)
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('(Circular N°2106 Comisión Para el Mercado Financiero)', margin, y); y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('PROCEDIMIENTO DE LIQUIDACIÓN DE SINIESTROS', margin + 2, y); y += 9

  const liqSections: Array<[string, string]> = [
    [
      '1) OBJETO DE LA LIQUIDACIÓN',
      'La liquidación tiene por fin establecer la ocurrencia de un siniestro, determinar si el siniestro está cubierto en la póliza contratada en una compañía de seguros determinada, y cuantificar el monto de la pérdida y de la indemnización a pagar. El procedimiento de liquidación está sometido a los principios de celeridad y economía procedimental, de objetividad y carácter técnico y de transparencia y acceso.',
    ],
    [
      '2) FORMA DE EFECTUAR LA LIQUIDACIÓN',
      'La liquidación puede efectuarla directamente la Compañía o encomendarla a un Liquidador de Seguros. La decisión debe comunicarse al Asegurado dentro del plazo de tres días hábiles contados desde la fecha de la denuncia del siniestro.',
    ],
    [
      '3) DERECHO DE OPOSICIÓN A LA LIQUIDACIÓN DIRECTA',
      'En caso de liquidación directa por la compañía, el Asegurado o beneficiario puede oponerse a ella, solicitándole por escrito que designe un Liquidador de Seguros, dentro del plazo de cinco días hábiles contados desde la notificación de la comunicación de la Compañía. La Compañía deberá designar al Liquidador en el plazo de dos días hábiles contados desde dicha oposición.',
    ],
    [
      '4) INFORMACIÓN AL ASEGURADO DE GESTIONES A REALIZAR Y PETICIÓN DE ANTECEDENTES',
      'El Liquidador o la Compañía deberá informar al Asegurado, por escrito, en forma suficiente y oportuna, al correo electrónico (informado en la denuncia del siniestro) o por carta certificada (al domicilio señalado en la denuncia de siniestro), de las gestiones que le corresponde realizar, solicitando de una sola vez, cuando las circunstancias lo permitan, todos los antecedentes que requiere para liquidar el siniestro.',
    ],
    [
      '5) PRE-INFORME DE LIQUIDACIÓN',
      'En aquellos siniestros en que surgieren problemas y diferencias de criterios sobre sus causas, evaluación del riesgo o extensión de la cobertura, podrá el Liquidador, actuando de oficio o a petición del Asegurado, emitir un pre-informe de liquidación sobre la cobertura del siniestro y el monto de los daños producidos, el que deberá ponerse en conocimiento de los interesados. El asegurado o la Compañía podrán hacer observaciones por escrito al pre-informe dentro del plazo de cinco días hábiles desde su conocimiento.',
    ],
    [
      '6) PLAZO DE LIQUIDACIÓN',
      'Dentro del más breve plazo, no pudiendo exceder de 45 días corridos desde fecha denuncio, a excepción de: a) Siniestros que correspondan a seguros individuales sobre riesgos del Primer Grupo cuya prima anual sea superior a 100 UF: 90 días corridos desde fecha denuncio; b) Siniestros marítimos que afecten a los cascos o en caso de Avería Gruesa: 180 días corridos desde fecha denuncio.',
    ],
    [
      '7) PRÓRROGA DEL PLAZO DE LIQUIDACIÓN',
      'Los plazos antes señalados podrán, excepcionalmente siempre que las circunstancias lo ameriten, prorrogarse, sucesivamente por iguales períodos, informando los motivos que la fundamenten e indicando las gestiones concretas y específicas que se realizarán, lo que deberá comunicarse al Asegurado y a la Comisión Para el Mercado Financiero, pudiendo esta última dejar sin efecto la ampliación, en casos calificados, y fijar un plazo para entrega del Informe de Liquidación.',
    ],
    [
      '8) INFORME FINAL DE LIQUIDACIÓN',
      'El informe final de liquidación deberá remitirse al Asegurado y simultáneamente al Asegurador, cuando corresponda, y deberá contener necesariamente la transcripción íntegra de los artículos 26 y 27 del Reglamento de Auxiliares del Comercio de Seguros (D.S. de Hacienda Nº 1.055 de 2012, Diario Oficial de 29 de diciembre de 2012).',
    ],
    [
      '9) IMPUGNACIÓN INFORME DE LIQUIDACIÓN',
      'Recibido el informe de Liquidación, la Compañía y el Asegurado dispondrán de un plazo de diez días hábiles para impugnarla. En caso de liquidación directa por la Compañía, este derecho sólo lo tendrá el Asegurado. Impugnado el informe, el Liquidador o la compañía dispondrá de un plazo de 6 días hábiles para responder la impugnación.',
    ],
  ]

  for (const [title, body] of liqSections) {
    newPageIfNeeded(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(title, margin, y); y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const lines = doc.splitTextToSize(body, contentWidth)
    if (y + lines.length * 3 > pageHeight - 15) { doc.addPage(); y = 15 }
    doc.text(lines, margin, y)
    y += lines.length * 3 + 4
  }

  return doc.output('blob') as Blob
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el certificado Pol347 para Banco de Chile (con beneficiario fijo).
 */
export const generateBancoChilePol347PDF = (
  refund: RefundRequest,
  formData: BancoChileCertificateData,
  firmaAugustarBase64: string,
  firmaTdvBase64: string,
  firmaCngBase64: string,
): Promise<Blob> =>
  generatePol347PDF(refund, formData, firmaAugustarBase64, firmaTdvBase64, firmaCngBase64, {
    useBancoChileTemplate: true,
    useBancoChileBeneficiaryFallback: true,
  })

/**
 * Genera el certificado genérico Pol347 (no Banco de Chile). El beneficiario
 * irrevocable se toma desde formData.
 */
export const generateGenericPol347PDF = (
  refund: RefundRequest,
  formData: BancoChileCertificateData,
  firmaAugustarBase64: string,
  firmaTdvBase64: string,
  firmaCngBase64: string,
): Promise<Blob> =>
  generatePol347PDF(refund, formData, firmaAugustarBase64, firmaTdvBase64, firmaCngBase64, {
    useBancoChileTemplate: false,
    useBancoChileBeneficiaryFallback: false,
  })

/**
 * Genera el certificado Pol347 para Chevrolet SF (mismo layout que Banco de Chile,
 * pero el beneficiario irrevocable es el ingresado en el formulario, sin fallback fijo).
 */
export const generateChevroletSfPol347PDF = (
  refund: RefundRequest,
  formData: BancoChileCertificateData,
  firmaAugustarBase64: string,
  firmaTdvBase64: string,
  firmaCngBase64: string,
): Promise<Blob> =>
  generatePol347PDF(refund, formData, firmaAugustarBase64, firmaTdvBase64, firmaCngBase64, {
    useBancoChileTemplate: true,
    useBancoChileBeneficiaryFallback: false,
  })

// ─── Aliases legacy ───────────────────────────────────────────────────────
// Compatibilidad con imports antiguos: ambos llaman al mismo generador Pol347.
export const generateBancoChilePrimePDF = generateBancoChilePol347PDF
export const generateBancoChileStandardPDF = generateBancoChilePol347PDF
