import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Download } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { RefundRequest } from '@/types/refund'
import jsPDF from 'jspdf'

interface GenerateCertificateDialogProps {
  refund: RefundRequest
}

interface CertificateData {
  folio: string
  direccion: string
  numero: string
  depto: string
  ciudad: string
  comuna: string
  celular: string
  sexo: 'M' | 'F'
  autorizaEmail: 'SI' | 'NO'
  nroOperacion: string
  fechaInicioCredito: string
  fechaFinCredito: string
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

export function GenerateCertificateDialog({ refund }: GenerateCertificateDialogProps) {
  const [open, setOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [formData, setFormData] = useState<CertificateData>({
    folio: '',
    direccion: '',
    numero: '',
    depto: '',
    ciudad: '',
    comuna: '',
    celular: refund.phone || '',
    sexo: 'M',
    autorizaEmail: 'SI',
    nroOperacion: '',
    fechaInicioCredito: '',
    fechaFinCredito: '',
  })

  const handleChange = (field: keyof CertificateData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const calculatePrimaUnica = () => {
    const saldoInsoluto = refund.calculationSnapshot?.totalAmount || 0
    const nper = refund.calculationSnapshot?.originalInstallments || 0
    const age = refund.calculationSnapshot?.age
    const tbm = getTasaBrutaMensual(age) / 1000
    return Math.round(saldoInsoluto * tbm * nper)
  }

  const generatePDF = async () => {
    setIsGenerating(true)
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 15

      // Header
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('SOLICITUD DE INCORPORACIÓN, PROPUESTA Y CERTIFICADO DE COBERTURA INMEDIATA', pageWidth / 2, y, { align: 'center' })
      y += 6
      doc.text('SEGURO DE DESGRAVAMEN', pageWidth / 2, y, { align: 'center' })
      y += 8

      // Fecha, Folio, Póliza
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Fecha: ${getTodayFormatted()}`, 15, y)
      doc.text(`Folio: ${formData.folio}`, 80, y)
      doc.text('Nro. Póliza: 342', 140, y)
      y += 10

      // Certificado de Cobertura
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Certificado de Cobertura', 15, y)
      y += 8

      // Identificación del Asegurado Titular
      doc.setFontSize(10)
      doc.text('Identificación del Asegurado Titular', 15, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      
      // Nombre y RUT
      doc.text(`Nombre: ${refund.fullName}`, 15, y)
      doc.text(`RUT: ${refund.rut}`, 120, y)
      doc.text(`Fecha Nacimiento: ${formatDate(refund.calculationSnapshot?.birthDate)}`, 160, y)
      y += 5

      // Dirección
      doc.text(`Dirección: ${formData.direccion}`, 15, y)
      doc.text(`N°: ${formData.numero}`, 120, y)
      doc.text(`Depto/Block: ${formData.depto}`, 155, y)
      y += 5

      // Ciudad, Comuna, Teléfono
      doc.text(`Ciudad: ${formData.ciudad}`, 15, y)
      doc.text(`Comuna: ${formData.comuna}`, 60, y)
      doc.text(`Teléfono: ${refund.phone || '-'}`, 110, y)
      doc.text(`Celular: ${formData.celular}`, 155, y)
      y += 5

      // Sexo
      doc.text(`Sexo: ${formData.sexo === 'M' ? '[X] M    [ ] F' : '[ ] M    [X] F'}`, 15, y)
      y += 5

      // Email
      doc.text(`Correo Electrónico: ${refund.email}`, 15, y)
      y += 5
      doc.setFontSize(7)
      doc.text('Autorizo que toda comunicación y notificación que diga relación con el presente seguro me sea enviada al correo electrónico señalado.', 15, y)
      y += 4
      doc.setFontSize(9)
      doc.text(`${formData.autorizaEmail === 'SI' ? '[X] SI    [ ] NO' : '[ ] SI    [X] NO'}`, 15, y)
      y += 8

      // Antecedentes de la Compañía Aseguradora
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Antecedentes de la Compañía Aseguradora', 15, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Augustar Seguros de Vida S.A.', 15, y)
      doc.text('RUT: 76.632.384-7', 120, y)
      y += 6

      // Antecedentes del Contratante y Recaudador
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Antecedentes del Contratante y Recaudador', 15, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('TDV SERVICIOS SPA', 15, y)
      doc.text('RUT: 78.168.126-1', 120, y)
      y += 6

      // Antecedentes del Corredor
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Antecedentes del Corredor', 15, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Prime Corredores de Seguro SPA.', 15, y)
      doc.text('RUT: 76.196.802-5', 120, y)
      y += 8

      // Datos del Seguro
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Datos del Seguro', 15, y)
      y += 6

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const montoCredito = refund.calculationSnapshot?.totalAmount || 0
      doc.text(`Monto Inicial del Crédito*: $${montoCredito.toLocaleString('es-CL')} CLP`, 15, y)
      doc.text(`Nro. Operación: ${formData.nroOperacion}`, 120, y)
      y += 5

      doc.text(`Fecha Inicio del Crédito: ${formData.fechaInicioCredito}`, 15, y)
      doc.text(`Fecha Fin del Crédito**: ${formData.fechaFinCredito}`, 120, y)
      y += 6

      const primaUnica = calculatePrimaUnica()
      doc.text(`Prima Única del Seguro (Exenta de IVA): $${primaUnica.toLocaleString('es-CL')} CLP`, 15, y)
      y += 8

      // Fórmula
      doc.setFontSize(8)
      doc.text('Donde: SI = Saldo insoluto inicial, TBM = Tasa Bruta Mensual, Nper = plazo de duración del crédito en meses', 15, y)
      y += 6

      // Tabla de tasas
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Rangos de Edad de Emisión', 15, y)
      doc.text('Tasa Bruta mensual (por mil)', 100, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      doc.text('18 – 55 años', 15, y)
      doc.text('0,2970', 100, y)
      y += 4
      doc.text('56 – 65 años', 15, y)
      doc.text('0,3733', 100, y)
      y += 8

      // Edad del asegurado indicador
      const age = refund.calculationSnapshot?.age || 0
      const tasaAplicada = getTasaBrutaMensual(age)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text(`Edad del asegurado: ${age} años - Tasa aplicada: ${tasaAplicada.toFixed(4)} por mil`, 15, y)
      y += 10

      // Page 2
      doc.addPage()
      y = 15

      // Coberturas
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Detalle de Coberturas', 15, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Cobertura de Fallecimiento', 15, y)
      doc.text('Código C.M.F.: POL 220150573', 100, y)
      y += 8

      doc.setFontSize(8)
      doc.text('El presente contrato no cuenta con Sello SERNAC conforme al Artículo 55, Ley 20.555', 15, y)
      y += 10

      // Condiciones
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Condiciones de Asegurabilidad', 15, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const condicionesText = 'Acreditado el fallecimiento del asegurado, la compañía de seguros pagará el total del saldo insoluto del crédito de consumo o automotriz del asegurado con tope de $20.000.000, al momento de ocurrir el siniestro, cualquiera sea la época y lugar donde ocurra, siempre que el certificado se encuentre vigente.'
      const splitCondiciones = doc.splitTextToSize(condicionesText, pageWidth - 30)
      doc.text(splitCondiciones, 15, y)
      y += splitCondiciones.length * 4 + 6

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Capital máximo: $20.000.000 CLP', 15, y)
      y += 8

      // Requisitos
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Requisitos de Asegurabilidad', 15, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('• Edad Mínima de Ingreso: 18 años', 15, y)
      y += 4
      doc.text('• Edad Máxima de Ingreso: 64 años y 364 días', 15, y)
      y += 4
      doc.text('• Edad máxima de Permanencia: 69 años y 364 días', 15, y)
      y += 8

      doc.setFontSize(8)
      doc.text('La edad del asegurado al inicio del crédito más el plazo del crédito, no deberá superar la edad máxima de permanencia.', 15, y)
      y += 10

      // Beneficiarios
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text('Beneficiarios', 15, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('El acreedor financiero del crédito de consumo o automotriz del asegurado, respecto del saldo insoluto de la deuda.', 15, y)
      y += 10

      // Footer
      doc.setFontSize(7)
      doc.setTextColor(128)
      doc.text('Documento generado automáticamente por TeDevuelvo Backoffice', pageWidth / 2, 280, { align: 'center' })
      doc.text(`Fecha de generación: ${getTodayFormatted()}`, pageWidth / 2, 284, { align: 'center' })

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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="h-4 w-4 mr-2" />
          Generar Certificado de Cobertura
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar Certificado de Cobertura</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Datos precargados */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Datos del asegurado (desde solicitud)</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Nombre:</span> {refund.fullName}</div>
              <div><span className="text-muted-foreground">RUT:</span> {refund.rut}</div>
              <div><span className="text-muted-foreground">Email:</span> {refund.email}</div>
              <div><span className="text-muted-foreground">Teléfono:</span> {refund.phone || 'N/A'}</div>
              <div><span className="text-muted-foreground">Fecha Nac.:</span> {formatDate(refund.calculationSnapshot?.birthDate)}</div>
              <div><span className="text-muted-foreground">Edad:</span> {refund.calculationSnapshot?.age || 'N/A'} años</div>
              <div><span className="text-muted-foreground">Monto Crédito:</span> ${(refund.calculationSnapshot?.totalAmount || 0).toLocaleString('es-CL')}</div>
              <div><span className="text-muted-foreground">Cuotas:</span> {refund.calculationSnapshot?.originalInstallments || 'N/A'}</div>
            </div>
          </div>

          {/* Campos a completar */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Folio</Label>
              <Input
                value={formData.folio}
                onChange={(e) => handleChange('folio', e.target.value)}
                placeholder="Número de folio"
              />
            </div>
            <div className="space-y-2">
              <Label>Nro. Operación</Label>
              <Input
                value={formData.nroOperacion}
                onChange={(e) => handleChange('nroOperacion', e.target.value)}
                placeholder="Número de operación"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Dirección</Label>
              <Input
                value={formData.direccion}
                onChange={(e) => handleChange('direccion', e.target.value)}
                placeholder="Calle o avenida"
              />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input
                value={formData.numero}
                onChange={(e) => handleChange('numero', e.target.value)}
                placeholder="N°"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Depto/Block</Label>
              <Input
                value={formData.depto}
                onChange={(e) => handleChange('depto', e.target.value)}
                placeholder="Depto"
              />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input
                value={formData.ciudad}
                onChange={(e) => handleChange('ciudad', e.target.value)}
                placeholder="Ciudad"
              />
            </div>
            <div className="space-y-2">
              <Label>Comuna</Label>
              <Input
                value={formData.comuna}
                onChange={(e) => handleChange('comuna', e.target.value)}
                placeholder="Comuna"
              />
            </div>
            <div className="space-y-2">
              <Label>Celular</Label>
              <Input
                value={formData.celular}
                onChange={(e) => handleChange('celular', e.target.value)}
                placeholder="+56 9..."
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Sexo</Label>
              <Select value={formData.sexo} onValueChange={(v) => handleChange('sexo', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Autoriza email</Label>
              <Select value={formData.autorizaEmail} onValueChange={(v) => handleChange('autorizaEmail', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SI">Sí</SelectItem>
                  <SelectItem value="NO">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha Inicio Crédito</Label>
              <Input
                value={formData.fechaInicioCredito}
                onChange={(e) => handleChange('fechaInicioCredito', e.target.value)}
                placeholder="DD/MM/YYYY"
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin Crédito</Label>
              <Input
                value={formData.fechaFinCredito}
                onChange={(e) => handleChange('fechaFinCredito', e.target.value)}
                placeholder="DD/MM/YYYY"
              />
            </div>
          </div>

          {/* Prima calculada */}
          <div className="bg-primary/10 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Prima Única del Seguro (calculada):</span>
              <span className="text-lg font-bold">${calculatePrimaUnica().toLocaleString('es-CL')} CLP</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Fórmula: Saldo insoluto × TBM × Nper (Tasa según edad: {getTasaBrutaMensual(refund.calculationSnapshot?.age).toFixed(4)} por mil)
            </p>
          </div>

          <Button onClick={generatePDF} className="w-full" disabled={isGenerating}>
            {isGenerating ? (
              'Generando...'
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Descargar Certificado PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
