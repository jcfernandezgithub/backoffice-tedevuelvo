import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Download, Search, User, MapPin, CreditCard, ArrowLeft, Eye, Shield } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { RefundRequest } from '@/types/refund'
import { authService } from '@/services/authService'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import jsPDF from 'jspdf'
import firmaAugustarImg from '@/assets/firma-augustar.jpeg'
import firmaTdvImg from '@/assets/firma-tdv.png'
import firmaCngImg from '@/assets/firma-cng.jpeg'
import { 
  isBancoChile, 
  generateBancoChilePrimePDF, 
  generateBancoChileStandardPDF,
  getBancoChileTasaBrutaMensual,
  BANCO_CHILE_CONFIG
} from './pdfGenerators/bancoChilePdfGenerator'

interface GenerateCertificateDialogProps {
  refund: RefundRequest
  isMandateSigned?: boolean
  certificateType?: 'desgravamen' | 'cesantia'
}

interface CertificateData {
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
  // Campos para Banco de Chile - Beneficiario Irrevocable
  beneficiarioNombre: string
  beneficiarioRut: string
}

const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return ''
  }
}

const getTodayFormatted = () => {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = today.getFullYear()
  return `${day}/${month}/${year}`
}

const getTasaBrutaMensual = (age?: number): number => {
  if (!age) return 0.297
  if (age >= 18 && age <= 55) return 0.297
  if (age >= 56 && age <= 65) return 0.3733
  return 0.297
}

// Helper to load image as base64
const loadImageAsBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg'))
    }
    img.onerror = reject
    img.src = src
  })
}

export function GenerateCertificateDialog({ refund, isMandateSigned = false, certificateType = 'desgravamen' }: GenerateCertificateDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'preview'>('form')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingRut, setIsLoadingRut] = useState(false)
  const [firmaBase64, setFirmaBase64] = useState<string>('')
  const [firmaTdvBase64, setFirmaTdvBase64] = useState<string>('')
  const [firmaCngBase64, setFirmaCngBase64] = useState<string>('')
  const [formData, setFormData] = useState<CertificateData>({
    folio: '',
    direccion: '',
    numero: '',
    depto: '',
    ciudad: '',
    comuna: '',
    celular: refund.phone || '',
    sexo: '',
    autorizaEmail: 'SI',
    nroOperacion: '',
    fechaInicioCredito: '',
    fechaFinCredito: '',
    saldoInsoluto: (refund.calculationSnapshot?.averageInsuredBalance || refund.calculationSnapshot?.remainingBalance || refund.estimatedAmountCLP || 0).toString(),
    beneficiarioNombre: '',
    beneficiarioRut: '',
  })

  // Check if this refund is for Banco de Chile
  const isBancoChileRefund = isBancoChile(refund.institutionId)

  // Load firma images on mount
  useEffect(() => {
    loadImageAsBase64(firmaAugustarImg).then(setFirmaBase64).catch(console.error)
    loadImageAsBase64(firmaTdvImg).then(setFirmaTdvBase64).catch(console.error)
    loadImageAsBase64(firmaCngImg).then(setFirmaCngBase64).catch(console.error)
  }, [])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setStep('form')
    }
  }

  const handlePreview = () => {
    const saldoInsolutoValue = parseFloat(formData.saldoInsoluto.replace(/\./g, '').replace(',', '.')) || 0
    if (saldoInsolutoValue === 0) {
      toast({
        title: 'Error de validación',
        description: 'El Saldo Insoluto no puede ser cero',
        variant: 'destructive',
      })
      return
    }
    setStep('preview')
  }

  const handleBackToEdit = () => {
    setStep('form')
  }

  const handleChange = (field: keyof CertificateData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const fetchRutInfo = async () => {
    setIsLoadingRut(true)
    
    try {
      const rut = refund.rut || ''
      const rutParts = rut.split('-')
      const rutNumber = rutParts[0].replace(/\./g, '')
      const rutDV = rutParts[1] || ''
      const cleanRut = `${rutNumber}${rutDV}`
      
      const token = authService.getAccessToken()
      
      const response = await fetch(`https://rut-data-extractor-production.up.railway.app/rut/${cleanRut}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      })
      
      if (!response.ok) {
        throw new Error('Error al consultar el servicio')
      }

      const data = await response.json()
      
      const genero = data.data?.genero || ''
      const sexo = genero === 'MUJ' ? 'F' : genero === 'VAR' ? 'M' : ''
      const direccion = data.data?.direccion || ''
      const comuna = data.data?.comuna || ''
      
      setFormData(prev => ({
        ...prev,
        sexo: sexo as 'M' | 'F' | '',
        direccion,
        comuna,
      }))
      
      toast({
        title: 'Información encontrada',
        description: 'Se han actualizado los datos del cliente',
      })
    } catch (error) {
      toast({
        title: 'Datos no encontrados',
        description: 'No se pudo obtener la información. Puede ingresar los datos manualmente.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingRut(false)
    }
  }

  const calculatePrimaUnica = () => {
    // Saldo Insoluto = Valor ingresado en el formulario o el valor por defecto
    const saldoInsoluto = parseFloat(formData.saldoInsoluto.replace(/\./g, '').replace(',', '.')) || 0
    // Nper = Cuotas restantes por pagar
    const nper = refund.calculationSnapshot?.remainingInstallments || 0
    const age = refund.calculationSnapshot?.age
    
    // Use Banco de Chile specific rates if applicable
    let tbm: number
    if (isBancoChileRefund) {
      tbm = getBancoChileTasaBrutaMensual(isPrimeFormat, age) / 1000
    } else {
      tbm = getTasaBrutaMensual(age) / 1000
    }
    return Math.round(saldoInsoluto * tbm * nper)
  }

  const getSaldoInsolutoValue = () => {
    return parseFloat(formData.saldoInsoluto.replace(/\./g, '').replace(',', '.')) || 0
  }

  // Check if Prime format should be used (credit > 20 million)
  const isPrimeFormat = (refund.calculationSnapshot?.totalAmount || 0) > 20000000

  // Tasa Bruta Mensual para Póliza 344 (Prime)
  const getTasaBrutaMensualPrime = (age?: number): number => {
    if (!age) return 0.3267
    if (age >= 18 && age <= 55) return 0.3267
    if (age >= 56 && age <= 65) return 0.4106
    return 0.3267
  }

  const generatePrimePDF = async () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    const contentWidth = pageWidth - margin * 2
    let y = 15

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

    // Valores calculados para Prime (Póliza 344) - Prima Única usa saldoInsoluto del formulario
    const saldoInsoluto = getSaldoInsolutoValue()
    const montoCredito = refund.calculationSnapshot?.totalAmount || 0 // Para mostrar en PDF
    const nperValue = refund.calculationSnapshot?.remainingInstallments || 0
    const ageValue = refund.calculationSnapshot?.age
    const tcValue = getTasaBrutaMensualPrime(ageValue)
    const primaUnica = Math.round(saldoInsoluto * (tcValue / 1000) * nperValue)
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
    doc.text('POL 2 2015 0573', margin + 2, y + 1)
    doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
    doc.text('344', pageWidth - margin - 38, y + 1)
    y += 12

    // CONTRATANTE
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('CONTRATANTE (SI ES DISTINTO DEL ASEGURADO)', margin, y)
    doc.text('RUT', pageWidth - margin - 40, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.rect(margin, y - 3, 90, 6, 'S')
    doc.text('TDV SERVICIOS SPA', margin + 2, y + 1)
    doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
    doc.text('RUT: 78.168.126-1', pageWidth - margin - 38, y + 1)
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
    doc.text('01/12/2025', margin + 37, y)
    doc.text('Inicio', margin + 70, y)
    drawCheckbox(margin + 100, y, true)
    doc.text('SI', margin + 107, y)
    y += 6

    drawCheckbox(margin, y, true)
    doc.text('Colectiva', margin + 7, y)
    doc.rect(margin + 35, y - 3, 30, 5, 'S')
    doc.text('30/11/2028', margin + 37, y)
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
    // Peso checked for non-Banco de Chile
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
    doc.text('No hay comisión', margin + 122, y)

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
    // Fallecimiento - Show Saldo Insoluto value and CLP for non-Banco de Chile
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
    y += 10

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
      { term: 'CÓDIGO CMF DE LA PÓLIZA:', desc: 'Es el Código con que la póliza fue depositada en la Comisión para el Mercado Financiero, conocido también como "código Pol".' },
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

    // ===================== CARÁTULA - PAGE 4 =====================
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
    doc.text('Nro. Póliza: 344', 140, y)
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
    doc.text('Autorizo que toda comunicación y notificación que diga relación con el presente seguro me sea enviada al correo electrónico señalado.', margin, y)
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
    doc.text('Prime Corredores de Seguro SPA.', margin, y)
    doc.text('RUT: 76.196.802-5', 120, y)
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
    doc.text(`$${montoCredito.toLocaleString('es-CL')}`, margin + 45, y)
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
    doc.text('Prima Única del Seguro (Exenta de IVA):', margin, y)
    doc.setFont('helvetica', 'bold')
    doc.text(`$${primaUnica.toLocaleString('es-CL')}`, margin + 68, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('Fórmula: TC/1000 × MCI × Nper', margin, y)
    y += 4
    doc.text('Donde:', margin, y)
    y += 3
    doc.text(`• MCI: Monto del crédito inicial: $${montoCredito.toLocaleString('es-CL')}`, margin + 5, y)
    y += 3
    doc.text(`• TC: Tasa Comercial Bruta Mensual: ${tcValue.toFixed(4)} por mil`, margin + 5, y)
    y += 3
    doc.text(`• Nper: plazo de duración del crédito, en meses: ${nperValue}`, margin + 5, y)
    y += 5

    // Tabla de tasas
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(230, 230, 230)
    doc.rect(margin, y - 3, 70, 5, 'F')
    doc.rect(margin + 70, y - 3, 50, 5, 'F')
    doc.text('Rangos de Edad de Emisión', margin + 2, y)
    doc.text('Tasa Bruta mensual (por mil)', margin + 72, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.rect(margin, y - 3, 70, 5, 'S')
    doc.rect(margin + 70, y - 3, 50, 5, 'S')
    doc.text('18 – 55 años', margin + 2, y)
    doc.text('0,3267', margin + 72, y)
    y += 5
    doc.rect(margin, y - 3, 70, 5, 'S')
    doc.rect(margin + 70, y - 3, 50, 5, 'S')
    doc.text('56 – 65 años', margin + 2, y)
    doc.text('0,4106', margin + 72, y)
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
    const aseguradosText = 'Personas naturales que firmen el contrato de término de condiciones y mantengan un crédito de consumo o automotriz vigente con un acreedor financiero, que cumplan con la edad de permanencia establecida para este producto.'
    const aseguradosLines = doc.splitTextToSize(aseguradosText, contentWidth)
    doc.text(aseguradosLines, margin, y)
    y += aseguradosLines.length * 3 + 4

    // ===================== CUERPO - PAGE 2 =====================
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
    doc.text('POL 2 2015 0573', margin + 92, y)
    y += 6

    doc.setFontSize(7)
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
    const materiaText = 'Acreditado el fallecimiento del asegurado, la compañía de seguros pagará el saldo insoluto del crédito de consumo o automotriz del asegurado al momento de ocurrir el siniestro, con tope máximo de $60.000.000 Pesos, cualquiera sea la época y lugar donde ocurra, siempre que el certificado se encuentre vigente.'
    const materiaLines = doc.splitTextToSize(materiaText, contentWidth)
    doc.text(materiaLines, margin, y)
    y += materiaLines.length * 3 + 3

    doc.setFont('helvetica', 'bold')
    doc.text('Capitales: $60.000.000', margin, y)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Interés Asegurable', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('El interés asegurable por parte del asegurado corresponde a saldo insoluto de la deuda.', margin, y)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Requisitos de Asegurabilidad', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('• Edad Mínima de Ingreso: 18 años', margin + 5, y)
    y += 3
    doc.text('• Edad Máxima de Ingreso: 64 años y 364 días', margin + 5, y)
    y += 3
    doc.text('• Edad máxima de Permanencia: 69 años y 364 días', margin + 5, y)
    y += 3
    doc.text('La edad del asegurado al inicio del crédito más el plazo del crédito, no deberá superar la edad máxima de permanencia.', margin, y)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Beneficiarios', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('El beneficiario para la cobertura de Desgravamen es el acreedor del crédito de consumo o automotriz.', margin, y)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Cobertura de Desgravamen (POL220150573)', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const coberturaText = 'Conforme a los términos de la presente póliza y en sus condiciones particulares, la Compañía Aseguradora asegura la vida de los deudores asegurados que se hayan incorporado a la póliza, pagado la prima correspondiente, cumpliendo con los demás requisitos de asegurabilidad.'
    const coberturaLines = doc.splitTextToSize(coberturaText, contentWidth)
    doc.text(coberturaLines, margin, y)
    y += coberturaLines.length * 3 + 3

    const coberturaText2 = 'De acuerdo a lo anterior, la indemnización correspondiente al capital asegurado de un Deudor-Asegurado será pagado por la Compañía Aseguradora al acreedor Beneficiario de esta póliza, inmediatamente después de haberse comprobado que el fallecimiento del Asegurado ocurrió durante la vigencia de la cobertura.'
    const coberturaLines2 = doc.splitTextToSize(coberturaText2, contentWidth)
    doc.text(coberturaLines2, margin, y)
    y += coberturaLines2.length * 3 + 5

    // Prima del Seguro
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 4, contentWidth, 6, 'F')
    doc.text('Prima del Seguro', margin + 2, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('La prima bruta de este seguro es única, y corresponde a una tasa multiplicada por el monto de cada crédito.', margin, y)
    y += 5

    // ===================== CUERPO - PAGE 3 =====================
    doc.addPage()
    y = 15

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Prima Única = TC/1000 × MCI × Nper', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('Donde:', margin, y)
    y += 3
    doc.text('• MCI: Monto del crédito inicial', margin + 5, y)
    y += 3
    doc.text('• TC: Tasa Comercial Bruta Mensual', margin + 5, y)
    y += 3
    doc.text('• Nper: plazo de duración del crédito, en meses', margin + 5, y)
    y += 6

    // Tabla de tasas (repetida)
    doc.setFontSize(7)
    doc.text('La Tasa Bruta Mensual dependerá de la edad del asegurado:', margin, y)
    y += 4
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(230, 230, 230)
    doc.rect(margin, y - 3, 70, 5, 'F')
    doc.rect(margin + 70, y - 3, 50, 5, 'F')
    doc.text('Rangos de Edad de Emisión', margin + 2, y)
    doc.text('Tasa Bruta mensual (por mil)', margin + 72, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.rect(margin, y - 3, 70, 5, 'S')
    doc.rect(margin + 70, y - 3, 50, 5, 'S')
    doc.text('18 – 55 años', margin + 2, y)
    doc.text('0,3267', margin + 72, y)
    y += 5
    doc.rect(margin, y - 3, 70, 5, 'S')
    doc.rect(margin + 70, y - 3, 50, 5, 'S')
    doc.text('56 – 65 años', margin + 2, y)
    doc.text('0,4106', margin + 72, y)
    y += 8

    // Exclusiones
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 4, contentWidth, 6, 'F')
    doc.text('Exclusiones Cobertura de Desgravamen (POL220150573, Artículo N°4)', margin + 2, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('Este seguro no cubre el riesgo de muerte si el fallecimiento del Asegurado fuere causado por:', margin, y)
    y += 4
    doc.text('a) Guerra, terrorismo o cualquier conflicto armado.', margin + 5, y)
    y += 3
    const exclusionB = 'b) Suicidio. No obstante, esta exclusión cesará si hubieren transcurrido 2 años completos e ininterrumpidos de cobertura desde la contratación.'
    const exclusionBLines = doc.splitTextToSize(exclusionB, contentWidth - 10)
    doc.text(exclusionBLines, margin + 5, y)
    y += exclusionBLines.length * 3
    doc.text('c) Acto delictivo cometido, en calidad de autor o cómplice, por el asegurado.', margin + 5, y)
    y += 3
    doc.text('d) Energía atómica o nuclear.', margin + 5, y)
    y += 6

    // Procedimiento de Denuncia
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 4, contentWidth, 6, 'F')
    doc.text('Procedimiento de Denuncia de Siniestro', margin + 2, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const denunciaText = 'En caso de consultas, reclamos y denuncias de siniestro, el asegurado se deberá comunicar al teléfono 600 600 4490. En todos los casos la compañía se reserva el derecho de pedir mayores antecedentes para la liquidación del siniestro.'
    const denunciaLines = doc.splitTextToSize(denunciaText, contentWidth)
    doc.text(denunciaLines, margin, y)
    y += denunciaLines.length * 3 + 3

    doc.text('Para efectuar el denuncio de un siniestro, se deberá presentar:', margin, y)
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Cobertura Fallecimiento', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('• Certificado de defunción original con causa de muerte.', margin + 5, y)
    y += 3
    doc.text('• Formulario de denuncio de siniestro.', margin + 5, y)
    y += 3
    doc.text('• Fotocopia de la cédula de identidad del asegurado.', margin + 5, y)
    y += 3
    doc.text('• En caso de muerte presunta, ésta deberá acreditarse de conformidad a la ley.', margin + 5, y)
    y += 3
    doc.text('• Certificado de saldo de la deuda, emitido por la entidad contratante.', margin + 5, y)
    y += 3
    doc.text('• Otros antecedentes que se estimen convenientes.', margin + 5, y)
    y += 6

    // Plazo de Pago
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 4, contentWidth, 6, 'F')
    doc.text('Plazo de Pago de Siniestros', margin + 2, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const plazoText = 'El período de liquidación y pago de siniestro, a contar de la fecha de recepción conforme a todos los antecedentes indicados en la póliza, no podrá exceder de 15 días hábiles.'
    const plazoLines = doc.splitTextToSize(plazoText, contentWidth)
    doc.text(plazoLines, margin, y)
    y += plazoLines.length * 3 + 5

    // ===================== CUERPO - PAGE 4 =====================
    doc.addPage()
    y = 15

    // Comisiones
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 4, contentWidth, 6, 'F')
    doc.text('Comisiones', margin + 2, y)
    y += 6

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Recaudador:', margin, y)
    doc.text('TDV SERVICIOS SPA, Rut: 78.168.126-1', margin + 40, y)
    y += 4
    doc.text('Comisión de Cobranza:', margin, y)
    doc.text('35% + IVA sobre la prima recaudada', margin + 40, y)
    y += 4
    doc.text('Corredor:', margin, y)
    doc.text('PRIME CORREDORES DE SEGUROS SPA, Rut: 76.196.802-5', margin + 40, y)
    y += 4
    doc.text('Comisión de Intermediación:', margin, y)
    doc.text('15% + IVA sobre la prima recaudada', margin + 40, y)
    y += 4
    doc.text('Comisión CEF:', margin, y)
    doc.text('Se calculará de acuerdo con la siguiente fórmula.', margin + 40, y)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.text('Primero:', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text('Resultado AUG Pre CEFt = Prima Cliente Brutat - Comisión de Recaudación Brutat - Comisión de Intermediación Brutat – Siniestrost – IBNRt - Costos de Liq. de Siniestrost – Costos Fijost', margin, y)
    y += 3
    doc.text('Resultado AUG tras CEFt = Resultado AUG Pre CEFt x 10%', margin, y)
    y += 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text('Segundo:', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text('CEFt = Resultado Bruto Pre CEFt × 10% - Pérdida Acarreadat-1', margin, y)
    y += 8

    // Notas Importantes
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 4, contentWidth, 6, 'F')
    doc.text('Notas Importantes', margin + 2, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    
    doc.text('1. El asegurado declara:', margin, y)
    y += 4
    const nota1a = 'a) Conocer, haber sido previa y completamente informado y aceptar las condiciones señaladas en esta Solicitud de Incorporación y Certificado de Cobertura.'
    const nota1aLines = doc.splitTextToSize(nota1a, contentWidth - 10)
    doc.text(nota1aLines, margin + 5, y)
    y += nota1aLines.length * 3

    doc.text('b) Haber tomado conocimiento del derecho a decidir sobre la contratación voluntaria del seguro.', margin + 5, y)
    y += 4

    doc.text('c) Que el contratante colectivo de la Póliza N°344 es TDV SERVICIOS SPA.', margin + 5, y)
    y += 4

    const nota1d = 'd) Que las coberturas tendrán vigencia desde la firma de esta solicitud de incorporación.'
    doc.text(nota1d, margin + 5, y)
    y += 5

    const nota2 = '2. La presente Solicitud de Incorporación, Propuesta y Certificado de Cobertura es un resumen con la descripción general del seguro.'
    const nota2Lines = doc.splitTextToSize(nota2, contentWidth - 5)
    doc.text(nota2Lines, margin, y)
    y += nota2Lines.length * 3 + 2

    const nota3 = '3. Vigencia de la Póliza Colectiva: La póliza colectiva tendrá vigencia desde el 01 de diciembre de 2025 hasta el 30 de noviembre de 2028.'
    const nota3Lines = doc.splitTextToSize(nota3, contentWidth - 5)
    doc.text(nota3Lines, margin, y)
    y += nota3Lines.length * 3 + 2

    const nota4 = '4. Vigencia de la Póliza Individual: La cobertura comenzará a regir a partir de la fecha de firma de la Solicitud de Incorporación.'
    const nota4Lines = doc.splitTextToSize(nota4, contentWidth - 5)
    doc.text(nota4Lines, margin, y)
    y += nota4Lines.length * 3 + 2

    doc.text('5. Término Anticipado: Las coberturas de esta póliza terminarán anticipadamente en los siguientes casos:', margin, y)
    y += 4
    doc.text('a) En caso de renegociación, anulación o prepago del crédito de consumo.', margin + 5, y)
    y += 3
    doc.text('b) El no pago de la respectiva prima por parte del asegurado.', margin + 5, y)
    y += 3
    doc.text('c) Al momento que el asegurado cumpla la edad máxima de permanencia.', margin + 5, y)
    y += 3
    doc.text('d) Por la pérdida de la calidad de asegurado.', margin + 5, y)
    y += 5

    const nota6 = '6. La contratación de estos seguros es de carácter voluntario. Usted puede retractarse si la contratación la efectuó por un medio a distancia.'
    const nota6Lines = doc.splitTextToSize(nota6, contentWidth - 5)
    doc.text(nota6Lines, margin, y)

    // ===================== CUERPO - PAGE 5 =====================
    doc.addPage()
    y = 15

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
    const autoregText = 'La compañía de seguros Augustar Seguros de Vida S.A. se encuentra adherida voluntariamente al código de autorregulación y al compendio de buenas prácticas de las compañías de seguros.'
    const autoregLines = doc.splitTextToSize(autoregText, contentWidth)
    doc.text(autoregLines, margin, y)
    y += autoregLines.length * 3 + 3

    const defensorText = 'Asimismo, Augustar Seguros de Vida S.A. se encuentra adherida voluntariamente a la institución del Defensor del Asegurado. Para mayor información: www.ddachile.cl; teléfono 800 646 232.'
    const defensorLines = doc.splitTextToSize(defensorText, contentWidth)
    doc.text(defensorLines, margin, y)
    y += defensorLines.length * 3 + 6

    // Información sobre atención de clientes
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 4, contentWidth, 6, 'F')
    doc.text('Información sobre atención de clientes y presentación de consultas y reclamos', margin + 2, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const atencionText1 = 'En virtud de la circular nro. 2.131, las compañías de seguros deberán recibir, registrar y responder todas las presentaciones, consultas o reclamos.'
    const atencionLines1 = doc.splitTextToSize(atencionText1, contentWidth)
    doc.text(atencionLines1, margin, y)
    y += atencionLines1.length * 3 + 2

    const contactoText = 'En caso de consultas y/o reclamos, el Asegurado debe comunicarse con el Servicio de Atención al Cliente de Augustar Seguros de Vida S.A., número 600 600 4490 o correo electrónico svida@augustarseguros.cl. También puede contactar a TDV SERVICIOS SPA vía WhatsApp al +56973973802 o al correo electrónico contacto@tedevuelvo.cl'
    const contactoLines = doc.splitTextToSize(contactoText, contentWidth)
    doc.text(contactoLines, margin, y)
    y += contactoLines.length * 3 + 2

    doc.text('Recibida una presentación, consulta o reclamo, ésa deberá ser respondida en el plazo máximo de 20 días hábiles.', margin, y)
    y += 6

    // Autorización Datos
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 4, contentWidth, 6, 'F')
    doc.text('Autorización para el Tratamiento de Datos Personales', margin + 2, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const datosText = 'Por este acto, y según lo dispuesto en la Ley N°19.628 sobre protección de la vida privada, doy mi consentimiento y autorización expresa a Augustar Seguros de Vida S.A. para proceder a la transmisión o transferencia de mis datos personales.'
    const datosLines = doc.splitTextToSize(datosText, contentWidth)
    doc.text(datosLines, margin, y)
    y += datosLines.length * 3 + 8

    // Mandato y Autorización
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 4, contentWidth, 6, 'F')
    doc.text('Mandato y Autorización', margin + 2, y)
    y += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const mandatoText = 'Conforme a lo dispuesto en el Artículo 13 y 3 del Contrato de Crédito, por medio del presente mandato, faculto a TDV SERVICIOS SPA. para incorporarme a la Póliza Colectiva Nº 344 emitida por Augustar Seguros de Vida S.A. y para incluir dentro del mismo crédito la prima de este seguro, cuyas condiciones de cobertura, monto de prima única a pagar, vigencia, exclusiones y condiciones de asegurabilidad conozco a cabalidad y acepto voluntaria e informadamente.'
    const mandatoLines = doc.splitTextToSize(mandatoText, contentWidth)
    doc.text(mandatoLines, margin, y)
    y += mandatoLines.length * 3 + 10

    // Firmas
    doc.setFontSize(8)
    
    // Agregar firma TDV
    if (firmaTdvBase64) {
      doc.addImage(firmaTdvBase64, 'PNG', margin + 5, y, 25, 15)
    }
    
    // Agregar firma AuguStar (entre título y línea)
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

    // Download
    const fileName = `Certificado_Prime_344_${refund.rut.replace(/\./g, '').replace('-', '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
  }

  const generatePDF = async () => {
    setIsGenerating(true)
    try {
      // Check if this is Banco de Chile - use specific generators
      if (isBancoChileRefund) {
        if (isPrimeFormat) {
          await generateBancoChilePrimePDF(refund, formData, firmaBase64, firmaTdvBase64, firmaCngBase64)
          toast({
            title: 'Certificado Banco de Chile generado',
            description: 'El certificado de cobertura (Póliza 344 - Banco de Chile) se descargó correctamente',
          })
        } else {
          await generateBancoChileStandardPDF(refund, formData, firmaBase64, firmaTdvBase64, firmaCngBase64)
          toast({
            title: 'Certificado Banco de Chile generado',
            description: 'El certificado de cobertura (Póliza 342 - Banco de Chile) se descargó correctamente',
          })
        }
        setOpen(false)
        setIsGenerating(false)
        return
      }

      // Use Prime format for credits > 20 million (non-Banco de Chile)
      if (isPrimeFormat) {
        await generatePrimePDF()
        toast({
          title: 'Certificado Prime generado',
          description: 'El certificado de cobertura (Póliza 344) se descargó correctamente',
        })
        setOpen(false)
        return
      }

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 15
      const contentWidth = pageWidth - margin * 2
      let y = 15

      // Helper function for checkboxes
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

      // Valores calculados
      const saldoInsoluto = getSaldoInsolutoValue()
      const nperValue = refund.calculationSnapshot?.remainingInstallments || 0
      const ageValue = refund.calculationSnapshot?.age
      const tbmValue = getTasaBrutaMensual(ageValue)
      const primaUnica = Math.round(saldoInsoluto * (tbmValue / 1000) * nperValue)
      const saldoInsolutoFormatted = `$${saldoInsoluto.toLocaleString('es-CL')}`

      // ===================== CARÁTULA - PAGE 1 =====================
      // Header: CÓDIGOS CMF DE LA PÓLIZA
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('CÓDIGOS CMF DE LA PÓLIZA', margin, y)
      doc.text('PÓLIZA N°', pageWidth - margin - 40, y)
      y += 5
      
      // Boxes for CMF code and policy number
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.rect(margin, y - 3, 60, 6, 'S')
      doc.text('POL 220150573', margin + 2, y + 1)
      doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
      doc.text('342', pageWidth - margin - 38, y + 1)
      y += 12

      // CONTRATANTE
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('CONTRATANTE (SI ES DISTINTO DEL ASEGURADO)', margin, y)
      doc.text('RUT', pageWidth - margin - 40, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.rect(margin, y - 3, 90, 6, 'S')
      doc.text('TDV SERVICIOS SPA', margin + 2, y + 1)
      doc.rect(pageWidth - margin - 40, y - 3, 35, 6, 'S')
      doc.text('RUT: 78.168.126-1', pageWidth - margin - 38, y + 1)
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

      // Table structure
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      drawCheckbox(margin, y, false)
      doc.text('Individual', margin + 7, y)
      doc.rect(margin + 35, y - 3, 30, 5, 'S')
      doc.text('13/10/2025', margin + 37, y)
      doc.text('Inicio', margin + 70, y)
      drawCheckbox(margin + 100, y, true)
      doc.text('SI', margin + 107, y)
      y += 6

      drawCheckbox(margin, y, true)
      doc.text('Colectiva', margin + 7, y)
      doc.rect(margin + 35, y - 3, 30, 5, 'S')
      doc.text('12/09/2028', margin + 37, y)
      doc.text('Termino', margin + 70, y)
      drawCheckbox(margin + 100, y, false)
      doc.text('NO', margin + 107, y)
      y += 12

      // PLAN and PRIMA
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
      // Row 1
      drawCheckbox(margin, y, false)
      doc.text('UF', margin + 7, y)
      drawCheckbox(margin + 30, y, false)
      doc.text('Anual', margin + 37, y)
      drawCheckbox(margin + 75, y, true)
      doc.text('Fija', margin + 82, y)
      doc.text('15% + IVA por prima', margin + 122, y)
      y += 5
      // Row 2 - Peso checked for non-Banco de Chile
      drawCheckbox(margin, y, true)
      doc.text('Peso', margin + 7, y)
      drawCheckbox(margin + 30, y, false)
      doc.text('Mensual', margin + 37, y)
      drawCheckbox(margin + 75, y, false)
      doc.text('Ajustable Según Contrato', margin + 82, y)
      y += 5
      // Row 3
      drawCheckbox(margin, y, false)
      doc.text('Otra', margin + 7, y)
      drawCheckbox(margin + 30, y, true)
      doc.text('Otro', margin + 37, y)
      doc.text('No hay comisión', margin + 122, y)

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
      // Fallecimiento - Show Saldo Insoluto value and CLP for non-Banco de Chile
      drawCheckbox(margin, y, true)
      doc.text('Fallecimiento', margin + 7, y)
      doc.rect(margin + 60, y - 3, 35, 5, 'S')
      doc.text(saldoInsolutoFormatted, margin + 62, y)
      doc.rect(margin + 98, y - 3, 15, 5, 'S')
      doc.text('CLP', margin + 100, y)
      doc.rect(margin + 120, y - 3, 15, 5, 'S')
      doc.text('2/3', margin + 124, y)
      doc.rect(margin + 145, y - 3, 15, 5, 'S')
      y += 6

      // Invalidez
      drawCheckbox(margin, y, false)
      doc.text('Invalidez T&P 2/3', margin + 7, y)
      doc.rect(margin + 60, y - 3, 35, 5, 'S')
      doc.rect(margin + 98, y - 3, 15, 5, 'S')
      doc.rect(margin + 120, y - 3, 15, 5, 'S')
      doc.rect(margin + 145, y - 3, 15, 5, 'S')
      y += 6

      // Sobrevivencia
      drawCheckbox(margin, y, false)
      doc.text('Sobrevivencia', margin + 7, y)
      doc.rect(margin + 60, y - 3, 35, 5, 'S')
      doc.rect(margin + 98, y - 3, 15, 5, 'S')
      doc.rect(margin + 120, y - 3, 15, 5, 'S')
      doc.rect(margin + 145, y - 3, 15, 5, 'S')
      y += 6

      // Muerte Accidental
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
      y += 10

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
        { term: 'TIPO DE PÓLIZA:', desc: 'Según si tiene o no asociada una cuenta única de inversión, la póliza puede ser sin cuenta única de inversión, con cuenta única de inversión, o con ahorro previsional voluntario (APV).' },
        { term: 'VIGENCIA:', desc: 'Tiempo durante el cual se extiende la cobertura de riesgo de la póliza contratada.' },
        { term: 'RENOVACIÓN:', desc: 'Se refiere a si la póliza se extingue al vencimiento de su plazo o si se renueva automáticamente.' },
        { term: 'PRIMA:', desc: 'El precio que se cobra por el seguro. Éste incluye los adicionales, en su caso.' },
        { term: 'CONDICIONES DE PRIMA:', desc: 'La prima puede ser fija o ajustable conforme a las normas incluidas en la póliza.' },
        { term: 'COMISIÓN CORREDOR:', desc: 'Es la parte de la prima que recibe un corredor de seguros. Puede expresarse como un monto fijo o un porcentaje de la prima.' },
        { term: 'COBERTURA:', desc: 'El tipo de riesgo cubierto por la póliza.' },
        { term: 'CARENCIA:', desc: 'Período establecido en la póliza durante el cual no rige la cobertura del seguro.' },
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
      const sistemaNotifText = 'Sistema de comunicación que el cliente autoriza para que la compañía le efectúe todas las notificaciones requeridas conforme a la póliza o que la compañía requiera realizar. Es responsabilidad del cliente actualizar los datos cuando exista un cambio en ellos.'
      const sistemaNotifLines = doc.splitTextToSize(sistemaNotifText, contentWidth)
      doc.text(sistemaNotifLines, margin, y)
      y += sistemaNotifLines.length * 2.5 + 10

      // ===================== CUERPO - PAGE 1 =====================
      doc.addPage()
      y = 15

      // Header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('SOLICITUD DE INCORPORACIÓN, PROPUESTA Y CERTIFICADO DE COBERTURA INMEDIATA', pageWidth / 2, y, { align: 'center' })
      y += 6
      doc.setFontSize(10)
      doc.text('SEGURO DE DESGRAVAMEN', pageWidth / 2, y, { align: 'center' })
      y += 8

      // Fecha, Folio, Póliza row
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`Fecha: ${getTodayFormatted()}`, margin, y)
      doc.text(`Folio: ${formData.folio || '____________'}`, 70, y)
      doc.text('Nro. Póliza: 342', 140, y)
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

      // Row 1: Nombre, RUT, Fecha Nacimiento
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

      // Row 2: Dirección, N°, Depto
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

      // Row 3: Ciudad, Comuna, Teléfono, Celular
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

      // Row 4: Sexo
      doc.setFont('helvetica', 'normal')
      doc.text('Sexo:', margin, y)
      drawBox(margin + 15, y, 3, 3, formData.sexo === 'M')
      doc.text('M', margin + 20, y)
      drawBox(margin + 35, y, 3, 3, formData.sexo === 'F')
      doc.text('F', margin + 40, y)
      y += 5

      // Row 5: Email
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
      doc.text('Prime Corredores de Seguro SPA.', margin, y)
      doc.text('RUT: 76.196.802-5', 120, y)
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
      const montoCredito = refund.calculationSnapshot?.totalAmount || 0
      doc.text('Monto Inicial del Crédito*:', margin, y)
      doc.setFont('helvetica', 'bold')
      doc.text(`$${montoCredito.toLocaleString('es-CL')}`, margin + 45, y)
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
      doc.text('Prima Única del Seguro (Exenta de IVA):', margin, y)
      doc.setFont('helvetica', 'bold')
      doc.text(`$${primaUnica.toLocaleString('es-CL')}`, margin + 68, y)
      y += 5

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Fórmula: Saldo insoluto Inicial × TBM × Nper', margin, y)
      y += 4
      doc.text('Donde:', margin, y)
      y += 3
      doc.text(`• SI: Saldo insoluto inicial: ${saldoInsolutoFormatted}`, margin + 5, y)
      y += 3
      doc.text(`• TBM: Tasa Bruta Mensual`, margin + 5, y)
      y += 3
      doc.text(`• Nper: plazo de duración del crédito, en meses: ${nperValue}`, margin + 5, y)
      y += 5

      doc.setFontSize(7)
      doc.text('La Tasa Bruta Mensual dependerá de la edad del asegurado, al momento de la emisión del certificado, de acuerdo con la siguiente tabla:', margin, y)
      y += 5

      // Tabla de tasas
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setFillColor(230, 230, 230)
      doc.rect(margin, y - 3, 70, 5, 'F')
      doc.rect(margin + 70, y - 3, 50, 5, 'F')
      doc.text('Rangos de Edad de Emisión', margin + 2, y)
      doc.text('Tasa Bruta mensual (por mil)', margin + 72, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.rect(margin, y - 3, 70, 5, 'S')
      doc.rect(margin + 70, y - 3, 50, 5, 'S')
      doc.text('18 – 55 años', margin + 2, y)
      doc.text('0,2970', margin + 72, y)
      y += 5
      doc.rect(margin, y - 3, 70, 5, 'S')
      doc.rect(margin + 70, y - 3, 50, 5, 'S')
      doc.text('56 – 65 años', margin + 2, y)
      doc.text('0,3733', margin + 72, y)
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
      doc.text('Personas naturales que mantenga un crédito de consumo o automotriz vigente con un acreedor financiero, y que cumplan los requisitos de Asegurabilidad.', margin, y)
      y += 5
      doc.setFont('helvetica', 'bold')
      doc.text('IMPORTANTE:', margin, y)
      doc.setFont('helvetica', 'normal')
      const importanteText = 'Usted está solicitando su incorporación como asegurado a una póliza o contrato de seguro colectivo cuyas condiciones han sido convenidas por TDV SERVICIOS SPA, directamente con Augustar Seguros de Vida S.A.'
      const importanteLines = doc.splitTextToSize(importanteText, contentWidth - 20)
      doc.text(importanteLines, margin + 22, y)
      y += importanteLines.length * 3 + 4

      // Detalle de Coberturas
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Detalle de Coberturas', margin + 2, y)
      y += 6

      // Tabla de coberturas
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

      doc.setFontSize(7)
      doc.text('El presente contrato no cuenta con Sello SERNAC conforme al Artículo 55, Ley 20.555', margin, y)

      // ===================== PAGE 2 =====================
      doc.addPage()
      y = 15

      // Descripción de Coberturas y Condiciones
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

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('Condiciones de Asegurabilidad', margin, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      const condText = 'Acreditado el fallecimiento del asegurado, la compañía de seguros pagará el total del saldo insoluto del crédito de consumo o automotriz del asegurado con tope de $20.000.000, al momento de ocurrir el siniestro, cualquiera sea la época y lugar donde ocurra, siempre que el certificado se encuentre vigente.'
      const condLines = doc.splitTextToSize(condText, contentWidth)
      doc.text(condLines, margin, y)
      y += condLines.length * 3 + 4

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('Capitales', margin, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.text('$20.000.000', margin, y)
      y += 5

      doc.setFont('helvetica', 'bold')
      doc.text('Interés Asegurable', margin, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('El interés asegurable por parte del asegurado corresponde a saldo insoluto de la deuda.', margin, y)
      y += 5

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('Asegurados', margin, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      const aseguradosText = 'Son asegurados los titulares que firmen el contrato de término de condiciones y mantengan un crédito de consumo o automotriz vigente con un acreedor financiero, que cumplan con la edad de permanencia establecida para este producto a la fecha del siniestro y con los demás requisitos de asegurabilidad, siempre que este ocurra dentro del período de vigencia de la correspondiente cobertura.'
      const aseguradosLines = doc.splitTextToSize(aseguradosText, contentWidth)
      doc.text(aseguradosLines, margin, y)
      y += aseguradosLines.length * 3 + 4

      // Requisitos de Asegurabilidad
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Requisitos de Asegurabilidad', margin + 2, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text('• Edad Mínima de Ingreso: 18 años', margin, y)
      y += 4
      doc.text('• Edad Máxima de Ingreso: 64 años y 364 días', margin, y)
      y += 4
      doc.text('• Edad máxima de Permanencia: 69 años y 364 días', margin, y)
      y += 5
      doc.setFontSize(7)
      doc.text('La edad del asegurado al inicio del crédito más el plazo del crédito, no deberá superar la edad máxima de permanencia.', margin, y)
      y += 6

      // Beneficiarios
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Beneficiarios', margin + 2, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('El beneficiario para la cobertura de Desgravamen es el acreedor del crédito de consumo o automotriz.', margin, y)
      y += 6

      // Cobertura de Desgravamen
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Cobertura de Desgravamen (POL220150573)', margin + 2, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      const coberturaText1 = 'Conforme a los términos de la presente póliza y en sus condiciones particulares, la Compañía Aseguradora asegura la vida de los deudores asegurados que se hayan incorporado a la póliza, pagado la prima correspondiente, cumpliendo con los demás requisitos de asegurabilidad.'
      const coberturaLines1 = doc.splitTextToSize(coberturaText1, contentWidth)
      doc.text(coberturaLines1, margin, y)
      y += coberturaLines1.length * 3 + 3

      const coberturaText2 = 'De acuerdo a lo anterior, la indemnización correspondiente al capital asegurado de un Deudor-Asegurado según lo indicado en las Condiciones Particulares de la póliza, será pagado por la Compañía Aseguradora al acreedor Beneficiario de esta póliza, inmediatamente después de haberse comprobado por ésta que el fallecimiento del Asegurado ocurrió durante la vigencia de la cobertura para dicho Asegurado, y que no se produjo bajo algunas de las exclusiones señaladas en el artículo 4° las Condiciones Generales. Si el Asegurado sobrevive a la fecha de vencimiento de la cobertura otorgada por esta póliza, no habrá derecho a indemnización alguna.'
      const coberturaLines2 = doc.splitTextToSize(coberturaText2, contentWidth)
      doc.text(coberturaLines2, margin, y)
      y += coberturaLines2.length * 3 + 5

      // Prima del Seguro
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Prima del Seguro', margin + 2, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('La prima bruta de este seguro es única, y corresponde a una tasa multiplicada por el monto de cada crédito.', margin, y)
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.text('Prima = Saldo insoluto Inicial * TBM * nper', margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.text('Donde:', margin, y)
      y += 3
      doc.text('• SI: Saldo insoluto inicial', margin + 5, y)
      y += 3
      doc.text('• TBM: Tasa Bruta Mensual', margin + 5, y)
      y += 3
      doc.text('• Nper: plazo de duración del crédito, en meses', margin + 5, y)
      y += 5

      // Tabla de tasas (repetida)
      doc.setFontSize(7)
      doc.text('La Tasa Bruta Mensual dependerá de la edad del asegurado, al momento de la emisión del certificado:', margin, y)
      y += 4
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setFillColor(230, 230, 230)
      doc.rect(margin, y - 3, 70, 5, 'F')
      doc.rect(margin + 70, y - 3, 50, 5, 'F')
      doc.text('Rangos de Edad de Emisión', margin + 2, y)
      doc.text('Tasa Bruta mensual (por mil)', margin + 72, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.rect(margin, y - 3, 70, 5, 'S')
      doc.rect(margin + 70, y - 3, 50, 5, 'S')
      doc.text('18 – 55 años', margin + 2, y)
      doc.text('0,2970', margin + 72, y)
      y += 5
      doc.rect(margin, y - 3, 70, 5, 'S')
      doc.rect(margin + 70, y - 3, 50, 5, 'S')
      doc.text('56 – 65 años', margin + 2, y)
      doc.text('0,3733', margin + 72, y)
      y += 8

      // ===================== PAGE 3 =====================
      doc.addPage()
      y = 15

      // Exclusiones
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Exclusiones Cobertura de Desgravamen (POL220150573, Artículo N°4)', margin + 2, y)
      y += 7
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Este seguro no cubre el riesgo de muerte si el fallecimiento del Asegurado fuere causado por:', margin, y)
      y += 4
      doc.text('a) Guerra, terrorismo o cualquier conflicto armado.', margin + 5, y)
      y += 3
      const exclusionB = 'b) Suicidio. No obstante, esta exclusión cesará si hubieren transcurrido 2 años completos e ininterrumpidos de cobertura desde la contratación.'
      const exclusionBLines = doc.splitTextToSize(exclusionB, contentWidth - 10)
      doc.text(exclusionBLines, margin + 5, y)
      y += exclusionBLines.length * 3
      doc.text('c) Acto delictivo cometido, en calidad de autor o cómplice, por el asegurado.', margin + 5, y)
      y += 3
      doc.text('d) Energía atómica o nuclear.', margin + 5, y)
      y += 6

      // Procedimiento de Denuncia
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Procedimiento de Denuncia de Siniestro', margin + 2, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      const denunciaText = 'En caso de consultas, reclamos y denuncias de siniestro, el asegurado se deberá comunicar al teléfono 600 600 4490. En todos los casos la compañía se reserva el derecho de pedir mayores antecedentes para la liquidación del siniestro. En todas las denuncias deberá dejarse constancia del nombre, dirección y teléfono de la persona denunciante para posteriores contactos que sean necesarios.'
      const denunciaLines = doc.splitTextToSize(denunciaText, contentWidth)
      doc.text(denunciaLines, margin, y)
      y += denunciaLines.length * 3 + 3

      doc.text('Para efectuar el denuncio de un siniestro, se deberá presentar al asegurador los siguientes antecedentes junto al formulario "Denuncio de Siniestros":', margin, y)
      y += 5

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('Cobertura Fallecimiento', margin, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('• Certificado de defunción original con causa de muerte.', margin + 5, y)
      y += 3
      doc.text('• Formulario de denuncio de siniestro', margin + 5, y)
      y += 3
      doc.text('• Fotocopia de la cédula de identidad del asegurado.', margin + 5, y)
      y += 3
      doc.text('• En caso de muerte presunta, ésta deberá acreditarse de conformidad a la ley.', margin + 5, y)
      y += 3
      doc.text('• Certificado de saldo de la deuda, emitido por la entidad contratante a la fecha de fallecimiento del deudor.', margin + 5, y)
      y += 3
      doc.text('• Otros antecedentes que se estimen convenientes y necesarios para la evaluación del siniestro.', margin + 5, y)
      y += 6

      // Plazo de Pago
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Plazo de Pago de Siniestros', margin + 2, y)
      y += 6
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
      y += 6

      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('Recaudador:', margin, y)
      doc.text('TDV SERVICIOS SPA, Rut: 78.168.126-1', margin + 40, y)
      y += 4
      doc.text('Comisión de Cobranza:', margin, y)
      doc.text('35% + IVA sobre la prima recaudada', margin + 40, y)
      y += 4
      doc.text('Corredor:', margin, y)
      doc.text('PRIME CORREDORES DE SEGUROS SPA, Rut: 76.196.802-5', margin + 40, y)
      y += 4
      doc.text('Comisión de Intermediación:', margin, y)
      doc.text('15% + IVA sobre la prima recaudada', margin + 40, y)
      y += 4
      doc.text('Comisión CEF:', margin, y)
      doc.text('Se calculará de acuerdo con la siguiente fórmula.', margin + 40, y)
      y += 6

      doc.setFont('helvetica', 'bold')
      doc.text('Primero:', margin, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.text('Resultado AUG Pre CEFt = Prima Cliente Brutat - Comisión de Recaudación Brutat - Comisión de Intermediación Brutat – Siniestrost – IBNRt - Costos de Liq. de Siniestrost – Costos Fijost', margin, y)
      y += 3
      doc.text('Resultado AUG tras CEFt = Resultado AUG Pre CEFt x 10%', margin, y)
      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text('Segundo:', margin, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.text('CEFt = Resultado Bruto Pre CEFt × 10% - Pérdida Acarreadat-1', margin, y)

      // ===================== PAGE 4 =====================
      doc.addPage()
      y = 15

      // Notas Importantes
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Notas Importantes', margin + 2, y)
      y += 7

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      
      doc.text('1. El asegurado declara:', margin, y)
      y += 4
      const nota1a = 'a) Conocer, haber sido previa y completamente informado y aceptar las condiciones señaladas en esta Solicitud de Incorporación y Certificado de Cobertura que suscribe en manifestación de su voluntad libre y espontánea de contratar el seguro.'
      const nota1aLines = doc.splitTextToSize(nota1a, contentWidth - 10)
      doc.text(nota1aLines, margin + 5, y)
      y += nota1aLines.length * 3

      doc.text('b) Haber tomado conocimiento del derecho a decidir sobre la contratación voluntaria del seguro y la libre elección de la compañía aseguradora.', margin + 5, y)
      y += 6

      doc.text('c) Que el contratante colectivo de la Póliza N°342 es TDV SERVICIOS SPA.', margin + 5, y)
      y += 4

      const nota1d = 'd) Que las coberturas tendrán vigencia desde la firma de esta solicitud de incorporación por parte del asegurado. En este caso la presente solicitud hará las veces de certificado de cobertura conforme a la circular N° 2123 de la Comisión Para el Mercado Financiero.'
      const nota1dLines = doc.splitTextToSize(nota1d, contentWidth - 10)
      doc.text(nota1dLines, margin + 5, y)
      y += nota1dLines.length * 3 + 2

      const nota2 = '2. La presente Solicitud de Incorporación, Propuesta y Certificado de Cobertura es un resumen con la descripción general del seguro, sus coberturas y el procedimiento a seguir en caso de siniestro. El resumen de los seguros es parcial y no reemplaza a las condiciones particulares ni generales de las respectivas pólizas y sólo tienen un carácter informativo. En caso de requerir una copia de las Condiciones Generales y Particulares del seguro, el cliente debe solicitarlas al contratante colectivo de la póliza.'
      const nota2Lines = doc.splitTextToSize(nota2, contentWidth - 5)
      doc.text(nota2Lines, margin, y)
      y += nota2Lines.length * 3 + 2

      const nota3 = '3. Vigencia de la Póliza Colectiva: La póliza colectiva tendrá vigencia desde el 01 de octubre de 2025 hasta el 30 de septiembre de 2028 y se renovará tácita y sucesivamente en los mismos términos, por periodos de 1 año cada uno, salvo voluntad en contrario dada por el contratante o la aseguradora, según corresponda, por medio de carta certificada notarial enviado al domicilio de la parte correspondiente.'
      const nota3Lines = doc.splitTextToSize(nota3, contentWidth - 5)
      doc.text(nota3Lines, margin, y)
      y += nota3Lines.length * 3 + 2

      const nota4 = '4. Vigencia de la Póliza Individual: Para aquellas personas que cumplan con los requisitos de asegurabilidad, la cobertura comenzará a regir a partir de la fecha de firma de la Solicitud de Incorporación y se mantendrá vigente hasta la extinción del crédito de consumo que le fue otorgado por TDV SERVICIOS SPA.'
      const nota4Lines = doc.splitTextToSize(nota4, contentWidth - 5)
      doc.text(nota4Lines, margin, y)
      y += nota4Lines.length * 3 + 2

      doc.text('5. Término Anticipado: Las coberturas de esta póliza terminarán anticipadamente respecto de un asegurado, en los siguientes casos:', margin, y)
      y += 4
      doc.text('a) En caso de renegociación, anulación o prepago del crédito de consumo.', margin + 5, y)
      y += 3
      const nota5b = 'b) El no pago de la respectiva prima por parte del asegurado una vez vencido el periodo de gracia señalado en el artículo 13 de las condiciones particulares.'
      const nota5bLines = doc.splitTextToSize(nota5b, contentWidth - 10)
      doc.text(nota5bLines, margin + 5, y)
      y += nota5bLines.length * 3
      const nota5c = 'c) Al momento que el asegurado cumpla la edad máxima de permanencia establecida en las condiciones particulares de esta póliza. Asimismo, la cobertura individual de esta póliza terminará inmediatamente respecto de un Asegurado, en el instante en que éste deje de ser deudor del Acreedor.'
      const nota5cLines = doc.splitTextToSize(nota5c, contentWidth - 10)
      doc.text(nota5cLines, margin + 5, y)
      y += nota5cLines.length * 3
      doc.text('d) Por la pérdida de la calidad de asegurado de conformidad a lo establecido en las condiciones particulares.', margin + 5, y)
      y += 5

      const nota6 = '6. La contratación de estos seguros es de carácter voluntario. Usted puede retractarse si la contratación la efectuó por un medio a distancia. Además, usted puede terminar los seguros voluntarios anticipadamente en cualquier momento, independiente del medio utilizado para su contratación.'
      const nota6Lines = doc.splitTextToSize(nota6, contentWidth - 5)
      doc.text(nota6Lines, margin, y)
      y += nota6Lines.length * 3 + 5

      // ===================== PAGE 5 =====================
      doc.addPage()
      y = 15

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
      const autoregText = 'La compañía de seguros Augustar Seguros de Vida S.A. se encuentra adherida voluntariamente al código de autorregulación y al compendio de buenas prácticas de las compañías de seguros, cuyo propósito es propender al desarrollo del mercado de los seguros, en consonancia con los principios de libre competencia y buena fe que debe existir entre las empresas, y entre éstas y sus clientes. Copia del compendio de buenas prácticas corporativas de las compañías de seguros, se encuentra a disposición de los interesados en las oficinas de Augustar Seguros de Vida S.A. y en www.aach.cl.'
      const autoregLines = doc.splitTextToSize(autoregText, contentWidth)
      doc.text(autoregLines, margin, y)
      y += autoregLines.length * 3 + 3

      const defensorText = 'Asimismo, Augustar Seguros de Vida S.A. se encuentra adherida voluntariamente a la institución del Defensor del Asegurado dependiente del Consejo de Autorregulación de las Compañías de Seguros, y cuya finalidad es velar por el desarrollo del mercado de seguros bajo el principio de buena fe, debiendo conforme a sus estatutos conocer y resolver los conflictos y/o reclamos que pudieran producirse entre las Compañías y sus clientes. Para más información, ésta se encuentra disponible en www.ddachile.cl; teléfono 800 646 232, desde celulares 22 234 3583, o bien En Augusto Leguía Sur N° 79, oficina 1210, Las Condes.'
      const defensorLines = doc.splitTextToSize(defensorText, contentWidth)
      doc.text(defensorLines, margin, y)
      y += defensorLines.length * 3 + 6

      // Información sobre atención de clientes
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Información sobre atención de clientes y presentación de consultas y reclamos', margin + 2, y)
      y += 7

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      const atencionText1 = 'En virtud de la circular nro. 2.131 de 28 de noviembre de 2013, las compañías de seguros, corredores de seguros y liquidadores de siniestros, deberán recibir, registrar y responder todas las presentaciones, consultas o reclamos que se les presenten directamente por el contratante, asegurado, beneficiarios o legítimos interesados o sus mandatarios.'
      const atencionLines1 = doc.splitTextToSize(atencionText1, contentWidth)
      doc.text(atencionLines1, margin, y)
      y += atencionLines1.length * 3 + 2

      doc.text('Las presentaciones pueden ser efectuadas en todas las oficinas de las entidades que se atienda público, presencialmente, por correo postal, medios electrónicos, o telefónicamente, sin formalidades, en el horario normal de atención.', margin, y)
      y += 8

      const contactoText = 'En caso de consultas y/o reclamos y, el Asegurado debe comunicarse con el Servicio de Atención al Cliente de Augustar Seguros de Vida S.A., número 600 600 4490 o correo electrónico svida@augustarseguros.cl. El Asegurado también puede enviar su consulta o solicitud al Servicio de Atención al Cliente TDV SERVICIOS SPA. al correo electrónico contacto@tedevuelvo.cl o llamando a los números 228404900 - 228404905.'
      const contactoLines = doc.splitTextToSize(contactoText, contentWidth)
      doc.text(contactoLines, margin, y)
      y += contactoLines.length * 3 + 2

      doc.text('Recibida una presentación, consulta o reclamo, ésa deberá ser respondida en el plazo más breve posible, el que no podrá exceder de 20 días hábiles contados desde su recepción.', margin, y)
      y += 6

      const cmfText = 'Interesado, en caso de disconformidad respecto de lo informado, o bien cuando exista demora injustificada de la respuesta, podrá recurrir a la Comisión Para el Mercado Financiero, área de protección al inversionista y asegurado, cuyas oficinas se encuentran ubicadas en avda. Libertador Bernardo O\'Higgins 1449 piso 1, Santiago, o a través del sitio web www.cmfchile.cl.'
      const cmfLines = doc.splitTextToSize(cmfText, contentWidth)
      doc.text(cmfLines, margin, y)
      y += cmfLines.length * 3 + 6

      // Autorización para el Tratamiento de Datos Personales
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
      y += datosLines.length * 3 + 6

      // Mandato y Autorización
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.text('Mandato y Autorización', margin + 2, y)
      y += 7

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      const mandatoText = 'Conforme a lo dispuesto en el Artículo 13 y 3 del Contrato de Crédito, por medio del presente mandato, faculto a TDV SERVICIOS SPA. para incorporarme a la Póliza Colectiva Nº 342 emitida por Augustar Seguros de Vida S.A., cuyas condiciones de cobertura, monto de prima única a pagar, vigencia, exclusiones y condiciones de asegurabilidad conozco a cabalidad y las cuales acepto voluntaria e informadamente. El mandatario rendirá cuenta de este encargo junto con la entrega o envío del presente documento. Asimismo, autorizo a TDV SERVICIOS SPA., en caso de término del seguro suscrito, excepto por siniestralidad, para cobrar y percibir en mi nombre y representación de Augustar Seguros de Vida S.A. la prima no consumida en conformidad a lo dispuesto en la Circular 2114 de la Comisión para el Mercado Financiero, debiendo rendir cuenta de su gestión de acuerdo con lo estipulado en el contrato de crédito.'
      const mandatoLines = doc.splitTextToSize(mandatoText, contentWidth)
      doc.text(mandatoLines, margin, y)
      y += mandatoLines.length * 3 + 10

      // Firmas
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('TDV SERVICIOS SPA', margin + 10, y)
      doc.text('AuguStar Seguros de Vida S.A.', pageWidth / 2 - 15, y)
      doc.text('Asegurado', pageWidth - margin - 30, y)
      y += 5

      // Agregar firma TDV
      if (firmaTdvBase64) {
        doc.addImage(firmaTdvBase64, 'PNG', margin + 10, y, 30, 18)
      }

      // Agregar firma AuguStar (entre título y línea)
      if (firmaBase64) {
        doc.addImage(firmaBase64, 'JPEG', pageWidth / 2 - 15, y, 30, 18)
      }
      y += 20

      // Líneas para firmas
      doc.line(margin, y, margin + 45, y)
      doc.line(pageWidth / 2 - 25, y, pageWidth / 2 + 25, y)
      doc.line(pageWidth - margin - 45, y, pageWidth - margin, y)

      // Download
      const fileName = `Certificado_Cobertura_${refund.rut.replace(/\./g, '').replace('-', '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)

      toast({
        title: 'Certificado generado',
        description: 'El certificado de cobertura se descargó correctamente',
      })
      setOpen(false)
    } catch (error) {
      console.error('Error generating certificate:', error)
      toast({
        title: 'Error',
        description: 'No se pudo generar el certificado',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!isMandateSigned} className="gap-1.5">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Cert.</span> Desgravamen
                </Button>
              </DialogTrigger>
            </span>
          </TooltipTrigger>
          {!isMandateSigned && (
            <TooltipContent>
              <p>El mandato debe estar firmado</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {step === 'form' ? 'Certificado de Cobertura' : 'Previsualización del Certificado'}
            {isBancoChileRefund && (
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 border-blue-500/30">
                Banco de Chile
              </Badge>
            )}
            {isPrimeFormat && (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                Póliza 344 (Prime)
              </Badge>
            )}
            {!isPrimeFormat && (
              <Badge variant="outline" className="text-muted-foreground">
                Póliza 342
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 overflow-auto pr-4">
          {step === 'form' ? (
            // ========== FORMULARIO ==========
            <div className="space-y-4 py-2">
              {/* Sección: Datos del Asegurado */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4 text-primary" />
                  Datos del Asegurado (desde solicitud)
                </div>
                <div className="bg-muted/50 p-3 rounded-lg border border-border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Nombre</span>
                      <p className="font-medium truncate">{refund.fullName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">RUT</span>
                      <p className="font-medium">{refund.rut}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Email</span>
                      <p className="font-medium truncate">{refund.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Teléfono</span>
                      <p className="font-medium">{refund.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Fecha Nacimiento</span>
                      <p className="font-medium">{formatDate(refund.calculationSnapshot?.birthDate)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Edad</span>
                      <p className="font-medium">{refund.calculationSnapshot?.age || 'N/A'} años</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Monto Crédito</span>
                      <p className="font-medium">${(refund.calculationSnapshot?.averageInsuredBalance || refund.calculationSnapshot?.remainingBalance || 0).toLocaleString('es-CL')}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Cuotas Pendientes</span>
                      <p className="font-medium">{refund.calculationSnapshot?.remainingInstallments || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección: Datos del Certificado */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Datos del Certificado
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Folio</Label>
                    <Input
                      value={formData.folio}
                      onChange={(e) => handleChange('folio', e.target.value)}
                      placeholder="N° folio"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nro. Operación</Label>
                    <Input
                      value={formData.nroOperacion}
                      onChange={(e) => handleChange('nroOperacion', e.target.value)}
                      placeholder="N° operación"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Saldo Insoluto</Label>
                    <Input
                      value={formData.saldoInsoluto ? Number(formData.saldoInsoluto).toLocaleString('es-CL') : ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                        handleChange('saldoInsoluto', value)
                      }}
                      placeholder="Monto"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha Inicio</Label>
                    <Input
                      value={formData.fechaInicioCredito}
                      onChange={(e) => handleChange('fechaInicioCredito', e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fecha Fin</Label>
                    <Input
                      value={formData.fechaFinCredito}
                      onChange={(e) => handleChange('fechaFinCredito', e.target.value)}
                      placeholder="DD/MM/YYYY"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Sección: Beneficiario Irrevocable (solo Banco de Chile) */}
              {isBancoChileRefund && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-primary" />
                    Beneficiario Irrevocable (Banco de Chile)
                  </div>
                  <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/30 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nombre del Beneficiario</Label>
                        <Input
                          value={formData.beneficiarioNombre}
                          onChange={(e) => handleChange('beneficiarioNombre', e.target.value)}
                          placeholder="Nombre completo del beneficiario"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">RUT del Beneficiario</Label>
                        <Input
                          value={formData.beneficiarioRut}
                          onChange={(e) => handleChange('beneficiarioRut', e.target.value)}
                          placeholder="12.345.678-9"
                          className="h-9"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Este beneficiario aparecerá como beneficiario irrevocable en el certificado de cobertura.
                    </p>
                  </div>
                </div>
              )}

              {/* Sección: Datos Personales (con búsqueda RUT) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4 text-primary" />
                    Datos Personales del Cliente
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchRutInfo}
                    disabled={isLoadingRut}
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    {isLoadingRut ? 'Buscando...' : 'Buscar Información'}
                  </Button>
                </div>
                
                <div className="bg-muted/30 p-3 rounded-lg border border-border space-y-2">
                  {/* Fila 1: Dirección completa */}
                  <div className="grid grid-cols-12 gap-2">
                    <div className="space-y-1.5 col-span-7">
                      <Label className="text-xs">Dirección</Label>
                      <Input
                        value={formData.direccion}
                        onChange={(e) => handleChange('direccion', e.target.value)}
                        placeholder="Calle o avenida"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Número</Label>
                      <Input
                        value={formData.numero}
                        onChange={(e) => handleChange('numero', e.target.value)}
                        placeholder="N°"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-3">
                      <Label className="text-xs">Depto/Block</Label>
                      <Input
                        value={formData.depto}
                        onChange={(e) => handleChange('depto', e.target.value)}
                        placeholder="Depto"
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Fila 2: Ciudad, Comuna, Celular, Sexo, Autoriza email */}
                  <div className="grid grid-cols-5 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ciudad</Label>
                      <Input
                        value={formData.ciudad}
                        onChange={(e) => handleChange('ciudad', e.target.value)}
                        placeholder="Ciudad"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Comuna</Label>
                      <Input
                        value={formData.comuna}
                        onChange={(e) => handleChange('comuna', e.target.value)}
                        placeholder="Comuna"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Celular</Label>
                      <Input
                        value={formData.celular}
                        onChange={(e) => handleChange('celular', e.target.value)}
                        placeholder="+56 9..."
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sexo</Label>
                      <Select value={formData.sexo} onValueChange={(v) => handleChange('sexo', v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Autoriza email</Label>
                      <Select value={formData.autorizaEmail} onValueChange={(v) => handleChange('autorizaEmail', v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SI">Sí</SelectItem>
                          <SelectItem value="NO">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prima calculada */}
              <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Prima Única del Seguro (calculada):</span>
                  <span className="text-lg font-bold text-primary">${calculatePrimaUnica().toLocaleString('es-CL')} CLP</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Fórmula: Saldo insoluto × TBM × Nper
                </p>
                <p className="text-xs text-muted-foreground">
                  ${getSaldoInsolutoValue().toLocaleString('es-CL')} × {getTasaBrutaMensual(refund.calculationSnapshot?.age).toFixed(4)} por mil × {refund.calculationSnapshot?.remainingInstallments || 0} cuotas
                </p>
              </div>
            </div>
          ) : (
            // ========== PREVISUALIZACIÓN ==========
            <div className="space-y-4 py-2">
              {/* Resumen del Asegurado */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <User className="h-4 w-4" />
                  Datos del Asegurado
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nombre:</span>
                      <span className="font-medium">{refund.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RUT:</span>
                      <span className="font-medium">{refund.rut}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="font-medium">{refund.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha Nacimiento:</span>
                      <span className="font-medium">{formatDate(refund.calculationSnapshot?.birthDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Edad:</span>
                      <span className="font-medium">{refund.calculationSnapshot?.age} años</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sexo:</span>
                      <span className="font-medium">{formData.sexo === 'M' ? 'Masculino' : formData.sexo === 'F' ? 'Femenino' : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen Dirección */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <MapPin className="h-4 w-4" />
                  Dirección
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="flex justify-between col-span-2">
                      <span className="text-muted-foreground">Dirección completa:</span>
                      <span className="font-medium">
                        {formData.direccion || 'N/A'} {formData.numero && `N° ${formData.numero}`} {formData.depto && `Depto ${formData.depto}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ciudad:</span>
                      <span className="font-medium">{formData.ciudad || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Comuna:</span>
                      <span className="font-medium">{formData.comuna || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Celular:</span>
                      <span className="font-medium">{formData.celular || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Autoriza email:</span>
                      <span className="font-medium">{formData.autorizaEmail === 'SI' ? 'Sí' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen del Certificado */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <CreditCard className="h-4 w-4" />
                  Datos del Certificado
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border border-border">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Folio:</span>
                      <span className="font-medium">{formData.folio || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nro. Operación:</span>
                      <span className="font-medium">{formData.nroOperacion || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha Inicio Crédito:</span>
                      <span className="font-medium">{formData.fechaInicioCredito || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha Fin Crédito:</span>
                      <span className="font-medium">{formData.fechaFinCredito || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Saldo Insoluto:</span>
                      <span className="font-medium">${getSaldoInsolutoValue().toLocaleString('es-CL')} CLP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monto Crédito:</span>
                      <span className="font-medium">${(refund.calculationSnapshot?.averageInsuredBalance || refund.calculationSnapshot?.remainingBalance || 0).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plazo (meses):</span>
                      <span className="font-medium">{refund.calculationSnapshot?.originalInstallments || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen del Beneficiario Irrevocable (solo Banco de Chile) */}
              {isBancoChileRefund && (formData.beneficiarioNombre || formData.beneficiarioRut) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                    <User className="h-4 w-4" />
                    Beneficiario Irrevocable
                  </div>
                  <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Nombre:</span>
                        <span className="font-medium">{formData.beneficiarioNombre || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">RUT:</span>
                        <span className="font-medium">{formData.beneficiarioRut || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Prima calculada destacada */}
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Prima Única del Seguro:</span>
                  <span className="text-xl font-bold text-primary">${calculatePrimaUnica().toLocaleString('es-CL')} CLP</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Fórmula: Saldo insoluto × TBM × Nper
                </p>
                <p className="text-xs text-muted-foreground">
                  ${(refund.calculationSnapshot?.averageInsuredBalance || refund.calculationSnapshot?.remainingBalance || 0).toLocaleString('es-CL')} × {getTasaBrutaMensual(refund.calculationSnapshot?.age).toFixed(4)} por mil × {refund.calculationSnapshot?.remainingInstallments || 0} cuotas
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-3 border-t mt-2">
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handlePreview} className="gap-2">
                <Eye className="h-4 w-4" />
                Previsualizar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBackToEdit} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver a Editar
              </Button>
              <Button onClick={generatePDF} disabled={isGenerating} className="gap-2">
                {isGenerating ? (
                  'Generando...'
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Descargar PDF
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
