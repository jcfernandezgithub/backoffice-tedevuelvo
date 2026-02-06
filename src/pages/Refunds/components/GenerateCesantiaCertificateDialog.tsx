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

// Tasas de cesantía según tramo
const getTasaCesantia = (montoCredito: number): number => {
  if (montoCredito >= 500000 && montoCredito <= 1000000) return 0.288
  if (montoCredito > 1000000 && montoCredito <= 3000000) return 0.177
  if (montoCredito > 3000000 && montoCredito <= 5000000) return 0.157
  if (montoCredito > 5000000 && montoCredito <= 7000000) return 0.151
  if (montoCredito > 7000000) return 0.150
  return 0.288 // Default
}

const getTramoLabel = (montoCredito: number): string => {
  if (montoCredito >= 500000 && montoCredito <= 1000000) return 'Tramo 1 ($500.000 - $1.000.000)'
  if (montoCredito > 1000000 && montoCredito <= 3000000) return 'Tramo 2 ($1.000.001 - $3.000.000)'
  if (montoCredito > 3000000 && montoCredito <= 5000000) return 'Tramo 3 ($3.000.001 - $5.000.000)'
  if (montoCredito > 5000000 && montoCredito <= 7000000) return 'Tramo 4 ($5.000.001 - $7.000.000)'
  if (montoCredito > 7000000) return 'Tramo 5 ($7.000.001 o más)'
  return 'Tramo 1'
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
    region: 'Metropolitana',
    telefono: refund.phone || '',
    email: refund.email || '',
    rutEjecutivo: '',
    nombreEjecutivo: '',
    oficina: 'Santiago',
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

      // ===================== PAGE 1 - CARÁTULA =====================
      
      // Header - Logo placeholder (Southbridge)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 100, 150)
      doc.text('Southbridge', pageWidth - margin - 30, y)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('Insurance Company', pageWidth - margin - 27, y + 4)
      y += 15

      // Title
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('PÓLIZA DE SEGURO DE DESEMPLEO INVOLUNTARIO/', pageWidth / 2, y, { align: 'center' })
      y += 5
      doc.text('CERTIFICADO DE COBERTURA', pageWidth / 2, y, { align: 'center' })
      y += 10

      // Nro Póliza
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Nro Póliza:', margin, y)
      doc.setFont('helvetica', 'normal')
      doc.text(`0020121737 - ${formData.correlativo || 'correlativo'}`, margin + 22, y)
      y += 8

      // Section: Antecedentes del Asegurado
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 3, contentWidth, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Antecedentes del Asegurado', margin + 2, y + 1)
      y += 10

      // Table structure for asegurado data
      const drawRow = (label: string, value: string, x: number, yPos: number, width: number) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(label, x, yPos)
        doc.setFont('helvetica', 'bold')
        doc.text(value, x, yPos + 4)
      }

      const col1 = margin
      const col2 = margin + 60
      const col3 = margin + 120

      drawRow('Apellido Paterno:', formData.apellidoPaterno, col1, y, 55)
      drawRow('Apellido Materno:', formData.apellidoMaterno, col2, y, 55)
      drawRow('Nombre(s):', formData.nombres, col3, y, 55)
      y += 12

      drawRow('RUT:', refund.rut || '', col1, y, 55)
      drawRow('Fecha de Nacimiento:', formData.fechaNacimiento, col2, y, 55)
      drawRow('Estado Civil:', formData.estadoCivil, col3, y, 55)
      y += 12

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text('Dirección Particular:', col1, y)
      doc.setFont('helvetica', 'bold')
      doc.text(formData.direccion, col1, y + 4)
      y += 12

      drawRow('Comuna:', formData.comuna, col1, y, 55)
      drawRow('Región:', formData.region, col2, y, 55)
      y += 12

      drawRow('Teléfono Particular:', formData.telefono, col1, y, 55)
      drawRow('Email:', formData.email, col2, y, 90)
      y += 15

      // Section: Antecedentes del Ejecutivo
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 3, contentWidth, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Antecedentes del Ejecutivo', margin + 2, y + 1)
      y += 10

      drawRow('RUT:', formData.rutEjecutivo, col1, y, 55)
      drawRow('Nombre:', formData.nombreEjecutivo, col2, y, 90)
      y += 12

      drawRow('Oficina:', formData.oficina, col1, y, 55)
      drawRow('Fono:', formData.fonoEjecutivo, col2, y, 55)
      y += 15

      // Section: Antecedentes del Seguro
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 3, contentWidth, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Antecedentes del Seguro', margin + 2, y + 1)
      y += 10

      const montoCredito = parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.')) || 0
      const primaNeta = calculatePrimaNeta()

      drawRow('Nro Operación:', formData.nroOperacion, col1, y, 55)
      drawRow('Inicio Vigencia:', formData.inicioVigencia, col2, y, 55)
      drawRow('Término Vigencia:', formData.terminoVigencia, col3, y, 55)
      y += 12

      drawRow('Monto del Crédito:', `$${montoCredito.toLocaleString('es-CL')}`, col1, y, 45)
      drawRow('Monto Cuota:', formData.montoCuota ? `$${formData.montoCuota}` : '-', col1 + 45, y, 40)
      drawRow('Plazo (meses):', formData.plazoMeses, col2 + 25, y, 30)
      drawRow('Prima Neta:', `$${primaNeta.toLocaleString('es-CL')}`, col3, y, 55)
      y += 15

      // Section: Coberturas
      doc.setFillColor(200, 200, 200)
      doc.rect(margin, y - 3, contentWidth / 2, 7, 'F')
      doc.rect(margin + contentWidth / 2, y - 3, contentWidth / 2, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Coberturas', margin + 2, y + 1)
      doc.text('Capital Asegurado', margin + contentWidth / 2 + 2, y + 1)
      y += 10

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text('Desempleo Involuntario', margin + 2, y)
      doc.text('Este seguro cubre hasta 3 cuotas mensuales con tope', margin + contentWidth / 2 + 2, y)
      y += 4
      doc.text('POL 1 2022 0203', margin + 2, y)
      doc.text('máximo de UF 15 por cuota.', margin + contentWidth / 2 + 2, y)
      y += 10

      // IMPORTANTE section
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 3, contentWidth, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('IMPORTANTE', pageWidth / 2, y + 1, { align: 'center' })
      y += 10

      // Important notes
      const importantNotes = [
        '1. Este seguro es suscrito por Southbridge Compañía de Seguros Generales S.A. Rut: 99.288.000-7',
        '2. Este documento constituye certificado de cobertura una vez completados todos los datos.',
        '3. La contratación de este seguro es de carácter voluntario.',
        '4. Para efectos de este seguro, declaro tener la calidad de trabajador dependiente.',
        '5. Vigencia de la Póliza Colectiva: 07/11/2025 al 30/11/2030.',
        '6. La cobertura iniciará el día de la contratación y se mantendrá vigente mientras el crédito esté vigente.',
        '7. El contratante de este seguro es TDV SERVICIOS SPA, RUT 78.168.126-1',
        '8. El intermediario es PRIME CORREDORES DE SEGUROS SPA, RUT: 76.196.802-5',
        '9. Número de Póliza Colectiva: 0020121737'
      ]

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      importantNotes.forEach(note => {
        if (y > pageHeight - 30) {
          doc.addPage()
          y = 20
        }
        const lines = doc.splitTextToSize(note, contentWidth)
        lines.forEach((line: string) => {
          doc.text(line, margin, y)
          y += 4
        })
      })

      y += 10

      // Signature section
      if (y > pageHeight - 50) {
        doc.addPage()
        y = 20
      }

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.line(margin, y + 15, margin + 60, y + 15)
      doc.line(pageWidth - margin - 70, y + 15, pageWidth - margin, y + 15)
      doc.text('Firma Asegurado', margin + 15, y + 20)
      doc.text('Southbridge Compañía de Seguros', pageWidth - margin - 55, y + 20)
      doc.text('Generales S.A.', pageWidth - margin - 45, y + 24)

      // ===================== PAGE 2 - DESCRIPCIÓN DE COBERTURAS =====================
      doc.addPage()
      y = 15

      // Header
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 100, 150)
      doc.text('Southbridge', pageWidth - margin - 30, y)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('Insurance Company', pageWidth - margin - 27, y + 4)
      y += 15

      doc.setTextColor(0, 0, 0)
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y - 3, contentWidth, 7, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Descripción de Coberturas y Condiciones de Asegurabilidad', margin + 2, y + 1)
      y += 12

      // Materia Asegurada
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Materia Asegurada', margin, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      const materiaText = `En virtud de la presente Póliza, el asegurador cubre el riesgo de Desempleo Involuntario, indemnizando al asegurado hasta con tres (3) cuotas del crédito individualizado, en donde la primera cuota a pagar luego de ocurrido el evento de desempleo involuntario es de deducible (primera cuota deducible + indemnización de hasta tres (3) cuotas restantes). Esta Póliza cubre los casos de Desempleo Involuntario que impliquen la privación total de ingresos por conceptos laborales.`
      
      const materiaLines = doc.splitTextToSize(materiaText, contentWidth)
      materiaLines.forEach((line: string) => {
        doc.text(line, margin, y)
        y += 3.5
      })
      y += 5

      // Coberturas
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Coberturas', margin, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Desempleo involuntario del asegurado (POL 1 2022 0203)', margin, y)
      y += 8

      // Requisitos de Asegurabilidad
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Requisitos de Asegurabilidad', margin, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      const requisitos = [
        '• Edad mínima de ingreso: 18 años',
        '• Edad máxima de ingreso: 65 años y 364 días',
        '• Edad máxima de permanencia: 69 años y 364 días',
        '• Trabajadores Dependientes con contrato indefinido'
      ]
      requisitos.forEach(req => {
        doc.text(req, margin, y)
        y += 4
      })
      y += 5

      // Prima por Asegurado
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Prima por Asegurado', margin, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('La prima es única y resulta de multiplicar monto crédito en pesos por la tasa del tramo por el número de cuotas.', margin, y)
      y += 8

      // Table of rates
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      const tableHeaders = ['Tramo', 'Desde', 'Hasta', 'Tasa Bruta']
      const colWidths = [25, 35, 35, 30]
      let xPos = margin

      doc.setFillColor(220, 220, 220)
      doc.rect(margin, y - 3, colWidths.reduce((a, b) => a + b, 0), 6, 'F')
      
      tableHeaders.forEach((header, i) => {
        doc.text(header, xPos + 2, y)
        xPos += colWidths[i]
      })
      y += 6

      const tableData = [
        ['Tramo 1', '$500.000', '$1.000.000', '0,288%'],
        ['Tramo 2', '$1.000.001', '$3.000.000', '0,177%'],
        ['Tramo 3', '$3.000.001', '$5.000.000', '0,157%'],
        ['Tramo 4', '$5.000.001', '$7.000.000', '0,151%'],
        ['Tramo 5', '$7.000.001', 'o más', '0,150%'],
      ]

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      tableData.forEach((row, rowIndex) => {
        xPos = margin
        if (rowIndex % 2 === 0) {
          doc.setFillColor(250, 250, 250)
          doc.rect(margin, y - 3, colWidths.reduce((a, b) => a + b, 0), 5, 'F')
        }
        row.forEach((cell, i) => {
          doc.text(cell, xPos + 2, y)
          xPos += colWidths[i]
        })
        y += 5
      })
      y += 5

      // Highlight applied rate
      const tasa = getTasaCesantia(montoCredito)
      const tramo = getTramoLabel(montoCredito)
      doc.setFillColor(230, 245, 230)
      doc.rect(margin, y - 3, contentWidth, 8, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(`Tasa aplicada: ${tasa}% (${tramo})`, margin + 2, y + 1)
      y += 12

      // Deducible
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Deducible', margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Primera cuota del crédito a pagar luego de la desvinculación laboral.', margin, y)
      y += 8

      // Antigüedad Laboral mínima
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Antigüedad Laboral mínima', margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Se establece una antigüedad mínima de 6 meses, con el mismo empleador, para tener derecho a indemnización.', margin, y)
      y += 8

      // Cobertura
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Cobertura', margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('Desempleo Involuntario: Hasta 3 Cuotas* (*Tope por cuota de UF 15)', margin, y)
      y += 4
      doc.text('La compañía aseguradora indemnizará los montos de acuerdo con lo siguiente:', margin, y)
      y += 4
      doc.text('• de 31 a 60 días: primera cuota', margin + 5, y)
      y += 4
      doc.text('• de 61 a 90 días: segunda cuota', margin + 5, y)
      y += 4
      doc.text('• de 91 a 120 días: tercera cuota', margin + 5, y)

      // Footer
      doc.setFontSize(6)
      doc.setTextColor(128, 128, 128)
      doc.text(`Generado el ${getTodayFormatted()} - TDV Servicios SPA`, pageWidth / 2, pageHeight - 10, { align: 'center' })

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
