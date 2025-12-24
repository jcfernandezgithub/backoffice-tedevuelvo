import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, Download } from 'lucide-react'
import { RefundRequest } from '@/types/refund'
import { toast } from '@/hooks/use-toast'
import { exportXLSX } from '@/services/reportesService'
import { RefundStatus } from '@/types/refund'

const statusLabels: Record<RefundStatus, string> = {
  simulated: 'Simulado',
  requested: 'Solicitado',
  qualifying: 'En calificación',
  docs_pending: 'Documentos pendientes',
  docs_received: 'Documentos recibidos',
  submitted: 'Ingresado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  payment_scheduled: 'Pago programado',
  paid: 'Pagado',
  canceled: 'Cancelado',
  datos_sin_simulacion: 'Datos (sin simulación)',
}

interface ExportToExcelDialogProps {
  refunds: RefundRequest[]
  totalCount: number
  partnerNameMap?: Record<string, string>
  gestorNameMap?: Record<string, string>
  mandateStatuses?: Record<string, any>
}

export function ExportToExcelDialog({ 
  refunds, 
  totalCount, 
  partnerNameMap = {}, 
  gestorNameMap = {},
  mandateStatuses = {}
}: ExportToExcelDialogProps) {
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
      
      // Mandato
      const mandateStatus = mandateStatuses[refund.publicId]
      const mandatoFirmado = mandateStatus?.hasSignedPdf === true ? 'Firmado' : 'Pendiente'
      
      // Origen y Gestor
      const origen = refund.partnerId ? (partnerNameMap[refund.partnerId] || 'Alianza') : 'Directo'
      const gestor = refund.partnerUserId ? (gestorNameMap[refund.partnerUserId] || 'N/A') : 'N/A'

      // Nuevos campos solicitados
      const primaMensualActual = calculation.currentMonthlyPremium || 0
      const montoEstimado = refund.estimatedAmountCLP || 0
      const nuevaPrimaMensual = calculation.newMonthlyPremium || 0
      const cuotasRestantes = calculation.remainingInstallments || 0
      const saldoInsoluto = nuevaPrimaMensual * cuotasRestantes
      const costoNuevoSeguroTDV = nuevaPrimaMensual * cuotasRestantes
      
      // Fecha de nacimiento - buscar en refund o en calculationSnapshot
      const birthDateValue = refund.birthdate || calculation.birthDate || calculation.birthdate || null
      const fechaNacimiento = birthDateValue 
        ? new Date(birthDateValue).toLocaleDateString('es-CL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          })
        : 'N/A'
      return {
        // === DATOS DEL CLIENTE ===
        'ID Público': refund.publicId,
        'ID Interno': refund.id,
        'Nombre Completo': refund.fullName || 'N/A',
        'RUT': rut,
        'Email': refund.email || 'N/A',
        'Teléfono': refund.phone || 'N/A',
        'Fecha de Nacimiento': fechaNacimiento,
        
        // === ESTADO Y GESTIÓN ===
        'Estado': statusLabels[refund.status as RefundStatus] || refund.status,
        'Mandato': mandatoFirmado,
        'Origen': origen,
        'Gestor': gestor,
        
        // === DATOS DEL CRÉDITO ===
        'Institución Financiera': institucion,
        'Tipo de Seguro': tipoSeguro,
        'Monto Total Crédito': calculation.totalAmount || 0,
        'Cuotas Pagadas': calculation.installmentsPaid || 0,
        'Cuotas Restantes': cuotasRestantes,
        
        // === CÁLCULOS DE PRIMAS Y SEGUROS ===
        'Prima Mensual Actual': primaMensualActual,
        'Prima Antigua': calculation.oldMonthlyPremium || 0,
        'Prima Nueva': primaBruta,
        'Prima Neta (sin IVA)': primaNeta,
        'Saldo Insoluto': saldoInsoluto,
        'Costo Nuevo Seguro TDV': costoNuevoSeguroTDV,
        
        // === AHORROS Y MONTOS ===
        'Ahorro Mensual': calculation.savingsPerMonth || 0,
        'Ahorro Total': calculation.totalSavings || 0,
        'Monto Estimado CLP': refund.estimatedAmountCLP || 0,
        
        // === FECHAS ===
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
              <li>Datos de identificación (ID, RUT, nombre, email, fecha de nacimiento)</li>
              <li>Estado de la solicitud y mandato</li>
              <li>Origen (Alianza o Directo) y Gestor</li>
              <li>Información del crédito y seguro</li>
              <li>Prima Mensual Actual, Monto Estimado, Saldo Insoluto</li>
              <li>Costo Nuevo Seguro TDV y cálculos de primas</li>
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
