import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { FileSpreadsheet } from 'lucide-react'
import { RefundRequest } from '@/types/refund'
import { toast } from '@/hooks/use-toast'
import { exportXLSX } from '@/services/reportesService'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { authService } from '@/services/authService'

interface RefundExcelData {
  policyNumber: string
  creditCode: string
  sexo: string
  direccion: string
  comuna: string
}

interface GenerateExcelDialogProps {
  selectedRefunds: RefundRequest[]
  onClose?: () => void
}

export function GenerateExcelDialog({ selectedRefunds, onClose }: GenerateExcelDialogProps) {
  const [open, setOpen] = useState(false)
  const [refundData, setRefundData] = useState<Record<string, RefundExcelData>>({})
  const [loadingRut, setLoadingRut] = useState<string | null>(null)

  const updateRefundData = (refundId: string, field: keyof RefundExcelData, value: string) => {
    setRefundData(prev => ({
      ...prev,
      [refundId]: {
        ...prev[refundId],
        [field]: value
      }
    }))
  }

  const fetchRutInfo = async (refundId: string, rut: string) => {
    setLoadingRut(refundId)
    
    try {
      // Limpiar el RUT: remover puntos y guión para formato 15421741K
      const rutParts = rut.split('-')
      const rutNumber = rutParts[0].replace(/\./g, '')
      const rutDV = rutParts[1] || ''
      const cleanRut = `${rutNumber}${rutDV}` // Ej: 15421741K
      
      const token = authService.getAccessToken()
      
      const response = await fetch(`http://rut-data-extractor-production.up.railway.app/rut/${cleanRut}`, {
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
      
      // Mapear la respuesta del servicio
      const sexo = data.sex || data.sexo || ''
      const direccion = data.address || data.direccion || ''
      const comuna = data.commune || data.comuna || ''
      
      // Actualizar los datos
      setRefundData(prev => ({
        ...prev,
        [refundId]: {
          ...prev[refundId],
          sexo,
          direccion,
          comuna
        }
      }))
      
      toast({
        title: 'Información encontrada',
        description: 'Se han actualizado los datos del cliente',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo consultar la información del RUT',
        variant: 'destructive',
      })
    } finally {
      setLoadingRut(null)
    }
  }

  const handleGenerate = () => {
    // Validar que todas las solicitudes tengan sus datos completos
    const missingData = selectedRefunds.filter(refund => {
      const data = refundData[refund.id]
      return !data?.policyNumber?.trim() || !data?.creditCode?.trim() || !data?.sexo?.trim()
    })

    if (missingData.length > 0) {
      toast({
        title: 'Error',
        description: `Debes completar la información de ${missingData.length} solicitud(es)`,
        variant: 'destructive',
      })
      return
    }

    const excelData = selectedRefunds.map((refund) => {
      const data = refundData[refund.id]
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
        'Poliza N°': data.policyNumber,
        'Número del certificado (Folio)': refund.id,
        'Rut Cliente': rutNumber,
        'DV Cliente': rutDV,
        'Nombre_Cliente': refund.fullName,
        'Fecha_Nacimiento': 'N/A',
        'Sexo': data.sexo,
        'Codigo_producto': '342',
        'Prima Seguro  $': primaBruta,
        'Prima_periodo_neta_pesos': primaNeta,
        'Prima_periodo_bruta_pesos': primaBruta,
        'Vigencia_Desde': vigenciaDesde,
        'Vigencia_Hasta': vigenciaHasta,
        'Plazo Meses': calculation.remainingInstallments || 0,
        'Codigo_De_credito_o Nro de operación': data.creditCode,
        'Capital Asegurado': calculation.totalAmount || 0,
        'Corre electrónico': refund.email,
        'Dirección particular': data.direccion || 'N/A',
        'Comuna': data.comuna || 'N/A',
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
    setRefundData({})
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
          Archivo Altas CIA. ({selectedRefunds.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Generar Excel de Solicitudes</DialogTitle>
          <DialogDescription>
            Se generará un archivo Excel con {selectedRefunds.length} solicitud(es) seleccionada(s).
            Complete la información requerida para cada solicitud:
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <Accordion type="single" collapsible className="w-full">
            {selectedRefunds.map((refund, index) => {
              const data = refundData[refund.id] || { policyNumber: '', creditCode: '', sexo: '', direccion: '', comuna: '' }
              const isComplete = (data.policyNumber?.trim() || '') !== '' && 
                                (data.creditCode?.trim() || '') !== '' &&
                                (data.sexo?.trim() || '') !== ''
              
              return (
                <AccordionItem key={refund.id} value={refund.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <div className={`h-2 w-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <div>
                        <div className="font-medium">
                          Solicitud {index + 1}: {refund.fullName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {refund.publicId} • {refund.rut}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4 pl-5">
                      <div className="space-y-2">
                        <Label htmlFor={`policy-${refund.id}`}>Número de Póliza *</Label>
                        <Input
                          id={`policy-${refund.id}`}
                          value={data.policyNumber || ''}
                          onChange={(e) => updateRefundData(refund.id, 'policyNumber', e.target.value)}
                          placeholder="Ej: POL-123456"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`credit-${refund.id}`}>Código de Crédito / Nro de Operación *</Label>
                        <Input
                          id={`credit-${refund.id}`}
                          value={data.creditCode || ''}
                          onChange={(e) => updateRefundData(refund.id, 'creditCode', e.target.value)}
                          placeholder="Ej: CRED-789012"
                        />
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg space-y-4 border border-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <div className="h-1 w-1 rounded-full bg-primary" />
                            Datos Personales del Cliente
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fetchRutInfo(refund.id, refund.rut)}
                            disabled={loadingRut === refund.id}
                          >
                            {loadingRut === refund.id ? 'Buscando...' : 'Buscar Información'}
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor={`sexo-${refund.id}`}>Sexo *</Label>
                          <Input
                            id={`sexo-${refund.id}`}
                            value={data.sexo || ''}
                            onChange={(e) => updateRefundData(refund.id, 'sexo', e.target.value)}
                            placeholder="Ej: M, F"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`direccion-${refund.id}`}>Dirección</Label>
                          <Input
                            id={`direccion-${refund.id}`}
                            value={data.direccion || ''}
                            onChange={(e) => updateRefundData(refund.id, 'direccion', e.target.value)}
                            placeholder="Ej: Av. Providencia 123"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`comuna-${refund.id}`}>Comuna</Label>
                          <Input
                            id={`comuna-${refund.id}`}
                            value={data.comuna || ''}
                            onChange={(e) => updateRefundData(refund.id, 'comuna', e.target.value)}
                            placeholder="Ej: Providencia"
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </ScrollArea>

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
