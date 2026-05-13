import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { RefundRequest } from '@/types/refund'
import { toast } from '@/hooks/use-toast'
import { exportXLSX } from '@/services/reportesService'
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

const EMPTY_REFUND_DATA: RefundExcelData = {
  policyNumber: '',
  creditCode: '',
  sexo: '',
  direccion: '',
  comuna: '',
}

const DIALOG_PAGE_SIZE = 20

export function GenerateExcelDialog({ selectedRefunds, onClose }: GenerateExcelDialogProps) {
  const [open, setOpen] = useState(false)
  const [refundData, setRefundData] = useState<Record<string, RefundExcelData>>({})
  const [loadingRut, setLoadingRut] = useState<string | null>(null)
  const [dialogPage, setDialogPage] = useState(1)
  const [expandedRefundId, setExpandedRefundId] = useState<string | null>(null)

  const dialogTotalPages = Math.max(1, Math.ceil(selectedRefunds.length / DIALOG_PAGE_SIZE))

  const visibleRefunds = useMemo(() => {
    const start = (dialogPage - 1) * DIALOG_PAGE_SIZE
    return selectedRefunds.slice(start, start + DIALOG_PAGE_SIZE)
  }, [selectedRefunds, dialogPage])

  const updateRefundData = (refundId: string, field: keyof RefundExcelData, value: string) => {
    setRefundData(prev => ({
      ...prev,
      [refundId]: {
        ...(prev[refundId] || EMPTY_REFUND_DATA),
        [field]: value,
      },
    }))
  }

  const fetchRutInfo = async (refundId: string, rut: string) => {
    setLoadingRut(refundId)

    try {
      const rutParts = rut.split('-')
      const rutNumber = rutParts[0].replace(/\./g, '')
      const rutDV = rutParts[1] || ''
      const cleanRut = `${rutNumber}${rutDV}`

      const token = authService.getAccessToken()

      const response = await fetch(`https://rut-data-extractor-production.up.railway.app/rut/${cleanRut}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      })

      if (!response.ok) {
        throw new Error('Error al consultar el servicio')
      }

      const data = await response.json()
      const genero = data.data?.genero || ''
      const sexo = genero === 'MUJ' ? 'F' : genero === 'VAR' ? 'M' : genero
      const direccion = data.data?.direccion || ''
      const comuna = data.data?.comuna || ''

      setRefundData(prev => ({
        ...prev,
        [refundId]: {
          ...(prev[refundId] || EMPTY_REFUND_DATA),
          sexo,
          direccion,
          comuna,
        },
      }))

      toast({
        title: 'Información encontrada',
        description: 'Se han actualizado los datos del cliente',
      })
    } catch {
      toast({
        title: 'Datos no encontrados',
        description: 'No se pudo obtener la información del RUT consultado',
        variant: 'destructive',
      })
    } finally {
      setLoadingRut(null)
    }
  }

  const handleGenerate = () => {
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

      const { newMonthlyPremium: derivedNew } = (function () {
        // Importación dinámica evita ciclo y mantiene el cambio aislado.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { derivePremiumsFromSnapshot } = require('@/lib/snapshotPremiums')
        return derivePremiumsFromSnapshot(calculation, refund.institutionId)
      })()
      const primaBruta = derivedNew || calculation.newMonthlyPremium || 0
      const cuotaRestantes = calculation.remainingInstallments || 0
      const primaSeguro = primaBruta * cuotaRestantes

      const paymentScheduledEntry = refund.statusHistory?.find(
        entry => entry.to === 'payment_scheduled'
      )
      const vigenciaDesdeDate = paymentScheduledEntry
        ? new Date(paymentScheduledEntry.at)
        : new Date(refund.createdAt)
      const vigenciaDesdeDay = String(vigenciaDesdeDate.getDate()).padStart(2, '0')
      const vigenciaDesdeMonth = String(vigenciaDesdeDate.getMonth() + 1).padStart(2, '0')
      const vigenciaDesdeYear = vigenciaDesdeDate.getFullYear()
      const vigenciaDesde = `${vigenciaDesdeDay}-${vigenciaDesdeMonth}-${vigenciaDesdeYear}`

      const vigenciaHastaDate = new Date(vigenciaDesdeDate)
      vigenciaHastaDate.setMonth(vigenciaHastaDate.getMonth() + cuotaRestantes)
      const vigenciaHastaDay = String(vigenciaHastaDate.getDate()).padStart(2, '0')
      const vigenciaHastaMonth = String(vigenciaHastaDate.getMonth() + 1).padStart(2, '0')
      const vigenciaHastaYear = vigenciaHastaDate.getFullYear()
      const vigenciaHasta = `${vigenciaHastaDay}-${vigenciaHastaMonth}-${vigenciaHastaYear}`

      let fechaNacimiento = 'N/A'
      if (calculation.birthDate) {
        try {
          const birthDate = new Date(calculation.birthDate)
          if (!isNaN(birthDate.getTime())) {
            const day = String(birthDate.getDate()).padStart(2, '0')
            const month = String(birthDate.getMonth() + 1).padStart(2, '0')
            const year = birthDate.getFullYear()
            fechaNacimiento = `${day}-${month}-${year}`
          } else {
            fechaNacimiento = calculation.birthDate
          }
        } catch {
          fechaNacimiento = calculation.birthDate || 'N/A'
        }
      }

      const saldoInsoluto = calculation.averageInsuredBalance || calculation.remainingBalance || 0
      const codigoProducto = saldoInsoluto <= 20000000 ? '342' : '344'

      return {
        Sponsor: 'TDV Servicios SpA.',
        'Rut Empresa': '78168126-1',
        'Ramo comercial': 'Desgravamen',
        Producto: 'Fallecimiento',
        'Poliza N°': data.policyNumber,
        'Número del certificado (Folio)': refund.id,
        'Rut Cliente': rutNumber,
        'DV Cliente': rutDV,
        Nombre_Cliente: refund.fullName,
        Fecha_Nacimiento: fechaNacimiento,
        Sexo: data.sexo,
        Codigo_producto: codigoProducto,
        'Prima Seguro  $': primaSeguro,
        Prima_periodo_neta_pesos: primaSeguro,
        Prima_periodo_bruta_pesos: primaSeguro,
        Vigencia_Desde: vigenciaDesde,
        Vigencia_Hasta: vigenciaHasta,
        'Plazo Meses': cuotaRestantes,
        'Codigo_De_credito_o Nro de operación': data.creditCode,
        'Capital Asegurado': calculation.averageInsuredBalance || 0,
        'Corre electrónico': refund.email,
        'Dirección particular': data.direccion || 'N/A',
        Comuna: data.comuna || 'N/A',
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
    setExpandedRefundId(null)
    setDialogPage(1)
    onClose?.()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) {
          setExpandedRefundId(null)
          return
        }
        // Pre-fill from calculationSnapshot
        const initial: Record<string, RefundExcelData> = {}
        selectedRefunds.forEach(r => {
          const snap = r.calculationSnapshot || {}
          initial[r.id] = {
            ...EMPTY_REFUND_DATA,
            ...(refundData[r.id] || {}),
            policyNumber: refundData[r.id]?.policyNumber || snap.nroPoliza || '',
            creditCode: refundData[r.id]?.creditCode || snap.nroCredito || '',
          }
        })
        setRefundData(initial)
        setDialogPage(1)
        setExpandedRefundId(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="default" disabled={selectedRefunds.length === 0} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Archivo Altas CIA. ({selectedRefunds.length})
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Generar Excel de Solicitudes</DialogTitle>
          <DialogDescription>
            Se generará un archivo Excel con {selectedRefunds.length} solicitud(es) seleccionada(s). Complete la información
            requerida para cada solicitud:
          </DialogDescription>
        </DialogHeader>

        {dialogTotalPages > 1 && (
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-sm text-muted-foreground">
              Mostrando {(dialogPage - 1) * DIALOG_PAGE_SIZE + 1}-{Math.min(dialogPage * DIALOG_PAGE_SIZE, selectedRefunds.length)} de {selectedRefunds.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDialogPage((page) => Math.max(1, page - 1))
                  setExpandedRefundId(null)
                }}
                disabled={dialogPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-sm">
                {dialogPage}/{dialogTotalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDialogPage((page) => Math.min(dialogTotalPages, page + 1))
                  setExpandedRefundId(null)
                }}
                disabled={dialogPage === dialogTotalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto pr-2">
          {visibleRefunds.map((refund, index) => {
            const globalIndex = (dialogPage - 1) * DIALOG_PAGE_SIZE + index
            const data = refundData[refund.id] || EMPTY_REFUND_DATA
            const isComplete = Boolean(data.policyNumber?.trim() && data.creditCode?.trim() && data.sexo?.trim())
            const isExpanded = expandedRefundId === refund.id

            return (
              <div key={refund.id} className="border-b">
                <button
                  type="button"
                  onClick={() => setExpandedRefundId((current) => (current === refund.id ? null : refund.id))}
                  className="flex w-full items-center justify-between gap-4 rounded-sm py-4 text-left transition-colors hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-expanded={isExpanded}
                >
                  <div className="flex min-w-0 items-center gap-3 text-left">
                    <div className={`h-2 w-2 shrink-0 rounded-full ${isComplete ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <div className="min-w-0">
                      <div className="font-medium">
                        Solicitud {globalIndex + 1}: {refund.fullName}
                      </div>
                      <div className="break-all text-sm text-muted-foreground">
                        {refund.publicId} • {refund.rut}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="space-y-4 pb-4 pl-5">
                    <div className="space-y-2">
                      <Label htmlFor={`policy-${refund.id}`}>Número de Póliza *</Label>
                      <Input
                        id={`policy-${refund.id}`}
                        value={data.policyNumber}
                        onChange={(e) => updateRefundData(refund.id, 'policyNumber', e.target.value)}
                        placeholder="Ej: POL-123456"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`credit-${refund.id}`}>Código de Crédito / Nro de Operación *</Label>
                      <Input
                        id={`credit-${refund.id}`}
                        value={data.creditCode}
                        onChange={(e) => updateRefundData(refund.id, 'creditCode', e.target.value)}
                        placeholder="Ej: CRED-789012"
                      />
                    </div>

                    <div className="space-y-4 rounded-lg border border-border bg-muted/50 p-4">
                      <div className="flex items-center justify-between gap-3">
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
                          value={data.sexo}
                          onChange={(e) => updateRefundData(refund.id, 'sexo', e.target.value)}
                          placeholder="Ej: M, F"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`direccion-${refund.id}`}>Dirección</Label>
                        <Input
                          id={`direccion-${refund.id}`}
                          value={data.direccion}
                          onChange={(e) => updateRefundData(refund.id, 'direccion', e.target.value)}
                          placeholder="Ej: Av. Providencia 123"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`comuna-${refund.id}`}>Comuna</Label>
                        <Input
                          id={`comuna-${refund.id}`}
                          value={data.comuna}
                          onChange={(e) => updateRefundData(refund.id, 'comuna', e.target.value)}
                          placeholder="Ej: Providencia"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleGenerate}>
            Generar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
