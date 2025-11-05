import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, Download } from 'lucide-react'
import { RefundRequest } from '@/types/refund'
import { toast } from '@/hooks/use-toast'
import { exportXLSX } from '@/services/reportesService'

interface ExportToExcelDialogProps {
  refunds: RefundRequest[]
  totalCount: number
}

export function ExportToExcelDialog({ refunds, totalCount }: ExportToExcelDialogProps) {
  const [open, setOpen] = useState(false)

  const handleExport = () => {
    const excelData = refunds.map((refund) => {
      const calculation = refund.calculationSnapshot || {}
      const rut = refund.rut || ''
      
      // Calcular prima neta (sin IVA 19%)
      const primaBruta = calculation.newMonthlyPremium || 0
      const primaNeta = Math.round(primaBruta / 1.19)
      
      // Fechas
      const createdDate = new Date(refund.createdAt)
      const formattedCreatedAt = createdDate.toLocaleDateString('es-CL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
      
      // Tipo de seguro
      const tipoSeguro = calculation.insuranceToEvaluate === 'desgravamen' 
        ? 'Desgravamen' 
        : calculation.insuranceToEvaluate === 'cesantia' 
        ? 'Cesantía' 
        : 'N/A'
      
      // Institución financiera
      const institucion = calculation.financialEntity || calculation.entityName || refund.institutionId || 'N/A'

      return {
        'ID Público': refund.publicId,
        'ID Interno': refund.id,
        'Estado': refund.status,
        'Nombre Completo': refund.fullName || 'N/A',
        'Email': refund.email || 'N/A',
        'RUT': rut,
        'Teléfono': refund.phone || 'N/A',
        'Institución Financiera': institucion,
        'Tipo de Seguro': tipoSeguro,
        'Monto Total Crédito': calculation.totalAmount || 0,
        'Cuotas Pagadas': calculation.installmentsPaid || 0,
        'Cuotas Restantes': calculation.remainingInstallments || 0,
        'Prima Antigua': calculation.oldMonthlyPremium || 0,
        'Prima Nueva': primaBruta,
        'Prima Neta (sin IVA)': primaNeta,
        'Ahorro Mensual': calculation.savingsPerMonth || 0,
        'Ahorro Total': calculation.totalSavings || 0,
        'Monto Estimado CLP': refund.estimatedAmountCLP || 0,
        'Fecha de Creación': formattedCreatedAt,
        'Última Actualización': refund.updatedAt ? new Date(refund.updatedAt).toLocaleDateString('es-CL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'N/A',
      }
    })

    const fileName = `solicitudes_export_${new Date().toISOString().split('T')[0]}_${new Date().getTime()}`
    exportXLSX(excelData, fileName)

    toast({
      title: 'Exportación exitosa',
      description: `Se exportaron ${refunds.length} solicitudes a Excel`,
    })

    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          className="gap-2"
          disabled={refunds.length === 0}
        >
          <Download className="h-4 w-4" />
          Exportar a Excel ({totalCount})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Exportar Solicitudes a Excel
          </DialogTitle>
          <DialogDescription>
            Se exportarán {refunds.length} solicitud(es) visibles con todos sus datos al formato Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <p className="font-medium">El archivo incluirá:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Datos de identificación (ID, RUT, nombre, email)</li>
              <li>Estado de la solicitud</li>
              <li>Información del crédito y seguro</li>
              <li>Cálculos de primas y ahorros</li>
              <li>Fechas de creación y actualización</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
