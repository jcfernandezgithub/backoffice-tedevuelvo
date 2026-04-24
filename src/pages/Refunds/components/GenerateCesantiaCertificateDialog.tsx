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
import { Briefcase, Download, Search, ArrowLeft, Eye } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { RefundRequest } from '@/types/refund'
import { authService } from '@/services/authService'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import jsPDF from 'jspdf'

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
  const [isLoadingRut, setIsLoadingRut] = useState(false)

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
    montoCredito: (refund.calculationSnapshot?.totalAmount || 0).toString(),
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

  const generatePDF = async () => {
    setIsGenerating(true)
    
    try {
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
        const lh = opts.lh ?? 3.6
        const indent = opts.indent ?? 0
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
        doc.setFontSize(size)
        const lines = doc.splitTextToSize(text, contentWidth - indent)
        lines.forEach((line: string) => {
          ensureSpace(lh)
          doc.text(line, margin + indent, y)
          y += lh
        })
      }

      const writeHeading = (text: string, size = 10) => {
        ensureSpace(10)
        doc.setFillColor(235, 235, 235)
        doc.rect(margin, y - 4, contentWidth, 6.5, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(size)
        doc.text(text, margin + 2, y)
        y += 7
      }

      const writeSubHeading = (text: string, size = 9) => {
        ensureSpace(7)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(size)
        doc.text(text, margin, y)
        y += 5
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
      writeHeading('Descripcion de Coberturas y Condiciones de Asegurabilidad')
      writeSubHeading('Materia Asegurada')
      writeParagraph('En virtud de la presente Poliza, el asegurador cubre el riesgo de Desempleo Involuntario, indemnizando al asegurado hasta con tres (3) cuotas del credito individualizado en el condicionado particular, en donde la primera cuota a pagar luego de ocurrido el evento de desempleo involuntario es de deducible (primera cuota deducible + indemnizacion de hasta tres (3) cuotas restantes). Esta Poliza cubre los casos de Desempleo Involuntario que impliquen la privacion total de ingresos por conceptos laborales.')
      writeParagraph('El pago se realizara mes a mes, por lo que el asegurado debe proveer los antecedentes solicitados por la compania para acreditar la continuidad en calidad de desempleado para asi cobrar la cuota siguiente. Reintegrandose el asegurado al servicio laboral, con contrato de trabajo, cesara inmediatamente el pago de indemnizacion con cargo a este seguro.')
      writeParagraph('A su vez, cada asegurado podra tener solamente contratada una poliza relacionada al presente producto. A mayor abundamiento, en caso de tener mas de una poliza contratada, solamente se realizara el pago de una de ellas al momento de un siniestro.')
      y += 2
      writeSubHeading('Coberturas')
      writeParagraph('Desempleo involuntario del asegurado (POL 1 2022 0203)', { bold: true })
      writeParagraph('a) El pago de cuotas mensuales que correspondan a una deuda del asegurado singularizada en las condiciones particulares de la Poliza o un porcentaje de la misma, cuyo monto y forma de pago se determinara en las condiciones particulares de la Poliza. En estos casos solo habra lugar a la cobertura en la medida existan cuotas devengadas en los meses de cobertura establecidos en las condiciones particulares de la Poliza.')
      writeParagraph('Asimismo, se podra establecer en las condiciones particulares de la Poliza, un Periodo de Carencia, una Antiguedad Laboral Minima, un deducible, un periodo minimo de permanencia en estado de cesantia, un numero maximo de Eventos, una edad maxima de permanencia, sublimites de indemnizacion, y/o una franquicia.')
      writeParagraph('Se considerara como un solo Evento la ocurrencia de cualquiera de las causales de Desempleo Involuntario.')

      writeSubHeading('Procedencia de la indemnizacion')
      writeParagraph('A.1. La presente cobertura se extendera a uno o mas de los siguientes tipos de trabajadores, segun se indique en las condiciones particulares de la Poliza:', { bold: true })
      ;[
        '1) Trabajadores Dependientes.',
        '2) Funcionarios vinculados laboralmente y bajo regimen de subordinacion y dependencia a la administracion publica centralizada o descentralizada, sometidos al Estatuto Administrativo.',
        '3) Profesionales de la educacion vinculados laboralmente y bajo regimen de subordinacion y dependencia a la educacion municipalizada, sometidos al Estatuto Docente.',
        '4) Miembros de las Fuerzas Armadas y Fuerzas de Orden y Seguridad Publica.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))

      writeParagraph('A.2. Solo se consideraran como causales de Desempleo Involuntario las siguientes:', { bold: true })
      writeParagraph('I) Trabajadores Dependientes:', { bold: true })
      ;[
        'I.1) Articulo 159 N1 del Codigo del Trabajo: Mutuo acuerdo de las partes, en la medida que en el finiquito se hubiere pactado a favor del asegurado una indemnizacion equivalente o asimilable a anos de servicio.',
        'I.2) Articulo 159 N6 del Codigo del Trabajo: caso fortuito o fuerza mayor.',
        'I.3) Articulo 161 del Codigo del Trabajo: necesidades de la empresa y desahucio del empleador.',
        'I.4) Articulo 163 bis del Codigo del Trabajo: procedimiento concursal de liquidacion que afecte al empleador.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('II) Empleados de la administracion publica (Estatuto Administrativo):', { bold: true })
      ;[
        'II.1) Funcionarios de Planta: Supresion del empleo / Termino del periodo legal.',
        'II.2) Personal a contrata: No renovacion del contrato una vez finalizado el plazo.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('III) Profesionales de la educacion municipalizada (Estatuto Docente): solo sera cubierto el Desempleo Involuntario derivado del cese de funciones por causas no imputables a su actuar o voluntad y que impliquen privacion total de ingresos por conceptos laborales.', { bold: true })
      writeParagraph('IV) Miembros de las Fuerzas Armadas y Fuerzas de Orden y Seguridad Publica: solo sera cubierto si se produce por alguna causal de retiro temporal o absoluto contemplada en sus respectivas Leyes Organicas, Estatutos y Reglamentos de Personal, en la medida que el retiro o baja se deba a causa no imputable a la voluntad o conducta del miembro.', { bold: true })

      writeHeading('Requisitos de Asegurabilidad')
      writeParagraph('La cobertura se extendera a Trabajadores Dependientes, funcionarios de la administracion publica (Estatuto Administrativo), profesionales de la educacion municipalizada (Estatuto Docente) y miembros de las Fuerzas Armadas y Fuerzas de Orden y Seguridad Publica.')
      writeParagraph('Edades de ingreso y permanencia:', { bold: true })
      ;[
        '- Edad minima de ingreso: 18 anos.',
        '- Edad maxima de ingreso: 65 anos y 364 dias.',
        '- Edad maxima de permanencia: 69 anos y 364 dias.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))

      writeHeading('Beneficiario')
      writeParagraph('Para la cobertura de desempleo se tendra como beneficiario en calidad de irrevocable a [ENTIDAD FINANCIERA] y sus cesionarios a cualquier titulo.')

      writeHeading('Definiciones Seguro Desempleo')
      writeParagraph('DESEMPLEO INVOLUNTARIO: estado o condicion de aquella persona que ha perdido su trabajo, producido por circunstancias no imputables a su actuar (segun las causales senaladas en el Articulo 3 de las condiciones generales), y que implica la privacion total de remuneraciones o ingresos por conceptos laborales como consecuencia directa del termino de la relacion laboral.')
      writeParagraph('EVENTO: la situacion de desempleo involuntario que puede afectar al asegurado, no interrumpida por un periodo de activo minimo.')
      writeParagraph('ANTIGUEDAD MINIMA LABORAL O COMERCIAL: se exige un periodo de 180 dias consecutivos en que el asegurado debe mantenerse en su empleo (si es trabajador dependiente) para reclamar, por primera vez, una indemnizacion bajo esta poliza.')
      writeParagraph('PERIODO DE ACTIVO MINIMO: lapso durante el cual el asegurado que ya haya sido indemnizado y haya obtenido nuevamente empleo debe mantenerse en dicho empleo si incurre nuevamente en cesantia involuntaria. Se establece un periodo de 180 dias a partir de la fecha de inicio del nuevo empleo.')
      writeParagraph('TRABAJADOR DEPENDIENTE: persona que, segun la legislacion laboral chilena, presta servicios o desempena funciones para un empleador, bajo vinculo de subordinacion y dependencia, en virtud de un contrato de trabajo indefinido sujeto al Codigo del Trabajo.')
      writeParagraph('DEDUCIBLE: corresponde al numero de cuotas que debe asumir el asegurado posterior a la ocurrencia del evento de desempleo. Se establece el deducible en una cuota correspondiente a los 30 dias siguientes a la fecha del finiquito.')

      writeHeading('Prima por Asegurado')
      writeParagraph('La prima es unica y resulta de multiplicar el monto del credito en pesos por la tasa del tramo por el numero de cuotas.')

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

      writeParagraph('La compania aseguradora indemnizara los montos antes indicados de acuerdo con lo siguiente:', { bold: true })
      ;[
        '- De 31 a 60 dias: primera cuota.',
        '- De 61 a 90 dias: segunda cuota.',
        '- De 91 a 120 dias: tercera cuota.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))

      writeSubHeading('Deducible')
      writeParagraph('Primera cuota del credito a pagar luego de la desvinculacion laboral.')
      writeSubHeading('Antiguedad Laboral minima')
      writeParagraph('Se establece una antiguedad minima de 6 meses, con el mismo empleador, para tener derecho a indemnizacion.')
      writeSubHeading('Pago de Prima')
      writeParagraph('El importe de las primas sera cargado automaticamente en el medio de pago del asegurado, segun este lo haya estipulado en la propuesta o solicitud de incorporacion. La periodicidad del pago sera unica.')
      writeSubHeading('Derecho de Retracto')
      writeParagraph('El asegurado podra, sin expresion de causa ni penalizacion alguna, retractarse del seguro contratado dentro del plazo de 30 dias, contado desde que tomo conocimiento de la poliza. Dicha retractacion debera comunicarse a la compania por cualquier medio que permita la expresion fehaciente de dicha voluntad. El ejercicio del derecho de retracto implicara para el asegurado el derecho a la devolucion del segundo cobro mensual de las primas, reteniendo el asegurador las primas correspondientes al riesgo transcurrido y cubierto.')
      writeSubHeading('Vigencia de la poliza colectiva')
      writeParagraph('El presente contrato regira desde el 07 de noviembre de 2025 al 30 de noviembre de 2030. Sera renovado en forma automatica por periodos iguales y sucesivos de un ano cada uno, si ninguna de las partes notifica por escrito a la otra su decision contraria, en un plazo minimo de 15 dias.')
      writeSubHeading('Vigencia individual')
      writeParagraph('La cobertura de desempleo entrara en vigencia para cada asegurado individual desde la fecha senalada en la propuesta o solicitud de incorporacion; la poliza se mantendra vigente hasta la total extincion del credito.')
      writeSubHeading('Termino anticipado de la cobertura individual')
      ;[
        '- Solicitud por escrito del asegurado, con al menos diez (10) dias de anticipacion.',
        '- Cumplimiento de la edad maxima de permanencia indicada en esta poliza.',
        '- Fallecimiento del asegurado.',
        '- Perdida de la calidad de asegurado segun las condiciones particulares.',
        '- Perdida de la calidad de trabajador dependiente del asegurado.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))

      writeParagraph('A partir de la fecha del cambio de calidad del asegurado de trabajador dependiente a trabajador independiente, cesara de pleno derecho cualquier responsabilidad de la compania. Es responsabilidad del asegurado notificar lo mas pronto posible al asegurador el cambio de su situacion laboral. Una vez que la compania tome conocimiento, el asegurado tendra derecho a la restitucion de la parte de la prima pagada no ganada por la compania correspondiente al tiempo no cubierto.')

      writeSubHeading('Causales de termino anticipado por la Compania')
      ;[
        '1. Si el interes asegurable no llegare a existir o cesare durante la vigencia del seguro.',
        '2. Por falta de pago de la prima en los terminos del condicionado general.',
        '3. Infraccion a cualquiera de las obligaciones del condicionado general.',
        '4. Inexistencia o inhabilitacion del medio de pago acordado.',
        '5. Cambio en la politica de suscripcion de la compania (cancelando o revisando todas las polizas individuales del programa).',
        '6. Cumplimiento del maximo de eventos a asegurar por el periodo de vigencia.',
        '7. Renovacion de la poliza individual o colectiva, en la fecha establecida en las condiciones particulares.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('La terminacion se producira a la expiracion del plazo de 30 dias contados desde la fecha de envio de la respectiva comunicacion.')

      writeSubHeading('Clausula de devolucion de primas no devengadas')
      writeParagraph('Cuando por termino anticipado o extincion del contrato proceda la devolucion de la prima pagada no devengada, la aseguradora debera poner la suma a disposicion de quien corresponda dentro del plazo de 10 dias habiles de haber tomado conocimiento del termino del seguro, conforme a la Circular N 2114 del 26 de julio de 2013 de la CMF.')

      writeSubHeading('Pago de la indemnizacion')
      writeParagraph('El pago de indemnizaciones sera efectuado por la compania al asegurado o beneficiario, contando con un plazo maximo de 10 dias habiles desde la recepcion del informe de liquidacion correspondiente que senale la procedencia del pago.')

      writeHeading('Comunicaciones')
      writeParagraph('Cualquier comunicacion, declaracion o notificacion del asegurador al contratante o asegurado debera efectuarse al correo electronico indicado por el asegurado en la propuesta o solicitud de incorporacion. En caso de desconocerse el correo o de constancia de no envio/recepcion, las comunicaciones se efectuaran mediante carta certificada dirigida al domicilio.')

      writeHeading('Servicio de atencion al cliente')
      writeParagraph('Para cualquier consulta y/o reclamo, el asegurado puede llamar al centro de atencion al cliente al fono 800 200 802 de Southbridge Compania de Seguros Generales S.A. Horario: lunes a jueves de 9:00 a 17:45 hrs, viernes de 9:00 a 13:30 hrs. No hay atencion los fines de semana ni dias feriados.')

      writeHeading('Exclusiones')
      writeParagraph('1. El asegurado no podra hacer uso de la cobertura de Desempleo Involuntario si:', { bold: true })
      writeParagraph('i. Es desvinculado de una sociedad o E.I.R.L. de la cual es socio, accionista o titular.', { indent: 4 })
      writeParagraph('ii. Si su conyuge, conviviente civil, padre, madre, hijo(a), hermano(a), nieto(a), tio(a), abuelo(a), cunado(a), suegro(a) o padre/madre de su conviviente civil es socio, accionista, titular, director o ejecutivo principal de la sociedad o E.I.R.L. de la que fue desvinculado.', { indent: 4 })
      writeParagraph('Dentro del concepto de sociedad se comprenden todos los tipos de sociedades civiles y comerciales (colectivas, en comanditas, de responsabilidad limitada, sociedades anonimas, sociedades por acciones).')
      writeParagraph('No se otorgara la cobertura cuando el Desempleo Involuntario se produzca por una causa distinta de las senaladas en el numeral 2, letra A.2, del Articulo 3 del condicionado general POL 1 2022 0203.')

      writeHeading('Procedimiento de Denuncia de Siniestro')
      writeParagraph('Producido un siniestro, debera comunicarlo por escrito a siniestros@sbins.cl o al 800 200 802, dentro del menor plazo posible una vez tomado conocimiento, no pudiendo superar los 10 dias de ocurrido el siniestro, empleando el formulario de presentacion de siniestros que proporcionara su corredor de seguros.')
      writeParagraph('Para tener derecho a la indemnizacion el interesado debera acreditar la situacion invocada con los antecedentes justificativos. Se entendera como fecha de ocurrencia del siniestro la fecha de termino de la relacion laboral indicada en el finiquito; en el caso de empleados publicos, sera la fecha del decreto o resolucion de retiro o baja.')
      writeParagraph('Antecedentes necesarios para el pago de siniestros (primer mes asegurado de desempleo):', { bold: true })
      ;[
        '- Formulario de denuncia de siniestros firmado por el asegurado.',
        '- Copia del finiquito legalizado donde conste la causal de termino (Codigo del Trabajo).',
        '- Copia legalizada del decreto o resolucion del organismo (empleados publicos, docentes, FFAA y de Orden).',
        '- Certificado de ultimas cotizaciones de A.F.P., con fecha posterior al vencimiento del dividendo reclamado.',
        '- Fotocopia de cedula de identidad del asegurado, por ambas caras.',
        '- Tabla de desarrollo de la deuda.',
      ].forEach(t => writeParagraph(t, { indent: 4 }))
      writeParagraph('Nota: La compania se reserva el derecho de solicitar cualquier otro antecedente que estime necesario. En caso de existir primas impagas al momento del siniestro, estas seran descontadas del monto a indemnizar.')

      writeHeading('Disposiciones Finales')
      writeSubHeading('Informacion sobre atencion de clientes y reclamos')
      writeParagraph('En virtud de la circular N 2.131 del 28 de noviembre de 2013, las companias de seguros, corredores y liquidadores deberan recibir, registrar y responder todas las presentaciones, consultas o reclamos. Las presentaciones podran efectuarse en oficinas, presencialmente, por correo postal, medios electronicos o telefonicamente, sin formalidades, en horario normal de atencion. Recibida una presentacion, debera ser respondida en un plazo no superior a 20 dias habiles. En caso de disconformidad, el interesado podra recurrir a la Comision para el Mercado Financiero, Av. Libertador Bernardo O Higgins 1449, piso 1, Santiago, o al sitio web www.cmfchile.cl.')
      writeSubHeading('Codigo de Autorregulacion')
      writeParagraph('Southbridge Seguros se encuentra adherida al Codigo de Autorregulacion de las Companias de Seguros y al Compendio de Buenas Practicas Corporativas. Copia disponible en www.aach.cl. Asimismo, ha aceptado la intervencion del Defensor del Asegurado: www.southbridgeseguros.cl o www.ddachile.cl.')

      writeHeading('Informacion de las Comisiones - Circular N 2123 (CMF)')
      writeParagraph('De acuerdo a lo instruido en la Circular N 2123 del 22 de octubre de 2013 de la Comision para el Mercado Financiero, le informamos que las comisiones pagadas por Southbridge Compania de Seguros Generales S.A., respecto de la prima pagada por usted, son las siguientes:')
      writeSubHeading('Comision de Intermediacion')
      writeParagraph('PRIME CORREDORES DE SEGUROS SPA - RUT: 76.196.802-5')
      writeParagraph('10% mas IVA sobre Prima Neta recaudada, neta de anulaciones y devoluciones.')
      writeSubHeading('Comision de Recaudacion')
      writeParagraph('TDV SERVICIOS SPA - RUT: 78.168.126-1')
      writeParagraph('20% mas IVA sobre Prima Neta recaudada, neta de anulaciones y devoluciones.')

      writeHeading('Anexo N 1 - Atencion de Clientes y Reclamos')
      writeParagraph('En virtud de la Circular N 2131 de la CMF del 28 de noviembre de 2013, las companias de seguros, corredores y liquidadores deberan recibir, registrar y responder todas las presentaciones, consultas o reclamos. TDV disponibilizara el siguiente numero: +56229943004 en horarios de lunes a jueves de 9:00 a 14:00 y de 15:00 a 18:00, y viernes de 9:00 a 14:00 y 15:00 a 17:30; correo: contacto@tedevuelvo.cl. Las presentaciones seran respondidas en un plazo no superior a 20 dias habiles.')

      writeHeading('Anexo N 2 - Procedimiento de Liquidacion de Siniestros (Circular N 2106 CMF)')
      writeSubHeading('1) Objeto de la Liquidacion')
      writeParagraph('Establecer la ocurrencia del siniestro, determinar si esta cubierto en la poliza contratada y cuantificar el monto de la perdida y la indemnizacion a pagar. Sometido a los principios de celeridad, economia procedimental, objetividad, caracter tecnico, transparencia y acceso.')
      writeSubHeading('2) Forma de efectuar la Liquidacion')
      writeParagraph('La liquidacion puede efectuarla directamente la Compania o encomendarla a un Liquidador de Seguros. La decision debe comunicarse al Asegurado dentro del plazo de tres dias habiles desde la fecha de denuncia del siniestro.')
      writeSubHeading('3) Derecho de Oposicion a la Liquidacion Directa')
      writeParagraph('En caso de liquidacion directa por la compania, el Asegurado o beneficiario puede oponerse solicitando por escrito que designe un Liquidador de Seguros, dentro del plazo de cinco dias habiles desde la notificacion.')
      writeSubHeading('4) Informacion al Asegurado y Peticion de Antecedentes')
      writeParagraph('El Liquidador o la Compania debera informar al Asegurado por escrito, en forma suficiente y oportuna, las gestiones que le corresponde realizar, solicitando todos los antecedentes que requiere para liquidar el siniestro.')
      writeSubHeading('5) Pre-informe de Liquidacion')
      writeParagraph('En siniestros con problemas o diferencias de criterios, podra el Liquidador emitir un pre-informe sobre cobertura y monto de danos. El asegurado o la compania podran hacer observaciones por escrito dentro de cinco dias habiles desde su conocimiento.')
      writeSubHeading('6) Plazo de Liquidacion')
      writeParagraph('Dentro del mas breve plazo, no pudiendo exceder de 45 dias corridos desde la fecha de denuncia. Excepciones: (a) seguros individuales del Primer Grupo con prima anual superior a 100 UF: 90 dias; (b) siniestros maritimos o averia gruesa: 180 dias.')
      writeSubHeading('7) Prorroga del Plazo de Liquidacion')
      writeParagraph('Los plazos podran prorrogarse excepcionalmente por iguales periodos, informando los motivos y gestiones a realizar, comunicandolo al Asegurado y a la Superintendencia.')
      writeSubHeading('8) Informe Final de Liquidacion')
      writeParagraph('El informe final debera remitirse al Asegurado y simultaneamente al Asegurador, conteniendo la transcripcion integra de los articulos 26 y 27 del Reglamento de Auxiliares del Comercio de Seguros (D.S. de Hacienda N 1.055 de 2012).')
      writeSubHeading('9) Impugnacion del Informe de Liquidacion')
      writeParagraph('Recibido el informe, la Compania y el Asegurado dispondran de un plazo de diez dias habiles para impugnarlo. En caso de liquidacion directa por la Compania, este derecho solo lo tendra el Asegurado. Impugnado el informe, el Liquidador o la compania dispondra de un plazo de 6 dias habiles para responder.')

      writeHeading('Clausula Sanciones Economicas')
      writeSubHeading('A. Exclusion Territorial')
      writeParagraph('La presente poliza no cubre ninguna perdida, lesion, dano o responsabilidad legal derivada directa o indirectamente de bienes, transacciones, comercio u otra actividad relacionada con Cuba, Iran, Sudan, Siria o la region de Crimea (Ucrania).')
      writeSubHeading('B. Exclusion SDN')
      writeParagraph('No se considerara que este Asegurador proporciona cobertura a, o es responsable de pagar algun reclamo o proveer algun beneficio por alguna perdida, lesion, dano o responsabilidad legal experimentado directa o indirectamente por: (i) residentes de paises distintos a los cubiertos; (ii) personas empleadas en Iran o por el gobierno irani; (iii) personas mencionadas en listados de sanciones publicadas por las Naciones Unidas (resoluciones N 1.988 y 1.989 del Consejo de Seguridad), en cumplimiento del Oficio Circular N 700 de la CMF; (iv) personas identificadas por autoridades gubernamentales como sostenedores de terrorismo, narcotrafico, trafico de personas, pirateria, proliferacion de armas de destruccion masiva, crimen organizado, violaciones a los derechos humanos o interrupcion de procesos democraticos.')

      drawFooter(pageNum)

      // Save
      const fileName = `Certificado_Cesantia_${refund.rut?.replace(/[.-]/g, '') || 'cliente'}_${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)

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
