import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { FileSpreadsheet } from 'lucide-react'
import { RefundRequest } from '@/types/refund'
import { toast } from '@/hooks/use-toast'
import { exportXLSX } from '@/services/reportesService'

interface GenerateExcelDialogProps {
  selectedRefunds: RefundRequest[]
  onClose?: () => void
}

export function GenerateExcelDialog({ selectedRefunds, onClose }: GenerateExcelDialogProps) {
  const [open, setOpen] = useState(false)
  const [policyNumber, setPolicyNumber] = useState('')
  const [creditCode, setCreditCode] = useState('')

  const handleGenerate = () => {
    if (!policyNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Debes ingresar el número de póliza',
        variant: 'destructive',
      })
      return
    }

    if (!creditCode.trim()) {
      toast({
        title: 'Error',
        description: 'Debes ingresar el código de crédito',
        variant: 'destructive',
      })
      return
    }

    const excelData = selectedRefunds.map((refund) => {
      const calculation = refund.calculationSnapshot || {}
      const rut = refund.rut || ''
      const rutParts = rut.split('-')
      const rutNumber = rutParts[0].replace(/\./g, '')
      const rutDV = rutParts[1] || ''
      
      // Calcular prima neta (sin IVA 19%)
      const primaBruta = calculation.newMonthlyPremium || 0
      const primaNeta = Math.round(primaBruta / 1.19)
      
      // Fechas
      const createdDate = new Date(refund.createdAt)
      const vigenciaDesde = createdDate.toLocaleDateString('es-CL')
      
      // Vigencia hasta: fecha de creación + 3 años
      const vigenciaHastaDate = new Date(refund.createdAt)
      vigenciaHastaDate.setFullYear(vigenciaHastaDate.getFullYear() + 3)
      const vigenciaHasta = vigenciaHastaDate.toLocaleDateString('es-CL')
      
      // Tipo de seguro
      const tipoSeguro = calculation.insuranceToEvaluate === 'desgravamen' 
        ? 'Desgravamen' 
        : calculation.insuranceToEvaluate === 'cesantia' 
        ? 'Cesantía' 
        : 'N/A'
      
      const producto = calculation.insuranceToEvaluate === 'desgravamen' 
        ? 'Fallecimiento' 
        : 'N/A'

      return {
        'Sponsor': 'TDV Servicios SpA.',
        'Rut Empresa': '78168126-1',
        'Ramo comercial': tipoSeguro,
        'Producto': producto,
        'Poliza N°': policyNumber,
        'Número del certificado (Folio)': refund.id,
        'Rut Cliente': rutNumber,
        'DV Cliente': rutDV,
        'Nombre_Cliente': refund.fullName,
        'Fecha_Nacimiento': 'N/A', // No tenemos edad exacta, solo estimación
        'Sexo': 'N/A',
        'Codigo_producto': '342',
        'Prima Seguro  $': primaBruta,
        'Prima_periodo_neta_pesos': primaNeta,
        'Prima_periodo_bruta_pesos': primaBruta,
        'Vigencia_Desde': vigenciaDesde,
        'Vigencia_Hasta': vigenciaHasta,
        'Plazo Meses': calculation.remainingInstallments || 0,
        'Codigo_De_credito_o Nro de operación': creditCode,
        'Capital Asegurado': calculation.totalAmount || 0,
        'Corre electrónico': refund.email,
        'Dirección particular': 'N/A',
        'Comuna': 'N/A',
        'Región': 'N/A',
      }
    })

    const fileName = `solicitudes_${new Date().toISOString().split('T')[0]}`
    exportXLSX(excelData, fileName)

    toast({
      title: 'Excel generado',
      description: `Se generó el archivo con ${selectedRefunds.length} solicitudes`,
    })

    setOpen(false)
    setPolicyNumber('')
    setCreditCode('')
    if (onClose) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default"
          disabled={selectedRefunds.length === 0}
          className="gap-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Generar Excel ({selectedRefunds.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generar Excel de Solicitudes</DialogTitle>
          <DialogDescription>
            Se generará un archivo Excel con {selectedRefunds.length} solicitud(es) seleccionada(s).
            Complete los siguientes datos requeridos:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="policyNumber">Número de Póliza *</Label>
            <Input
              id="policyNumber"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              placeholder="Ej: POL-123456"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="creditCode">Código de Crédito / Nro de Operación *</Label>
            <Input
              id="creditCode"
              value={creditCode}
              onChange={(e) => setCreditCode(e.target.value)}
              placeholder="Ej: CRED-789012"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate}>
            Generar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
