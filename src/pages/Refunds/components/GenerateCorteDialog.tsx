import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { FileText, Download } from 'lucide-react'
import { RefundRequest } from '@/types/refund'
import { toast } from '@/hooks/use-toast'
import firmaImg from '@/assets/firma-cng.jpeg'
import cedulaFrenteImg from '@/assets/cedula-frente.jpg'
import cedulaDorsoImg from '@/assets/cedula-dorso.jpg'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getInstitutionDisplayName } from '@/lib/institutionHomologation'

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

  const idPageContent = `
    <div style="page-break-before: always;">
      <h3 style="text-align: center; font-size: 12pt; margin-bottom: 20px;">CÉDULA DE IDENTIDAD</h3>
      <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
        <div style="text-align: center; flex: 1; min-width: 220px;">
          <p style="font-weight: bold; margin-bottom: 8px;">Frente</p>
          <img src="${cedulaFrenteImg}" alt="Cédula Frente" style="max-width: 100%; max-height: 280px; border: 1px solid #ccc; border-radius: 4px;" />
        </div>
        <div style="text-align: center; flex: 1; min-width: 220px;">
          <p style="font-weight: bold; margin-bottom: 8px;">Dorso</p>
          <img src="${cedulaDorsoImg}" alt="Cédula Dorso" style="max-width: 100%; max-height: 280px; border: 1px solid #ccc; border-radius: 4px;" />
        </div>
      </div>
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
            viene en comunicar formalmente a esa Compañía Aseguradora <strong>${formData.companyName}</strong> 
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
        ${idPageContent}
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

// ──────────────────────────────────────────
// Formulario GENÉRICO
// ──────────────────────────────────────────
interface GenericFormProps {
  refund: RefundRequest
  onGenerate: (data: { creditNumber: string; policyNumber: string; bankName: string; companyName: string }, hasPolicyNumber: boolean) => void
}

function GenericForm({ refund, onGenerate }: GenericFormProps) {
  const [hasPolicyNumber, setHasPolicyNumber] = useState(true)
  const [creditNumber, setCreditNumber] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [bankName, setBankName] = useState(getInstitutionDisplayName(refund.institutionId))
  const [companyName, setCompanyName] = useState('')

  const handleGenerate = () => {
    const required = hasPolicyNumber
      ? [creditNumber, policyNumber, companyName]
      : [creditNumber, companyName]
    if (required.some(v => !v.trim())) {
      toast({ title: 'Campos requeridos', description: 'Por favor completa todos los campos obligatorios', variant: 'destructive' })
      return
    }
    onGenerate({ creditNumber, policyNumber, bankName, companyName }, hasPolicyNumber)
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
        <Checkbox id="hasPolicyNumber" checked={hasPolicyNumber} onCheckedChange={(c) => setHasPolicyNumber(c as boolean)} />
        <Label htmlFor="hasPolicyNumber" className="text-sm font-normal cursor-pointer">Tengo número de póliza</Label>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="creditNumber">Nº de Crédito *</Label>
          <Input id="creditNumber" value={creditNumber} onChange={e => setCreditNumber(e.target.value)} placeholder="Número de operación de crédito" />
        </div>
        {hasPolicyNumber && (
          <div className="space-y-2">
            <Label htmlFor="policyNumber">Póliza Nº *</Label>
            <Input id="policyNumber" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Número de póliza" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bankName">Banco (Crédito)</Label>
        <Input id="bankName" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Nombre del banco que otorgó el crédito" />
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={handleGenerate} className="flex-1">Vista Previa</Button>
      </div>
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
  const rawInsuranceType = getInsuranceType(refund.calculationSnapshot)
  const derivedInsuranceName = getInsuranceName(rawInsuranceType)

  const [creditNumber, setCreditNumber] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [bankName, setBankName] = useState(getInstitutionDisplayName(refund.institutionId))
  const [companyName, setCompanyName] = useState('')
  const [insuranceName, setInsuranceName] = useState(derivedInsuranceName)

  const handleGenerate = () => {
    if (!creditNumber.trim() || !policyNumber.trim() || !companyName.trim() || !insuranceName.trim()) {
      toast({ title: 'Campos requeridos', description: 'Por favor completa todos los campos obligatorios', variant: 'destructive' })
      return
    }
    onGenerate({ creditNumber, policyNumber, bankName, companyName, insuranceName })
  }

  return (
    <div className="space-y-4 py-4">
      {/* Badge indicador formato Santander */}
      <div className="flex items-center gap-2 p-3 border rounded-lg bg-primary/10 border-primary/30">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm text-primary font-medium">Formato especial Banco Santander</span>
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
          <Label htmlFor="s-creditNumber">Nº de Crédito *</Label>
          <Input id="s-creditNumber" value={creditNumber} onChange={e => setCreditNumber(e.target.value)} placeholder="Número de operación de crédito" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-policyNumber">Nº de Póliza *</Label>
          <Input id="s-policyNumber" value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} placeholder="Número de póliza" />
        </div>
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
        <Button onClick={handleGenerate} className="flex-1">Vista Previa</Button>
      </div>
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
            viene en comunicar formalmente a esa Compañía Aseguradora <strong>{formData.companyName}</strong>{' '}
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

        {/* Segunda página: Cédula de Identidad */}
        <div className="mt-8 pt-6 border-t border-dashed border-border">
          <h4 className="text-center font-bold mb-4 text-sm tracking-wide">— CÉDULA DE IDENTIDAD —</h4>
          <div className="flex gap-4 justify-center flex-wrap">
            <div className="text-center flex-1 min-w-[180px]">
              <p className="text-xs font-semibold mb-1">Frente</p>
              <img src={cedulaFrenteImg} alt="Cédula Frente" className="max-h-48 w-auto border rounded mx-auto" />
            </div>
            <div className="text-center flex-1 min-w-[180px]">
              <p className="text-xs font-semibold mb-1">Dorso</p>
              <img src={cedulaDorsoImg} alt="Cédula Dorso" className="max-h-48 w-auto border rounded mx-auto" />
            </div>
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
    </div>
  )
}

// ──────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────
export function GenerateCorteDialog({ refund, isMandateSigned = false }: GenerateCorteDialogProps) {
  const [open, setOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const isSantander = refund.institutionId?.toLowerCase() === 'santander'

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
