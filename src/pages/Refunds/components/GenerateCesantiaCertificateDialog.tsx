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
import { Briefcase, Download, Search, ArrowLeft, Eye, Upload } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { RefundRequest } from '@/types/refund'
import { authService } from '@/services/authService'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import jsPDF from 'jspdf'
import { useQueryClient } from '@tanstack/react-query'

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'

interface GenerateCesantiaCertificateDialogProps {
  refund: RefundRequest
  isMandateSigned?: boolean
}

interface CesantiaCertificateData {
  correlativo: string
  apellidoPaterno: string
  apellidoMaterno: string
  nombres: string
  fechaNacimiento: string
  estadoCivil: string
  direccion: string
  comuna: string
  region: string
  telefono: string
  email: string
  // Ejecutivo
  rutEjecutivo: string
  nombreEjecutivo: string
  oficina: string
  fonoEjecutivo: string
  // Seguro
  nroOperacion: string
  inicioVigencia: string
  terminoVigencia: string
  montoCredito: string
  montoCuota: string
  plazoMeses: string
  primaNeta: string
}

const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  try {
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, year, month, day] = match
      return `${day}/${month}/${year}`
    }
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

const getTodayFormatted = () => {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = today.getFullYear()
  return `${day}/${month}/${year}`
}

// Tasa única (0,094% para todos los tramos según nueva póliza 0020123902)
const TASA_CESANTIA_BRUTA = 0.094
const getTasaCesantia = (_montoCredito: number): number => TASA_CESANTIA_BRUTA

const getTramoLabel = (montoCredito: number): string => {
  if (montoCredito >= 500000 && montoCredito <= 1000000) return 'Tramo 1 ($500.000 - $1.000.000)'
  if (montoCredito > 1000000 && montoCredito <= 3000000) return 'Tramo 2 ($1.000.001 - $3.000.000)'
  if (montoCredito > 3000000 && montoCredito <= 5000000) return 'Tramo 3 ($3.000.001 - $5.000.000)'
  if (montoCredito > 5000000 && montoCredito <= 7000000) return 'Tramo 4 ($5.000.001 - $7.000.000)'
  if (montoCredito > 7000000) return 'Tramo 5 ($7.000.001 o más)'
  return 'Tramo 1 ($500.000 - $1.000.000)'
}

export function GenerateCesantiaCertificateDialog({ refund, isMandateSigned = false }: GenerateCesantiaCertificateDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'preview'>('form')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingRut, setIsLoadingRut] = useState(false)
  const queryClient = useQueryClient()

  // Separar nombre completo en partes: Nombre(s) ApellidoPaterno ApellidoMaterno
  const nameParts = refund.fullName?.split(' ').filter(p => p.trim()) || []
  // Si hay 3+ partes: nombres = todo menos los 2 últimos, penúltimo = apellido paterno, último = apellido materno
  // Si hay 2 partes: primer = nombres, segundo = apellido paterno, sin apellido materno
  // Si hay 1 parte: solo nombres
  const defaultNombres = nameParts.length >= 3 
    ? nameParts.slice(0, nameParts.length - 2).join(' ') 
    : (nameParts[0] || '')
  const defaultApellidoPaterno = nameParts.length >= 3 
    ? nameParts[nameParts.length - 2] 
    : (nameParts.length === 2 ? nameParts[1] : '')
  const defaultApellidoMaterno = nameParts.length >= 3 ? nameParts[nameParts.length - 1] : ''

  const [formData, setFormData] = useState<CesantiaCertificateData>({
    correlativo: '',
    apellidoPaterno: defaultApellidoPaterno,
    apellidoMaterno: defaultApellidoMaterno,
    nombres: defaultNombres,
    fechaNacimiento: formatDate(refund.calculationSnapshot?.birthDate),
    estadoCivil: '',
    direccion: '',
    comuna: '',
    region: '',
    telefono: refund.phone || '',
    email: refund.email || '',
    rutEjecutivo: '',
    nombreEjecutivo: '',
    oficina: '',
    fonoEjecutivo: '',
    nroOperacion: '',
    inicioVigencia: getTodayFormatted(),
    terminoVigencia: '',
    montoCredito: (
      refund.calculationSnapshot?.confirmedAverageInsuredBalance ||
      refund.calculationSnapshot?.averageInsuredBalance ||
      0
    ).toString(),
    montoCuota: '',
    plazoMeses: (refund.calculationSnapshot?.remainingInstallments || 0).toString(),
    primaNeta: '',
  })

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setStep('form')
    }
  }

  const handlePreview = () => {
    setStep('preview')
  }

  const handleBackToEdit = () => {
    setStep('form')
  }

  const handleChange = (field: keyof CesantiaCertificateData, value: string) => {
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
      
      const direccion = data.data?.direccion || ''
      const comuna = data.data?.comuna || ''
      
      setFormData(prev => ({
        ...prev,
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

  const calculatePrimaNeta = () => {
    const montoCredito = parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.')) || 0
    const plazoMeses = parseInt(formData.plazoMeses) || 0
    const tasa = getTasaCesantia(montoCredito)
    return Math.round(montoCredito * (tasa / 100) * plazoMeses)
  }

  const buildPDF = async (): Promise<{ blob: Blob; fileName: string }> => {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 15
      const contentWidth = pageWidth - margin * 2
      let y = 15
      const FOOTER_RESERVED = 18

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(0, 70, 130)
        doc.text('Southbridge', pageWidth - margin, 14, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text('Insurance Company', pageWidth - margin, 18, { align: 'right' })
        doc.setTextColor(0, 0, 0)
      }

      const drawFooter = (pageNum: number) => {
        doc.setFontSize(6)
        doc.setTextColor(128, 128, 128)
        doc.text(`Generado el ${getTodayFormatted()} - TDV Servicios SPA`, margin, pageHeight - 8)
        doc.text(`Pagina ${pageNum}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
        doc.setTextColor(0, 0, 0)
      }

      let pageNum = 1
      const newPage = () => {
        drawFooter(pageNum)
        doc.addPage()
        pageNum += 1
        drawHeader()
        y = 24
      }

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - FOOTER_RESERVED) newPage()
      }

      const writeParagraph = (
        text: string,
        opts: { size?: number; bold?: boolean; lh?: number; indent?: number } = {}
      ) => {
        const size = opts.size ?? 8
        const lh = opts.lh ?? 4.2
        const indent = opts.indent ?? 0
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
        doc.setFontSize(size)
        const lines = doc.splitTextToSize(text, contentWidth - indent)
        lines.forEach((line: string) => {
          ensureSpace(lh)
          doc.text(line, margin + indent, y)
          y += lh
        })
        // pequeño espacio entre párrafos
        y += 1.8
      }

      const writeHeading = (text: string, size = 10) => {
        // espacio antes del título de sección
        y += 4
        ensureSpace(12)
        doc.setFillColor(235, 235, 235)
        doc.rect(margin, y - 4, contentWidth, 7, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(size)
        doc.text(text, margin + 2, y)
        y += 9
      }

      const writeSubHeading = (text: string, size = 9) => {
        // espacio antes del subtítulo
        y += 2.5
        ensureSpace(8)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(size)
        doc.text(text, margin, y)
        y += 6
      }

      const drawField = (label: string, value: string, x: number, yPos: number, width: number) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(90, 90, 90)
        doc.text(label, x, yPos)
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        const valueLines = doc.splitTextToSize(value || '-', width - 2)
        doc.text(valueLines[0] || '-', x, yPos + 4)
        doc.setDrawColor(200, 200, 200)
        doc.line(x, yPos + 5.5, x + width - 2, yPos + 5.5)
      }

      // ===================== PAGE 1 =====================
      drawHeader()
      y = 24

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('POLIZA DE SEGURO DE DESEMPLEO INVOLUNTARIO /', pageWidth / 2, y, { align: 'center' })
      y += 5
      doc.text('CERTIFICADO DE COBERTURA', pageWidth / 2, y, { align: 'center' })
      y += 8

      doc.setFontSize(9)
      doc.text('Nro Poliza: ', margin, y)
      doc.setFont('helvetica', 'normal')
      doc.text(`0020123902 - ${formData.correlativo || '-'} (numero de certificado)`, margin + 22, y)
      y += 7

      writeHeading('Antecedentes del Asegurado')

      const colW = contentWidth / 3
      const c1 = margin
      const c2 = margin + colW
      const c3 = margin + colW * 2

      drawField('Apellido Paterno', formData.apellidoPaterno, c1, y, colW)
      drawField('Apellido Materno', formData.apellidoMaterno, c2, y, colW)
      drawField('Nombre(s)', formData.nombres, c3, y, colW)
      y += 10

      drawField('RUT', refund.rut || '', c1, y, colW)
      drawField('Fecha de Nacimiento', formData.fechaNacimiento, c2, y, colW)
      drawField('Estado Civil', formData.estadoCivil, c3, y, colW)
      y += 10

      drawField('Direccion Particular', formData.direccion, c1, y, contentWidth)
      y += 10

      drawField('Comuna', formData.comuna, c1, y, colW)
      drawField('Region', formData.region, c2, y, colW)
      y += 10

      drawField('Telefono Particular', formData.telefono, c1, y, colW)
      drawField('Email', formData.email, c2, y, colW * 2)
      y += 12

      writeHeading('Antecedentes del Ejecutivo')
      drawField('RUT', formData.rutEjecutivo, c1, y, colW)
      drawField('Nombre', formData.nombreEjecutivo, c2, y, colW * 2)
      y += 10
      drawField('Oficina', formData.oficina, c1, y, colW)
      drawField('Fono', formData.fonoEjecutivo, c2, y, colW)
      y += 12

      writeHeading('Antecedentes del Seguro')
      const montoCredito = parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.')) || 0
      const primaNeta = calculatePrimaNeta()

      drawField('Nro Operacion', formData.nroOperacion, c1, y, colW)
      drawField('Inicio Vigencia', formData.inicioVigencia, c2, y, colW)
      drawField('Termino Vigencia', formData.terminoVigencia, c3, y, colW)
      y += 10

      const cw4 = contentWidth / 4
      drawField('Monto del Credito', `$${montoCredito.toLocaleString('es-CL')}`, margin, y, cw4)
      drawField('Monto Cuota', formData.montoCuota ? `$${formData.montoCuota}` : '-', margin + cw4, y, cw4)
      drawField('Plazo (meses)', formData.plazoMeses, margin + cw4 * 2, y, cw4)
      drawField('Prima Neta', `$${primaNeta.toLocaleString('es-CL')}`, margin + cw4 * 3, y, cw4)
      y += 12

      ensureSpace(20)
      doc.setFillColor(220, 220, 220)
      doc.rect(margin, y - 4, contentWidth / 2, 6, 'F')
      doc.rect(margin + contentWidth / 2, y - 4, contentWidth / 2, 6, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('Coberturas', margin + 2, y)
      doc.text('Capital Asegurado', margin + contentWidth / 2 + 2, y)
      y += 4
      doc.setDrawColor(180, 180, 180)
      doc.rect(margin, y - 2, contentWidth / 2, 10)
      doc.rect(margin + contentWidth / 2, y - 2, contentWidth / 2, 10)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text('Desempleo Involuntario', margin + 2, y + 2)
      doc.text('POL 1 2022 0203', margin + 2, y + 6)
      doc.text('Este seguro cubre hasta 3 cuotas mensuales', margin + contentWidth / 2 + 2, y + 2)
      doc.text('con tope maximo de UF 15 por cuota.', margin + contentWidth / 2 + 2, y + 6)
      y += 14

      writeHeading('IMPORTANTE')
      const importantNotes = [
        '1. Este seguro es suscrito por Southbridge Compania de Seguros Generales S.A. Rut: 99.288.000-7, con domicilio en Avenida Presidente Riesco 5335, piso 15, Las Condes.',
        '2. Este documento constituye certificado de cobertura una vez que se completen todos los datos solicitados, se encuentre debidamente firmada por el proponente, se otorgue el credito y se pague la prima pactada.',
        '3. La contratacion de este seguro es de caracter voluntario.',
        '4. Para efectos de este seguro, declaro tener la calidad de trabajador o empleado dependiente. Mediante la siguiente firma, acepto la contratacion de este seguro y que soy trabajador dependiente.',
        '5. Vigencia de la Poliza Colectiva: La poliza tendra vigencia desde el 07 de noviembre de 2025 al 30 de noviembre de 2030.',
        '6. Vigencia de la Poliza Individual: La cobertura de esta poliza iniciara el dia de la contratacion o firma de la solicitud de incorporacion por parte del asegurado individual y se mantendra vigente mientras se encuentre vigente el credito.',
        '7. En este caso la presente solicitud hara las veces de certificado de cobertura conforme a la circular N 2123 de la Comision para el Mercado Financiero.',
        '8. El contratante de este seguro es TDV SERVICIOS SPA, RUT 78.168.126-1.',
        '9. El intermediario de este seguro es PRIME CORREDORES DE SEGUROS SPA, RUT: 76.196.802-5.',
        '10. La compania que cubre el riesgo es Southbridge Compania de Seguros Generales S.A., RUT 99.288.000-7.',
        '11. Numero de Poliza Colectiva: 0020121737.',
        '12. Southbridge se encuentra adherida al Codigo de Autorregulacion de las Companias de Seguros y esta sujeta al Compendio de Buenas Practicas Corporativas. Copia disponible en www.aach.cl. Asimismo, ha aceptado la intervencion del Defensor del Asegurado: www.southbridgeseguros.cl o www.ddachile.cl.',
      ]
      importantNotes.forEach(note => writeParagraph(note, { size: 7, lh: 3.2 }))
      y += 4

      ensureSpace(28)
      doc.setDrawColor(0, 0, 0)
      doc.line(margin + 5, y + 12, margin + 75, y + 12)
      doc.line(pageWidth - margin - 75, y + 12, pageWidth - margin - 5, y + 12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text('Firma Asegurado', margin + 22, y + 16)
      doc.text('Southbridge Compania de Seguros Generales S.A.', pageWidth - margin - 73, y + 16)
      y += 22

      writeParagraph(
        'DECLARO QUE AL ESTAMPAR MI HUELLA, EN SENAL DE FIRMA ELECTRONICA, ESTOY EXPRESAMENTE CONSINTIENDO EN LO QUE HE DECLARADO EN LA DECLARACION PERSONAL DE SALUD Y EN LA DECLARACION PERSONAL DE ACTIVIDADES Y DEPORTES RIESGOSOS ANTERIORES, ASI COMO EN EL RESTO DEL CONTENIDO DE LA PROPUESTA.',
        { size: 7, bold: true, lh: 3.2 }
      )

      // ===================== PAGE 2+ =====================
      newPage()
      writeHeading('Descripción de Coberturas y Condiciones de Asegurabilidad')
      writeSubHeading('Materia Asegurada')
      writeParagraph('En virtud de la presente Póliza, el asegurador cubre el riesgo de Desempleo Involuntario, indemnizando al asegurado hasta con tres (3) cuotas del crédito individualizado en el condicionado particular, en donde la primera cuota a pagar luego de ocurrido el evento de desempleo involuntario es de deducible (primera cuota deducible + indemnización de hasta tres (3) cuotas restantes). Esta Póliza cubre los casos de Desempleo Involuntario que impliquen la privación total de ingresos por conceptos laborales.')
      writeParagraph('El pago se realizará mes a mes, por lo que el asegurado debe proveer los antecedentes solicitados por la compañía para acreditar la continuidad en calidad de desempleado para así cobrar la cuota siguiente. Reintegrándose el asegurado al servicio laboral, con contrato de trabajo, cesará inmediatamente el pago de indemnización con cargo a este seguro.')
      writeParagraph('A su vez, cada asegurado podrá tener solamente contratada una póliza relacionada al presente producto. A mayor abundamiento, en caso de tener más de una póliza contratada, solamente se realizará el pago de una de ellas al momento de un siniestro.')
      y += 2
      writeSubHeading('Coberturas')
      writeParagraph('Desempleo involuntario del asegurado (POL 1 2022 0203)', { bold: true })
      writeParagraph('En virtud de la presente Póliza, el asegurador cubre el riesgo de Desempleo Involuntario, indemnizando al asegurado o beneficiario (en caso de que sea una persona distinta al asegurado) en alguna de las formas que se señalan a continuación, según se indique en las condiciones particulares de la Póliza:')
      writeParagraph('a) El pago de cuotas mensuales que correspondan a una deuda del asegurado singularizada en las condiciones particulares de la Póliza o un porcentaje de la misma, cuyo monto y forma de pago se determinará en las condiciones particulares de la Póliza. En estos casos sólo habrá lugar a la cobertura en la medida existan cuotas devengadas en los meses de cobertura establecidos en las condiciones particulares de la Póliza; o')
      writeParagraph('Asimismo, se podrá establecer en las condiciones particulares de la Póliza, un Periodo de Carencia, una Antigüedad Laboral Mínima, un deducible, un periodo mínimo de permanencia en estado de cesantía, un número máximo de Eventos, una edad máxima de permanencia, sublímites de indemnización, y/o una franquicia.')
      writeParagraph('Se considerará como un solo Evento la ocurrencia de cualquiera de las causales de Desempleo Involuntario.')

      writeParagraph('2.- Procedencia de la indemnización:', { bold: true })
      writeParagraph('Esta Póliza cubre los casos de Desempleo Involuntario que impliquen la privación total de ingresos por conceptos laborales. Lo anterior resultará aplicable a menos que en las condiciones particulares de la Póliza se establezca un porcentaje o una condición que represente una privación parcial de ingresos para todos o algunos de los tipos de trabajadores contemplados en los numerales 1) a 4) de la sección A.1. siguiente:')
      writeParagraph('A.1. La presente cobertura se extenderá a uno o más de los siguientes tipos de trabajadores, según se indique en las condiciones particulares de la Póliza:', { bold: true })
      ;[
        '1) Trabajadores Dependientes.',
        '2) Funcionarios vinculados laboralmente y bajo régimen de subordinación y dependencia a la administración pública centralizada o descentralizada, sometidos al Estatuto Administrativo de acuerdo a la legislación administrativa chilena, que, en virtud de una designación de autoridad, prestan servicios o desempeñan funciones para la administración pública, y percibiendo por tales servicios una remuneración.',
        '3) Los profesionales de la educación vinculados laboralmente y bajo régimen de subordinación y dependencia a la educación municipalizada, sometidos al Estatuto Docente.',
        '4) Los miembros de las Fuerzas Armadas y Fuerzas de Orden y Seguridad Pública.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))

      writeParagraph('A.2. Para efectos del pago de la indemnización correspondiente, sólo se considerarán como causales de Desempleo Involuntario las siguientes:', { bold: true })
      writeParagraph('I) Para el caso de los Trabajadores Dependientes, sólo se considerarán causales de Desempleo Involuntario las siguientes:', { bold: true })
      ;[
        'I.1) Artículo 159 Nº1 del Código del Trabajo: Mutuo acuerdo de las partes, pero sólo en la medida que, en el finiquito respectivo, se hubiere pactado a favor del asegurado una indemnización equivalente o asimilable a años de servicio.',
        'I.2) Artículo 159 N° 6 del Código del Trabajo: caso fortuito o fuerza mayor.',
        'I.3) Artículo 161 del Código del Trabajo: necesidades de la empresa y desahucio del empleador.',
        'I.4) Artículo 163 bis del Código del Trabajo: procedimiento concursal de liquidación que afecte al empleador.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('II) Para el caso de los empleados vinculados laboralmente y bajo régimen de subordinación y dependencia a la administración pública centralizada o descentralizada, sometidos al Estatuto Administrativo, el Desempleo Involuntario solo será cubierto por la presente Póliza si se produce por alguna de las siguientes causales:', { bold: true })
      ;[
        'II.1) Funcionarios de Planta:',
        '   II.1.1.) Supresión del empleo.',
        '   II.1.2.) Término del período legal.',
        'II.2.) Personal a contrata:',
        '   II.2.1) No renovación del contrato una vez finalizado el plazo.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('III) Para el caso de los profesionales de la educación vinculados laboralmente y bajo régimen de subordinación y dependencia a la educación municipalizada, sometidos al Estatuto Docente, sólo será cubierto el Desempleo Involuntario derivado del cese de sus funciones debido a causas que no sean imputables a su actuar o a su voluntad y que impliquen la privación total de ingresos por conceptos laborales.', { bold: true })
      writeParagraph('IV) Para el caso de los miembros de las Fuerzas Armadas y Fuerzas de Orden y Seguridad Pública, el Desempleo Involuntario sólo será cubierto por la presente Póliza sí se produce por alguna causal de retiro temporal o absoluto contemplada en sus respectivas Leyes Orgánicas, Estatutos y Reglamentos de Personal, pero única y exclusivamente en la medida que el retiro o baja se deba a causa no imputable a la voluntad o a la conducta del miembro de las Fuerzas Armadas y Fuerzas de Orden y Seguridad Pública; y Reintegrado el Asegurado al servicio laboral bajo alguna de las formas de empleo cubiertas en la presente Póliza, cesará inmediatamente el pago de las indemnizaciones con cargo a esta Póliza.', { bold: true })

      writeHeading('Requisitos de Asegurabilidad')
      writeParagraph('La presente cobertura se extenderá a uno o más de los siguientes tipos de trabajadores:')
      ;[
        '1. Trabajadores Dependientes.',
        '2. Funcionarios vinculados laboralmente y bajo régimen de subordinación y dependencia a la administración pública centralizada o descentralizada, sometidos al Estatuto Administrativo de acuerdo a la legislación administrativa chilena, que, en virtud de una designación de autoridad, prestan servicios o desempeñan funciones para la administración pública, y percibiendo por tales servicios una remuneración.',
        '3. Los profesionales de la educación vinculados laboralmente y bajo régimen de subordinación y dependencia a la educación municipalizada, sometidos al Estatuto Docente.',
        '4. Los miembros de las Fuerzas Armadas y Fuerzas de Orden y Seguridad Pública.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('Por otra parte, las edades de ingreso y permanencia serán:', { bold: true })
      ;[
        'Edad mínima de ingreso: 18 años',
        'Edad máxima de ingreso: 65 años y 364 días',
        'Edad máxima de permanencia: 69 años y 364 días.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))

      writeHeading('Beneficiario')
      writeParagraph('Para la cobertura de desempleo se tendrá como beneficiario en calidad de irrevocables a [ENTIDAD FINANCIERA]. Y sus cesionarios a cualquier título.')

      writeHeading('Definiciones Seguro Desempleo')
      writeParagraph('DESEMPLEO INVOLUNTARIO: Es el estado o condición de aquella persona que ha perdido su trabajo, producido por circunstancias no imputables a su actuar (en conformidad a las causales señaladas en Artículo 3 de estas condiciones generales), y que implica la privación total de remuneraciones o ingresos por conceptos laborales como consecuencia directa del término de la relación laboral.')
      writeParagraph('EVENTO: la situación de desempleo involuntario que puede afectar al asegurado no interrumpida por un periodo de activo mínimo.')
      writeParagraph('ANTIGÜEDAD MÍNIMA LABORAL O COMERCIAL: se exige un periodo de 180 días consecutivos en que el asegurado debe mantenerse en su empleo (si es trabajador dependiente) para reclamar, por primera vez una indemnización bajo esta póliza.')
      writeParagraph('PERIODO DE ACTIVO MÍNIMO: lapso de tiempo durante el cual el asegurado que ya haya sido indemnizado en razón del seguro, y ha obtenido nuevamente empleo, debe mantenerse en dicho empleo si incurre nuevamente en cesantía involuntaria. Se establece un periodo de activo mínimo de 180 días a partir de la fecha de inicio del nuevo empleo.')
      writeParagraph('TRABAJADOR DEPENDIENTE: toda persona que, de acuerdo a la legislación laboral chilena, presta servicios o desempeña funciones para un empleador, bajo vínculo de subordinación y dependencia, en virtud de un contrato de trabajo indefinido sujeto al Código del Trabajo.')
      writeParagraph('DEDUCIBLE: corresponde al número de cuotas, que debe asumir el asegurado, posterior a la ocurrencia del evento de desempleo. Se establece el deducible en una cuota correspondiente a los 30 días siguientes a la fecha del finiquito para la cobertura de desempleo.')

      writeHeading('Prima por Asegurado')
      writeParagraph('La prima es única y resulta de multiplicar monto crédito en pesos por la tasa del tramo por el número de cuotas.')

      ensureSpace(40)
      const tramos: Array<[string, string, string, string]> = [
        ['Tramo 1', '$500.000', '$1.000.000', '0,094%'],
        ['Tramo 2', '$1.000.001', '$3.000.000', '0,094%'],
        ['Tramo 3', '$3.000.001', '$5.000.000', '0,094%'],
        ['Tramo 4', '$5.000.001', '$7.000.000', '0,094%'],
        ['Tramo 5', '$7.000.001', 'o mas', '0,094%'],
      ]
      const cw = [30, 45, 45, 35]
      const tableWidth = cw.reduce((a, b) => a + b, 0)
      doc.setFillColor(220, 220, 220)
      doc.rect(margin, y - 4, tableWidth, 6, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      ;['', 'Desde', 'Hasta', 'Tasa Bruta'].forEach((h, i) => {
        const xp = margin + cw.slice(0, i).reduce((a, b) => a + b, 0)
        doc.text(h, xp + 2, y)
      })
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      const tableStartY = y
      tramos.forEach((row, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(248, 248, 248)
          doc.rect(margin, y - 2, tableWidth, 5, 'F')
        }
        row.forEach((cell, i) => {
          const xp = margin + cw.slice(0, i).reduce((a, b) => a + b, 0)
          doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
          doc.text(cell, xp + 2, y + 1.5)
        })
        y += 5
      })
      doc.setDrawColor(180, 180, 180)
      doc.rect(margin, tableStartY - 2, tableWidth, 5 * tramos.length)
      y += 4

      ensureSpace(14)
      doc.setFillColor(220, 220, 220)
      doc.rect(margin, y - 4, contentWidth, 6, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('Cobertura', margin + 2, y)
      doc.text('Monto Asegurado', margin + contentWidth / 2 + 2, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.text('Desempleo Involuntario', margin + 2, y + 2)
      doc.text('Hasta 3 Cuotas* (*Tope por cuota de UF 15)', margin + contentWidth / 2 + 2, y + 2)
      doc.rect(margin, y - 2, contentWidth, 6)
      y += 8

      writeParagraph('La compañía aseguradora indemnizará los montos antes indicados de acuerdo con lo siguiente:', { bold: true })
      ;[
        '• de 31 a 60 días: primera cuota.',
        '• de 61 a 90 días: segunda cuota.',
        '• de 91 a 120 días: tercera cuota.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))

      writeSubHeading('Deducible')
      writeParagraph('Primera cuota del crédito a pagar luego de la desvinculación laboral.')
      writeSubHeading('Antigüedad Laboral mínima')
      writeParagraph('Se establece una antigüedad mínima de 6 meses, con el mismo empleador, para tener derecho a indemnización.')
      writeSubHeading('Pago de Prima')
      writeParagraph('El importe de las primas será cargado automáticamente en el medio de pago del asegurado, según este lo haya estipulado en la propuesta o solicitud de incorporación. La periodicidad del pago será única.')
      writeSubHeading('Derecho de Retracto')
      writeParagraph('El asegurado podrá, sin expresión de causa ni penalización alguna, retractarse del seguro contratado dentro del plazo de 30 días, contado desde que tomó conocimiento de la póliza. Dicha retractación deberá comunicarse, a la compañía por cualquier medio que permita la expresión fehaciente de dicha voluntad. El ejercicio del derecho de retracto implicará para el asegurado el derecho a la devolución del segundo cobro mensual de las primas, reteniendo el asegurador las primas correspondientes al riesgo transcurrido y cubierto.')
      writeSubHeading('Vigencia de la póliza colectiva')
      writeParagraph('El presente contrato regirá desde el 07 de noviembre de 2025 al 30 de noviembre de 2030.')
      writeParagraph('Será renovado en forma automática por períodos iguales y sucesivos de un año cada uno, si ninguna de las partes notifica por escrito a la otra, su decisión contraria, la cual deberá hacerlo en un plazo mínimo de 15 días.')
      writeParagraph('En caso de un término anticipado del contrato, la compañía deberá informar por escrito al contratante con 30 días antes de hacer efectivo su término.')
      writeParagraph('Por otra parte, el contratante, sin expresión de causa podrá poner término al contrato, decisión que deberá informar a la compañía con 30 días de anticipación, cobrando las primas proporcionales al tiempo de cobertura transcurrido.')
      writeSubHeading('Vigencia individual')
      writeParagraph('La cobertura de desempleo de esta póliza entrará en vigencia para cada asegurado individual desde la fecha señalada en la propuesta o solicitud de incorporación, la póliza se mantendrá vigente hasta la total extinción del crédito.')
      writeSubHeading('Término anticipado de la cobertura individual')
      ;[
        '• solicitud por escrito de parte del asegurado para poner término a la cobertura individual, mediante aviso por escrito a la compañía con al menos diez (10) días de anticipación.',
        '• por el cumplimiento de la edad máxima de permanencia indicada en esta póliza.',
        '• por fallecimiento del asegurado.',
        '• por la pérdida de la calidad de asegurado de conformidad a lo establecido en las condiciones particulares o propuesta de seguro.',
        '• pérdida del asegurado de su calidad de trabajador dependiente, conforme las calidades o tipos de trabajadores dependientes definidos en la sección ii, número 1, literales i), ii) y iii), del condicionado general, bien por causa de una cesantía voluntaria o involuntaria. Por lo anterior, para efectos de esta póliza el trabajador que, durante la vigencia de la póliza, cambie su calidad o situación de trabajador dependiente a trabajador independiente, vendedor, comisionista, pensionado y/o jubilado, perderá, de pleno derecho, la calidad de asegurado.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))

      writeParagraph('A partir de la fecha del cambio de calidad del asegurado de trabajador dependiente a trabajador independiente, cesará de pleno derecho cualquier responsabilidad de la compañía ante cualquier evento que pudiera afectar la materia asegurada indicada en la sección i y detallada en las condiciones particulares.')
      writeParagraph('Es responsabilidad del asegurado notificar (de acuerdo con las condiciones fijadas en la cláusula "comunicaciones" de esta póliza) lo más pronto posible al asegurador o compañía de seguros, el cambio de su situación laboral que produzca la pérdida de calidad de trabajador dependiente, como, por ejemplo, si deja de ser trabajador empleado mediante un contrato de trabajo y comienza a ejercer alguna actividad económica o emprendimiento de forma independiente.')
      writeParagraph('Una vez que la compañía de seguros tome conocimiento del cambio de calidad de la situación laboral del asegurado mencionado en el párrafo anterior, el asegurado tendrá derecho a la restitución de la parte de la prima pagada no ganada por la compañía correspondiente al tiempo no cubierto.')
      writeParagraph('El contrato de seguro podrá ser terminado anticipadamente y de forma unilateral por la compañía o el asegurado, en virtud de las siguientes circunstancias:')
      writeParagraph('A. la compañía podrá poner término anticipadamente al contrato de seguro en caso de concurrir cualquiera de las siguientes causales:', { bold: true })
      ;[
        '1. Si el interés asegurable no llegare a existir o cesare durante la vigencia del seguro. En este caso el asegurado tendrá derecho a restitución de la parte de la prima pagada no ganada por la compañía correspondiente al tiempo no corrido.',
        '2. Por falta del pago de la prima en los términos indicados en el artículo séptimo del condicionado general.',
        '3. En caso de verificarse una infracción a cualquiera de las obligaciones descritas en el artículo cuarto del condicionado general.',
        '4. Inexistencia o inhabilitación del medio de pago acordado para el pago de la prima.',
        '5. Cuando la compañía haya efectuado un cambio en su política de suscripción. Sin embargo, esta terminación será posible únicamente cuando se cancele o se revisen todas las pólizas o coberturas individuales que han sido emitidas bajo dicha política de suscripción respecto al programa de seguros acordado con el contratante de la póliza.',
        '6. Cuando se haya cumplido el máximo de eventos a asegurar por el periodo de vigencia.',
        '7. Al momento de la renovación de la póliza (ya sea individual o de la póliza colectiva/maestra), fecha que deberá estar establecida claramente en las condiciones particulares.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('En cualquiera de estos casos, la terminación se producirá a la expiración del plazo de 30 días contados desde la fecha de envío de la respectiva comunicación de acuerdo con lo establecido en el artículo décimo del condicionado general.')
      writeParagraph('B. a su turno, el asegurado podrá poner término anticipado al contrato, salvo las excepciones legales, comunicándolo al asegurador en la forma establecida en el artículo décimo del condicionado general.', { bold: true })
      writeParagraph('En caso de término anticipado, la prima se reducirá en forma proporcional al plazo corrido, pero en caso de haber ocurrido un siniestro, se entenderá devengada totalmente.')

      writeSubHeading('Cláusula de devolución de primas no devengadas')
      writeParagraph('Cuando por término anticipado o extinción del contrato de seguro proceda la devolución de la prima pagada no devengada, la aseguradora deberá poner la suma a devolver a disposición de quien corresponda, dentro del plazo de 10 días hábiles de haber tomado conocimiento del término del seguro. La compañía deberá informar a quien corresponda acerca de la existencia de la suma a su disposición, dentro del plazo indicado. La prima pagada no devengada será devuelta al asegurado o contratante, según quién hubiera soportado en su patrimonio, si todo o parte de la prima hubiera sido financiada por un beneficio del estado, se devolverá a la entidad que corresponda la parte de la prima pagada no devengada que financió. Asimismo, estas devoluciones, en su caso, se harán efectivas mientras se encuentren vigentes créditos asegurados con la compañía y cuya devolución corresponda de acuerdo con la circular n°2114, del 26 de julio del 2013 de la comisión para el mercado financiero (CMF), siempre y cuando el contratante informe de los hechos correspondientes a extinción o disminución de deuda por prepago o renegociación de crédito a los cuales se haya asociado seguros de prima única de la compañía.')

      writeSubHeading('Pago de la indemnización')
      writeParagraph('El pago de indemnizaciones será efectuado por la compañía aseguradora al asegurado o beneficiario, según sea el caso, contando para ello con un plazo máximo de 10 días hábiles contados desde la fecha de recepción del informe de liquidación correspondiente que señale la procedencia del pago de la indemnización.')

      writeHeading('Comunicaciones')
      writeParagraph('Cualquier comunicación, declaración o notificación que deba efectuar el asegurador al contratante o el asegurado con motivo de esta póliza, deberá efectuarse enviando la comunicación a la dirección de correo electrónico que haya indicado el asegurado en la propuesta o solicitud de incorporación.')
      writeParagraph('En caso de desconocerse su correo electrónico o de recibir una constancia de que dicho correo no fue enviado o recibido exitosamente, las comunicaciones deberán efectuarse mediante el envío de carta certificada dirigida al domicilio del contratante o el asegurado.')

      writeHeading('Servicio de atención al cliente')
      writeParagraph('Para cualquier consulta y/o reclamo, el asegurado puede llamar al centro de atención al cliente al fono 800 200 802 de Southbridge Compañía de Seguros Generales S.A. el horario de atención es de lunes a jueves de 9:00 a 17:45 horas, viernes de 9:00 a 13:30 horas. No hay atención los fines de semana ni días feriados.')

      writeHeading('Exclusiones')
      writeParagraph('1. El asegurado no podrá hacer uso de la cobertura de Desempleo Involuntario si:', { bold: true })
      writeParagraph('i. Es desvinculado de una sociedad o de una empresa de responsabilidad limitada (E.I.R.L) de la cual es socio, accionista o titular, según corresponda.', { indent: 4 })
      writeParagraph('ii. Si su cónyuge, conviviente civil, padre, madre, hijo(a), hermano(a), nieto(a), tío(a), abuelo(a), cuñado(a), suegro(a) o padre o madre de su conviviente civil es socio, accionista, titular, director, ejecutivo principal o titular de la sociedad o de la E.I.R.L. de la que fue desvinculado.', { indent: 4 })
      writeParagraph('Dentro del concepto de sociedad se comprenden todos los tipos de sociedades civiles y comerciales, como las colectivas, en comanditas, de responsabilidad limitada, sociedades anónimas, sociedades por acciones.')
      writeParagraph('No se otorgará la cobertura cuando el Desempleo Involuntario se produzca por una causa distinta de las señaladas en el numeral 2, letra A.2, del Artículo 3 del condicionado general POL 1 2022 0203.')

      writeHeading('Procedimiento de Denuncia de Siniestro')
      writeParagraph('Producido un siniestro del asegurado según corresponda, deberá comunicarlo por escrito a siniestros@sbins.cl o contactándose al 800 200 802, dentro del menor plazo posible, una vez tomado conocimiento de la ocurrencia de cualquier hecho que pueda constituir o constituya siniestro, el cual no podrá superar los 10 días de ocurrido el siniestro, empleando para tal efecto un formulario de presentación de siniestros que proporcionará su corredor de seguros.')
      writeParagraph('Para tener derecho a la indemnización el interesado deberá acreditar la situación invocada, con los Antecedentes justificativos de la misma. Se entenderá como fecha de ocurrencia del siniestro para cada una de las coberturas la siguiente:')
      writeParagraph('A) desempleo involuntario: se entenderá como fecha de ocurrencia del siniestro la fecha de término de la relación laboral indicada en el finiquito del contrato de trabajo, y en el caso de los empleados públicos regidos por sus respectivos estatutos, será la fecha que establezca el decreto o resolución en que consta su retiro o baja de la respectiva institución.')
      writeParagraph('Antecedentes necesarios para el pago de siniestros:', { bold: true })
      writeParagraph('Cobertura por desempleo involuntario:', { bold: true })
      writeParagraph('Primer mes asegurado de desempleo:', { bold: true })
      ;[
        '- formulario de denuncia de siniestros firmados por el asegurado.',
        '- En el caso de los trabajadores regidos por el código del trabajo, copia del finiquito legalizado donde conste la causal de término de la relación laboral.',
        '- En el caso de los empleados públicos, docentes y miembros de las fuerzas armadas y de orden, copia legalizada del decreto o resolución del organismo que corresponda en el que se pone término a la relación laboral.',
        '- Certificado de últimas cotizaciones de a.f.p. con fecha posterior a la fecha de vencimiento del dividendo reclamado',
        '- Fotocopia de cédula de identidad del asegurado, por ambas caras.',
        '- Tabla de desarrollo de la deuda.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('Para efectos del pago de la indemnización correspondiente, sólo se considerarán como causales de Desempleo Involuntario las siguientes:')
      writeParagraph('I. Para el caso de los Trabajadores Dependientes, sólo se considerarán causales de Desempleo Involuntario las siguientes:', { bold: true })
      ;[
        'i. Artículo 159 Nº1 del Código del Trabajo: Mutuo acuerdo de las partes, pero sólo en la medida que, en el finiquito respectivo, se hubiere pactado a favor del asegurado una indemnización equivalente o asimilable a años de servicio.',
        'ii. Artículo 159 N° 6 del Código del Trabajo: caso fortuito o fuerza mayor.',
        'iii. Artículo 161 del Código del Trabajo: necesidades de la empresa y desahucio del empleador.',
        'iv. Artículo 163 bis del Código del Trabajo: procedimiento concursal de liquidación que afecte al empleador.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('II. Para el caso de los empleados vinculados laboralmente y bajo régimen de subordinación y dependencia a la administración pública centralizada o descentralizada, sometidos al Estatuto Administrativo, el Desempleo Involuntario solo será cubierto por la presente Póliza si se produce por alguna de las siguientes causales:', { bold: true })
      ;[
        'i. funcionarios de Planta:',
        'ii. Supresión del empleo.',
        'iii. Término del período legal.',
        'iv. Personal a contrata:',
        'v. No renovación del contrato una vez finalizado el plazo.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('III. Para el caso de los profesionales de la educación vinculados laboralmente y bajo régimen de subordinación y dependencia a la educación municipalizada, sometidos al Estatuto Docente, sólo será cubierto el Desempleo Involuntario derivado del cese de sus funciones debido a causas que no sean imputables a su actuar o a su voluntad y que impliquen la privación total de ingresos por conceptos laborales.', { bold: true })
      writeParagraph('IV. Para el caso de los miembros de las Fuerzas Armadas y Fuerzas de Orden y Seguridad Pública, el Desempleo Involuntario sólo será cubierto por la presente Póliza sí se produce por alguna causal de retiro temporal o absoluto contemplada en sus respectivas Leyes Orgánicas, Estatutos y Reglamentos de Personal, pero única y exclusivamente en la medida que el retiro o baja se deba a causa no imputable a la voluntad o a la conducta del miembro de las Fuerzas Armadas y Fuerzas de Orden y Seguridad Pública; y Reintegrado el Asegurado al servicio laboral bajo alguna de las formas de empleo cubiertas en la presente Póliza, cesará inmediatamente el pago de las indemnizaciones con cargo a esta Póliza.', { bold: true })
      writeParagraph('Nota: La compañía se reserva el derecho de solicitar cualquier otro antecedente que estime necesario, para poder realizar la respectiva liquidación de siniestro. Asimismo, y en el caso de existir primas impagas al momento del siniestro, estás serán descontadas del monto a indemnizar.')

      writeHeading('Disposiciones Finales')
      writeSubHeading('Información sobre atención de clientes y presentación de consultas y reclamos')
      writeParagraph('En virtud de la circular nro. 2.131 de 28 de noviembre de 2013, las compañías de seguros, corredores de seguros y liquidadores de siniestros, deberán recibir, registrar y responder todas las presentaciones, consultas o reclamos que se les presenten directamente por el contratante, asegurado, beneficiarios o legítimos interesados o sus mandatarios.')
      writeParagraph('Las presentaciones pueden ser efectuadas en todas las oficinas de las entidades que se atienda público, presencialmente, por correo postal, medios electrónicos, o telefónicamente, sin formalidades, en el horario normal de atención.')
      writeParagraph('Recibida una presentación, consulta o reclamo, ésa deberá ser respondida en el plazo más breve posible, el que no podrá exceder de 20 días hábiles contados desde su recepción.')
      writeParagraph('Interesado, en caso de disconformidad respecto de lo informado, o bien cuando exista demora injustificada de la respuesta, podrá recurrir a la Comisión para el Mercado Financiero, área de protección al inversionista y asegurado, cuyas oficinas se encuentran ubicadas en avda. Libertador Bernardo O\u2019Higgins 1449 piso 1, Santiago, o a través del sitio web www.cmfchile.cl.')
      writeSubHeading('Código De Autorregulación')
      writeParagraph('Southbridge Seguros se encuentra adherida al Código de Autorregulación de las Compañías de Seguros y está sujeta al Compendio de Buenas Prácticas Corporativas, que contiene un conjunto de normas destinadas a promover una adecuada relación de las compañías de seguros con sus clientes. Copia de este Compendio se encuentra en la página Web www.aach.cl. Asimismo, ha aceptado la intervención del Defensor del Asegurado cuando los clientes le presenten reclamos en relación a los contratos celebrados con ella. Los clientes pueden presentar sus reclamos ante el Defensor del Asegurado utilizando los formularios disponibles en el sitio web de Southbridge (www.southbridgeseguros.cl) o a través de la página Web www.ddachile.cl.')

      writeHeading('INFORMACIÓN DE LAS COMISIONES CIRCULAR Nº 2123 (COMISIÓN PARA EL MERCADO FINANCIERO)')
      writeParagraph('De acuerdo a lo instruido en la circular N° 2123 e fecha de 22 de Octubre de 2013 de la Comisión para el Mercado Financiero, le informamos que las comisiones pagadas por Southbridge Compañía de Seguros Generales S.A, respecto de la prima pagada por usted son las siguientes:')
      writeSubHeading('Comisión de Intermediación')
      writeParagraph('PRIME CORREDORES DE SEGUROS SPA')
      writeParagraph('RUT: 76.196.802 -5')
      writeParagraph('10% más IVA sobre Prima Neta recaudada, neta de anulaciones y devoluciones.')
      writeSubHeading('Comisión de recaudación')
      writeParagraph('TDV SERVICIOS SPA')
      writeParagraph('RUT 78.168.126-1')
      writeParagraph('20% más IVA sobre Prima Neta recaudada, neta de anulaciones y devoluciones.')

      writeHeading('Anexo N°1 - INFORMACION SOBRE ATENCION DE CLIENTES Y PRESENTACIÓN DE CONSULTAS Y RECLAMOS')
      writeParagraph('En virtud de la Circular N° 2131 de la CMF del 28 de noviembre de 2013, las compañías de seguros, corredores de seguros y liquidadores de siniestros, deberán recibir, registrar y responder todas las presentaciones, consultas o reclamos que se les presenten directamente por el contratante, asegurado, beneficiarios o legítimos interesados o sus mandatarios.')
      writeParagraph('Las presentaciones pueden ser efectuadas en todas las oficinas de las entidades en que se atienda público, presencialmente, por correo postal, medios electrónicos, o telefónicamente, sin formalidades, en el horario normal de atención. TDV disponibilizará el siguiente número: +56229943004 en los siguientes horarios: De lunes a jueves de 9:00 a 14:00 y de 15:00 a 18:00 y viernes de 9:00 a 14:00 y 15:00 a 17:30 y el siguiente correo: contacto@tedevuelvo.cl.')
      writeParagraph('Recibida una presentación, consulta o reclamo, ésta deberá ser respondida en el plazo más breve posible, el que no podrá exceder de 20 días hábiles contados desde su recepción.')
      writeParagraph('El interesado, en caso de disconformidad respecto de lo informado, o bien cuando exista demora injustificada de la respuesta, podrá recurrir a la Comisión para el Mercado Financiero, Área de Protección al Inversionista y Asegurado, cuyas oficinas se encuentran ubicadas en Av. Libertador Bernardo O\u2019Higgins 1449, piso 1°, Santiago, o a través del sitio web www.cmfchile.cl.')

      writeHeading('Anexo N°2 (Circular N° 2106 Comisión para el Mercado Financiero) - PROCEDIMIENTO DE LIQUIDACION DE SINIESTROS')
      writeSubHeading('1) OBJETO DE LA LIQUIDACION')
      writeParagraph('La liquidación tiene por fin establecer la ocurrencia de un siniestro, determinar si el siniestro está cubierto en la póliza contratada en una compañía de seguros determinada, y cuantificar el monto de la pérdida y de la indemnización a pagar.')
      writeParagraph('El procedimiento de liquidación está sometido a los principios de celeridad y economía procedimental, de objetividad y carácter técnico y de transparencia y acceso.')
      writeSubHeading('2) FORMA DE EFECTUAR LA LIQUIDACION')
      writeParagraph('La liquidación puede efectuarla directamente la Compañía o encomendarla a un Liquidador de Seguros. La decisión debe comunicarse al Asegurado dentro del plazo de tres días hábiles contados desde la fecha de la denuncia del siniestro.')
      writeSubHeading('3) DERECHO DE OPOSICION A LA LIQUIDACION DIRECTA')
      writeParagraph('En caso de liquidación directa por la compañía, el Asegurado o beneficiario puede oponerse a ella, solicitándole por escrito que designe un Liquidador de Seguros, dentro del plazo de cinco días hábiles contados desde la notificación de la comunicación de la Compañía. La Compañía deberá designar al Liquidador en el plazo de dos días hábiles contados desde dicha oposición.')
      writeSubHeading('4) INFORMACION AL ASEGURADO DE GESTIONES A REALIZAR Y PETICION DE ANTECEDENTES')
      writeParagraph('El Liquidador o la Compañía deberá informar al Asegurado, por escrito, en forma suficiente y oportuna, al correo electrónico (informado en la denuncia del siniestro) o por carta certificada (al domicilio señalado en la denuncia de siniestro), de las gestiones que le corresponde realizar, solicitando de una sola vez, cuando las circunstancias lo permitan, todos los antecedentes que requiere para liquidar el siniestro.')
      writeSubHeading('5) PRE-INFORME DE LIQUIDACION')
      writeParagraph('En aquellos siniestros en que surgieren problemas y diferencias de criterios sobre sus causas, evaluación del riesgo o extensión de la cobertura, podrá el Liquidador, actuando de oficio o a petición del Asegurado, emitir un pre-informe de liquidación sobre la cobertura del siniestro y el monto de los daños producidos, el que deberá ponerse en conocimiento de los interesados. El asegurado o la Compañía podrán hacer observaciones por escrito al pre-informe dentro del plazo de cinco días hábiles desde su conocimiento.')
      writeSubHeading('6) PLAZO DE LIQUIDACION')
      writeParagraph('Dentro del más breve plazo, no pudiendo exceder de 45 días corridos desde fecha denuncio, a excepción de;')
      writeParagraph('a) Siniestros que correspondan a seguros individuales sobre riesgos del Primer Grupo cuya prima anual sea superior a 100 UF: 90 días corridos desde fecha denuncio;', { indent: 4 })
      writeParagraph('b) Siniestros marítimos que afecten a los cascos o en caso de Avería Gruesa: 180 días corridos desde fecha denuncio.', { indent: 4 })
      writeSubHeading('7) PRORROGA DEL PLAZO DE LIQUIDACION')
      writeParagraph('Los plazos antes señalados podrán, excepcionalmente siempre que las circunstancias lo ameriten, prorrogarse, sucesivamente por iguales períodos, informando los motivos que la fundamenten e indicando las gestiones concretas y específicas que se realizarán, lo que deberá comunicarse al Asegurado y a la Superintendencia, pudiendo esta última dejar sin efecto la ampliación, en casos calificados, y fijar un plazo para entrega del Informe de Liquidación. No podrá ser motivo de prórroga la solicitud de nuevos antecedentes cuyo requerimiento pudo preverse con anterioridad, salvo que se indiquen las razones que justifiquen la falta de requerimiento, ni podrán prorrogarse los siniestros en que no haya existido gestión alguna del liquidador, registrado o directo.')
      writeSubHeading('8) INFORME FINAL DE LIQUIDACION')
      writeParagraph('El informe final de liquidación deberá remitirse al Asegurado y simultáneamente al Asegurador, cuando corresponda, y deberá contener necesariamente la transcripción íntegra de los artículos 26 y 27 del Reglamento de Auxiliares del Comercio de Seguros (D.S. de Hacienda Nº 1.055, de 2012, Diario Oficial de 29 de diciembre de 2012).')
      writeSubHeading('9) IMPUGNACION INFORME DE LIQUIDACION')
      writeParagraph('Recibido el informe de Liquidación, la Compañía y el Asegurado dispondrán de un plazo de diez días hábiles para impugnarla. En caso de liquidación directa por la Compañía, este derecho sólo lo tendrá el Asegurado.')
      writeParagraph('Impugnado el informe, el Liquidador o la compañía dispondrá de un plazo de 6 días hábiles para responder la impugnación.')

      writeHeading('CLAUSULA SANCIONES ECONÓMICAS')
      writeSubHeading('A. Exclusión Territorial')
      writeParagraph('La presente póliza no cubre ninguna pérdida, lesión, daño o responsabilidad legal derivada ya sea directa o indirectamente de bienes, transacciones, comercio u otra actividad relacionada con Cuba, Irán, Sudán, Siria o Crimea región de Ucrania.')
      writeSubHeading('B. Exclusión SDN')
      writeParagraph('No se considerará que este Asegurador proporciona cobertura a, o es responsable de pagar algún reclamo o proveer algún beneficio por alguna pérdida, lesión, daño o responsabilidad legal experimentado directa o indirectamente por alguno de los siguientes:')
      ;[
        '- residentes de cualquier país distinto de aquellos países no incluidos en la cobertura bajo esta póliza y/o aquellos países donde una exclusión territorial ha sido agregada en la póliza.',
        '- personas empleadas en Irán o por el gobierno iraní,',
        '- Personas mencionadas en los listados de sanciones publicadas por las Naciones Unidas, resoluciones N° 1.988 y 1.989, del Consejo de Seguridad de la Organización de las Naciones Unidas y demás que resulten aplicables, todo en cumplimiento de lo dispuesto en el Oficio Circular N° 700, de 18 de octubre de 2011, de la Comisión para el Mercado Financiero y de las que se dicten en el futuro sobre esta materia.',
        '- personas identificadas por autoridades gubernamentales como sostenedores de terrorismo, drogas o tráfico de personas, piratería, proliferación de armas de destrucción masiva, crimen organizado, violaciones a los derechos humanos o interrupción de procesos democráticos"',
      ].forEach(t => writeParagraph(t, { indent: 4 }))

      drawFooter(pageNum)

      const fileName = `Certificado_Cesantia_${refund.rut?.replace(/[.-]/g, '') || 'cliente'}_${new Date().toISOString().split('T')[0]}.pdf`
      const blob = doc.output('blob') as Blob
      return { blob, fileName }
  }

  const generatePDF = async () => {
    setIsGenerating(true)
    try {
      const { blob, fileName } = await buildPDF()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({
        title: 'Certificado generado',
        description: 'El certificado de cesantía se ha descargado correctamente',
      })
      setOpen(false)
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast({
        title: 'Error',
        description: 'No se pudo generar el certificado',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const uploadToClient = async () => {
    setIsUploading(true)
    try {
      const { blob, fileName } = await buildPDF()
      const token = authService.getAccessToken()
      const uploadFormData = new FormData()
      uploadFormData.append('file', blob, fileName)
      uploadFormData.append('kind', 'carta-de-corte')

      const response = await fetch(`${API_BASE_URL}/refund-requests/${refund.id}/upload-file`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: uploadFormData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Error al subir el certificado')
      }

      queryClient.invalidateQueries({ queryKey: ['refund-documents', refund.id] })
      queryClient.invalidateQueries({ queryKey: ['refund', refund.id] })

      toast({
        title: 'Certificado subido',
        description: 'El documento está disponible en la carpeta del cliente como "Carta de corte"',
      })
      setOpen(false)
    } catch (error) {
      console.error('Error uploading certificate:', error)
      toast({
        title: 'Error al subir',
        description: error instanceof Error ? error.message : 'No se pudo subir el certificado',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
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
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Cert.</span> Cesantía
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
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2">
            {step === 'form' ? 'Certificado de Cesantía' : 'Previsualización del Certificado'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto pr-4">
          {step === 'form' ? (
            <div className="space-y-6 py-2">
              {/* Datos del Asegurado */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Antecedentes del Asegurado</h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={fetchRutInfo}
                    disabled={isLoadingRut}
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    {isLoadingRut ? 'Buscando...' : 'Buscar por RUT'}
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombres">Nombres</Label>
                    <Input
                      id="nombres"
                      value={formData.nombres}
                      onChange={(e) => handleChange('nombres', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellidoPaterno">Apellido Paterno</Label>
                    <Input
                      id="apellidoPaterno"
                      value={formData.apellidoPaterno}
                      onChange={(e) => handleChange('apellidoPaterno', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellidoMaterno">Apellido Materno</Label>
                    <Input
                      id="apellidoMaterno"
                      value={formData.apellidoMaterno}
                      onChange={(e) => handleChange('apellidoMaterno', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>RUT</Label>
                    <Input value={refund.rut || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fechaNacimiento">Fecha Nacimiento</Label>
                    <Input
                      id="fechaNacimiento"
                      value={formData.fechaNacimiento}
                      onChange={(e) => handleChange('fechaNacimiento', e.target.value)}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estadoCivil">Estado Civil</Label>
                    <Select 
                      value={formData.estadoCivil} 
                      onValueChange={(v) => handleChange('estadoCivil', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Soltero/a">Soltero/a</SelectItem>
                        <SelectItem value="Casado/a">Casado/a</SelectItem>
                        <SelectItem value="Divorciado/a">Divorciado/a</SelectItem>
                        <SelectItem value="Viudo/a">Viudo/a</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => handleChange('direccion', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="comuna">Comuna</Label>
                    <Input
                      id="comuna"
                      value={formData.comuna}
                      onChange={(e) => handleChange('comuna', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Región</Label>
                    <Input
                      id="region"
                      value={formData.region}
                      onChange={(e) => handleChange('region', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => handleChange('telefono', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                  />
                </div>
              </div>

              {/* Antecedentes del Seguro */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Antecedentes del Seguro</h3>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="correlativo">Correlativo</Label>
                    <Input
                      id="correlativo"
                      value={formData.correlativo}
                      onChange={(e) => handleChange('correlativo', e.target.value)}
                      placeholder="Ej: 001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nroOperacion">Nro Operación</Label>
                    <Input
                      id="nroOperacion"
                      value={formData.nroOperacion}
                      onChange={(e) => handleChange('nroOperacion', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inicioVigencia">Inicio Vigencia</Label>
                    <Input
                      id="inicioVigencia"
                      value={formData.inicioVigencia}
                      onChange={(e) => handleChange('inicioVigencia', e.target.value)}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="montoCredito">Monto Crédito</Label>
                    <Input
                      id="montoCredito"
                      value={formData.montoCredito}
                      onChange={(e) => handleChange('montoCredito', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="montoCuota">Monto Cuota</Label>
                    <Input
                      id="montoCuota"
                      value={formData.montoCuota}
                      onChange={(e) => handleChange('montoCuota', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plazoMeses">Plazo (meses)</Label>
                    <Input
                      id="plazoMeses"
                      value={formData.plazoMeses}
                      onChange={(e) => handleChange('plazoMeses', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="terminoVigencia">Término Vigencia</Label>
                    <Input
                      id="terminoVigencia"
                      value={formData.terminoVigencia}
                      onChange={(e) => handleChange('terminoVigencia', e.target.value)}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Prima Neta Estimada:</span>
                  <span className="text-xl font-bold text-primary">
                    ${calculatePrimaNeta().toLocaleString('es-CL')} CLP
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fórmula: Monto crédito × Tasa ({getTasaCesantia(parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.')) || 0)}%) × Plazo
                </p>
              </div>
            </div>
          ) : (
            /* Preview Mode */
            <div className="space-y-4 py-2">
              <div className="border rounded-lg p-4 bg-white">
                <div className="text-center mb-4">
                  <p className="text-lg font-bold">PÓLIZA DE SEGURO DE DESEMPLEO INVOLUNTARIO</p>
                  <p className="text-sm">CERTIFICADO DE COBERTURA</p>
                </div>
                
                <div className="space-y-4 text-sm">
                  <p><strong>Nro Póliza:</strong> 0020121737 - {formData.correlativo || 'correlativo'}</p>
                  
                  <div className="border-t pt-2">
                    <p className="font-semibold mb-2">Antecedentes del Asegurado</p>
                    <div className="grid grid-cols-2 gap-2">
                      <p><strong>Nombre:</strong> {formData.nombres} {formData.apellidoPaterno} {formData.apellidoMaterno}</p>
                      <p><strong>RUT:</strong> {refund.rut}</p>
                      <p><strong>Fecha Nacimiento:</strong> {formData.fechaNacimiento}</p>
                      <p><strong>Estado Civil:</strong> {formData.estadoCivil}</p>
                      <p><strong>Dirección:</strong> {formData.direccion}</p>
                      <p><strong>Comuna:</strong> {formData.comuna}</p>
                      <p><strong>Email:</strong> {formData.email}</p>
                      <p><strong>Teléfono:</strong> {formData.telefono}</p>
                    </div>
                  </div>

                  <div className="border-t pt-2">
                    <p className="font-semibold mb-2">Antecedentes del Seguro</p>
                    <div className="grid grid-cols-2 gap-2">
                      <p><strong>Monto Crédito:</strong> ${parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.') || '0').toLocaleString('es-CL')}</p>
                      <p><strong>Plazo:</strong> {formData.plazoMeses} meses</p>
                      <p><strong>Inicio Vigencia:</strong> {formData.inicioVigencia}</p>
                      <p><strong>Prima Neta:</strong> ${calculatePrimaNeta().toLocaleString('es-CL')}</p>
                    </div>
                  </div>

                  <div className="border-t pt-2">
                    <p className="font-semibold mb-2">Cobertura</p>
                    <p><strong>Desempleo Involuntario:</strong> Hasta 3 cuotas mensuales con tope máximo de UF 15 por cuota.</p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Prima Neta del Seguro:</span>
                  <span className="text-xl font-bold text-primary">${calculatePrimaNeta().toLocaleString('es-CL')} CLP</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tasa aplicada: {getTasaCesantia(parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.')) || 0)}% ({getTramoLabel(parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.')) || 0)})
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
              <Button variant="outline" onClick={handleBackToEdit} className="gap-2" disabled={isGenerating || isUploading}>
                <ArrowLeft className="h-4 w-4" />
                Volver a Editar
              </Button>
              <Button
                variant="outline"
                onClick={uploadToClient}
                disabled={isGenerating || isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  'Subiendo...'
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Subir a carpeta del cliente
                  </>
                )}
              </Button>
              <Button onClick={generatePDF} disabled={isGenerating || isUploading} className="gap-2">
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
