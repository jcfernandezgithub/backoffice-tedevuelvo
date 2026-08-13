import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react'
import { RefundRequest } from '@/types/refund'
import { toast } from '@/hooks/use-toast'
import { exportXLSX } from '@/services/reportesService'
import { authService } from '@/services/authService'
import { derivePremiumsFromSnapshot } from '@/lib/snapshotPremiums'
import { computeCesantiaTdvDetail } from '@/lib/insuranceBreakdownUtils'
import { refundAdminApi } from '@/services/refundAdminApi'
import { getUfValue, formatUf } from '@/services/ufService'

interface RefundExcelData {
  policyNumber: string
  creditCode: string
  sexo: string
  direccion: string
  comuna: string
  region: string
  valorCuota: string
  tasaCredito: string
}

type InsuranceMode = 'desgravamen' | 'cesantia'

interface GenerateExcelDialogProps {
  selectedRefunds: RefundRequest[]
  mode?: InsuranceMode
  onClose?: () => void
}

const EMPTY_REFUND_DATA: RefundExcelData = {
  policyNumber: '',
  creditCode: '',
  sexo: '',
  direccion: '',
  comuna: '',
  region: '',
  valorCuota: '',
  tasaCredito: '',
}

const DIALOG_PAGE_SIZE = 20

// Constantes del formato de altas Cesantía (Southbridge)
const CESANTIA_POLIZA_MAESTRA = '20123902'
const CESANTIA_PRODUCTO_SBINS = 'Desempleo'
const CESANTIA_ESTADO = 'Vigente'
const IVA_FACTOR = 1.19
const COMISION_INTERMEDIACION = 0.1
const COMISION_RECAUDACION = 0.2

function getInsuranceType(snapshot: any): string {
  const raw = (snapshot?.insuranceToEvaluate || snapshot?.tipoSeguro || '').toString().toLowerCase()
  if (raw.includes('ambos') || raw.includes('both') || (raw.includes('desgrav') && raw.includes('cesant'))) {
    return 'ambos'
  }
  if (raw.includes('desgrav')) return 'desgravamen'
  if (raw.includes('cesant')) return 'cesantia'
  return 'unknown'
}

function matchesMode(snapshot: any, mode: InsuranceMode): boolean {
  const type = getInsuranceType(snapshot)
  return type === mode || type === 'ambos'
}

export function GenerateExcelDialog({ selectedRefunds, mode = 'desgravamen', onClose }: GenerateExcelDialogProps) {
  const [open, setOpen] = useState(false)
  const [refundData, setRefundData] = useState<Record<string, RefundExcelData>>({})
  const [loadingRut, setLoadingRut] = useState<string | null>(null)
  const [dialogPage, setDialogPage] = useState(1)
  const [expandedRefundId, setExpandedRefundId] = useState<string | null>(null)
  const [ufValue, setUfValue] = useState('')
  const [ufStatus, setUfStatus] = useState<'idle' | 'loading' | 'ok' | 'fallback' | 'error'>('idle')
  const [ufDate, setUfDate] = useState<string | null>(null)
  const [ufTouched, setUfTouched] = useState(false)

  const loadUf = useCallback(async () => {
    setUfStatus('loading')
    try {
      const result = await getUfValue(new Date())
      setUfValue(formatUf(result.value))
      setUfDate(result.date)
      setUfTouched(false)
      setUfStatus(result.isFallback ? 'fallback' : 'ok')
    } catch {
      setUfDate(null)
      setUfStatus('error')
    }
  }, [])

  useEffect(() => {
    if (open && mode === 'cesantia' && !ufTouched && ufStatus === 'idle') {
      void loadUf()
    }
  }, [open, mode, ufTouched, ufStatus, loadUf])

  const filteredRefunds = useMemo(() => {
    return selectedRefunds.filter(r => matchesMode(r.calculationSnapshot, mode))
  }, [selectedRefunds, mode])

  const dialogTotalPages = Math.max(1, Math.ceil(filteredRefunds.length / DIALOG_PAGE_SIZE))

  const visibleRefunds = useMemo(() => {
    const start = (dialogPage - 1) * DIALOG_PAGE_SIZE
    return filteredRefunds.slice(start, start + DIALOG_PAGE_SIZE)
  }, [filteredRefunds, dialogPage])

  const isDesgravamen = mode === 'desgravamen'
  const modeLabel = isDesgravamen ? 'Desgravamen' : 'Cesantía'
  const modeProducto = isDesgravamen ? 'Fallecimiento' : 'Desempleo'
  const modeRamo = isDesgravamen ? 'Desgravamen' : 'Cesantía'

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
      const region = data.data?.region || data.data?.regionNombre || ''

      setRefundData(prev => ({
        ...prev,
        [refundId]: {
          ...(prev[refundId] || EMPTY_REFUND_DATA),
          sexo,
          direccion,
          comuna,
          region: prev[refundId]?.region || region,
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

  const handleGenerate = async () => {
    const missingData = filteredRefunds.filter(refund => {
      const data = refundData[refund.id] || EMPTY_REFUND_DATA
      return !data?.policyNumber?.trim() || !data?.creditCode?.trim()
    })

    if (!isDesgravamen) {
      const uf = Number(String(ufValue).replace(/\./g, '').replace(',', '.'))
      if (!uf || uf <= 0) {
        toast({
          title: 'Falta el valor de la UF',
          description: 'Ingresa el valor de la UF del día del cierre para calcular la prima neta en UF',
          variant: 'destructive',
        })
        return
      }
    }

    if (isDesgravamen && missingData.length > 0) {
      toast({
        title: 'Error',
        description: `Debes completar la información de ${missingData.length} solicitud(es)`,
        variant: 'destructive',
      })
      return
    }

    const ufDelDia = Number(String(ufValue).replace(/\./g, '').replace(',', '.'))

    // Asignar/obtener nroFolio para cada solicitud en paralelo
    let folioByRefundId: Record<string, string> = {}
    try {
      const results = await Promise.all(
        filteredRefunds.map(async (r) => {
          try {
            const res = await refundAdminApi.assignFolio(r.publicId)
            return [r.id, res.nroFolio] as const
          } catch {
            return [r.id, ''] as const
          }
        })
      )
      folioByRefundId = Object.fromEntries(results)
    } catch {
      // continua con folios vacíos si algo falla
    }

    const missingFolio = filteredRefunds.filter((r) => !folioByRefundId[r.id])
    if (missingFolio.length > 0) {
      toast({
        title: 'Error al asignar folios',
        description: `No se pudo obtener el folio de ${missingFolio.length} solicitud(es)`,
        variant: 'destructive',
      })
      return
    }

    const excelData = filteredRefunds.map((refund) => {
      const data = refundData[refund.id] || EMPTY_REFUND_DATA
      const calculation = refund.calculationSnapshot || {}
      const rut = refund.rut || ''
      const rutParts = rut.split('-')
      const rutNumber = rutParts[0].replace(/\./g, '')
      const rutDV = rutParts[1] || ''

      const cuotaRestantes = calculation.remainingInstallments || 0

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

      if (!isDesgravamen) {
        const detail = computeCesantiaTdvDetail(calculation)
        const primaBruta = detail?.primaBruta || 0
        const primaNeta = primaBruta / IVA_FACTOR
        const primaNetaUF = ufDelDia > 0 ? primaNeta / ufDelDia : 0
        const round2 = (n: number) => Math.round(n * 100) / 100

        return {
          ID: refund.publicId,
          'Producto_SBINS*': CESANTIA_PRODUCTO_SBINS,
          'Fecha_Inicio_Vigencia*': vigenciaDesde,
          'Fecha_Termino_Vigencia*': vigenciaHasta,
          Estado: CESANTIA_ESTADO,
          'Poliza*': CESANTIA_POLIZA_MAESTRA,
          'Certificado*': folioByRefundId[refund.id] || '',
          'Nombre_Asegurado*': refund.fullName,
          'Rut_Asegurado*': rutNumber,
          'DV_Asegurado*': rutDV,
          'Fecha de nacimiento': fechaNacimiento,
          'Telefono_Asegurado*': refund.phone || '',
          'Mail_Asegurado*': refund.email || '',
          'Dirección_Asegurado*': data?.direccion || '',
          'Comuna_Asegurado*': data?.comuna || '',
          'Región_Asegurado*': data?.region || '',
          'SALDO INSOLUTO*': detail?.saldoInsoluto || saldoInsoluto,
          'PLAZO*': detail?.remainingInstallments || cuotaRestantes,
          'Valor Cuota*': data?.valorCuota ? Number(String(data.valorCuota).replace(/\./g, '').replace(',', '.')) : '',
          'Tasa* credito': data?.tasaCredito || '',
          'Prima bruta CLP*': primaBruta,
          'Prima neta CLP*': Math.round(primaNeta),
          'Prima Neta UF (Uf del día de venta)': round2(primaNetaUF),
          'Comisión neta Intermediacion (UF)': round2(primaNetaUF * COMISION_INTERMEDIACION),
          'Comisión neta recaudación (UF)': round2(primaNetaUF * COMISION_RECAUDACION),
          Tasa: detail ? `${(detail.tasaMensual * 100).toFixed(3)}%` : '',
        }
      }

      let primaSeguro = 0
      let codigoProducto = '342'
      let capitalAsegurado = saldoInsoluto

      const { newMonthlyPremium: derivedNew } = derivePremiumsFromSnapshot(
        calculation,
        refund.institutionId,
      )
      const primaBrutaMensual = derivedNew || calculation.newMonthlyPremium || 0
      primaSeguro = primaBrutaMensual * cuotaRestantes
      codigoProducto = saldoInsoluto <= 20000000 ? '342' : '344'

      return {
        Sponsor: 'TDV Servicios SpA.',
        'Rut Empresa': '78168126-1',
        'Ramo comercial': modeRamo,
        Producto: modeProducto,
        'Poliza N°': data.policyNumber,
        'Número del certificado (Folio)': folioByRefundId[refund.id] || '',
        'Rut Cliente': rutNumber,
        'DV Cliente': rutDV,
        Nombre_Cliente: refund.fullName,
        Fecha_Nacimiento: fechaNacimiento,
        Sexo: data?.sexo || '',
        Codigo_producto: codigoProducto,
        'Prima Seguro  $': primaSeguro,
        Prima_periodo_neta_pesos: primaSeguro,
        Prima_periodo_bruta_pesos: primaSeguro,
        Vigencia_Desde: vigenciaDesde,
        Vigencia_Hasta: vigenciaHasta,
        'Plazo Meses': cuotaRestantes,
        'Codigo_De_credito_o Nro de operación': data.creditCode,
        'Capital Asegurado': capitalAsegurado,
        'Corre electrónico': refund.email,
        'Dirección particular': data?.direccion || 'N/A',
        Comuna: data?.comuna || 'N/A',
        'Región': 'N/A',
      }
    })

    const fileName = `solicitudes_${mode}_${new Date().toISOString().split('T')[0]}`
    exportXLSX(excelData, fileName)

    toast({
      title: 'Excel generado',
      description: `Se generó el archivo de ${modeLabel} con ${filteredRefunds.length} solicitud(es)`,
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
        filteredRefunds.forEach(r => {
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
        <Button variant="default" disabled={filteredRefunds.length === 0} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Archivo Altas CIA {modeLabel} ({filteredRefunds.length})
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Generar Excel de Altas CIA - {modeLabel}</DialogTitle>
          <DialogDescription>
            Se generará un archivo Excel con {filteredRefunds.length} solicitud(es) seleccionada(s) del tipo {modeLabel}. Complete la información
            requerida para cada solicitud:
          </DialogDescription>
        </DialogHeader>

        {!isDesgravamen && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full space-y-1 sm:max-w-xs">
              <Label htmlFor="uf-cierre">Valor UF del día del cierre *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="uf-cierre"
                  value={ufValue}
                  onChange={(e) => {
                    setUfTouched(true)
                    setUfValue(e.target.value)
                  }}
                  placeholder={ufStatus === 'loading' ? 'Obteniendo UF…' : 'Ej: 40.150,25'}
                  inputMode="decimal"
                  disabled={ufStatus === 'loading'}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void loadUf()}
                  disabled={ufStatus === 'loading'}
                  title="Volver a obtener la UF de hoy"
                >
                  {ufStatus === 'loading'
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
              {ufStatus === 'ok' && !ufTouched && (
                <p className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> UF de hoy obtenida automáticamente
                </p>
              )}
              {ufStatus === 'fallback' && !ufTouched && ufDate && (
                <p className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> Hoy aún no está publicada; se usa la UF del {ufDate}
                </p>
              )}
              {ufStatus === 'error' && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> No se pudo obtener la UF. Ingrésala manualmente.
                </p>
              )}
              {ufTouched && (
                <p className="text-xs text-muted-foreground">Valor ingresado manualmente</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground sm:max-w-xs">
              Se usa para convertir la prima neta a UF y calcular las comisiones de intermediación (10%) y recaudación (20%).
            </p>
          </div>
        )}

        {dialogTotalPages > 1 && (
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-sm text-muted-foreground">
              Mostrando {(dialogPage - 1) * DIALOG_PAGE_SIZE + 1}-{Math.min(dialogPage * DIALOG_PAGE_SIZE, filteredRefunds.length)} de {filteredRefunds.length}
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
            const isAmbos = getInsuranceType(refund.calculationSnapshot) === 'ambos'

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
                        {isAmbos && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                            AMBOS
                          </span>
                        )}
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
                        <Label htmlFor={`sexo-${refund.id}`}>Sexo</Label>
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

                      {!isDesgravamen && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor={`region-${refund.id}`}>Región</Label>
                            <Input
                              id={`region-${refund.id}`}
                              value={data.region}
                              onChange={(e) => updateRefundData(refund.id, 'region', e.target.value)}
                              placeholder="Ej: Metropolitana"
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`cuota-${refund.id}`}>Valor cuota del crédito</Label>
                              <Input
                                id={`cuota-${refund.id}`}
                                value={data.valorCuota}
                                onChange={(e) => updateRefundData(refund.id, 'valorCuota', e.target.value)}
                                placeholder="Ej: 235.253"
                                inputMode="decimal"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`tasa-${refund.id}`}>Tasa del crédito</Label>
                              <Input
                                id={`tasa-${refund.id}`}
                                value={data.tasaCredito}
                                onChange={(e) => updateRefundData(refund.id, 'tasaCredito', e.target.value)}
                                placeholder="Ej: 1,25%"
                              />
                            </div>
                          </div>
                        </>
                      )}
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
