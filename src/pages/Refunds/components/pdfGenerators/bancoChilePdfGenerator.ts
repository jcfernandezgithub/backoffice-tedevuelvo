/**
 * Generadores de PDF para Certificados de Cobertura - BANCO DE CHILE
 * 
 * Póliza 342: Créditos ≤ 20.000.000 CLP
 * Póliza 344: Créditos > 20.000.000 CLP
 * 
 * Tasas de visualización en PDF (estéticas):
 * - Póliza 342: 0.30 (18-55 años), 0.39 (56-65 años)
 * - Póliza 344: 0.34 (ambos rangos)
 */

import jsPDF from 'jspdf'
import { RefundRequest } from '@/types/refund'

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
  // Beneficiario Irrevocable
  beneficiarioNombre: string
  beneficiarioRut: string
}

// Configuración específica para Banco de Chile
const BANCO_CHILE_CONFIG = {
  poliza342: {
    numero: '342',
    codigoCMF: 'POL 220150573',
    codigoCMFDisplay: 'POL 2 2015 0573',
    vigenciaInicio: '13/10/2025',
    vigenciaFin: '12/09/2028',
    capitalMaximo: 20000000,
    tasas: {
      '18-55': 0.2970,
      '56-65': 0.3733,
    },
    corredor: {
      nombre: 'Prime Corredores de Seguros SPA.',
      rut: '76.196.802-5',
    },
    comisiones: {
      recaudador: 'TDV SERVICIOS SPA, Rut: 78.168.126-1',
      comisionCobranza: '35% + IVA sobre la prima recaudada',
      corredorComision: 'PRIME CORREDORES DE SEGUROS SPA, Rut: 76.196.802-5',
      comisionIntermediacion: '15% + IVA sobre la prima recaudada',
    },
  },
  poliza344: {
    numero: '344',
    codigoCMF: 'POL 2 2015 0573',
    vigenciaInicio: '01/12/2025',
    vigenciaFin: '30/11/2028',
    capitalMaximo: 60000000,
    tasas: {
      '18-55': 0.3267,
      '56-65': 0.4106,
    },
    corredor: {
      nombre: 'Prime Corredores de Seguros SPA',
      rut: '76.196.802-5',
    },
  },
}

// Helper functions
const formatDate = (dateString?: string): string => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateString || ''
  }
}

const getTodayFormatted = (): string => {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = today.getFullYear()
  return `${day}/${month}/${year}`
}

const getTasaBrutaMensual342 = (age?: number): number => {
  if (!age) return BANCO_CHILE_CONFIG.poliza342.tasas['18-55']
  if (age >= 18 && age <= 55) return BANCO_CHILE_CONFIG.poliza342.tasas['18-55']
  if (age >= 56 && age <= 65) return BANCO_CHILE_CONFIG.poliza342.tasas['56-65']
  return BANCO_CHILE_CONFIG.poliza342.tasas['18-55']
}

const getTasaBrutaMensual344 = (age?: number): number => {
  if (!age) return BANCO_CHILE_CONFIG.poliza344.tasas['18-55']
  if (age >= 18 && age <= 55) return BANCO_CHILE_CONFIG.poliza344.tasas['18-55']
  if (age >= 56 && age <= 65) return BANCO_CHILE_CONFIG.poliza344.tasas['56-65']
  return BANCO_CHILE_CONFIG.poliza344.tasas['18-55']
}

const parseSaldoInsoluto = (saldoStr: string): number => {
  return parseFloat(saldoStr.replace(/\./g, '').replace(',', '.')) || 0
}

/**
 * Genera el PDF de la Póliza 344 (Prime) para Banco de Chile
 * Créditos > 20.000.000 CLP
 * Documento legal conforme a Caratula y Cuerpo Póliza 344
 */
export const generateBancoChilePrimePDF = async (
  refund: RefundRequest,
  formData: BancoChileCertificateData,
  firmaBase64: string,
  firmaTdvBase64: string,
  firmaCngBase64: string
): Promise<void> => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = 15

  const config = BANCO_CHILE_CONFIG.poliza344

  const drawCheckbox = (x: number, yPos: number, checked: boolean = false) => {
    doc.setDrawColor(0)
    doc.setLineWidth(0.3)
    doc.rect(x, yPos - 2.5, 4, 4, 'S')
    if (checked) {
      doc.setFont('helvetica', 'bold')
      doc.text('X', x + 0.8, yPos)
    }
  }

  const drawBox = (x: number, yPos: number, w: number, h: number, filled: boolean = false): void => {
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.3)
    if (filled) {
      doc.setFillColor(0, 0, 0)
      doc.rect(x, yPos - 2.5, w, h, 'F')
    } else {
      doc.rect(x, yPos - 2.5, w, h, 'S')
    }
  }

  // Valores calculados - Prima Única usa newMonthlyPremium × remainingInstallments del snapshot, o calcula con TBM
  const saldoInsoluto = parseSaldoInsoluto(formData.saldoInsoluto)
  const nperValue = refund.calculationSnapshot?.remainingInstallments || 0
  const ageValue = refund.calculationSnapshot?.age
  const tcValue = getTasaBrutaMensual344(ageValue)
  
  // Prima Única: primero intentar desde snapshot (newMonthlyPremium × remainingInstallments), luego calcular
  let primaUnica: number
  const newMonthlyPremium = refund.calculationSnapshot?.newMonthlyPremium
  if (typeof newMonthlyPremium === 'number' && newMonthlyPremium > 0 && nperValue > 0) {
    primaUnica = Math.round(newMonthlyPremium * nperValue)
    console.log('Banco Chile Prime PDF - Prima Única desde snapshot:', { newMonthlyPremium, nperValue, primaUnica })
  } else {
    primaUnica = Math.round(saldoInsoluto * (tcValue / 1000) * nperValue)
    console.log('Banco Chile Prime PDF - Prima Única calculada con TBM:', { saldoInsoluto, tcValue, nperValue, primaUnica })
  }
  const saldoInsolutoFormatted = `$${saldoInsoluto.toLocaleString('es-CL')}`

  // ===================== CARÁTULA - PAGE 1 =====================
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('CÓDIGOS CMF DE LA PÓLIZA', margin, y)
  doc.text('PÓLIZA N°', pageWidth - margin - 40, y)
  y += 5
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.rect(margin, y - 3, 60, 6, 'S')
  doc.text(config.codigoCMF, margin + 2, y + 1)
  doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
  doc.text(config.numero, pageWidth - margin - 38, y + 1)
  y += 12

  // CONTRATANTE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CONTRATANTE (SI ES DISTINTO DEL ASEGURADO)', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 90, 6, 'S')
  doc.text('TDV SERVICIOS SPA', margin + 2, y + 1)
  doc.text('RUT: 78.168.126-1', margin + 95, y + 1)
  y += 12

  // ASEGURADO
  doc.setFont('helvetica', 'bold')
  doc.text('ASEGURADO', margin, y)
  doc.text('RUT', pageWidth - margin - 40, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 90, 6, 'S')
  doc.text(refund.fullName || '', margin + 2, y + 1)
  doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
  doc.text(refund.rut || '', pageWidth - margin - 38, y + 1)
  y += 12

  // TIPO DE PÓLIZA
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
  y += 10

  // PÓLIZA section with VIGENCIA and RENOVACIÓN
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
  doc.text(config.vigenciaInicio, margin + 37, y)
  doc.text('Inicio', margin + 70, y)
  drawCheckbox(margin + 100, y, true)
  doc.text('SI', margin + 107, y)
  y += 6

  drawCheckbox(margin, y, true)
  doc.text('Colectiva', margin + 7, y)
  doc.rect(margin + 35, y - 3, 30, 5, 'S')
  doc.text(config.vigenciaFin, margin + 37, y)
  doc.text('Termino', margin + 70, y)
  drawCheckbox(margin + 100, y, false)
  doc.text('NO', margin + 107, y)
  y += 12

  // PLAN and PRIMA - Póliza 344 (Prime) = Plan 2
  const primaUnicaFormatted = `$${primaUnica.toLocaleString('es-CL')}`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PLAN', margin, y)
  doc.text('PRIMA Monto', margin + 50, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  drawCheckbox(margin, y, false)
  doc.text('Plan 1', margin + 7, y)
  doc.rect(margin + 50, y - 3, 40, 5, 'S')
  y += 6
  drawCheckbox(margin, y, true) // Plan 2 checked for Póliza 344
  doc.text('Plan 2', margin + 7, y)
  doc.rect(margin + 50, y - 3, 40, 5, 'S')
  doc.text(primaUnicaFormatted, margin + 52, y) // Prima Única in second row
  y += 12

  // MONEDA, PERIODO DE PAGO, CONDICIONES, COMISIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('MONEDA', margin, y)
  doc.text('PERIODO DE PAGO', margin + 30, y)
  doc.text('CONDICIONES', margin + 75, y)
  doc.text('COMISIÓN TOTAL CORREDOR', margin + 120, y)
  y += 6

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
  y += 5
  drawCheckbox(margin, y, false)
  doc.text('Otra', margin + 7, y)
  drawCheckbox(margin + 30, y, true)
  doc.text('Otro', margin + 37, y)

  // ===================== CARÁTULA - PAGE 2 =====================
  doc.addPage()
  y = 15

  // COBERTURAS
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
  doc.text(saldoInsolutoFormatted, margin + 62, y)
  doc.rect(margin + 98, y - 3, 15, 5, 'S')
  doc.text('CLP', margin + 100, y)
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.text('2/3', margin + 123, y)
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 6

  drawCheckbox(margin, y, false)
  doc.text('Invalidez T&P 2/3', margin + 7, y)
  doc.rect(margin + 60, y - 3, 35, 5, 'S')
  doc.rect(margin + 98, y - 3, 15, 5, 'S')
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 6

  drawCheckbox(margin, y, false)
  doc.text('Sobrevivencia', margin + 7, y)
  doc.rect(margin + 60, y - 3, 35, 5, 'S')
  doc.rect(margin + 98, y - 3, 15, 5, 'S')
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 6

  drawCheckbox(margin, y, false)
  doc.text('Muerte Accidental', margin + 7, y)
  doc.rect(margin + 60, y - 3, 35, 5, 'S')
  doc.rect(margin + 98, y - 3, 15, 5, 'S')
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 8

  doc.setFontSize(7)
  doc.text('Esta póliza contiene otras coberturas adicionales, cuyo detalle debe ser consultado en las condiciones particulares.', margin, y)
  y += 10

  // BENEFICIARIOS EN CASO DE FALLECIMIENTO
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
  y += 8

  // BENEFICIARIO IRREVOCABLE - campo del documento legal
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('BENEFICIARIO IRREVOCABLE', margin, y)
  doc.text('Rut', margin + 100, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 95, 5, 'S')
  doc.text(formData.beneficiarioNombre || '', margin + 2, y)
  doc.rect(margin + 100, y - 3, 60, 5, 'S')
  doc.text(formData.beneficiarioRut || '', margin + 102, y)
  y += 8

  doc.setFontSize(7)
  doc.text('El presente contrato no cuenta con Sello SERNAC conforme al Artículo 55, Ley 20.555', margin, y)
  y += 10

  // CONDICIONES ESPECIALES DE ASEGURABILIDAD
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
  y += 10

  // PERIODO DE CARENCIA
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PERIODO DE CARENCIA', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('NO APLICA', margin, y)
  y += 10

  // EXCLUSIONES
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
  y += 10

  // SISTEMA DE NOTIFICACIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('SISTEMA DE NOTIFICACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('El asegurado ha autorizado a la compañía para efectuar las notificaciones asociadas a esta póliza por el siguiente medio:', margin, y)
  y += 6
  doc.setFontSize(8)
  drawCheckbox(margin, y, true)
  doc.text('e-mail al correo electrónico', margin + 7, y)
  doc.rect(margin + 55, y - 3, 80, 5, 'S')
  doc.text(refund.email || '', margin + 57, y)

  // ===================== CARÁTULA - PAGE 3 =====================
  doc.addPage()
  y = 15

  drawCheckbox(margin, y, true)
  doc.text('Carta a la siguiente dirección', margin + 7, y)
  doc.rect(margin + 60, y - 3, 100, 5, 'S')
  doc.text(formData.direccion || '', margin + 62, y)
  y += 6
  drawCheckbox(margin, y, false)
  doc.text('Otro', margin + 7, y)
  y += 10

  doc.setFontSize(6)
  const notaCaratula = 'La presente carátula es un resumen de la información más relevante de la póliza y los conceptos fundamentales se encuentran definidos al reverso. Para una comprensión integral, se debe consultar las condiciones generales y particulares de la póliza. En cada punto se señala el artículo del condicionado general (CG) o condicionado particular (CP) donde puede revisarse el detalle respectivo.'
  const notaCaratulaLines = doc.splitTextToSize(notaCaratula, contentWidth)
  doc.text(notaCaratulaLines, margin, y)
  y += notaCaratulaLines.length * 2.5 + 5

  const nota1Caratula = 'Nota 1: El asegurado tiene la obligación de entregar la información que la compañía requiera acerca de su estado de riesgo, en los casos y en la forma que determina la normativa vigente. La infracción a esta obligación puede acarrear la terminación del contrato o que no sea pagado el siniestro.'
  const nota1CaratulaLines = doc.splitTextToSize(nota1Caratula, contentWidth)
  doc.text(nota1CaratulaLines, margin, y)
  y += nota1CaratulaLines.length * 2.5 + 5

  const nota2Caratula = 'Nota 2: (Para Seguros Colectivos) Importante. "Usted está solicitando su incorporación como asegurado a una póliza o contrato de seguro colectivo cuyas condiciones han sido convenidas por TDV SERVICIOS SPA directamente con la compañía de seguros Augustar Seguros de Vida S.A.'
  const nota2CaratulaLines = doc.splitTextToSize(nota2Caratula, contentWidth)
  doc.text(nota2CaratulaLines, margin, y)
  y += nota2CaratulaLines.length * 2.5 + 5

  const nota3Caratula = 'Nota 3: Póliza es de prima única y se encuentra pagada en su totalidad a la compañía de seguros Augustar Seguros de Vida S.A.'
  const nota3CaratulaLines = doc.splitTextToSize(nota3Caratula, contentWidth)
  doc.text(nota3CaratulaLines, margin, y)
  y += nota3CaratulaLines.length * 2.5 + 10

  // DEFINICIONES
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('DEFINICIONES', margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)

  const definitions = [
    { term: 'CÓDIGO CMF DE LA PÓLIZA:', desc: 'Es el Código con que la póliza fue depositada en la Comisión para el Mercado Financiero, conocido también como "código Pol". Si la póliza incluye más de uno, se incluye sólo el de la cobertura principal.' },
    { term: 'PÓLIZA:', desc: 'Documento justificativo del seguro.' },
    { term: 'CERTIFICADO DE COBERTURA:', desc: 'Documento que da cuenta de un seguro emitido con sujeción a los términos de una póliza de seguro colectivo.' },
    { term: 'CONTRATANTE:', desc: 'La persona que contrata el seguro con la compañía aseguradora y sobre quien recaen las obligaciones y cargas del contrato.' },
    { term: 'ASEGURADO:', desc: 'La persona a quien afecta el riesgo que se transfiere a la compañía aseguradora.' },
    { term: 'BENEFICIARIO:', desc: 'La persona que, aun sin ser asegurado, tiene derecho a la indemnización en caso de siniestro.' },
    { term: 'TIPO DE PÓLIZA:', desc: 'Según si tiene o no asociada una cuenta única de inversión.' },
    { term: 'VIGENCIA:', desc: 'Tiempo durante el cual se extiende la cobertura de riesgo de la póliza contratada.' },
    { term: 'RENOVACIÓN:', desc: 'Se refiere a si la póliza se extingue al vencimiento de su plazo o si se renueva.' },
    { term: 'PRIMA:', desc: 'El precio que se cobra por el seguro.' },
    { term: 'CONDICIONES DE PRIMA:', desc: 'La prima puede ser fija o ajustable conforme a las normas de la póliza.' },
    { term: 'COMISIÓN CORREDOR:', desc: 'Parte de la prima que recibe un corredor de seguros.' },
    { term: 'COBERTURA:', desc: 'El tipo de riesgo cubierto por la póliza.' },
    { term: 'CARENCIA:', desc: 'Período durante el cual no rige la cobertura del seguro.' },
  ]

  definitions.forEach(def => {
    doc.setFont('helvetica', 'bold')
    doc.text(def.term, margin, y)
    const termWidth = doc.getTextWidth(def.term)
    doc.setFont('helvetica', 'normal')
    const descLines = doc.splitTextToSize(def.desc, contentWidth - termWidth - 3)
    doc.text(descLines[0], margin + termWidth + 2, y)
    if (descLines.length > 1) {
      y += 2.5
      for (let i = 1; i < descLines.length; i++) {
        doc.text(descLines[i], margin, y)
        y += 2.5
      }
    }
    y += 3
  })

  // ===================== CARÁTULA - PAGE 4 (más definiciones) =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('EXCLUSIONES', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('Aquellos riesgos especificados en la póliza que no son cubiertos por el seguro.', margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('CONDICIONES ESPECIALES DE ASEGURABILIDAD', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('Son los requisitos específicos que debe cumplir el asegurado para que la compañía cubra el riesgo y pague el seguro, en caso de siniestro.', margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('SISTEMA DE NOTIFICACIÓN', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  const sistemaNotifText = 'Sistema de comunicación que el cliente autoriza para que la compañía le efectúe todas las notificaciones requeridas conforme a la póliza. Es responsabilidad del cliente actualizar los datos cuando exista un cambio.'
  const sistemaNotifLines = doc.splitTextToSize(sistemaNotifText, contentWidth)
  doc.text(sistemaNotifLines, margin, y)
  y += sistemaNotifLines.length * 2.5 + 10

  // ===================== CUERPO DEL CERTIFICADO - PAGE 5 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('SOLICITUD DE INCORPORACIÓN, PROPUESTA Y CERTIFICADO DE COBERTURA INMEDIATA', pageWidth / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(10)
  doc.text('SEGURO DE DESGRAVAMEN', pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Fecha: ${getTodayFormatted()}`, margin, y)
  doc.text(`Folio: ${formData.folio || '____________'}`, 70, y)
  doc.text(`Nro. Póliza: ${config.numero}`, 140, y)
  y += 8

  // Certificado de Cobertura
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setFillColor(220, 220, 220)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Certificado de Cobertura', margin + 2, y)
  y += 8

  // Identificación del Asegurado Titular
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Identificación del Asegurado Titular', margin + 2, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Nombre:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.fullName || '', margin + 18, y)
  doc.setFont('helvetica', 'normal')
  doc.text('RUT:', 115, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.rut || '', 125, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Fecha Nacimiento:', 155, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formatDate(refund.calculationSnapshot?.birthDate), 180, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Dirección:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.direccion || '', margin + 22, y)
  doc.setFont('helvetica', 'normal')
  doc.text('N°:', 115, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.numero || '', 122, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Depto/Block:', 145, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.depto || '', 168, y)
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
  doc.text('Teléfono:', 115, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.phone || '-', 133, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Celular:', 160, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.celular || '', 178, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Sexo:', margin, y)
  drawBox(margin + 15, y, 3, 3, formData.sexo === 'M')
  doc.text('M', margin + 20, y)
  drawBox(margin + 35, y, 3, 3, formData.sexo === 'F')
  doc.text('F', margin + 40, y)
  y += 5

  doc.text('Correo Electrónico:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.email || '', margin + 38, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Autorizo que toda comunicación y notificación que diga relación con el presente seguro me sea enviada al correo electrónico señalado en esta Solicitud de Incorporación.', margin, y)
  y += 4
  doc.setFontSize(8)
  drawBox(margin, y, 3, 3, formData.autorizaEmail === 'SI')
  doc.text('SI', margin + 5, y)
  drawBox(margin + 20, y, 3, 3, formData.autorizaEmail === 'NO')
  doc.text('NO', margin + 25, y)
  y += 7

  // Antecedentes de la Compañía Aseguradora
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Antecedentes de la Compañía Aseguradora', margin + 2, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Augustar Seguros de Vida S.A.', margin, y)
  doc.text('RUT: 76.632.384-7', 120, y)
  y += 6

  // Antecedentes del Contratante y Recaudador
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Antecedentes del Contratante y Recaudador', margin + 2, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('TDV SERVICIOS SPA', margin, y)
  doc.text('RUT: 78.168.126-1', 120, y)
  y += 6

  // Antecedentes del Corredor
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Antecedentes del Corredor', margin + 2, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(config.corredor.nombre, margin, y)
  doc.text(`RUT: ${config.corredor.rut}`, 120, y)
  y += 8

  // Datos del Seguro
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Datos del Seguro', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Monto Inicial del Crédito*:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(saldoInsolutoFormatted, margin + 45, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Nro. Operación:', 120, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.nroOperacion || '', 150, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Fecha Inicio del Crédito:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.fechaInicioCredito || '', margin + 42, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Fecha Fin del Crédito**:', 120, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.fechaFinCredito || '', 158, y)
  y += 6

  // Prima Única del Seguro - fórmula exacta del documento legal
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Prima Única del Seguro, Exenta de IVA = TC/1000 * MCI * nper', margin, y)
  y += 5

  doc.setFontSize(7)
  doc.text('Dónde:', margin, y)
  y += 3
  doc.text('• MCI: Monto del crédito inicial', margin + 5, y)
  y += 3
  doc.text('• TC: Tasa Comercial Bruta Mensual', margin + 5, y)
  y += 3
  doc.text('• Nper: plazo de duración del crédito, en meses', margin + 5, y)
  y += 5

  doc.text('La Tasa Bruta dependerá de la edad del asegurado, al momento de la emisión del certificado, de acuerdo con la siguiente tabla:', margin, y)
  y += 5

  // Tabla de tasas
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(230, 230, 230)
  doc.rect(margin, y - 3, 70, 5, 'F')
  doc.rect(margin + 70, y - 3, 50, 5, 'F')
  doc.text('Rangos de Edad de Emisión', margin + 2, y)
  doc.text('Tasa Bruta (por mil)', margin + 72, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 70, 5, 'S')
  doc.rect(margin + 70, y - 3, 50, 5, 'S')
  doc.text('18 – 55 años', margin + 2, y)
  doc.text('0,34', margin + 72, y)
  y += 5
  doc.rect(margin, y - 3, 70, 5, 'S')
  doc.rect(margin + 70, y - 3, 50, 5, 'S')
  doc.text('56 – 65 años', margin + 2, y)
  doc.text('0,34', margin + 72, y)
  y += 7

  // Asegurados
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Asegurados', margin + 2, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const aseguradosText = 'Personas naturales que suscriban el respectivo documento de "Términos y Condiciones" con el contratante de esta Póliza y mantengan un crédito de consumo o automotriz vigente con un acreedor financiero, que cumplan con la edad de permanencia establecida para este producto a la fecha del siniestro, siempre que este ocurra dentro del período de vigencia de la correspondiente cobertura.'
  const aseguradosLines = doc.splitTextToSize(aseguradosText, contentWidth)
  doc.text(aseguradosLines, margin, y)

  // ===================== CUERPO - PAGE 6 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('IMPORTANTE:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const importanteText = 'Usted está solicitando su incorporación como asegurado a una póliza o contrato de seguro colectivo cuyas condiciones han sido convenidas por TDV SERVICIOS SPA, directamente con Augustar Seguros de Vida S.A.'
  const importanteLines = doc.splitTextToSize(importanteText, contentWidth - 22)
  doc.text(importanteLines, margin + 22, y)
  y += importanteLines.length * 3 + 4

  // Detalle de Coberturas
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Detalle de Coberturas', margin + 2, y)
  y += 6

  doc.setFontSize(8)
  doc.setFillColor(230, 230, 230)
  doc.rect(margin, y - 3, 90, 5, 'F')
  doc.rect(margin + 90, y - 3, 50, 5, 'F')
  doc.text('Coberturas', margin + 2, y)
  doc.text('Código C.M.F.', margin + 92, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 90, 5, 'S')
  doc.rect(margin + 90, y - 3, 50, 5, 'S')
  doc.text('Cobertura de Fallecimiento', margin + 2, y)
  doc.text(config.codigoCMF, margin + 92, y)
  y += 6

  // BENEFICIARIO IRREVOCABLE en Detalle de Coberturas (Póliza 344)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('BENEFICIARIO IRREVOCABLE', margin, y)
  doc.text('Rut', margin + 100, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.rect(margin, y - 3, 95, 5, 'S')
  doc.text(formData.beneficiarioNombre || '', margin + 2, y)
  doc.rect(margin + 100, y - 3, 60, 5, 'S')
  doc.text(formData.beneficiarioRut || '', margin + 102, y)
  y += 8

  doc.text('El presente contrato no cuenta con Sello SERNAC conforme al Artículo 55, Ley 20.555', margin, y)
  y += 8

  // Descripción de Coberturas y Condiciones de Asegurabilidad
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setFillColor(220, 220, 220)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Descripción de Coberturas y Condiciones de Asegurabilidad', margin + 2, y)
  y += 8

  // Materia y Capital Asegurado
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Materia y Capital Asegurado', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const materiaText = `Acreditado el fallecimiento del asegurado, la compañía de seguros pagará al beneficiario el saldo insoluto del crédito de consumo o automotriz del asegurado al momento de ocurrir el siniestro, con tope máximo de $${config.capitalMaximo.toLocaleString('es-CL')} Pesos, cualquiera sea la época y lugar donde ocurra, siempre que el certificado se encuentre vigente.`
  const materiaLines = doc.splitTextToSize(materiaText, contentWidth)
  doc.text(materiaLines, margin, y)
  y += materiaLines.length * 3 + 3

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Capitales', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`$${config.capitalMaximo.toLocaleString('es-CL')}.-`, margin, y)
  y += 6

  // Interés Asegurable
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Interés Asegurable', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const interesText = 'El interés asegurable por parte del asegurado corresponde a saldo insoluto de la deuda. Asegurados qué firmen un contrato de mandato con TDV SERVICIOS SPA y mantengan un crédito de consumo o automotriz vigente con un acreedor financiero, que cumplan con la edad de permanencia establecida para este producto a la fecha del siniestro y con los demás requisitos de asegurabilidad, siempre que este ocurra dentro del período de vigencia de la correspondiente cobertura.'
  const interesLines = doc.splitTextToSize(interesText, contentWidth)
  doc.text(interesLines, margin, y)
  y += interesLines.length * 3 + 5

  // Requisitos de Asegurabilidad
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Requisitos de Asegurabilidad', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('• Edad Mínima de Ingreso: 18 años', margin, y)
  y += 3
  doc.text('• Edad Máxima de Ingreso: 64 años y 364 días', margin, y)
  y += 3
  doc.text('• Edad máxima de Permanencia: 69 años y 364 días', margin, y)
  y += 5

  doc.text('La edad del asegurado al inicio del crédito más el plazo del crédito, no deberá superar la edad máxima de permanencia.', margin, y)
  y += 8

  // Beneficiarios
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Beneficiarios', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const beneficiariosText = 'Será beneficiario, en carácter irrevocable, el acreedor, entidad bancaria o financiera del crédito de consumo o automotriz otorgado al asegurado siempre que dicho crédito se encuentre vigente al momento del siniestro, es decir, que no se haya extinguido por pago u otra causa.'
  const beneficiariosLines = doc.splitTextToSize(beneficiariosText, contentWidth)
  doc.text(beneficiariosLines, margin, y)
  y += beneficiariosLines.length * 3 + 5

  // Inalterabilidad
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Inalterabilidad', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const inalterabilidadText = 'El Contratante y la Compañía Aseguradora no podrán, sin autorización escrita del beneficiario, efectuar modificaciones que alteren la naturaleza del seguro contratado ya sea en su vigencia, monto asegurado y condiciones particulares. Para tal efecto, el contratante deberá requerir y presentar a la Compañía Aseguradora la autorización del beneficiario.'
  const inalterabilidadLines = doc.splitTextToSize(inalterabilidadText, contentWidth)
  doc.text(inalterabilidadLines, margin, y)

  // ===================== CUERPO - PAGE 7 =====================
  doc.addPage()
  y = 15

  // Cobertura de Desgravamen
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Cobertura de Desgravamen (POL220150573)', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const coberturaText1 = 'Conforme a los términos de la presente póliza y en sus condiciones particulares, la Compañía Aseguradora asegura la vida de los deudores asegurados que se hayan incorporado a la póliza, pagado la prima correspondiente, cumpliendo con los demás requisitos de asegurabilidad.'
  const coberturaLines1 = doc.splitTextToSize(coberturaText1, contentWidth)
  doc.text(coberturaLines1, margin, y)
  y += coberturaLines1.length * 3 + 3

  const coberturaText2 = 'De acuerdo a lo anterior, la indemnización correspondiente al capital asegurado de un Deudor-Asegurado según lo indicado en las Condiciones Particulares de la póliza, será pagado por la Compañía Aseguradora al acreedor Beneficiario de esta póliza.'
  const coberturaLines2 = doc.splitTextToSize(coberturaText2, contentWidth)
  doc.text(coberturaLines2, margin, y)
  y += coberturaLines2.length * 3 + 3

  const coberturaText3 = 'inmediatamente después de haberse comprobado por ésta que el fallecimiento del Asegurado ocurrió durante la vigencia de la cobertura para dicho Asegurado, y que no se produjo bajo algunas de las exclusiones señaladas en el artículo 4° las Condiciones Generales. Si el Asegurado sobrevive a la fecha de vencimiento de la cobertura otorgada por esta póliza, no habrá derecho a indemnización alguna.'
  const coberturaLines3 = doc.splitTextToSize(coberturaText3, contentWidth)
  doc.text(coberturaLines3, margin, y)
  y += coberturaLines3.length * 3 + 5

  // Prima del Seguro
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Prima del Seguro', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('La prima bruta de este seguro es única, pagada al contado y corresponde a una tasa multiplicada por el monto de cada crédito.', margin, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.text('Prima Única = TC/1000 * MCI * nper', margin, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Dónde:', margin, y)
  y += 3
  doc.text('• MCI: Monto del crédito inicial', margin + 5, y)
  y += 3
  doc.text('• TC: Tasa Comercial Bruta Mensual', margin + 5, y)
  y += 3
  doc.text('• Nper: plazo de duración del crédito, en meses', margin + 5, y)
  y += 5

  doc.text('La Tasa Bruta dependerá de la edad del asegurado, al momento de la emisión del certificado, de acuerdo con la siguiente tabla:', margin, y)
  y += 5

  // Tabla de tasas (repetida en cuerpo)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(230, 230, 230)
  doc.rect(margin, y - 3, 60, 4, 'F')
  doc.rect(margin + 60, y - 3, 40, 4, 'F')
  doc.text('Rangos de Edad de Emisión', margin + 2, y)
  doc.text('Tasa Bruta (por mil)', margin + 62, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 60, 4, 'S')
  doc.rect(margin + 60, y - 3, 40, 4, 'S')
  doc.text('18 – 55 años', margin + 2, y)
  doc.text('0,34', margin + 62, y)
  y += 4
  doc.rect(margin, y - 3, 60, 4, 'S')
  doc.rect(margin + 60, y - 3, 40, 4, 'S')
  doc.text('56 – 65 años', margin + 2, y)
  doc.text('0,34', margin + 62, y)
  y += 6

  // Ejemplo de cálculo
  doc.text(`Por ejemplo, un asegurado de 50 años, con una deuda inicial de $30.000.000, y un crédito a 36 meses:`, margin, y)
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.text('Prima Única = $30.000.000 * 0,34/1000 * 36 = $367.200 Pesos', margin, y)
  y += 8

  // Exclusiones
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Exclusiones', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Exclusiones Cobertura de Desgravamen (POL220150573, Artículo N°4)', margin, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Este seguro no cubre el riesgo de muerte si el fallecimiento del Asegurado fuere causado por:', margin, y)
  y += 4
  doc.text('a) Guerra, terrorismo o cualquier conflicto armado.', margin + 5, y)
  y += 3
  doc.text('b) Suicidio. No obstante, esta exclusión cesará si hubieren transcurrido 2 años completos e ininterrumpidos de cobertura', margin + 5, y)
  y += 3
  doc.text('    desde la contratación.', margin + 5, y)
  y += 3
  doc.text('c) Acto delictivo cometido, en calidad de autor o cómplice, por el asegurado.', margin + 5, y)
  y += 3
  doc.text('d) Energía atómica o nuclear.', margin + 5, y)
  y += 8

  // Procedimiento de Denuncia de Siniestro
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Procedimiento de Denuncia de Siniestro', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const denunciaText = 'En caso de consultas, reclamos y denuncias de siniestro, el asegurado se deberá comunicar al teléfono 600 600 4490. En todos los casos la compañía se reserva el derecho de pedir mayores antecedentes para la liquidación del siniestro. En todas las denuncias deberá dejarse constancia del nombre, dirección y teléfono de la persona denunciante para posteriores contactos que sean necesarios.'
  const denunciaLines = doc.splitTextToSize(denunciaText, contentWidth)
  doc.text(denunciaLines, margin, y)
  y += denunciaLines.length * 3 + 3

  doc.text('Para efectuar el denuncio de un siniestro, se deberá presentar al asegurador los siguientes antecedentes junto al formulario "Denuncio de Siniestros":', margin, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.text('Cobertura Fallecimiento', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('• Certificado de defunción original con causa de muerte.', margin + 5, y)

  // ===================== CUERPO - PAGE 8 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Formulario de denuncio de siniestro', margin, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('• Fotocopia de la cédula de identidad del asegurado.', margin + 5, y)
  y += 3
  doc.text('• En caso de muerte presunta, ésta deberá acreditarse de conformidad a la ley.', margin + 5, y)
  y += 3
  doc.text('• Certificado de saldo de la deuda, emitido por la entidad contratante a la fecha de fallecimiento del deudor.', margin + 5, y)
  y += 3
  doc.text('• Otros antecedentes que se estimen convenientes y necesarios para la evaluación del siniestro.', margin + 5, y)
  y += 8

  // Plazo de Pago de Siniestros
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Plazo de Pago de Siniestros', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const plazoText = 'El período de liquidación y pago de siniestro, a contar de la fecha de recepción conforme a todos los antecedentes indicados en la póliza, no podrá exceder de 15 días hábiles. Tratándose de siniestros que no vengan acompañados de la documentación pertinente o en que se requiera de un mayor análisis, la Compañía se reserva el derecho de contabilizar este plazo desde que se reciban tales antecedentes o los exigidos en forma excepcional. En este último evento, la Compañía deberá informar al Corredor a más tardar dentro de los 15 días hábiles siguientes a la presentación del siniestro.'
  const plazoLines = doc.splitTextToSize(plazoText, contentWidth)
  doc.text(plazoLines, margin, y)
  y += plazoLines.length * 3 + 8

  // Comisiones
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Comisiones', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Recaudador: TDV SERVICIOS SPA, Rut: 78.168.126-1', margin, y)
  y += 4
  doc.text('Comisión de Cobranza: 35% + IVA sobre la prima recaudada', margin, y)
  y += 4
  doc.text('Corredor: PRIME CORREDORES DE SEGUROS SPA, Rut: 76.196.802-5', margin, y)
  y += 4
  doc.text('Comisión de Intermediación: 15% + IVA sobre la prima recaudada', margin, y)
  y += 4
  doc.text('Comisión CEF: Se calculará de acuerdo a la siguiente fórmula.', margin, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.text('Primero:', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('Resultado AUG Pre CEF t = Prima Cliente Bruta t - Comisión de Recaudación Bruta t - Comisión de Intermediación Bruta t – Siniestros t – IBNR t - Costos de Liq. de Siniestros t – Costos Fijos t', margin, y)
  y += 3
  doc.text('Resultado AUG tras CEF t = Resultado AUG Pre CEF t x 10%', margin, y)
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('Segundo:', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('CEF t = Resultado Bruto Pre CEF t × 10% - Pérdida Acarreada t-1 (*)', margin, y)
  y += 3
  doc.text('Existirá Pérdida Acarreada t-1 solo en caso de que en el ejercicio anterior se produzca lo siguiente: Resultado AUG Pre CEF t < 0', margin, y)
  y += 3
  doc.text('Dónde: Costos Fijos t = 3% * Prima Cliente Bruta t', margin, y)
  y += 8

  // Notas Importantes - Declaraciones y Condiciones
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Notas Importantes - DECLARACIONES Y CONDICIONES', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('1. El Contratante declara que se encuentra debidamente mandatado por el Asegurado para suscribir la presente Solicitud de', margin, y)
  y += 3
  doc.text('   Incorporación, Propuesta y Certificado de Cobertura, así como para realizar el pago de la prima única correspondiente.', margin, y)
  y += 3
  doc.text('   Asimismo, declara que el Asegurado:', margin, y)
  y += 3
  doc.text('   a) Ha sido previa y completamente informado y ha aceptado las condiciones señaladas en esta Solicitud de Incorporación.', margin + 5, y)
  y += 3
  doc.text('   b) Ha tomado conocimiento de su derecho a decidir libremente sobre la contratación voluntaria del seguro.', margin + 5, y)
  y += 3
  doc.text('   c) Ha ejercido su derecho a la libre elección de la compañía aseguradora.', margin + 5, y)
  y += 5

  doc.text('2. Vigencia de las Coberturas. Las coberturas tendrán vigencia desde la firma de esta Solicitud de Incorporación por parte del', margin, y)
  y += 3
  doc.text('   Contratante. En este caso, la presente solicitud hará las veces de Certificado de Cobertura conforme a lo dispuesto en la', margin, y)
  y += 3
  doc.text('   Circular N° 2123 de la Comisión para el Mercado Financiero.', margin, y)

  // ===================== CUERPO - PAGE 9 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const notaResumen = 'La presente Solicitud de Incorporación, Propuesta y Certificado de Cobertura constituye un resumen con la descripción general del seguro, sus coberturas y el procedimiento a seguir en caso de siniestro. Dicho resumen es parcial y no reemplaza las condiciones particulares ni generales de la respectiva póliza, teniendo únicamente carácter informativo.'
  const notaResumenLines = doc.splitTextToSize(notaResumen, contentWidth)
  doc.text(notaResumenLines, margin, y)
  y += notaResumenLines.length * 3 + 3

  doc.text('En caso de requerir copia de las Condiciones Generales y Particulares del seguro, el cliente deberá solicitarlas al Contratante Colectivo de la póliza.', margin, y)
  y += 8

  // 3. Vigencia de la Póliza Colectiva
  doc.setFont('helvetica', 'bold')
  doc.text('3. Vigencia de la Póliza Colectiva.', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  const vigenciaPolizaText = 'La póliza colectiva tendrá vigencia desde el 01 de diciembre de 2025 hasta el 30 de noviembre de 2028, renovándose tácita y sucesivamente en los mismos términos por períodos de un (1) año cada uno, salvo voluntad en contrario manifestada por el Contratante o la Aseguradora, según corresponda, mediante carta certificada notarial enviada al domicilio de la parte respectiva.'
  const vigenciaPolizaLines = doc.splitTextToSize(vigenciaPolizaText, contentWidth)
  doc.text(vigenciaPolizaLines, margin, y)
  y += vigenciaPolizaLines.length * 3 + 5

  // 4. Vigencia de la Cobertura Individual
  doc.setFont('helvetica', 'bold')
  doc.text('4. Vigencia de la Cobertura Individual.', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  const vigenciaCoberturaText = 'Para aquellas personas que cumplan con los requisitos de asegurabilidad, la cobertura comenzará a regir desde la fecha de firma de la Solicitud de Incorporación y se mantendrá vigente hasta la extinción del crédito de consumo otorgado por la entidad acreedora.'
  const vigenciaCoberturaLines = doc.splitTextToSize(vigenciaCoberturaText, contentWidth)
  doc.text(vigenciaCoberturaLines, margin, y)
  y += vigenciaCoberturaLines.length * 3 + 5

  // 5. Término Anticipado de la Cobertura
  doc.setFont('helvetica', 'bold')
  doc.text('5. Término Anticipado de la Cobertura.', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('Las coberturas de esta póliza terminarán anticipadamente respecto de un Asegurado en los siguientes casos:', margin, y)
  y += 4
  doc.text('5.1. En caso de renegociación, anulación o prepago del crédito de consumo.', margin + 5, y)
  y += 3
  doc.text('5.2. Al momento en que el Asegurado cumpla la edad máxima de permanencia establecida en las Condiciones Particulares de la póliza.', margin + 5, y)
  y += 3
  doc.text('5.3. En el instante en que el Asegurado deje de tener la calidad de deudor del Acreedor.', margin + 5, y)
  y += 8

  // Disposiciones Finales
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Disposiciones Finales', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Código de Autorregulación', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const autoregText = 'La compañía de seguros Augustar Seguros de Vida S.A. se encuentra adherida voluntariamente al código de autorregulación y al compendio de buenas prácticas de las compañías de seguros, cuyo propósito es propender al desarrollo del mercado de los seguros, en consonancia con los principios de libre competencia y buena fe que debe existir entre las empresas, y entre éstas y sus clientes. Copia del compendio de buenas prácticas corporativas de las compañías de seguros, se encuentra a disposición de los interesados en las oficinas de Augustar Seguros de Vida S.A. y en www.aach.cl'
  const autoregLines = doc.splitTextToSize(autoregText, contentWidth)
  doc.text(autoregLines, margin, y)
  y += autoregLines.length * 3 + 3

  const defensorText = 'Asimismo, Augustar Seguros de Vida S.A. se encuentra adherida voluntariamente a la institución del Defensor del Asegurado dependiente del Consejo de Autorregulación de las Compañías de Seguros, y cuya finalidad es velar por el desarrollo del mercado de seguros bajo el principio de buena fe, debiendo conforme a sus estatutos conocer y resolver los conflictos y/o reclamos que pudieran producirse entre las Compañías y sus clientes. Para mayor información, ésta se encuentra disponible en www.ddachile.cl; teléfono 800 646 232, desde celulares 22 234 3583, o bien En Augusto Leguía Sur N° 79, oficina 1210, Las Condes.'
  const defensorLines = doc.splitTextToSize(defensorText, contentWidth)
  doc.text(defensorLines, margin, y)
  y += defensorLines.length * 3 + 6

  // Información sobre atención de clientes
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Información sobre atención de clientes y presentación de consultas y reclamos', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const atencionText = 'En virtud de la circular nro. 2.131 de 28 de noviembre de 2013, las compañías de seguros, corredores de seguros y liquidadores de siniestros, deberán recibir, registrar y responder todas las presentaciones, consultas o reclamos que se les presenten directamente por el contratante, asegurado, beneficiarios o legítimos interesados o sus mandatarios.'
  const atencionLines = doc.splitTextToSize(atencionText, contentWidth)
  doc.text(atencionLines, margin, y)
  y += atencionLines.length * 3 + 2

  doc.text('Las presentaciones pueden ser efectuadas en todas las oficinas de las entidades que se atienda público, presencialmente, por correo postal, medios electrónicos, o telefónicamente, sin formalidades, en el horario normal de atención.', margin, y)

  // ===================== CUERPO - PAGE 10 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const contactoText = 'En caso de consultas y/o reclamos y, el Asegurado debe comunicarse con el Servicio de Atención al Cliente de Augustar Seguros de Vida S.A., número 600 600 4490 o correo electrónico svida@augustarseguros.cl. El Asegurado también puede enviar su consulta o solicitud al Servicio de Atención al Cliente de TDV SERVICIOS SPA. vía WhatsApp al +56973973802 o al correo electrónico contacto@tedevuelvo.cl'
  const contactoLines = doc.splitTextToSize(contactoText, contentWidth)
  doc.text(contactoLines, margin, y)
  y += contactoLines.length * 3 + 3

  doc.text('Recibida una presentación, consulta o reclamo, ésa deberá ser respondida en el plazo más breve posible, el que no podrá exceder de 20 días hábiles contados desde su recepción.', margin, y)
  y += 6

  const cmfText = 'Interesado, en caso de disconformidad respecto de lo informado, o bien cuando exista demora injustificada de la respuesta, podrá recurrir a la Comisión Para el Mercado Financiero, área de protección al inversionista y asegurado, cuyas oficinas se encuentran ubicadas en avda. Libertador Bernardo O\'Higgins 1449 piso 1, Santiago, o a través del sitio web www.cmfchile.cl.'
  const cmfLines = doc.splitTextToSize(cmfText, contentWidth)
  doc.text(cmfLines, margin, y)
  y += cmfLines.length * 3 + 8

  // Autorización para el Tratamiento de Datos Personales
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Autorización para el Tratamiento de Datos Personales', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const datosText = 'Por este acto, y según lo dispuesto en la Ley N°19.628 sobre protección de la vida privada y sus modificaciones, doy mi consentimiento y autorización expresa a Augustar Seguros de Vida S.A. y sus representantes, sucesores y cesionarios puedan proceder a la transmisión o transferencia de todos o parte de los datos personales e información que declaro haber entregado voluntariamente a esta y/o puesto voluntariamente a su disposición, a cualesquiera terceros prestadores de servicios que estuvieren ubicados dentro o fuera de chile, para efectos del presente contrato de seguro y, en particular, para poder hacer efectivo el (los) beneficio (s) que pudieren estar asociados al seguro contratado.'
  const datosLines = doc.splitTextToSize(datosText, contentWidth)
  doc.text(datosLines, margin, y)
  y += datosLines.length * 3 + 10

  // Firmas
  doc.setFontSize(8)
  
  // Agregar firma TDV
  if (firmaTdvBase64) {
    doc.addImage(firmaTdvBase64, 'PNG', margin + 5, y, 25, 15)
  }
  
  // Agregar firma AuguStar
  if (firmaBase64) {
    doc.addImage(firmaBase64, 'JPEG', 78, y, 25, 15)
  }
  y += 18
  
  // Líneas de firma
  doc.text('_______________________', margin, y)
  doc.text('_______________________', 75, y)
  doc.text('_______________________', 145, y)
  
  y += 4
  doc.setFontSize(7)
  doc.text('TDV SERVICIOS SPA', margin, y)
  doc.text('AuguStar Seguros de Vida S.A.', 75, y)
  doc.text('Asegurado', 145, y)

  // ===================== PAGE 11 - PROCEDIMIENTO DE LIQUIDACIÓN DE SINIESTROS (Circular N°2106 CMF) =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('(Circular N°2106 Comisión Para el Mercado Financiero)', margin, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('PROCEDIMIENTO DE LIQUIDACIÓN DE SINIESTROS', margin + 2, y)
  y += 10

  // 1) OBJETO DE LA LIQUIDACIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('1) OBJETO DE LA LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const objeto1Text = 'La liquidación tiene por fin establecer la ocurrencia de un siniestro, determinar si el siniestro está cubierto en la póliza contratada en una compañía de seguros determinada, y cuantificar el monto de la pérdida y de la indemnización a pagar.'
  const objeto1Lines = doc.splitTextToSize(objeto1Text, contentWidth)
  doc.text(objeto1Lines, margin, y)
  y += objeto1Lines.length * 3 + 2

  doc.text('El procedimiento de liquidación está sometido a los principios de celeridad y economía procedimental, de objetividad y carácter técnico y de transparencia y acceso.', margin, y)
  y += 8

  // 2) FORMA DE EFECTUAR LA LIQUIDACIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('2) FORMA DE EFECTUAR LA LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const forma2Text = 'La liquidación puede efectuarla directamente la Compañía o encomendarla a un Liquidador de Seguros. La decisión debe comunicarse al Asegurado dentro del plazo de tres días hábiles contados desde la fecha de la denuncia del siniestro.'
  const forma2Lines = doc.splitTextToSize(forma2Text, contentWidth)
  doc.text(forma2Lines, margin, y)
  y += forma2Lines.length * 3 + 5

  // 3) DERECHO DE OPOSICIÓN A LA LIQUIDACIÓN DIRECTA
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('3) DERECHO DE OPOSICIÓN A LA LIQUIDACIÓN DIRECTA', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const oposicion3Text = 'En caso de liquidación directa por la compañía, el Asegurado o beneficiario puede oponerse a ella, solicitándole por escrito que designe un Liquidador de Seguros, dentro del plazo de cinco días hábiles contados desde la notificación de la comunicación de la Compañía. La Compañía deberá designar al Liquidador en el plazo de dos días hábiles contados desde dicha oposición.'
  const oposicion3Lines = doc.splitTextToSize(oposicion3Text, contentWidth)
  doc.text(oposicion3Lines, margin, y)
  y += oposicion3Lines.length * 3 + 5

  // 4) INFORMACIÓN AL ASEGURADO DE GESTIONES A REALIZAR Y PETICION DE ANTECEDENTES
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('4) INFORMACIÓN AL ASEGURADO DE GESTIONES A REALIZAR Y PETICION DE ANTECEDENTES', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const info4Text = 'El Liquidador o la Compañía deberá informar al Asegurado, por escrito, en forma suficiente y oportuna, al correo electrónico (informado en la denuncia del siniestro) o por carta certificada (al domicilio señalado en la denuncia de siniestro), de las gestiones que le corresponde realizar, solicitando de una sola vez, cuando las circunstancias lo permitan, todos los antecedentes que requiere para liquidar el siniestro.'
  const info4Lines = doc.splitTextToSize(info4Text, contentWidth)
  doc.text(info4Lines, margin, y)
  y += info4Lines.length * 3 + 5

  // 5) PRE-INFORME DE LIQUIDACIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('5) PRE-INFORME DE LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const preinforme5Text = 'En aquellos siniestros en que surgieren problemas y diferencias de criterios sobre sus causas, evaluación del riesgo o extensión de la cobertura, podrá el Liquidador, actuando de oficio o a petición del Asegurado, emitir un pre-informe de liquidación sobre la cobertura del siniestro y el monto de los daños producidos, el que deberá ponerse en conocimiento de los interesados. El asegurado o la Compañía podrán hacer observaciones por escrito al pre-informe dentro del plazo de cinco días hábiles desde su conocimiento.'
  const preinforme5Lines = doc.splitTextToSize(preinforme5Text, contentWidth)
  doc.text(preinforme5Lines, margin, y)
  y += preinforme5Lines.length * 3 + 5

  // 6) PLAZO DE LIQUIDACIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('6) PLAZO DE LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Dentro del más breve plazo, no pudiendo exceder de 45 días corridos desde fecha denuncio, a excepción de;', margin, y)
  y += 4
  doc.text('a) Siniestros que correspondan a seguros individuales sobre riesgos del Primer Grupo cuya prima anual sea superior a 100 UF: 90 días corridos desde fecha denuncio;', margin + 5, y)
  y += 3
  doc.text('b) Siniestros marítimos que afecten a los cascos o en caso de Avería Gruesa: 180 días corridos desde fecha denuncio.', margin + 5, y)
  y += 8

  // 7) PRORROGA DEL PLAZO DE LIQUIDACIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('7) PRORROGA DEL PLAZO DE LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const prorroga7Text = 'Los plazos antes señalados podrán, excepcionalmente siempre que las circunstancias lo ameriten, prorrogarse, sucesivamente por iguales períodos, informando los motivos que la fundamenten e indicando las gestiones concretas y específicas que se realizarán, lo que deberá comunicarse al Asegurado y a la Comisión Para el Mercado Financiero, pudiendo esta última dejar sin efecto la ampliación, en casos calificados, y fijar un plazo para entrega del Informe de Liquidación. No podrá ser motivo de prórroga la solicitud de nuevos antecedentes cuyo requerimiento pudo preverse con anterioridad, salvo que se indiquen las razones que justifiquen la falta de requerimiento, ni podrán prorrogarse los siniestros en que no haya existido gestión alguna del liquidador, registrado o directo.'
  const prorroga7Lines = doc.splitTextToSize(prorroga7Text, contentWidth)
  doc.text(prorroga7Lines, margin, y)
  y += prorroga7Lines.length * 3 + 5

  // 8) INFORME FINAL DE LIQUIDACIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('8) INFORME FINAL DE LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const informe8Text = 'El informe final de liquidación deberá remitirse al Asegurado y simultáneamente al Asegurador, cuando corresponda, y deberá contener necesariamente la transcripción íntegra de los artículos 26 y 27 del Reglamento de Auxiliares del Comercio de Seguros (D.S. de Hacienda Nº 1.055 de 2012, Diario Oficial de 29 de diciembre de 2012).'
  const informe8Lines = doc.splitTextToSize(informe8Text, contentWidth)
  doc.text(informe8Lines, margin, y)
  y += informe8Lines.length * 3 + 5

  // 9) IMPUGNACION INFORME DE LIQUIDACIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('9) IMPUGNACION INFORME DE LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const impugnacion9Text = 'Recibido el informe de Liquidación, la Compañía y el Asegurado dispondrán de un plazo de diez días hábiles para impugnarla. En caso de liquidación directa por la Compañía, este derecho sólo lo tendrá el Asegurado.'
  const impugnacion9Lines = doc.splitTextToSize(impugnacion9Text, contentWidth)
  doc.text(impugnacion9Lines, margin, y)
  y += impugnacion9Lines.length * 3 + 2

  doc.text('Impugnado el informe, el Liquidador o la compañía dispondrá de un plazo de 6 días hábiles para responder la impugnación.', margin, y)

  // Download
  const fileName = `Certificado_BancoChile_Prime_${config.numero}_${refund.rut.replace(/\./g, '').replace('-', '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

/**
 * Genera el PDF de la Póliza 342 (Standard) para Banco de Chile
 * Créditos ≤ 20.000.000 CLP
 * Documento legal conforme a Caratula y Cuerpo Póliza 342
 */
export const generateBancoChileStandardPDF = async (
  refund: RefundRequest,
  formData: BancoChileCertificateData,
  firmaBase64: string,
  firmaTdvBase64: string,
  firmaCngBase64: string
): Promise<void> => {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = 15

  const config = BANCO_CHILE_CONFIG.poliza342

  const drawCheckbox = (x: number, yPos: number, checked: boolean = false) => {
    doc.setDrawColor(0)
    doc.setLineWidth(0.3)
    doc.rect(x, yPos - 2.5, 4, 4, 'S')
    if (checked) {
      doc.setFont('helvetica', 'bold')
      doc.text('X', x + 0.8, yPos)
    }
  }

  const drawBox = (x: number, yPos: number, w: number, h: number, filled: boolean = false): void => {
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.3)
    if (filled) {
      doc.setFillColor(0, 0, 0)
      doc.rect(x, yPos - 2.5, w, h, 'F')
    } else {
      doc.rect(x, yPos - 2.5, w, h, 'S')
    }
  }

  // Valores calculados - Prima Única usa newMonthlyPremium × remainingInstallments del snapshot, o calcula con TBM
  const saldoInsoluto = parseSaldoInsoluto(formData.saldoInsoluto)
  const nperValue = refund.calculationSnapshot?.remainingInstallments || 0
  const ageValue = refund.calculationSnapshot?.age
  const tcValue = getTasaBrutaMensual342(ageValue)
  
  // Prima Única: primero intentar desde snapshot (newMonthlyPremium × remainingInstallments), luego calcular
  let primaUnica: number
  const newMonthlyPremium = refund.calculationSnapshot?.newMonthlyPremium
  if (typeof newMonthlyPremium === 'number' && newMonthlyPremium > 0 && nperValue > 0) {
    primaUnica = Math.round(newMonthlyPremium * nperValue)
    console.log('Banco Chile Standard PDF - Prima Única desde snapshot:', { newMonthlyPremium, nperValue, primaUnica })
  } else {
    primaUnica = Math.round(saldoInsoluto * (tcValue / 1000) * nperValue)
    console.log('Banco Chile Standard PDF - Prima Única calculada con TBM:', { saldoInsoluto, tcValue, nperValue, primaUnica })
  }
  const saldoInsolutoFormatted = `$${saldoInsoluto.toLocaleString('es-CL')}`

  // ===================== CARÁTULA - PAGE 1 =====================
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('CÓDIGOS CMF DE LA PÓLIZA', margin, y)
  doc.text('PÓLIZA N°', pageWidth - margin - 40, y)
  y += 5
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.rect(margin, y - 3, 60, 6, 'S')
  doc.text(config.codigoCMF, margin + 2, y + 1)
  doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
  doc.text(config.numero, pageWidth - margin - 38, y + 1)
  y += 12

  // CONTRATANTE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CONTRATANTE (SI ES DISTINTO DEL ASEGURADO)', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 90, 6, 'S')
  doc.text('TDV SERVICIOS SPA', margin + 2, y + 1)
  doc.text('RUT: 78.168.126-1', margin + 95, y + 1)
  y += 12

  // ASEGURADO
  doc.setFont('helvetica', 'bold')
  doc.text('ASEGURADO', margin, y)
  doc.text('RUT', pageWidth - margin - 40, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 90, 6, 'S')
  doc.text(refund.fullName || '', margin + 2, y + 1)
  doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
  doc.text(refund.rut || '', pageWidth - margin - 38, y + 1)
  y += 12

  // TIPO DE PÓLIZA
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
  y += 10

  // PÓLIZA section with VIGENCIA and RENOVACIÓN
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
  doc.text(config.vigenciaInicio, margin + 37, y)
  doc.text('Inicio', margin + 70, y)
  drawCheckbox(margin + 100, y, true)
  doc.text('SI', margin + 107, y)
  y += 6

  drawCheckbox(margin, y, true)
  doc.text('Colectiva', margin + 7, y)
  doc.rect(margin + 35, y - 3, 30, 5, 'S')
  doc.text(config.vigenciaFin, margin + 37, y)
  doc.text('Termino', margin + 70, y)
  drawCheckbox(margin + 100, y, false)
  doc.text('NO', margin + 107, y)
  y += 12

  // PLAN and PRIMA - Póliza 342 (Standard) = Plan 1
  const primaUnicaFormatted = `$${primaUnica.toLocaleString('es-CL')}`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PLAN', margin, y)
  doc.text('PRIMA Monto', margin + 50, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  drawCheckbox(margin, y, true)
  doc.text('Plan 1', margin + 7, y)
  doc.rect(margin + 50, y - 3, 40, 5, 'S')
  doc.text(primaUnicaFormatted, margin + 52, y)
  y += 6
  drawCheckbox(margin, y, false)
  doc.text('Plan 2', margin + 7, y)
  doc.rect(margin + 50, y - 3, 40, 5, 'S')
  y += 12

  // MONEDA, PERIODO DE PAGO, CONDICIONES, COMISIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('MONEDA', margin, y)
  doc.text('PERIODO DE PAGO', margin + 30, y)
  doc.text('CONDICIONES', margin + 75, y)
  doc.text('COMISIÓN TOTAL CORREDOR', margin + 120, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  drawCheckbox(margin, y, false)
  doc.text('UF', margin + 7, y)
  drawCheckbox(margin + 30, y, false)
  doc.text('Anual', margin + 37, y)
  drawCheckbox(margin + 75, y, true)
  doc.text('Fija', margin + 82, y)
  y += 5
  drawCheckbox(margin, y, true)
  doc.text('Peso', margin + 7, y)
  drawCheckbox(margin + 30, y, false)
  doc.text('Mensual', margin + 37, y)
  drawCheckbox(margin + 75, y, false)
  doc.text('Ajustable Según Contrato', margin + 82, y)
  y += 5
  drawCheckbox(margin, y, false)
  doc.text('Otra', margin + 7, y)
  drawCheckbox(margin + 30, y, true)
  doc.text('Otro', margin + 37, y)

  // ===================== CARÁTULA - PAGE 2 =====================
  doc.addPage()
  y = 15

  // COBERTURAS
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
  doc.text(saldoInsolutoFormatted, margin + 62, y)
  doc.rect(margin + 98, y - 3, 15, 5, 'S')
  doc.text('CLP', margin + 100, y)
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 6

  drawCheckbox(margin, y, false)
  doc.text('Invalidez T&P 2/3', margin + 7, y)
  doc.rect(margin + 60, y - 3, 35, 5, 'S')
  doc.rect(margin + 98, y - 3, 15, 5, 'S')
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 6

  drawCheckbox(margin, y, false)
  doc.text('Sobrevivencia', margin + 7, y)
  doc.rect(margin + 60, y - 3, 35, 5, 'S')
  doc.rect(margin + 98, y - 3, 15, 5, 'S')
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 6

  drawCheckbox(margin, y, false)
  doc.text('Muerte Accidental', margin + 7, y)
  doc.rect(margin + 60, y - 3, 35, 5, 'S')
  doc.rect(margin + 98, y - 3, 15, 5, 'S')
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 8

  doc.setFontSize(7)
  doc.text('Esta póliza contiene otras coberturas adicionales, cuyo detalle debe ser consultado en las condiciones particulares.', margin, y)
  y += 12

  // BENEFICIARIOS
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
  y += 8

  // BENEFICIARIO IRREVOCABLE - campo del documento legal (Póliza 342)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('BENEFICIARIO IRREVOCABLE:', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Nombre: ${formData.beneficiarioNombre || ''}`, margin + 5, y)
  y += 4
  doc.text(`RUT: ${formData.beneficiarioRut || ''}`, margin + 5, y)
  y += 8

  // CONDICIONES ESPECIALES
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
  y += 10

  // PERIODO DE CARENCIA
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PERIODO DE CARENCIA', margin, y)
  doc.text('ART. CG', margin + 120, y)
  doc.text('ART. CP', margin + 145, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.rect(margin, y - 3, 50, 5, 'S')
  doc.text('NO APLICA', margin + 2, y)
  doc.rect(margin + 120, y - 3, 15, 5, 'S')
  doc.rect(margin + 145, y - 3, 15, 5, 'S')
  y += 10

  // EXCLUSIONES
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
  y += 12

  // SISTEMA DE NOTIFICACIÓN
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('SISTEMA DE NOTIFICACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('El asegurado ha autorizado a la compañía para efectuar las notificaciones asociadas a esta póliza por el siguiente medio:', margin, y)
  y += 6
  doc.setFontSize(8)
  drawCheckbox(margin, y, true)
  doc.text('e-mail al correo electrónico', margin + 7, y)
  doc.rect(margin + 55, y - 3, 80, 5, 'S')
  doc.text(refund.email || '', margin + 57, y)

  // ===================== CARÁTULA - PAGE 3 =====================
  doc.addPage()
  y = 15

  drawCheckbox(margin, y, true)
  doc.text('Carta a la siguiente dirección', margin + 7, y)
  doc.rect(margin + 60, y - 3, 100, 5, 'S')
  doc.text(formData.direccion || '', margin + 62, y)
  y += 6
  drawCheckbox(margin, y, false)
  doc.text('Otro', margin + 7, y)
  y += 10

  doc.setFontSize(6)
  const notaCaratula = 'La presente carátula es un resumen de la información más relevante de la póliza y los conceptos fundamentales se encuentran definidos al reverso. Para una comprensión integral, se debe consultar las condiciones generales y particulares de la póliza. En cada punto se señala el artículo del condicionado general (CG) o condicionado particular (CP) donde puede revisarse el detalle respectivo.'
  const notaCaratulaLines = doc.splitTextToSize(notaCaratula, contentWidth)
  doc.text(notaCaratulaLines, margin, y)
  y += notaCaratulaLines.length * 2.5 + 5

  const nota1Caratula = 'Nota 1: El asegurado tiene la obligación de entregar la información que la compañía requiera acerca de su estado de riesgo, en los casos y en la forma que determina la normativa vigente. La infracción a esta obligación puede acarrear la terminación del contrato o que no sea pagado el siniestro.'
  const nota1CaratulaLines = doc.splitTextToSize(nota1Caratula, contentWidth)
  doc.text(nota1CaratulaLines, margin, y)
  y += nota1CaratulaLines.length * 2.5 + 5

  const nota2Caratula = 'Nota 2: (Para Seguros Colectivos) Importante. "Usted está solicitando su incorporación como asegurado a una póliza o contrato de seguro colectivo cuyas condiciones han sido convenidas por TDV SERVICIOS SPA directamente con la compañía de seguros Augustar Seguros de Vida S.A.'
  const nota2CaratulaLines = doc.splitTextToSize(nota2Caratula, contentWidth)
  doc.text(nota2CaratulaLines, margin, y)
  y += nota2CaratulaLines.length * 2.5 + 5

  const nota3Caratula = 'Nota 3: Póliza es de prima única y se encuentra pagada en su totalidad a la compañía de seguros Augustar Seguros de Vida S.A.'
  const nota3CaratulaLines = doc.splitTextToSize(nota3Caratula, contentWidth)
  doc.text(nota3CaratulaLines, margin, y)
  y += nota3CaratulaLines.length * 2.5 + 10

  // DEFINICIONES
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('DEFINICIONES', margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)

  const definitions = [
    { term: 'CÓDIGO CMF DE LA PÓLIZA:', desc: 'Es el Código con que la póliza fue depositada en la Comisión para el Mercado Financiero, conocido también como "código Pol". Si la póliza incluye más de uno, se incluye sólo el de la cobertura principal.' },
    { term: 'PÓLIZA:', desc: 'Documento justificativo del seguro.' },
    { term: 'CERTIFICADO DE COBERTURA:', desc: 'Documento que da cuenta de un seguro emitido con sujeción a los términos de una póliza de seguro colectivo.' },
    { term: 'CONTRATANTE:', desc: 'La persona que contrata el seguro con la compañía aseguradora y sobre quien recaen, en general, las obligaciones y cargas del contrato. Puede ser una persona diferente al asegurado.' },
    { term: 'ASEGURADO:', desc: 'La persona a quien afecta el riesgo que se transfiere a la compañía aseguradora.' },
    { term: 'BENEFICIARIO:', desc: 'La persona que, aun sin ser asegurado, tiene derecho a la indemnización en caso de siniestro.' },
    { term: 'TIPO DE PÓLIZA:', desc: 'Según si tiene o no asociada una cuenta única de inversión.' },
    { term: 'VIGENCIA:', desc: 'Tiempo durante el cual se extiende la cobertura de riesgo de la póliza contratada.' },
    { term: 'RENOVACIÓN:', desc: 'Se refiere a si la póliza se extingue al vencimiento de su plazo o si se renueva.' },
    { term: 'PRIMA:', desc: 'El precio que se cobra por el seguro. Éste incluye los adicionales, en su caso.' },
    { term: 'CONDICIONES DE PRIMA:', desc: 'La prima puede ser fija, si el monto es el mismo durante toda la vigencia de la póliza, o puede ser ajustable.' },
    { term: 'COMISIÓN CORREDOR:', desc: 'Es la parte de la prima que recibe un corredor de seguros, que ha vendido el seguro por cuenta de la compañía.' },
  ]

  definitions.forEach(def => {
    doc.setFont('helvetica', 'bold')
    doc.text(def.term, margin, y)
    const termWidth = doc.getTextWidth(def.term)
    doc.setFont('helvetica', 'normal')
    const descLines = doc.splitTextToSize(def.desc, contentWidth - termWidth - 3)
    doc.text(descLines[0], margin + termWidth + 2, y)
    if (descLines.length > 1) {
      y += 2.5
      for (let i = 1; i < descLines.length; i++) {
        doc.text(descLines[i], margin, y)
        y += 2.5
      }
    }
    y += 3
  })

  // ===================== CARÁTULA - PAGE 4 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('COBERTURA', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('El tipo de riesgo cubierto por la póliza.', margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('CARENCIA', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('Período establecido en la póliza durante el cual no rige la cobertura del seguro.', margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('EXCLUSIONES', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('Aquellos riesgos especificados en la póliza que no son cubiertos por el seguro.', margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('CONDICIONES ESPECIALES DE ASEGURABILIDAD', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('Son los requisitos específicos que debe cumplir el asegurado para que la compañía cubra el riesgo y pague el seguro, en caso de siniestro.', margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('SISTEMA DE NOTIFICACIÓN', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  const sistemaNotifText = 'Sistema de comunicación que el cliente autoriza para que la compañía le efectúe todas las notificaciones requeridas conforme a la póliza o que la compañía requiera realizar. Es responsabilidad del cliente actualizar los datos cuando exista un cambio en ellos.'
  const sistemaNotifLines = doc.splitTextToSize(sistemaNotifText, contentWidth)
  doc.text(sistemaNotifLines, margin, y)
  y += sistemaNotifLines.length * 2.5 + 10

  // ===================== CUERPO - PAGE 1 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('SOLICITUD DE INCORPORACIÓN, PROPUESTA Y CERTIFICADO DE COBERTURA INMEDIATA', pageWidth / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(10)
  doc.text('SEGURO DE DESGRAVAMEN', pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Fecha: ${getTodayFormatted()}`, margin, y)
  doc.text(`Folio: ${formData.folio || '____________'}`, 70, y)
  doc.text(`Nro. Póliza: ${config.numero}`, 140, y)
  y += 8

  // Certificado de Cobertura
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setFillColor(220, 220, 220)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Certificado de Cobertura', margin + 2, y)
  y += 8

  // Identificación del Asegurado Titular
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Identificación del Asegurado Titular', margin + 2, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Nombre:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.fullName || '', margin + 18, y)
  doc.setFont('helvetica', 'normal')
  doc.text('RUT:', 115, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.rut || '', 125, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Fecha Nacimiento:', 155, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formatDate(refund.calculationSnapshot?.birthDate), 180, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Dirección:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.direccion || '', margin + 22, y)
  doc.setFont('helvetica', 'normal')
  doc.text('N°:', 115, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.numero || '', 122, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Depto/Block:', 145, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.depto || '', 168, y)
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
  doc.text('Teléfono:', 115, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.phone || '-', 133, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Celular:', 160, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.celular || '', 178, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Sexo:', margin, y)
  drawBox(margin + 15, y, 3, 3, formData.sexo === 'M')
  doc.text('M', margin + 20, y)
  drawBox(margin + 35, y, 3, 3, formData.sexo === 'F')
  doc.text('F', margin + 40, y)
  y += 5

  doc.text('Correo Electrónico:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(refund.email || '', margin + 38, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Autorizo que toda comunicación y notificación que diga relación con el presente seguro me sea enviada al correo electrónico señalado en esta Solicitud de Incorporación.', margin, y)
  y += 4
  doc.setFontSize(8)
  drawBox(margin, y, 3, 3, formData.autorizaEmail === 'SI')
  doc.text('SI', margin + 5, y)
  drawBox(margin + 20, y, 3, 3, formData.autorizaEmail === 'NO')
  doc.text('NO', margin + 25, y)
  y += 7

  // Antecedentes
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Antecedentes de la Compañía Aseguradora', margin + 2, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Augustar Seguros de Vida S.A.', margin, y)
  doc.text('RUT: 76.632.384-7', 120, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Antecedentes del Contratante y Recaudador', margin + 2, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('TDV SERVICIOS SPA', margin, y)
  doc.text('RUT: 78.168.126-1', 120, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Antecedentes del Corredor', margin + 2, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(config.corredor.nombre, margin, y)
  doc.text(`RUT: ${config.corredor.rut}`, 120, y)
  y += 8

  // Datos del Seguro
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Datos del Seguro', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Saldo Insoluto*:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(`$${saldoInsoluto.toLocaleString('es-CL')}`, margin + 35, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Nro. Operación:', 120, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.nroOperacion || '', 150, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.text('Fecha Inicio del Crédito:', margin, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.fechaInicioCredito || '', margin + 42, y)
  doc.setFont('helvetica', 'normal')
  doc.text('Fecha Fin del Crédito**:', 120, y)
  doc.setFont('helvetica', 'bold')
  doc.text(formData.fechaFinCredito || '', 158, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.text('Prima Única del Seguro, Exenta de IVA = TC/1000 * MCI * nper', margin, y)
  y += 5

  doc.setFontSize(7)
  doc.text('Dónde:', margin, y)
  y += 4
  doc.text('• MCI: Monto del crédito inicial', margin + 5, y)
  y += 3
  doc.text('• TC: Tasa Comercial Bruta Mensual', margin + 5, y)
  y += 3
  doc.text('• Nper: plazo de duración del crédito, en meses', margin + 5, y)
  y += 5

  doc.text('La Tasa Bruta dependerá de la edad del asegurado, al momento de la emisión del certificado, de acuerdo con la siguiente tabla:', margin, y)
  y += 5

  // Tabla de tasas
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(230, 230, 230)
  doc.rect(margin, y - 3, 70, 5, 'F')
  doc.rect(margin + 70, y - 3, 50, 5, 'F')
  doc.text('Rangos de Edad de Emisión', margin + 2, y)
  doc.text('Tasa Bruta (por mil)', margin + 72, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 70, 5, 'S')
  doc.rect(margin + 70, y - 3, 50, 5, 'S')
  doc.text('18 – 55 años', margin + 2, y)
  doc.text('0,30', margin + 72, y)
  y += 5
  doc.rect(margin, y - 3, 70, 5, 'S')
  doc.rect(margin + 70, y - 3, 50, 5, 'S')
  doc.text('56 – 65 años', margin + 2, y)
  doc.text('0,39', margin + 72, y)
  y += 7

  // Asegurados section
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Asegurados', margin + 2, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const aseguradosText = 'Personas naturales que suscriban el respectivo documento de "Términos y Condiciones" con el contratante de esta Póliza y mantengan un crédito de consumo o automotriz vigente con un acreedor financiero, que cumplan con la edad de permanencia establecida para este producto a la fecha del siniestro, siempre que este ocurra dentro del período de vigencia de la correspondiente cobertura.'
  const aseguradosLines = doc.splitTextToSize(aseguradosText, contentWidth)
  doc.text(aseguradosLines, margin, y)

  // ===================== CUERPO - PAGE 2 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('IMPORTANTE:', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const importanteText = 'Usted está solicitando su incorporación como asegurado a una póliza o contrato de seguro colectivo cuyas condiciones han sido convenidas por TDV SERVICIOS SpA, directamente con Augustar Seguros de Vida S.A.'
  const importanteLines = doc.splitTextToSize(importanteText, contentWidth - 22)
  doc.text(importanteLines, margin + 22, y)
  y += importanteLines.length * 3 + 4

  // Detalle de Coberturas
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Detalle de Coberturas', margin + 2, y)
  y += 6

  doc.setFontSize(8)
  doc.setFillColor(230, 230, 230)
  doc.rect(margin, y - 3, 90, 5, 'F')
  doc.rect(margin + 90, y - 3, 50, 5, 'F')
  doc.text('Coberturas', margin + 2, y)
  doc.text('Código C.M.F.', margin + 92, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 90, 5, 'S')
  doc.rect(margin + 90, y - 3, 50, 5, 'S')
  doc.text('Cobertura de Fallecimiento', margin + 2, y)
  doc.text('POL 2 2015 0573', margin + 92, y)
  y += 6

  // BENEFICIARIO IRREVOCABLE en Detalle de Coberturas (Póliza 342)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('BENEFICIARIO IRREVOCABLE', margin, y)
  doc.text('Rut', margin + 100, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.rect(margin, y - 3, 95, 5, 'S')
  doc.text(formData.beneficiarioNombre || '', margin + 2, y)
  doc.rect(margin + 100, y - 3, 60, 5, 'S')
  doc.text(formData.beneficiarioRut || '', margin + 102, y)
  y += 8

  doc.text('El presente contrato no cuenta con Sello SERNAC conforme al Artículo 55, Ley 20.555', margin, y)
  y += 8

  // Descripción de Coberturas
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setFillColor(220, 220, 220)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Descripción de Coberturas y Condiciones de Asegurabilidad', margin + 2, y)
  y += 8

  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Materia y Capital Asegurado', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const materiaText = `Acreditado el fallecimiento del asegurado, la compañía de seguros pagará al beneficiario el saldo insoluto del crédito de consumo o automotriz del asegurado al momento de ocurrir el siniestro, con tope máximo de $${config.capitalMaximo.toLocaleString('es-CL')} Pesos, cualquiera sea la época y lugar donde ocurra, siempre que el certificado se encuentre vigente.`
  const materiaLines = doc.splitTextToSize(materiaText, contentWidth)
  doc.text(materiaLines, margin, y)
  y += materiaLines.length * 3 + 3

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Capitales', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`$${config.capitalMaximo.toLocaleString('es-CL')}.-`, margin, y)
  y += 6

  // Interés Asegurable
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Interés Asegurable', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const interesText = 'El interés asegurable por parte del asegurado corresponde a saldo insoluto de la deuda. Asegurados qué firmen un contrato de mandato con TDV SERVICIOS SPA y mantengan un crédito de consumo o automotriz vigente con un acreedor financiero, que cumplan con la edad de permanencia establecida para este producto a la fecha del siniestro y con los demás requisitos de asegurabilidad, siempre que este ocurra dentro del período de vigencia de la correspondiente cobertura.'
  const interesLines = doc.splitTextToSize(interesText, contentWidth)
  doc.text(interesLines, margin, y)
  y += interesLines.length * 3 + 3

  // Requisitos de Asegurabilidad
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Requisitos de Asegurabilidad', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('• Edad Mínima de Ingreso: 18 años', margin, y)
  y += 3
  doc.text('• Edad Máxima de Ingreso: 64 años y 364 días', margin, y)
  y += 3
  doc.text('• Edad máxima de Permanencia: 69 años y 364 días', margin, y)
  y += 5

  doc.text('La edad del asegurado al inicio del crédito más el plazo del crédito, no deberá superar la edad máxima de permanencia.', margin, y)
  y += 8

  // Beneficiarios
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Beneficiarios', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const beneficiariosText342 = 'Será beneficiario, en carácter irrevocable, el acreedor, entidad bancaria o financiera del crédito de consumo o automotriz otorgado al asegurado siempre que dicho crédito se encuentre vigente al momento del siniestro, es decir, que no se haya extinguido por pago u otra causa.'
  const beneficiariosLines342 = doc.splitTextToSize(beneficiariosText342, contentWidth)
  doc.text(beneficiariosLines342, margin, y)
  y += beneficiariosLines342.length * 3 + 3

  // Mostrar beneficiario irrevocable específico si fue ingresado (Póliza 342)
  if (formData.beneficiarioNombre || formData.beneficiarioRut) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text('Beneficiario Irrevocable Designado:', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    if (formData.beneficiarioNombre) {
      doc.text(`Nombre: ${formData.beneficiarioNombre}`, margin + 3, y)
      y += 3
    }
    if (formData.beneficiarioRut) {
      doc.text(`RUT: ${formData.beneficiarioRut}`, margin + 3, y)
      y += 3
    }
  }
  y += 3

  // Inalterabilidad
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Inalterabilidad', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const inalterabilidadText = 'El Contratante y la Compañía Aseguradora no podrán, sin autorización escrita del beneficiario, efectuar modificaciones que alteren la naturaleza del seguro contratado ya sea en su vigencia, monto asegurado y condiciones particulares. Para tal efecto, el contratante deberá requerir y presentar a la Compañía Aseguradora la autorización del beneficiario.'
  const inalterabilidadLines = doc.splitTextToSize(inalterabilidadText, contentWidth)
  doc.text(inalterabilidadLines, margin, y)
  y += inalterabilidadLines.length * 3 + 5

  // Cobertura de Desgravamen
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Cobertura de Desgravamen (POL220150573)', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const coberturaText = 'Conforme a los términos de la presente póliza y en sus condiciones particulares, la Compañía Aseguradora asegura la vida de los deudores asegurados que se hayan incorporado a la póliza, pagado la prima correspondiente, cumpliendo con los demás requisitos de asegurabilidad.'
  const coberturaLines = doc.splitTextToSize(coberturaText, contentWidth)
  doc.text(coberturaLines, margin, y)
  y += coberturaLines.length * 3 + 3

  const cobertura2Text = 'De acuerdo a lo anterior, la indemnización correspondiente al capital asegurado de un Deudor-Asegurado según lo indicado en las Condiciones Particulares de la póliza, será pagado por la Compañía Aseguradora al acreedor Beneficiario de esta póliza.'
  const cobertura2Lines = doc.splitTextToSize(cobertura2Text, contentWidth)
  doc.text(cobertura2Lines, margin, y)

  // ===================== CUERPO - PAGE 3 =====================
  doc.addPage()
  y = 15

  const cobertura3Text = 'inmediatamente después de haberse comprobado por ésta que el fallecimiento del Asegurado ocurrió durante la vigencia de la cobertura para dicho Asegurado, y que no se produjo bajo algunas de las exclusiones señaladas en el artículo 4° las Condiciones Generales. Si el Asegurado sobrevive a la fecha de vencimiento de la cobertura otorgada por esta póliza, no habrá derecho a indemnización alguna.'
  const cobertura3Lines = doc.splitTextToSize(cobertura3Text, contentWidth)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(cobertura3Lines, margin, y)
  y += cobertura3Lines.length * 3 + 5

  // Prima del Seguro
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Prima del Seguro', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('La prima bruta de este seguro es única, pagada al contado y corresponde a una tasa multiplicada por el monto de cada crédito.', margin, y)
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.text('Prima Única = TC/1000 * MCI * nper', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text('Dónde:', margin, y)
  y += 4
  doc.text('• MCI: Monto del crédito inicial', margin + 5, y)
  y += 3
  doc.text('• TC: Tasa Comercial Bruta Mensual', margin + 5, y)
  y += 3
  doc.text('• Nper: plazo de duración del crédito, en meses', margin + 5, y)
  y += 5

  doc.text('La Tasa Bruta dependerá de la edad del asegurado, al momento de la emisión del certificado, de acuerdo con la siguiente tabla:', margin, y)
  y += 5

  // Tabla de tasas
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(230, 230, 230)
  doc.rect(margin, y - 3, 70, 5, 'F')
  doc.rect(margin + 70, y - 3, 50, 5, 'F')
  doc.text('Rangos de Edad de Emisión', margin + 2, y)
  doc.text('Tasa Bruta (por mil)', margin + 72, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.rect(margin, y - 3, 70, 5, 'S')
  doc.rect(margin + 70, y - 3, 50, 5, 'S')
  doc.text('18 – 55 años', margin + 2, y)
  doc.text('0,30', margin + 72, y)
  y += 5
  doc.rect(margin, y - 3, 70, 5, 'S')
  doc.rect(margin + 70, y - 3, 50, 5, 'S')
  doc.text('56 – 65 años', margin + 2, y)
  doc.text('0,39', margin + 72, y)
  y += 8

  doc.setFontSize(7)
  doc.text('Por ejemplo, un asegurado de 50 años, con una deuda inicial de $30.000.000, y un crédito a 36 meses:', margin, y)
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.text('Prima Única = $30.000.000 * 0,30/1000 * 36 = $324.000 Pesos', margin, y)
  y += 8

  // Exclusiones
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Exclusiones', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Exclusiones Cobertura de Desgravamen (POL220150573, Artículo N°4)', margin, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Este seguro no cubre el riesgo de muerte si el fallecimiento del Asegurado fuere causado por:', margin, y)
  y += 5
  doc.text('a) Guerra, terrorismo o cualquier conflicto armado.', margin + 5, y)
  y += 3
  doc.text('b) Suicidio. No obstante, esta exclusión cesará si hubieren transcurrido 2 años completos e ininterrumpidos de cobertura desde la contratación.', margin + 5, y)
  y += 3
  doc.text('c) Acto delictivo cometido, en calidad de autor o cómplice, por el asegurado.', margin + 5, y)
  y += 3
  doc.text('d) Energía atómica o nuclear.', margin + 5, y)
  y += 8

  // Procedimiento de Denuncia de Siniestro
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Procedimiento de Denuncia de Siniestro', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const denunciaText = 'En caso de consultas, reclamos y denuncias de siniestro, el asegurado se deberá comunicar al teléfono 600 600 4490. En todos los casos la compañía se reserva el derecho de pedir mayores antecedentes para la liquidación del siniestro. En todas las denuncias deberá dejarse constancia del nombre, dirección y teléfono de la persona denunciante para posteriores contactos que sean necesarios.'
  const denunciaLines = doc.splitTextToSize(denunciaText, contentWidth)
  doc.text(denunciaLines, margin, y)
  y += denunciaLines.length * 3 + 3

  doc.text('Para efectuar el denuncio de un siniestro, se deberá presentar al asegurador los siguientes antecedentes junto al formulario "Denuncio de Siniestros":', margin, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.text('Cobertura Fallecimiento', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('• Certificado de defunción original con causa de muerte.', margin + 5, y)

  // ===================== CUERPO - PAGE 4 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('• Formulario de denuncio de siniestro', margin + 5, y)
  y += 3
  doc.text('• Fotocopia de la cédula de identidad del asegurado.', margin + 5, y)
  y += 3
  doc.text('• En caso de muerte presunta, ésta deberá acreditarse de conformidad a la ley.', margin + 5, y)
  y += 3
  doc.text('• Certificado de saldo de la deuda, emitido por la entidad contratante a la fecha de fallecimiento del deudor.', margin + 5, y)
  y += 3
  doc.text('• Otros antecedentes que se estimen convenientes y necesarios para la evaluación del siniestro.', margin + 5, y)
  y += 8

  // Plazo de Pago de Siniestros
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Plazo de Pago de Siniestros', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const plazoText = 'El período de liquidación y pago de siniestro, a contar de la fecha de recepción conforme a todos los antecedentes indicados en la póliza, no podrá exceder de 15 días hábiles. Tratándose de siniestros que no vengan acompañados de la documentación pertinente o en que se requiera de un mayor análisis, la Compañía se reserva el derecho de contabilizar este plazo desde que se reciban tales antecedentes o los exigidos en forma excepcional. En este último evento, la Compañía deberá informar al Corredor a más tardar dentro de los 15 días hábiles siguientes a la presentación del siniestro.'
  const plazoLines = doc.splitTextToSize(plazoText, contentWidth)
  doc.text(plazoLines, margin, y)
  y += plazoLines.length * 3 + 5

  // Comisiones
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Comisiones', margin + 2, y)
  y += 7

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(`Recaudador: ${config.comisiones.recaudador}`, margin, y)
  y += 4
  doc.text(`Comisión de Cobranza: ${config.comisiones.comisionCobranza}`, margin, y)
  y += 4
  doc.text(`Corredor: ${config.comisiones.corredorComision}`, margin, y)
  y += 4
  doc.text(`Comisión de Intermediación: ${config.comisiones.comisionIntermediacion}`, margin, y)
  y += 4
  doc.text('Comisión CEF: Se calculará de acuerdo a la siguiente fórmula.', margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.text('Primero:', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('Resultado AUG Pre CEF t = Prima Cliente Bruta t - Comisión de Recaudación Bruta t - Comisión de Intermediación Bruta t – Siniestros t – IBNR t - Costos de Liq. de Siniestros t – Costos Fijos t', margin, y)
  y += 3
  doc.text('Resultado AUG tras CEF t = Resultado AUG Pre CEF t x 10%', margin, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('Segundo:', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.text('CEF t = Resultado Bruto Pre CEF t × 10% - Pérdida Acarreada t-1 (*)', margin, y)
  y += 3
  doc.text('Existirá Pérdida Acarreada t-1 solo en caso de que en el ejercicio anterior se produzca lo siguiente: Resultado AUG Pre CEF t < 0', margin, y)
  y += 3
  doc.text('Dónde: Costos Fijos t = 3% * Prima Cliente Bruta t', margin, y)
  y += 8

  // Notas Importantes - DECLARACIONES Y CONDICIONES
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Notas Importantes - DECLARACIONES Y CONDICIONES', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const nota1Text = '1. El Contratante declara que se encuentra debidamente mandatado por el Asegurado para suscribir la presente Solicitud de Incorporación, Propuesta y Certificado de Cobertura, así como para realizar el pago de la prima única correspondiente. Asimismo, declara que el Asegurado:'
  const nota1Lines = doc.splitTextToSize(nota1Text, contentWidth)
  doc.text(nota1Lines, margin, y)
  y += nota1Lines.length * 3 + 2

  doc.text('   a. Ha sido previa y completamente informado y ha aceptado las condiciones señaladas en esta Solicitud de Incorporación y Certificado de Cobertura.', margin, y)
  y += 3
  doc.text('   b. Ha tomado conocimiento de su derecho a decidir libremente sobre la contratación voluntaria del seguro.', margin, y)
  y += 3
  doc.text('   c. Ha ejercido su derecho a la libre elección de la compañía aseguradora.', margin, y)
  y += 5

  const nota2Text = '2. Vigencia de las Coberturas. Las coberturas tendrán vigencia desde la firma de esta Solicitud de Incorporación por parte del Contratante. En este caso, la presente solicitud hará las veces de Certificado de Cobertura conforme a lo dispuesto en la Circular N° 2123 de la Comisión para el Mercado Financiero.'
  const nota2Lines = doc.splitTextToSize(nota2Text, contentWidth)
  doc.text(nota2Lines, margin, y)

  // ===================== CUERPO - PAGE 5 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const notaResumenText = 'La presente Solicitud de Incorporación, Propuesta y Certificado de Cobertura constituye un resumen con la descripción general del seguro, sus coberturas y el procedimiento a seguir en caso de siniestro. Dicho resumen es parcial y no reemplaza las condiciones particulares ni generales de la respectiva póliza, teniendo únicamente carácter informativo.'
  const notaResumenLines = doc.splitTextToSize(notaResumenText, contentWidth)
  doc.text(notaResumenLines, margin, y)
  y += notaResumenLines.length * 3 + 3

  doc.text('En caso de requerir copia de las Condiciones Generales y Particulares del seguro, el cliente deberá solicitarlas al Contratante Colectivo de la póliza.', margin, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.text('3. Vigencia de la Póliza Colectiva.', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  const vigenciaPolizaText = 'La póliza colectiva tendrá vigencia desde el 01 de diciembre de 2025 hasta el 30 de noviembre de 2028, renovándose tácita y sucesivamente en los mismos términos por períodos de un (1) año cada uno, salvo voluntad en contrario manifestada por el Contratante o la Aseguradora, según corresponda, mediante carta certificada notarial enviada al domicilio de la parte respectiva.'
  const vigenciaPolizaLines = doc.splitTextToSize(vigenciaPolizaText, contentWidth)
  doc.text(vigenciaPolizaLines, margin, y)
  y += vigenciaPolizaLines.length * 3 + 5

  doc.setFont('helvetica', 'bold')
  doc.text('4. Vigencia de la Cobertura Individual.', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  const vigenciaIndText = 'Para aquellas personas que cumplan con los requisitos de asegurabilidad, la cobertura comenzará a regir desde la fecha de firma de la Solicitud de Incorporación y se mantendrá vigente hasta la extinción del crédito de consumo otorgado por la entidad acreedora.'
  const vigenciaIndLines = doc.splitTextToSize(vigenciaIndText, contentWidth)
  doc.text(vigenciaIndLines, margin, y)
  y += vigenciaIndLines.length * 3 + 5

  doc.setFont('helvetica', 'bold')
  doc.text('5. Término Anticipado de la Cobertura.', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.text('Las coberturas de esta póliza terminarán anticipadamente respecto de un Asegurado en los siguientes casos:', margin, y)
  y += 5
  doc.text('5.1. En caso de renegociación, anulación o prepago del crédito de consumo.', margin + 5, y)
  y += 4
  doc.text('5.2. Al momento en que el Asegurado cumpla la edad máxima de permanencia establecida en las Condiciones Particulares de la póliza.', margin + 5, y)
  y += 4
  doc.text('5.3. En el instante en que el Asegurado deje de tener la calidad de deudor del Acreedor.', margin + 5, y)
  y += 8

  // Disposiciones Finales
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Disposiciones Finales', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Código de Autorregulación', margin, y)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const autoregText = 'La compañía de seguros Augustar Seguros de Vida S.A. se encuentra adherida voluntariamente al código de autorregulación y al compendio de buenas prácticas de las compañías de seguros, cuyo propósito es propender al desarrollo del mercado de los seguros, en consonancia con los principios de libre competencia y buena fe que debe existir entre las empresas, y entre éstas y sus clientes. Copia del compendio de buenas prácticas corporativas de las compañías de seguros, se encuentra a disposición de los interesados en las oficinas de Augustar Seguros de Vida S.A. y en www.aach.cl'
  const autoregLines = doc.splitTextToSize(autoregText, contentWidth)
  doc.text(autoregLines, margin, y)
  y += autoregLines.length * 3 + 3

  const defensorText = 'Asimismo, Augustar Seguros de Vida S.A. se encuentra adherida voluntariamente a la institución del Defensor del Asegurado dependiente del Consejo de Autorregulación de las Compañías de Seguros, y cuya finalidad es velar por el desarrollo del mercado de seguros bajo el principio de buena fe, debiendo conforme a sus estatutos conocer y resolver los conflictos y/o reclamos que pudieran producirse entre las Compañías y sus clientes. Para mayor información, ésta se encuentra disponible en www.ddachile.cl; teléfono 800 646 232, desde celulares 22 234 3583, o bien En Augusto Leguía Sur N° 79, oficina 1210, Las Condes.'
  const defensorLines = doc.splitTextToSize(defensorText, contentWidth)
  doc.text(defensorLines, margin, y)
  y += defensorLines.length * 3 + 5

  // Información sobre atención de clientes
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Información sobre atención de clientes y presentación de consultas y reclamos', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const atencionText = 'En virtud de la circular nro. 2.131 de 28 de noviembre de 2013, las compañías de seguros, corredores de seguros y liquidadores de siniestros, deberán recibir, registrar y responder todas las presentaciones, consultas o reclamos que se les presenten directamente por el contratante, asegurado, beneficiarios o legítimos interesados o sus mandatarios.'
  const atencionLines = doc.splitTextToSize(atencionText, contentWidth)
  doc.text(atencionLines, margin, y)
  y += atencionLines.length * 3 + 3

  doc.text('Las presentaciones pueden ser efectuadas en todas las oficinas de las entidades que se atienda público, presencialmente, por correo postal, medios electrónicos, o telefónicamente, sin formalidades, en el horario normal de atención.', margin, y)

  // ===================== CUERPO - PAGE 6 =====================
  doc.addPage()
  y = 15

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const contactoText = 'En caso de consultas y/o reclamos y, el Asegurado debe comunicarse con el Servicio de Atención al Cliente de Augustar Seguros de Vida S.A., número 600 600 4490 o correo electrónico svida@augustarseguros.cl. El Asegurado también puede enviar su consulta o solicitud al Servicio de Atención al Cliente de TDV SERVICIOS SPA, vía WhatsApp al +56973973802 o al correo electrónico contacto@tedevuelvo.cl.'
  const contactoLines = doc.splitTextToSize(contactoText, contentWidth)
  doc.text(contactoLines, margin, y)
  y += contactoLines.length * 3 + 3

  doc.text('Recibida una presentación, consulta o reclamo, ésa deberá ser respondida en el plazo más breve posible, el que no podrá exceder de 20 días hábiles contados desde su recepción.', margin, y)
  y += 6

  const cmfText = 'Interesado, en caso de disconformidad respecto de lo informado, o bien cuando exista demora injustificada de la respuesta, podrá recurrir a la Comisión Para el Mercado Financiero, área de protección al inversionista y asegurado, cuyas oficinas se encuentran ubicadas en avda. Libertador Bernardo O\'Higgins 1449 piso 1, Santiago, o a través del sitio web www.cmfchile.cl.'
  const cmfLines = doc.splitTextToSize(cmfText, contentWidth)
  doc.text(cmfLines, margin, y)
  y += cmfLines.length * 3 + 8

  // Autorización Datos
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('Autorización para el Tratamiento de Datos Personales', margin + 2, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const datosText = 'Por este acto, y según lo dispuesto en la Ley N°19.628 sobre protección de la vida privada y sus modificaciones, doy mi consentimiento y autorización expresa a Augustar Seguros de Vida S.A. y sus representantes, sucesores y cesionarios puedan proceder a la transmisión o transferencia de todos o parte de los datos personales e información que declaro haber entregado voluntariamente a esta y/o puesto voluntariamente a su disposición, a cualesquiera terceros prestadores de servicios que estuvieren ubicados dentro o fuera de chile, para efectos del presente contrato de seguro y, en particular, para poder hacer efectivo el (los) beneficio (s) que pudieren estar asociados al seguro contratado.'
  const datosLines = doc.splitTextToSize(datosText, contentWidth)
  doc.text(datosLines, margin, y)
  y += datosLines.length * 3 + 10

  // Firmas
  doc.setFontSize(8)
  
  // Agregar firma TDV
  if (firmaTdvBase64) {
    doc.addImage(firmaTdvBase64, 'PNG', margin + 5, y, 25, 15)
  }
  
  // Agregar firma AuguStar
  if (firmaBase64) {
    doc.addImage(firmaBase64, 'JPEG', 78, y, 25, 15)
  }
  y += 18
  
  // Líneas de firma
  doc.text('_______________________', margin, y)
  doc.text('_______________________', 75, y)
  doc.text('_______________________', 145, y)
  
  y += 4
  doc.setFontSize(7)
  doc.text('TDV SERVICIOS SPA', margin, y)
  doc.text('AuguStar Seguros de Vida', 75, y)
  doc.text('Asegurado', 145, y)

  // ===================== PAGE 7 - PROCEDIMIENTO DE LIQUIDACIÓN DE SINIESTROS (Circular N°2106 CMF) =====================
  doc.addPage()
  y = 15

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('(Circular N°2106 Comisión Para el Mercado Financiero)', margin, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y - 4, contentWidth, 6, 'F')
  doc.text('PROCEDIMIENTO DE LIQUIDACIÓN DE SINIESTROS', margin + 2, y)
  y += 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('1) OBJETO DE LA LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const objeto1Text = 'La liquidación tiene por fin establecer la ocurrencia de un siniestro, determinar si el siniestro está cubierto en la póliza contratada en una compañía de seguros determinada, y cuantificar el monto de la pérdida y de la indemnización a pagar.'
  const objeto1Lines = doc.splitTextToSize(objeto1Text, contentWidth)
  doc.text(objeto1Lines, margin, y)
  y += objeto1Lines.length * 3 + 2
  doc.text('El procedimiento de liquidación está sometido a los principios de celeridad y economía procedimental, de objetividad y carácter técnico y de transparencia y acceso.', margin, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('2) FORMA DE EFECTUAR LA LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const forma2Text = 'La liquidación puede efectuarla directamente la Compañía o encomendarla a un Liquidador de Seguros. La decisión debe comunicarse al Asegurado dentro del plazo de tres días hábiles contados desde la fecha de la denuncia del siniestro.'
  const forma2Lines = doc.splitTextToSize(forma2Text, contentWidth)
  doc.text(forma2Lines, margin, y)
  y += forma2Lines.length * 3 + 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('3) DERECHO DE OPOSICIÓN A LA LIQUIDACIÓN DIRECTA', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const oposicion3Text = 'En caso de liquidación directa por la compañía, el Asegurado o beneficiario puede oponerse a ella, solicitándole por escrito que designe un Liquidador de Seguros, dentro del plazo de cinco días hábiles contados desde la notificación de la comunicación de la Compañía. La Compañía deberá designar al Liquidador en el plazo de dos días hábiles contados desde dicha oposición.'
  const oposicion3Lines = doc.splitTextToSize(oposicion3Text, contentWidth)
  doc.text(oposicion3Lines, margin, y)
  y += oposicion3Lines.length * 3 + 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('4) INFORMACIÓN AL ASEGURADO DE GESTIONES A REALIZAR Y PETICION DE ANTECEDENTES', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const info4Text = 'El Liquidador o la Compañía deberá informar al Asegurado, por escrito, en forma suficiente y oportuna, al correo electrónico (informado en la denuncia del siniestro) o por carta certificada (al domicilio señalado en la denuncia de siniestro), de las gestiones que le corresponde realizar, solicitando de una sola vez, cuando las circunstancias lo permitan, todos los antecedentes que requiere para liquidar el siniestro.'
  const info4Lines = doc.splitTextToSize(info4Text, contentWidth)
  doc.text(info4Lines, margin, y)
  y += info4Lines.length * 3 + 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('5) PRE-INFORME DE LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const preinforme5Text = 'En aquellos siniestros en que surgieren problemas y diferencias de criterios sobre sus causas, evaluación del riesgo o extensión de la cobertura, podrá el Liquidador, actuando de oficio o a petición del Asegurado, emitir un pre-informe de liquidación sobre la cobertura del siniestro y el monto de los daños producidos, el que deberá ponerse en conocimiento de los interesados. El asegurado o la Compañía podrán hacer observaciones por escrito al pre-informe dentro del plazo de cinco días hábiles desde su conocimiento.'
  const preinforme5Lines = doc.splitTextToSize(preinforme5Text, contentWidth)
  doc.text(preinforme5Lines, margin, y)
  y += preinforme5Lines.length * 3 + 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('6) PLAZO DE LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Dentro del más breve plazo, no pudiendo exceder de 45 días corridos desde fecha denuncio, a excepción de;', margin, y)
  y += 4
  doc.text('a) Siniestros que correspondan a seguros individuales sobre riesgos del Primer Grupo cuya prima anual sea superior a 100 UF: 90 días corridos desde fecha denuncio;', margin + 5, y)
  y += 4
  doc.text('b) Siniestros marítimos que afecten a los cascos o en caso de Avería Gruesa: 180 días corridos desde fecha denuncio.', margin + 5, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('7) PRORROGA DEL PLAZO DE LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const prorroga7Text = 'Los plazos antes señalados podrán, excepcionalmente siempre que las circunstancias lo ameriten, prorrogarse, sucesivamente por iguales períodos, informando los motivos que la fundamenten e indicando las gestiones concretas y específicas que se realizarán, lo que deberá comunicarse al Asegurado y a la Comisión Para el Mercado Financiero, pudiendo esta última dejar sin efecto la ampliación, en casos calificados, y fijar un plazo para entrega del Informe de Liquidación. No podrá ser motivo de prórroga la solicitud de nuevos antecedentes cuyo requerimiento pudo preverse con anterioridad, salvo que se indiquen las razones que justifiquen la falta de requerimiento, ni podrán prorrogarse los siniestros en que no haya existido gestión alguna del liquidador, registrado o directo.'
  const prorroga7Lines = doc.splitTextToSize(prorroga7Text, contentWidth)
  doc.text(prorroga7Lines, margin, y)
  y += prorroga7Lines.length * 3 + 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('8) INFORME FINAL DE LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const informe8Text = 'El informe final de liquidación deberá remitirse al Asegurado y simultáneamente al Asegurador, cuando corresponda, y deberá contener necesariamente la transcripción íntegra de los artículos 26 y 27 del Reglamento de Auxiliares del Comercio de Seguros (D.S. de Hacienda Nº 1.055 de 2012, Diario Oficial de 29 de diciembre de 2012).'
  const informe8Lines = doc.splitTextToSize(informe8Text, contentWidth)
  doc.text(informe8Lines, margin, y)
  y += informe8Lines.length * 3 + 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('9) IMPUGNACION INFORME DE LIQUIDACIÓN', margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const impugnacion9Text = 'Recibido el informe de Liquidación, la Compañía y el Asegurado dispondrán de un plazo de diez días hábiles para impugnarlo. En caso de liquidación directa por la Compañía, este derecho sólo lo tendrá el Asegurado.'
  const impugnacion9Lines = doc.splitTextToSize(impugnacion9Text, contentWidth)
  doc.text(impugnacion9Lines, margin, y)
  y += impugnacion9Lines.length * 3 + 2
  doc.text('Impugnado el informe, el Liquidador o la compañía dispondrá de un plazo de 6 días hábiles para responder la impugnación.', margin, y)

  // Download
  const fileName = `Certificado_BancoChile_Standard_${config.numero}_${refund.rut.replace(/\./g, '').replace('-', '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

/**
 * Determina si una entidad es Banco de Chile
 */
export const isBancoChile = (institution: string | undefined | null): boolean => {
  if (!institution) return false
  const normalized = institution.toLowerCase().trim()
  return normalized === 'chile' || 
         normalized === 'banco de chile' || 
         normalized === 'banco chile' ||
         normalized.includes('banco de chile') ||
         normalized.includes('banco chile')
}

/**
 * Obtiene la tasa bruta mensual para Banco de Chile según póliza y edad
 */
export const getBancoChileTasaBrutaMensual = (isPrime: boolean, age?: number): number => {
  if (isPrime) {
    return getTasaBrutaMensual344(age)
  }
  return getTasaBrutaMensual342(age)
}

export { BANCO_CHILE_CONFIG }
