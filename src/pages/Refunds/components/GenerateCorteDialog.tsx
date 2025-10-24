import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Download } from 'lucide-react'
import { RefundRequest } from '@/types/refund'
import { toast } from '@/hooks/use-toast'
import firmaImg from '@/assets/firma-cng.jpeg'

interface GenerateCorteDialogProps {
  refund: RefundRequest
}

interface CorteFormData {
  creditNumber: string
  policyNumber: string
  bankName: string
  companyName: string
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

export function GenerateCorteDialog({ refund }: GenerateCorteDialogProps) {
  const [open, setOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState<CorteFormData>({
    creditNumber: '',
    policyNumber: '',
    bankName: refund.institutionId || '',
    companyName: '',
  })

  const handleInputChange = (field: keyof CorteFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    const required = ['creditNumber', 'policyNumber', 'companyName']
    const missing = required.filter(field => !formData[field as keyof CorteFormData])
    
    if (missing.length > 0) {
      toast({
        title: 'Campos requeridos',
        description: 'Por favor completa todos los campos obligatorios',
        variant: 'destructive',
      })
      return false
    }
    return true
  }

  const handleGenerate = () => {
    if (!validateForm()) return
    setShowPreview(true)
  }

  const generatePDF = () => {
    const today = new Date()
    const day = today.getDate()
    const month = today.toLocaleDateString('es-CL', { month: 'long' })
    const year = today.getFullYear()

    const content = `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { 
              margin: 1.5cm 2cm; 
              size: letter;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 10pt;
              line-height: 1.4;
              color: #000;
            }
            .header {
              text-align: left;
              margin-bottom: 15px;
            }
            .title {
              text-align: center;
              font-weight: bold;
              font-size: 11pt;
              margin: 12px 0;
            }
            .content {
              text-align: justify;
              margin: 10px 0;
            }
            .content p {
              margin: 8px 0;
            }
            .signature {
              margin-top: 30px;
              text-align: center;
              page-break-inside: avoid;
            }
            .signature-line {
              border-top: 1px solid #000;
              width: 250px;
              margin: 20px auto 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            Santiago, ${day} de ${month} de ${year}
          </div>
          
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
              que corresponde a la operación de crédito N°<strong>${formData.creditNumber}</strong> 
              asociada a la Póliza N° <strong>${formData.policyNumber}</strong>, todo ello conforme 
              a lo dispuesto en el artículo 537 del Código de Comercio.
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

            <p>
              Sin otro particular, se despiden atentamente,
            </p>
          </div>

          <div class="signature">
            <img src="${firmaImg}" alt="Firma" style="width: 180px; height: auto; margin: 20px auto 10px; display: block;">
            <p style="margin: 5px 0;">Cristian Andrés Nieto Gavilán</p>
            <p style="margin: 5px 0;">
              p.p TDV SERVICIOS SPA RUT: ${FIXED_ACCOUNT_DATA.accountHolderRut}
            </p>
          </div>
        </body>
      </html>
    `

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="h-4 w-4 mr-2" />
          Generar Carta de Corte
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar Carta de Renuncia y Término Anticipado de Seguro</DialogTitle>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4 py-4">
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
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                placeholder="Ej: MAPFRE Seguros Generales de Chile S.A."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="creditNumber">Nº de Crédito *</Label>
                <Input
                  id="creditNumber"
                  value={formData.creditNumber}
                  onChange={(e) => handleInputChange('creditNumber', e.target.value)}
                  placeholder="Número de operación de crédito"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="policyNumber">Póliza Nº *</Label>
                <Input
                  id="policyNumber"
                  value={formData.policyNumber}
                  onChange={(e) => handleInputChange('policyNumber', e.target.value)}
                  placeholder="Número de póliza"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankName">Banco (Crédito)</Label>
              <Input
                id="bankName"
                value={formData.bankName}
                onChange={(e) => handleInputChange('bankName', e.target.value)}
                placeholder="Nombre del banco que otorgó el crédito"
              />
            </div>


            <div className="flex gap-2 pt-4">
              <Button onClick={handleGenerate} className="flex-1">
                Vista Previa
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-lg p-6 bg-white text-black max-h-[60vh] overflow-y-auto">
              <div className="mb-6">
                <p>Santiago, {new Date().getDate()} de {new Date().toLocaleDateString('es-CL', { month: 'long' })} de {new Date().getFullYear()}</p>
              </div>

              <div className="mb-6">
                <p>Sres.: {formData.companyName}</p>
                <p>Atención: Servicio al Cliente (Post-Venta)</p>
                <p className="mt-2">Ref: Carta de Renuncia al seguro que indica</p>
              </div>

              <h3 className="text-center font-bold my-4">
                INFORMA TÉRMINO ANTICIPADO DE SEGURO<br/>
                Y SOLICITA DEVOLUCIÓN DE PRIMA NO DEVENGADA
              </h3>

              <div className="space-y-4 text-justify">
                <p>
                  Por medio de la presente Carta de Renuncia, la sociedad <strong>TDV SERVICIOS SPA</strong> RUT: <strong>{FIXED_ACCOUNT_DATA.accountHolderRut}</strong>, 
                  actuando en representación y por cuenta de don (doña) <strong>{refund.fullName}</strong>, cédula de identidad <strong>{refund.rut}</strong>, 
                  comunicamos formalmente a esa Compañía Aseguradora la renuncia al seguro y su cobertura que fuera contratado junto 
                  con el crédito de consumo otorgado por el Banco <strong>{formData.bankName}</strong>, que corresponde a la operación de crédito 
                  N°<strong>{formData.creditNumber}</strong> asociada a la Póliza N° <strong>{formData.policyNumber}</strong>, todo ello conforme 
                  a lo dispuesto en el artículo 537 del Código de Comercio.
                </p>

                <p>
                  Asimismo, de acuerdo con lo estipulado en la Circular N°2114 de 2013 de la Comisión para el Mercado Financiero (CMF), 
                  solicitamos la devolución de la prima pagada y no devengada o consumida, la que deberá ser abonada a la cuenta corriente 
                  N° <strong>{FIXED_ACCOUNT_DATA.accountNumber}</strong> del Banco <strong>{FIXED_ACCOUNT_DATA.accountBank}</strong> cuyo titular es <strong>{FIXED_ACCOUNT_DATA.accountHolder}</strong>, 
                  RUT: <strong>{FIXED_ACCOUNT_DATA.accountHolderRut}</strong>, correo electrónico <strong>{FIXED_ACCOUNT_DATA.contactEmail}</strong>. Se hace presente que 
                  el monto a restituir deberá abonarse en la cuenta bancaria señalada dentro de los próximos 10 días hábiles, conforme a la normativa vigente.
                </p>

                <p>
                  Finalmente, se adjunta a la presente carta una copia del mandato que nos faculta para solicitar y tramitar la renuncia del seguro 
                  antes mencionado y recaudar a nombre del asegurado la devolución de las primas pagadas no devengadas, por lo cual solicitamos 
                  que se nos informe el resultado de esta gestión al correo electrónico <strong>{FIXED_ACCOUNT_DATA.contactEmail}</strong> y al número 
                  telefónico <strong>{FIXED_ACCOUNT_DATA.contactPhone}</strong>.
                </p>

                <p>Sin otro particular, se despiden atentamente,</p>
              </div>

              <div className="text-center mt-16">
                <img src={firmaImg} alt="Firma" className="w-48 h-auto mx-auto mb-2" />
                <p className="font-semibold">Cristian Andrés Nieto Gavilán</p>
                <p className="mt-1">p.p TDV SERVICIOS SPA RUT: {FIXED_ACCOUNT_DATA.accountHolderRut}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPreview(false)} className="flex-1">
                Editar
              </Button>
              <Button onClick={generatePDF} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
