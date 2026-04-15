import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

import { FileText, Download, Upload, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { RefundRequest } from '@/types/refund'
import { toast } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { authService } from '@/services/authService'
import jsPDF from 'jspdf'
import firmaImg from '@/assets/firma-cng.jpeg'
import corteCedulaImg from '@/assets/corte-cedula-legalizada.jpg'
import corteNotarialImg from '@/assets/corte-certificado-notarial.jpg'
import corteConservadorImg from '@/assets/corte-certificado-conservador.jpg'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getInstitutionDisplayName } from '@/lib/institutionHomologation'
import { refundAdminApi } from '@/services/refundAdminApi'

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'

interface GenerateCorteDialogProps {
  refund: RefundRequest
  isMandateSigned?: boolean
}

// Datos fijos para cuenta bancaria y contacto
const FIXED_ACCOUNT_DATA = {
  accountNumber: '992866721',
  accountBank: 'Banco Scotiabank',
  accountHolder: 'TDV SERVICIOS SPA',
  accountHolderRut: '78.168.126-1',
  contactEmail: 'contacto@tedevuelvo.cl',
  contactPhone: '+569 84295935',
}

// Helper: obtiene el nombre del seguro según tipo
function getInsuranceName(insuranceType: string | null): string {
  if (!insuranceType) return ''
  const t = insuranceType.toLowerCase()
  if (t === 'desgravamen') return 'Seguro de Desgravamen'
  if (t === 'cesantia') return 'Seguro de Cesantía'
  if (t === 'ambos') return 'Seguro de Desgravamen y Cesantía'
  return insuranceType
}

// Helper: obtiene el tipo de seguro desde calculationSnapshot
function getInsuranceType(snapshot: any): string | null {
  if (!snapshot) return null
  if (snapshot.tipoSeguro) return snapshot.tipoSeguro
  if (snapshot.insuranceToEvaluate) return snapshot.insuranceToEvaluate
  return null
}

// ──────────────────────────────────────────
// Generador PDF — Formato GENÉRICO
// ──────────────────────────────────────────
function generateGenericPDF(
  refund: RefundRequest,
  formData: { creditNumber: string; policyNumber: string; bankName: string; companyName: string },
  hasPolicyNumber: boolean,
) {
  const today = new Date()
  const day = today.getDate()
  const month = today.toLocaleDateString('es-CL', { month: 'long' })
  const year = today.getFullYear()

  const creditText = hasPolicyNumber
    ? `que corresponde a la operación de crédito N°<strong>${formData.creditNumber}</strong> asociada a la Póliza N° <strong>${formData.policyNumber}</strong>, todo ello conforme a lo dispuesto en el artículo 537 del Código de Comercio.`
    : `que corresponde a la operación de crédito N°<strong>${formData.creditNumber}</strong>, todo ello conforme a lo dispuesto en el artículo 537 del Código de Comercio.`

  const content = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { margin: 1.5cm 2cm; size: letter; }
          body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; }
          .header { text-align: left; margin-bottom: 15px; }
          .title { text-align: center; font-weight: bold; font-size: 11pt; margin: 12px 0; }
          .content { text-align: justify; margin: 10px 0; }
          .content p { margin: 8px 0; }
          .signature { margin-top: 30px; text-align: center; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="header">Santiago, ${day} de ${month} de ${year}</div>
        <div class="header">
          Sres.: ${formData.companyName}<br>
          Atención: Servicio al Cliente (Post-Venta)<br><br>
          Ref: Carta de Renuncia al seguro que indica
        </div>
        <div class="title">
          INFORMA TÉRMINO ANTICIPADO DE SEGURO<br>
          Y SOLICITA DEVOLUCIÓN DE PRIMA NO DEVENGADA
        </div>
        <div class="content">
          <p>
            Por medio de la presente Carta de Renuncia, la sociedad <strong>TDV SERVICIOS SPA</strong> 
            RUT: <strong>${FIXED_ACCOUNT_DATA.accountHolderRut}</strong>, actuando en representación y por cuenta de 
            don (doña) <strong>${refund.fullName}</strong>, cédula de identidad 
            <strong>${refund.rut}</strong>, comunicamos formalmente a esa Compañía 
            Aseguradora la renuncia al seguro y su cobertura que fuera contratado junto 
            con el crédito de consumo otorgado por el Banco <strong>${formData.bankName}</strong>, 
            ${creditText}
          </p>
          <p>
            Asimismo, de acuerdo con lo estipulado en la Circular N°2114 de 2013 de la Comisión 
            para el Mercado Financiero (CMF), solicitamos la devolución de la prima 
            pagada y no devengada o consumida, la que deberá ser abonada a la cuenta corriente 
            N° <strong>${FIXED_ACCOUNT_DATA.accountNumber}</strong> del Banco <strong>${FIXED_ACCOUNT_DATA.accountBank}</strong> 
            cuyo titular es <strong>${FIXED_ACCOUNT_DATA.accountHolder}</strong>, RUT: 
            <strong>${FIXED_ACCOUNT_DATA.accountHolderRut}</strong>, correo electrónico 
            <strong>${FIXED_ACCOUNT_DATA.contactEmail}</strong>. Se hace presente que el monto a restituir 
            deberá abonarse en la cuenta bancaria señalada dentro de los próximos 10 días hábiles, 
            conforme a la normativa vigente.
          </p>
          <p>
            Finalmente, se adjunta a la presente carta una copia del mandato que nos faculta 
            para solicitar y tramitar la renuncia del seguro antes mencionado y recaudar a nombre 
            del asegurado la devolución de las primas pagadas no devengadas, por lo cual solicitamos 
            que se nos informe el resultado de esta gestión al correo electrónico 
            <strong>${FIXED_ACCOUNT_DATA.contactEmail}</strong> y al número telefónico 
            <strong>${FIXED_ACCOUNT_DATA.contactPhone}</strong>.
          </p>
          <p>Sin otro particular, se despiden atentamente,</p>
        </div>
        <div class="signature">
          <img src="${firmaImg}" alt="Firma" style="width: 180px; height: auto; margin: 20px auto 10px; display: block;">
          <p style="margin: 5px 0;">Cristian Andrés Nieto Gavilán</p>
          <p style="margin: 5px 0;">p.p TDV SERVICIOS SPA RUT: ${FIXED_ACCOUNT_DATA.accountHolderRut}</p>
        </div>
      </body>
    </html>
  `

  openPrintWindow(content)
}

// ──────────────────────────────────────────
// Generador PDF — Formato SANTANDER
// ──────────────────────────────────────────
function generateSantanderPDF(
  refund: RefundRequest,
  formData: { creditNumber: string; policyNumber: string; bankName: string; companyName: string; insuranceName: string },
) {
  const today = new Date()
  const day = today.getDate()
  const month = today.toLocaleDateString('es-CL', { month: 'long' })
  const year = today.getFullYear()

  const attachedPages = `
    <div style="page-break-before: always; text-align: center;">
      <img src="${corteCedulaImg}" alt="Cédula de Identidad Legalizada" style="max-width: 100%; max-height: 95vh;" />
    </div>
    <div style="page-break-before: always; text-align: center;">
      <img src="${corteNotarialImg}" alt="Certificado Notarial" style="max-width: 100%; max-height: 95vh;" />
    </div>
    <div style="page-break-before: always; text-align: center;">
      <img src="${corteConservadorImg}" alt="Certificado Conservador de Bienes Raíces" style="max-width: 100%; max-height: 95vh;" />
    </div>`

  const content = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page { margin: 1.5cm 2cm; size: letter; }
          body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; }
          .header { text-align: left; margin-bottom: 15px; }
          .title { text-align: center; font-weight: bold; font-size: 11pt; margin: 12px 0; }
          .content { text-align: justify; margin: 10px 0; }
          .content p { margin: 8px 0; }
          .signature { margin-top: 30px; text-align: center; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <div class="header">Santiago, ${day} de ${month} de ${year}</div>
        <div class="header">
          Sres.: ${formData.companyName}<br><br>
          Ref: Carta de Renuncia al seguro que indica
        </div>
        <div class="title">
          INFORMA TÉRMINO ANTICIPADO DE SEGURO Y SOLICITA DEVOLUCION DE PRIMA NO DEVENGADA
        </div>
        <div class="content">
          <p>
            Por medio de la presente, <strong>TDV SERVICIOS SPA</strong>, RUT N° <strong>${FIXED_ACCOUNT_DATA.accountHolderRut}</strong>, 
            debidamente facultada y actuando en representación y por cuenta de don/doña 
            <strong>${refund.fullName}</strong>, cédula de identidad N° <strong>${refund.rut}</strong>, 
            viene a comunicar formalmente a esa Compañía Aseguradora <strong>${formData.companyName}</strong> 
            la renuncia expresa al seguro <strong>${formData.insuranceName}</strong>, incluyendo todas sus coberturas asociadas.
          </p>
          <p>
            El referido seguro fue contratado en conjunto con el crédito de consumo otorgado por el 
            Banco <strong>${formData.bankName}</strong>, correspondiente a la operación de crédito 
            N° <strong>${formData.creditNumber}</strong>, asociado a la Póliza N° <strong>${formData.policyNumber}</strong>.
          </p>
          <p>
            La presente renuncia se formula conforme a lo dispuesto en el artículo 537 del Código de Comercio 
            y demás normativa aplicable, solicitando se sirva proceder a la cancelación del seguro indicado 
            y a la determinación y devolución de las primas no devengadas que correspondan.
          </p>
          <p>
            Asimismo, de acuerdo con lo estipulado en la Circular N°2114 de fecha año 2013 de la Comisión 
            para el Mercado Financiero (CMF), solicitamos la devolución de la prima pagada y no devengada o 
            consumida, la que deberá ser abonada a la cuenta corriente 
            N° <strong>${FIXED_ACCOUNT_DATA.accountNumber}</strong> del Banco <strong>${FIXED_ACCOUNT_DATA.accountBank}</strong> 
            cuyo titular es <strong>${FIXED_ACCOUNT_DATA.accountHolder}</strong>, 
            RUT: <strong>${FIXED_ACCOUNT_DATA.accountHolderRut}</strong>, correo electrónico 
            <strong>${FIXED_ACCOUNT_DATA.contactEmail}</strong>. Se hace presente que el monto a restituir 
            deberá abonarse en la cuenta bancaria señalada dentro de los próximos 10 días hábiles, 
            conforme a la normativa vigente.
          </p>
          <p>
            Finalmente, se adjunta a la presente carta una copia del mandato que nos faculta para solicitar 
            y tramitar la renuncia del seguro antes mencionado y recaudar a nombre del asegurado la 
            devolución de las primas pagadas no devengadas, por lo cual solicitamos que se nos informe el 
            resultado de esta gestión al correo electrónico <strong>${FIXED_ACCOUNT_DATA.contactEmail}</strong> y 
            al número telefónico <strong>${FIXED_ACCOUNT_DATA.contactPhone}</strong>.
          </p>
          <p>Sin otro particular, se despiden atentamente,</p>
        </div>
        <div class="signature">
          <img src="${firmaImg}" alt="Firma" style="width: 180px; height: auto; margin: 20px auto 10px; display: block;">
          <p style="margin: 5px 0;">Cristian Andrés Nieto Gavilán / Rut: 13040385-9</p>
          <p style="margin: 5px 0;">p.p TDV SERVICIOS SPA RUT: ${FIXED_ACCOUNT_DATA.accountHolderRut}</p>
        </div>
        ${attachedPages}
      </body>
    </html>
  `

  openPrintWindow(content)
}

function openPrintWindow(content: string) {
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(content)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      toast({
        title: 'Carta generada',
        description: 'Utiliza la función de impresión para guardar como PDF',
      })
    }, 250)
  }
}

// Helper: genera un PDF blob con jsPDF para subir al servidor (formato genérico)
function generateCortePdfBlob(
  refund: RefundRequest,
  formData: { creditNumber: string; policyNumber: string; bankName: string; companyName: string },
  hasPolicyNumber: boolean,
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

  const p1 = `Por medio de la presente Carta de Renuncia, la sociedad TDV SERVICIOS SPA RUT: ${FIXED_ACCOUNT_DATA.accountHolderRut}, actuando en representación y por cuenta de don (doña) ${refund.fullName}, cédula de identidad ${refund.rut}, comunicamos formalmente a esa Compañía Aseguradora la renuncia al seguro y su cobertura que fuera contratado junto con el crédito de consumo otorgado por el Banco ${formData.bankName}, que corresponde a la operación de crédito N°${formData.creditNumber}${hasPolicyNumber ? ` asociada a la Póliza N° ${formData.policyNumber}` : ''}, todo ello conforme a lo dispuesto en el artículo 537 del Código de Comercio.`
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

// Helper: genera un PDF blob con formato SANTANDER V3 para subir al servidor
async function generateSantanderCortePdfBlob(
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

  // Página 1: Carta principal
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

  // Helper para agregar imagen como página completa
  const addImagePage = (imgSrc: string, altText: string): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        doc.addPage()
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
        resolve()
      }
      img.onerror = () => {
        doc.addPage()
        doc.setFontSize(12)
        doc.text(altText, pageWidth / 2, pageHeight / 2, { align: 'center' })
        resolve()
      }
      img.src = imgSrc
    })
  }

  // Agregar las 3 páginas adjuntas
  await addImagePage(corteCedulaImg, 'Cédula de Identidad Legalizada')
  await addImagePage(corteNotarialImg, 'Certificado Notarial')
  await addImagePage(corteConservadorImg, 'Certificado Conservador de Bienes Raíces')

  return doc.output('blob')
}

async function uploadCorteToClient(publicId: string, pdfBlob: Blob, queryClient: any) {
  const token = authService.getAccessToken()
  const formData = new FormData()
  formData.append('file', pdfBlob, `carta-de-corte-${publicId}.pdf`)
  formData.append('kind', 'carta-de-corte')

  const response = await fetch(`${API_BASE_URL}/refund-requests/${publicId}/upload-file`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || 'Error al subir carta de corte')
  }

  // Invalidar cache de documentos
  queryClient.invalidateQueries({ queryKey: ['refund-documents', publicId] })

  toast({ title: 'Carta de corte subida', description: 'El documento está disponible en la carpeta del cliente' })
}

// ──────────────────────────────────────────
// Formulario GENÉRICO
// ──────────────────────────────────────────
interface GenericFormProps {
  refund: RefundRequest
  onGenerate: (data: { creditNumber: string; policyNumber: string; bankName: string; companyName: string }, hasPolicyNumber: boolean) => void
}

function GenericForm({ refund, onGenerate }: GenericFormProps) {
  const queryClient = useQueryClient()
  const snapshot = refund.calculationSnapshot || {}
  const [creditNumber, setCreditNumber] = useState(snapshot.nroCredito || '')
  const [policyNumber, setPolicyNumber] = useState(snapshot.nroPoliza || '')
  const [bankName, setBankName] = useState(getInstitutionDisplayName(refund.institutionId))
  const [companyName, setCompanyName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const creditDataComplete = !!creditNumber.trim() && !!policyNumber.trim()

  const handleGenerate = async () => {
    if (!creditNumber.trim() || !policyNumber.trim() || !companyName.trim()) {
      toast({ title: 'Campos requeridos', description: 'Por favor completa todos los campos obligatorios', variant: 'destructive' })
      return
    }

    const nextPolicyNumber = policyNumber.trim()
    const nextCreditNumber = creditNumber.trim()
    const currentPolicyNumber = String(snapshot.nroPoliza || '').trim()
    const currentCreditNumber = String(snapshot.nroCredito || '').trim()
    const shouldPersistCreditData =
      nextPolicyNumber !== currentPolicyNumber || nextCreditNumber !== currentCreditNumber

    if (shouldPersistCreditData) {
      setIsSaving(true)
      try {
        await refundAdminApi.updateData(refund.publicId || (refund as any)._id || (refund as any).id, {
          calculationSnapshot: {
            ...(refund.calculationSnapshot || {}),
            nroPoliza: nextPolicyNumber,
            nroCredito: nextCreditNumber,
          }
        })
        queryClient.invalidateQueries({ queryKey: ['refund'] })
      } catch (err) {
        toast({ title: 'Error al guardar datos', description: 'No se pudieron guardar los datos del crédito', variant: 'destructive' })
        setIsSaving(false)
        return
      }
      setIsSaving(false)
    }

    onGenerate({ creditNumber: nextCreditNumber, policyNumber: nextPolicyNumber, bankName, companyName }, true)
  }

  return (
    <div className="space-y-4 py-4">
      {/* Sección obligatoria de datos del crédito */}
      <div className={`p-3 rounded-lg border space-y-3 ${creditDataComplete ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-700' : 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700'}`}>
        <div className="flex items-center gap-2">
          {creditDataComplete
            ? <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          }
          <p className={`text-sm font-semibold ${creditDataComplete ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
            Datos del crédito <span className="text-destructive">*</span>
          </p>
        </div>
        {!creditDataComplete && (
          <p className="text-xs text-amber-700 dark:text-amber-400 ml-6">
            Estos datos son obligatorios para generar la carta de corte. Se guardarán automáticamente en la solicitud.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nº de Crédito <span className="text-destructive">*</span></Label>
            <Input
              value={creditNumber}
              onChange={e => setCreditNumber(e.target.value)}
              placeholder="Número de operación de crédito"
              className={!creditNumber.trim() ? 'border-destructive/50 focus-visible:ring-destructive/30' : 'border-emerald-500/50'}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nº de Póliza <span className="text-destructive">*</span></Label>
            <Input
              value={policyNumber}
              onChange={e => setPolicyNumber(e.target.value)}
              placeholder="Número de póliza"
              className={!policyNumber.trim() ? 'border-destructive/50 focus-visible:ring-destructive/30' : 'border-emerald-500/50'}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nombre del cliente</Label>
          <Input value={refund.fullName} disabled className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label>RUT del cliente</Label>
          <Input value={refund.rut} disabled className="bg-muted" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyName">Compañía de Seguros *</Label>
        <Input id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ej: MAPFRE Seguros Generales de Chile S.A." />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bankName">Banco (Crédito)</Label>
        <Input id="bankName" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Nombre del banco que otorgó el crédito" />
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          onClick={handleGenerate}
          className="flex-1"
          disabled={!creditDataComplete || isSaving}
        >
          {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</> : 'Vista Previa'}
        </Button>
      </div>
      {!creditDataComplete && (
        <p className="text-xs text-destructive text-center">
          Completa el Nº de Crédito y Nº de Póliza para habilitar la vista previa
        </p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// Formulario SANTANDER
// ──────────────────────────────────────────
interface SantanderFormProps {
  refund: RefundRequest
  onGenerate: (data: { creditNumber: string; policyNumber: string; bankName: string; companyName: string; insuranceName: string }) => void
}

function SantanderForm({ refund, onGenerate }: SantanderFormProps) {
  const queryClient = useQueryClient()
  const rawInsuranceType = getInsuranceType(refund.calculationSnapshot)
  const derivedInsuranceName = getInsuranceName(rawInsuranceType)

  const snapshot = refund.calculationSnapshot || {}
  const [creditNumber, setCreditNumber] = useState(snapshot.nroCredito || '')
  const [policyNumber, setPolicyNumber] = useState(snapshot.nroPoliza || '')
  const [bankName, setBankName] = useState(getInstitutionDisplayName(refund.institutionId))
  const [companyName, setCompanyName] = useState('')
  const [insuranceName, setInsuranceName] = useState(derivedInsuranceName)
  const [isSaving, setIsSaving] = useState(false)

  const creditDataComplete = !!creditNumber.trim() && !!policyNumber.trim()

  const handleGenerate = async () => {
    if (!creditNumber.trim() || !policyNumber.trim() || !companyName.trim() || !insuranceName.trim()) {
      toast({ title: 'Campos requeridos', description: 'Por favor completa todos los campos obligatorios', variant: 'destructive' })
      return
    }

    const nextPolicyNumber = policyNumber.trim()
    const nextCreditNumber = creditNumber.trim()
    const currentPolicyNumber = String(snapshot.nroPoliza || '').trim()
    const currentCreditNumber = String(snapshot.nroCredito || '').trim()
    const shouldPersistCreditData =
      nextPolicyNumber !== currentPolicyNumber || nextCreditNumber !== currentCreditNumber

    if (shouldPersistCreditData) {
      setIsSaving(true)
      try {
        await refundAdminApi.updateData(refund.publicId || (refund as any)._id || (refund as any).id, {
          calculationSnapshot: {
            ...(refund.calculationSnapshot || {}),
            nroPoliza: nextPolicyNumber,
            nroCredito: nextCreditNumber,
          }
        })
        queryClient.invalidateQueries({ queryKey: ['refund'] })
      } catch (err) {
        toast({ title: 'Error al guardar datos', description: 'No se pudieron guardar los datos del crédito', variant: 'destructive' })
        setIsSaving(false)
        return
      }
      setIsSaving(false)
    }

    onGenerate({ creditNumber: nextCreditNumber, policyNumber: nextPolicyNumber, bankName, companyName, insuranceName })
  }

  return (
    <div className="space-y-4 py-4">
      {/* Badge indicador formato Santander */}
      <div className="flex items-center gap-2 p-3 border rounded-lg bg-primary/10 border-primary/30">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm text-primary font-medium">Formato especial Banco Santander</span>
      </div>

      {/* Sección obligatoria de datos del crédito */}
      <div className={`p-3 rounded-lg border space-y-3 ${creditDataComplete ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-700' : 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700'}`}>
        <div className="flex items-center gap-2">
          {creditDataComplete
            ? <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          }
          <p className={`text-sm font-semibold ${creditDataComplete ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
            Datos del crédito <span className="text-destructive">*</span>
          </p>
        </div>
        {!creditDataComplete && (
          <p className="text-xs text-amber-700 dark:text-amber-400 ml-6">
            Estos datos son obligatorios para generar la carta de corte. Se guardarán automáticamente en la solicitud.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nº de Crédito <span className="text-destructive">*</span></Label>
            <Input
              value={creditNumber}
              onChange={e => setCreditNumber(e.target.value)}
              placeholder="Número de operación de crédito"
              className={!creditNumber.trim() ? 'border-destructive/50 focus-visible:ring-destructive/30' : 'border-emerald-500/50'}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nº de Póliza <span className="text-destructive">*</span></Label>
            <Input
              value={policyNumber}
              onChange={e => setPolicyNumber(e.target.value)}
              placeholder="Número de póliza"
              className={!policyNumber.trim() ? 'border-destructive/50 focus-visible:ring-destructive/30' : 'border-emerald-500/50'}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nombre del cliente</Label>
          <Input value={refund.fullName} disabled className="bg-muted" />
        </div>
        <div className="space-y-2">
          <Label>RUT del cliente</Label>
          <Input value={refund.rut} disabled className="bg-muted" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="s-companyName">Compañía de Seguros *</Label>
        <Input id="s-companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ej: BCI Seguros Generales S.A." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="s-bankName">Banco (Crédito)</Label>
          <Input id="s-bankName" value={bankName} onChange={e => setBankName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-insuranceName">
            Tipo de Seguro *
            {derivedInsuranceName && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">(precargado desde la solicitud)</span>
            )}
          </Label>
          <Input
            id="s-insuranceName"
            value={insuranceName}
            onChange={e => setInsuranceName(e.target.value)}
            placeholder="Ej: Seguro de Desgravamen"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          onClick={handleGenerate}
          className="flex-1"
          disabled={!creditDataComplete || isSaving}
        >
          {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</> : 'Vista Previa'}
        </Button>
      </div>
      {!creditDataComplete && (
        <p className="text-xs text-destructive text-center">
          Completa el Nº de Crédito y Nº de Póliza para habilitar la vista previa
        </p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────
// Vista previa GENÉRICA
// ──────────────────────────────────────────
interface GenericPreviewProps {
  refund: RefundRequest
  formData: { creditNumber: string; policyNumber: string; bankName: string; companyName: string }
  hasPolicyNumber: boolean
  onEdit: () => void
  onDownload: () => void
}

function GenericPreview({ refund, formData, hasPolicyNumber, onEdit, onDownload }: GenericPreviewProps) {
  const today = new Date()
  const queryClient = useQueryClient()
  const [isUploading, setIsUploading] = useState(false)

  const handleUploadToClient = async () => {
    setIsUploading(true)
    try {
      const pdfBlob = generateCortePdfBlob(refund, formData, hasPolicyNumber)
      await uploadCorteToClient(refund.publicId, pdfBlob, queryClient)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-6 bg-white text-black max-h-[60vh] overflow-y-auto text-sm">
        <p className="mb-4">Santiago, {today.getDate()} de {today.toLocaleDateString('es-CL', { month: 'long' })} de {today.getFullYear()}</p>
        <p>Sres.: {formData.companyName}</p>
        <p>Atención: Servicio al Cliente (Post-Venta)</p>
        <p className="mt-2">Ref: Carta de Renuncia al seguro que indica</p>
        <h3 className="text-center font-bold my-4">
          INFORMA TÉRMINO ANTICIPADO DE SEGURO<br />
          Y SOLICITA DEVOLUCIÓN DE PRIMA NO DEVENGADA
        </h3>
        <div className="space-y-3 text-justify">
          <p>
            Por medio de la presente Carta de Renuncia, la sociedad <strong>TDV SERVICIOS SPA</strong> RUT: <strong>{FIXED_ACCOUNT_DATA.accountHolderRut}</strong>,
            actuando en representación y por cuenta de don (doña) <strong>{refund.fullName}</strong>, cédula de identidad <strong>{refund.rut}</strong>,
            comunicamos formalmente a esa Compañía Aseguradora la renuncia al seguro y su cobertura que fuera contratado junto
            con el crédito de consumo otorgado por el Banco <strong>{formData.bankName}</strong>, que corresponde a la operación de crédito
            N°<strong>{formData.creditNumber}</strong>{hasPolicyNumber ? ` asociada a la Póliza N° ${formData.policyNumber}` : ''}, todo ello conforme
            a lo dispuesto en el artículo 537 del Código de Comercio.
          </p>
          <p>
            Asimismo, de acuerdo con lo estipulado en la Circular N°2114 de 2013 de la Comisión para el Mercado Financiero (CMF),
            solicitamos la devolución de la prima pagada y no devengada o consumida, la que deberá ser abonada a la cuenta corriente
            N° <strong>{FIXED_ACCOUNT_DATA.accountNumber}</strong> del Banco <strong>{FIXED_ACCOUNT_DATA.accountBank}</strong> cuyo titular es <strong>{FIXED_ACCOUNT_DATA.accountHolder}</strong>,
            RUT: <strong>{FIXED_ACCOUNT_DATA.accountHolderRut}</strong>, correo electrónico <strong>{FIXED_ACCOUNT_DATA.contactEmail}</strong>.
          </p>
          <p>
            Finalmente, se adjunta a la presente carta una copia del mandato que nos faculta para solicitar y tramitar la renuncia del seguro
            antes mencionado y recaudar a nombre del asegurado la devolución de las primas pagadas no devengadas, por lo cual solicitamos
            que se nos informe el resultado de esta gestión al correo electrónico <strong>{FIXED_ACCOUNT_DATA.contactEmail}</strong> y al número
            telefónico <strong>{FIXED_ACCOUNT_DATA.contactPhone}</strong>.
          </p>
          <p>Sin otro particular, se despiden atentamente,</p>
        </div>
        <div className="text-center mt-12">
          <img src={firmaImg} alt="Firma" className="w-40 h-auto mx-auto mb-2" />
          <p className="font-semibold">Cristian Andrés Nieto Gavilán</p>
          <p>p.p TDV SERVICIOS SPA RUT: {FIXED_ACCOUNT_DATA.accountHolderRut}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onEdit} className="flex-1">Editar</Button>
        <Button onClick={onDownload} className="flex-1"><Download className="h-4 w-4 mr-2" />Descargar PDF</Button>
      </div>
      <Button
        onClick={handleUploadToClient}
        disabled={isUploading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {isUploading ? 'Subiendo...' : 'Subir a Carpeta del Cliente'}
      </Button>
    </div>
  )
}

// ──────────────────────────────────────────
// Vista previa SANTANDER
// ──────────────────────────────────────────
interface SantanderPreviewProps {
  refund: RefundRequest
  formData: { creditNumber: string; policyNumber: string; bankName: string; companyName: string; insuranceName: string }
  onEdit: () => void
  onDownload: () => void
}

function SantanderPreview({ refund, formData, onEdit, onDownload }: SantanderPreviewProps) {
  const today = new Date()
  const queryClient = useQueryClient()
  const [isUploading, setIsUploading] = useState(false)

  const handleUploadToClient = async () => {
    setIsUploading(true)
    try {
      const pdfBlob = await generateSantanderCortePdfBlob(refund, formData)
      await uploadCorteToClient(refund.publicId, pdfBlob, queryClient)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-6 bg-white text-black max-h-[60vh] overflow-y-auto text-sm">
        <p className="mb-4">Santiago, {today.getDate()} de {today.toLocaleDateString('es-CL', { month: 'long' })} de {today.getFullYear()}</p>
        <p>Sres.: {formData.companyName}</p>
        <p className="mt-2">Ref: Carta de Renuncia al seguro que indica</p>
        <h3 className="text-center font-bold my-4">
          INFORMA TÉRMINO ANTICIPADO DE SEGURO Y SOLICITA DEVOLUCION DE PRIMA NO DEVENGADA
        </h3>
        <div className="space-y-3 text-justify">
          <p>
            Por medio de la presente, <strong>TDV SERVICIOS SPA</strong>, RUT N° <strong>{FIXED_ACCOUNT_DATA.accountHolderRut}</strong>,
            debidamente facultada y actuando en representación y por cuenta de don/doña{' '}
            <strong>{refund.fullName}</strong>, cédula de identidad N° <strong>{refund.rut}</strong>,
            viene a comunicar formalmente a esa Compañía Aseguradora <strong>{formData.companyName}</strong>{' '}
            la renuncia expresa al seguro <strong>{formData.insuranceName}</strong>, incluyendo todas sus coberturas asociadas.
          </p>
          <p>
            El referido seguro fue contratado en conjunto con el crédito de consumo otorgado por el
            Banco <strong>{formData.bankName}</strong>, correspondiente a la operación de crédito
            N° <strong>{formData.creditNumber}</strong>, asociado a la Póliza N° <strong>{formData.policyNumber}</strong>.
          </p>
          <p>
            La presente renuncia se formula conforme a lo dispuesto en el artículo 537 del Código de Comercio
            y demás normativa aplicable, solicitando se sirva proceder a la cancelación del seguro indicado
            y a la determinación y devolución de las primas no devengadas que correspondan.
          </p>
          <p>
            Asimismo, de acuerdo con lo estipulado en la Circular N°2114 de fecha año 2013 de la Comisión
            para el Mercado Financiero (CMF), solicitamos la devolución de la prima pagada y no devengada o
            consumida, la que deberá ser abonada a la cuenta corriente
            N° <strong>{FIXED_ACCOUNT_DATA.accountNumber}</strong> del Banco <strong>{FIXED_ACCOUNT_DATA.accountBank}</strong>{' '}
            cuyo titular es <strong>{FIXED_ACCOUNT_DATA.accountHolder}</strong>,
            RUT: <strong>{FIXED_ACCOUNT_DATA.accountHolderRut}</strong>, correo electrónico{' '}
            <strong>{FIXED_ACCOUNT_DATA.contactEmail}</strong>. Se hace presente que el monto a restituir
            deberá abonarse en la cuenta bancaria señalada dentro de los próximos 10 días hábiles,
            conforme a la normativa vigente.
          </p>
          <p>
            Finalmente, se adjunta a la presente carta una copia del mandato que nos faculta para solicitar
            y tramitar la renuncia del seguro antes mencionado y recaudar a nombre del asegurado la
            devolución de las primas pagadas no devengadas, por lo cual solicitamos que se nos informe el
            resultado de esta gestión al correo electrónico <strong>{FIXED_ACCOUNT_DATA.contactEmail}</strong> y al número
            telefónico <strong>{FIXED_ACCOUNT_DATA.contactPhone}</strong>.
          </p>
          <p>Sin otro particular, se despiden atentamente,</p>
        </div>
        <div className="text-center mt-12">
          <img src={firmaImg} alt="Firma" className="w-40 h-auto mx-auto mb-2" />
          <p className="font-semibold">Cristian Andrés Nieto Gavilán / Rut: 13040385-9</p>
          <p>p.p TDV SERVICIOS SPA RUT: {FIXED_ACCOUNT_DATA.accountHolderRut}</p>
        </div>

        {/* Páginas adjuntas */}
        <div className="mt-8 pt-6 border-t border-dashed border-border space-y-6">
          <div className="text-center">
            <h4 className="font-bold mb-3 text-sm tracking-wide">— Página 2: Cédula Legalizada —</h4>
            <img src={corteCedulaImg} alt="Cédula de Identidad Legalizada" className="max-h-64 w-auto border rounded mx-auto" />
          </div>
          <div className="text-center">
            <h4 className="font-bold mb-3 text-sm tracking-wide">— Página 3: Certificado Notarial —</h4>
            <img src={corteNotarialImg} alt="Certificado Notarial" className="max-h-64 w-auto border rounded mx-auto" />
          </div>
          <div className="text-center">
            <h4 className="font-bold mb-3 text-sm tracking-wide">— Página 4: Certificado Conservador —</h4>
            <img src={corteConservadorImg} alt="Certificado Conservador" className="max-h-64 w-auto border rounded mx-auto" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onEdit} className="flex-1">Editar</Button>
        <Button onClick={onDownload} className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Descargar PDF
        </Button>
      </div>
      <Button
        onClick={handleUploadToClient}
        disabled={isUploading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {isUploading ? 'Subiendo...' : 'Subir a Carpeta del Cliente'}
      </Button>
    </div>
  )
}

// ──────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────
export function GenerateCorteDialog({ refund, isMandateSigned = false }: GenerateCorteDialogProps) {
  const [open, setOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const institutionLower = refund.institutionId?.toLowerCase() || ''
  const isSantander = institutionLower === 'santander' || institutionLower === 'santander-consumer' || institutionLower === 'santander consumer'

  const [genericData, setGenericData] = useState<{
    formData: { creditNumber: string; policyNumber: string; bankName: string; companyName: string }
    hasPolicyNumber: boolean
  } | null>(null)

  const [santanderData, setSantanderData] = useState<{
    creditNumber: string; policyNumber: string; bankName: string; companyName: string; insuranceName: string
  } | null>(null)

  const handleClose = () => {
    setOpen(false)
    setShowPreview(false)
    setGenericData(null)
    setSantanderData(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!isMandateSigned}>
                  <FileText className="h-4 w-4 mr-2" />
                  Carta de Corte
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

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Generar Carta de Renuncia y Término Anticipado de Seguro
            {isSantander && (
              <span className="ml-2 text-xs font-normal text-primary bg-primary/10 border border-primary/30 rounded px-2 py-0.5">
                Banco Santander
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── GENÉRICO ── */}
        {!isSantander && !showPreview && (
          <GenericForm
            refund={refund}
            onGenerate={(data, hasPol) => {
              setGenericData({ formData: data, hasPolicyNumber: hasPol })
              setShowPreview(true)
            }}
          />
        )}
        {!isSantander && showPreview && genericData && (
          <GenericPreview
            refund={refund}
            formData={genericData.formData}
            hasPolicyNumber={genericData.hasPolicyNumber}
            onEdit={() => setShowPreview(false)}
            onDownload={() => generateGenericPDF(refund, genericData.formData, genericData.hasPolicyNumber)}
          />
        )}

        {/* ── SANTANDER ── */}
        {isSantander && !showPreview && (
          <SantanderForm
            refund={refund}
            onGenerate={(data) => {
              setSantanderData(data)
              setShowPreview(true)
            }}
          />
        )}
        {isSantander && showPreview && santanderData && (
          <SantanderPreview
            refund={refund}
            formData={santanderData}
            onEdit={() => setShowPreview(false)}
            onDownload={() => generateSantanderPDF(refund, santanderData)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
