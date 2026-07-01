import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Briefcase, Download, Search, ArrowLeft, Eye, Upload, Loader2, Hash, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { RefundRequest } from '@/types/refund'
import { authService } from '@/services/authService'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useQueryClient } from '@tanstack/react-query'
import { buildCesantiaPdf } from './pdfGenerators/cesantiaPdfGenerator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { refundAdminApi } from '@/services/refundAdminApi'

const API_BASE_URL = 'https://tedevuelvo-app-be.onrender.com/api/v1'

interface GenerateCesantiaCertificateDialogProps {
  refund: RefundRequest
  isMandateSigned?: boolean
}

interface CesantiaCertificateData {
  correlativo: string
  apellidoPaterno: string
  apellidoMaterno: string
  nombres: string
  fechaNacimiento: string
  estadoCivil: string
  direccion: string
  comuna: string
  region: string
  telefono: string
  email: string
  // Ejecutivo
  rutEjecutivo: string
  nombreEjecutivo: string
  oficina: string
  fonoEjecutivo: string
  // Seguro
  nroOperacion: string
  inicioVigencia: string
  terminoVigencia: string
  montoCredito: string
  montoCuota: string
  plazoMeses: string
  primaNeta: string
}

const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  try {
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, year, month, day] = match
      return `${day}/${month}/${year}`
    }
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateString || ''
  }
}

const getTodayFormatted = () => {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = today.getFullYear()
  return `${day}/${month}/${year}`
}

// Misma lógica que el certificado de desgravamen: usar la fecha de
// transición a "submitted" como inicio de vigencia y sumar las cuotas
// pendientes para obtener la fecha de término.
const getCoverageDatesFromSubmitted = (refund: RefundRequest): { fechaInicio: string; fechaFin: string } => {
  const history = refund.statusHistory || []
  const submittedEntry = [...history].reverse().find((h: any) => h.to === 'submitted')
  if (!submittedEntry?.at) return { fechaInicio: '', fechaFin: '' }

  const start = new Date(submittedEntry.at)
  if (isNaN(start.getTime())) return { fechaInicio: '', fechaFin: '' }

  const remaining =
    refund.calculationSnapshot?.confirmedRemainingInstallments ||
    refund.calculationSnapshot?.remainingInstallments ||
    0

  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = d.getFullYear()
    return `${dd}/${mm}/${yy}`
  }

  const fechaInicio = fmt(start)
  let fechaFin = ''
  if (typeof remaining === 'number' && remaining > 0) {
    const end = new Date(start)
    end.setMonth(end.getMonth() + remaining)
    fechaFin = fmt(end)
  }
  return { fechaInicio, fechaFin }
}

// Tasa única (0,094% para todos los tramos según nueva póliza 0020123902)
const TASA_CESANTIA_BRUTA = 0.094
const getTasaCesantia = (_montoCredito: number): number => TASA_CESANTIA_BRUTA

const getTramoLabel = (montoCredito: number): string => {
  if (montoCredito >= 500000 && montoCredito <= 1000000) return 'Tramo 1 ($500.000 - $1.000.000)'
  if (montoCredito > 1000000 && montoCredito <= 3000000) return 'Tramo 2 ($1.000.001 - $3.000.000)'
  if (montoCredito > 3000000 && montoCredito <= 5000000) return 'Tramo 3 ($3.000.001 - $5.000.000)'
  if (montoCredito > 5000000 && montoCredito <= 7000000) return 'Tramo 4 ($5.000.001 - $7.000.000)'
  if (montoCredito > 7000000) return 'Tramo 5 ($7.000.001 o más)'
  return 'Tramo 1 ($500.000 - $1.000.000)'
}

export function GenerateCesantiaCertificateDialog({ refund, isMandateSigned = false }: GenerateCesantiaCertificateDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'preview'>('form')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingRut, setIsLoadingRut] = useState(false)
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false)
  const [existingDocsCount, setExistingDocsCount] = useState(0)
  const [isAssigningFolio, setIsAssigningFolio] = useState(false)
  const [folioError, setFolioError] = useState<string | undefined>(undefined)
  const queryClient = useQueryClient()

  // Separar nombre completo en partes: Nombre(s) ApellidoPaterno ApellidoMaterno
  const nameParts = refund.fullName?.split(' ').filter(p => p.trim()) || []
  // Si hay 3+ partes: nombres = todo menos los 2 últimos, penúltimo = apellido paterno, último = apellido materno
  // Si hay 2 partes: primer = nombres, segundo = apellido paterno, sin apellido materno
  // Si hay 1 parte: solo nombres
  const defaultNombres = nameParts.length >= 3 
    ? nameParts.slice(0, nameParts.length - 2).join(' ') 
    : (nameParts[0] || '')
  const defaultApellidoPaterno = nameParts.length >= 3 
    ? nameParts[nameParts.length - 2] 
    : (nameParts.length === 2 ? nameParts[1] : '')
  const defaultApellidoMaterno = nameParts.length >= 3 ? nameParts[nameParts.length - 1] : ''

  const [formData, setFormData] = useState<CesantiaCertificateData>({
    correlativo: '',
    apellidoPaterno: defaultApellidoPaterno,
    apellidoMaterno: defaultApellidoMaterno,
    nombres: defaultNombres,
    fechaNacimiento: formatDate(refund.calculationSnapshot?.birthDate),
    estadoCivil: '',
    direccion: '',
    comuna: '',
    region: '',
    telefono: refund.phone || '',
    email: refund.email || '',
    rutEjecutivo: '',
    nombreEjecutivo: '',
    oficina: '',
    fonoEjecutivo: '',
    nroOperacion: '',
    inicioVigencia: getTodayFormatted(),
    terminoVigencia: '',
    montoCredito: (
      refund.calculationSnapshot?.confirmedAverageInsuredBalance ||
      refund.calculationSnapshot?.averageInsuredBalance ||
      0
    ).toString(),
    montoCuota: '',
    plazoMeses: (
      refund.calculationSnapshot?.confirmedRemainingInstallments ||
      refund.calculationSnapshot?.remainingInstallments ||
      0
    ).toString(),
    primaNeta: '',
  })

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setStep('form')
    }
  }

  const handlePreview = () => {
    if (!formData.correlativo) {
      toast({
        title: 'Folio requerido',
        description: 'Debe asignarse un folio antes de previsualizar el certificado',
        variant: 'destructive',
      })
      return
    }
    setStep('preview')
  }

  const assignFolio = useCallback(async (reassign = false) => {
    if (!refund.publicId) return
    setIsAssigningFolio(true)
    setFolioError(undefined)
    try {
      const result = await refundAdminApi.assignFolio(refund.publicId, reassign)
      if (result.ok && result.nroFolio) {
        setFormData(prev => ({ ...prev, correlativo: result.nroFolio }))
        if (result.alreadyAssigned) {
          toast({ title: 'Folio existente', description: `Folio ${result.nroFolio} ya estaba asignado` })
        } else {
          toast({ title: 'Folio asignado', description: `Folio ${result.nroFolio} asignado correctamente` })
        }
      }
    } catch (error: any) {
      console.error('Error asignando folio:', error)
      setFolioError(error.message || 'Error al asignar folio')
      toast({ title: 'Error al asignar folio', description: error.message, variant: 'destructive' })
    } finally {
      setIsAssigningFolio(false)
    }
  }, [refund.publicId])

  useEffect(() => {
    if (open && !formData.correlativo) {
      assignFolio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleBackToEdit = () => {
    setStep('form')
  }

  const handleChange = (field: keyof CesantiaCertificateData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const fetchRutInfo = async () => {
    setIsLoadingRut(true)
    
    try {
      const rut = refund.rut || ''
      const rutParts = rut.split('-')
      const rutNumber = rutParts[0].replace(/\./g, '')
      const rutDV = rutParts[1] || ''
      const cleanRut = `${rutNumber}${rutDV}`
      
      const token = authService.getAccessToken()
      
      const response = await fetch(`https://rut-data-extractor-production.up.railway.app/rut/${cleanRut}`, {
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
      
      const direccion = data.data?.direccion || ''
      const comuna = data.data?.comuna || ''
      
      setFormData(prev => ({
        ...prev,
        direccion,
        comuna,
      }))
      
      toast({
        title: 'Información encontrada',
        description: 'Se han actualizado los datos del cliente',
      })
    } catch (error) {
      toast({
        title: 'Datos no encontrados',
        description: 'No se pudo obtener la información. Puede ingresar los datos manualmente.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingRut(false)
    }
  }

  const calculatePrimaNeta = () => {
    // Override manual desde snapshot (casos de borde editados desde "Prima total override")
    const manualOverride = Number((refund.calculationSnapshot as any)?.newTotalPremium) || 0
    if (manualOverride > 0) return Math.round(manualOverride)
    const montoCredito = parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.')) || 0
    const plazoMeses = parseInt(formData.plazoMeses) || 0
    const tasa = getTasaCesantia(montoCredito)
    return Math.round(montoCredito * (tasa / 100) * plazoMeses)
  }

  const buildPDF = async (): Promise<{ blob: Blob; fileName: string }> => {
    // Override prima si el usuario editó el snapshot manualmente. Inyectamos
    // primaNeta calculada para que el helper la respete vía calculatePrimaNeta.
    return buildCesantiaPdf(refund, { ...formData, primaNeta: String(calculatePrimaNeta()) })
  }


  const generatePDF = async () => {
    setIsGenerating(true)
    try {
      const { blob, fileName } = await buildPDF()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({
        title: 'Certificado generado',
        description: 'El certificado de cesantía se ha descargado correctamente',
      })
      setOpen(false)
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast({
        title: 'Error',
        description: 'No se pudo generar el certificado',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const uploadToClient = async () => {
    setIsUploading(true)
    try {
      const publicId = (refund as any).cloned && (refund as any).siblingId
        ? (refund as any).siblingId
        : refund.publicId
      const existing = await refundAdminApi.listDocs(publicId, ['certificado-de-cobertura-cesantia'])
      const previousCertificates = (existing || []).filter(
        (d) => d.kind === 'certificado-de-cobertura-cesantia'
      )

      if (previousCertificates.length > 0) {
        setExistingDocsCount(previousCertificates.length)
        setConfirmReplaceOpen(true)
        setIsUploading(false)
        return
      }

      await performUpload(0)
    } catch (error) {
      console.error('Error preparing upload:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo preparar la subida',
        variant: 'destructive',
      })
      setIsUploading(false)
    }
  }

  const performUpload = async (replacedCount: number) => {
    setIsUploading(true)
    try {
      const publicId = (refund as any).cloned && (refund as any).siblingId
        ? (refund as any).siblingId
        : refund.publicId
      const targetId = publicId || (refund as any)._id || refund.id

      // Si hay que reemplazar, eliminar previos en paralelo
      if (replacedCount > 0) {
        const token = authService.getAccessToken()
        const previous = await refundAdminApi.listDocs(publicId, ['certificado-de-cobertura-cesantia'])
        const toDelete = (previous || []).filter((d) => d.kind === 'certificado-de-cobertura-cesantia')
        await Promise.all(
          toDelete.map((doc) =>
            fetch(`${API_BASE_URL}/refund-requests/admin/${doc.id}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }).catch((err) => {
              console.warn('No se pudo eliminar documento previo:', doc.id, err)
            })
          )
        )
      }

      const { blob, fileName } = await buildPDF()
      const token = authService.getAccessToken()
      const uploadFormData = new FormData()
      uploadFormData.append('file', blob, fileName)
      uploadFormData.append('kind', 'certificado-de-cobertura-cesantia')

      const response = await fetch(`${API_BASE_URL}/refund-requests/${targetId}/upload-file`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: uploadFormData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Error al subir el certificado')
      }

      queryClient.invalidateQueries({ queryKey: ['refund-documents', targetId] })
      queryClient.invalidateQueries({ queryKey: ['refund-documents', publicId] })
      queryClient.invalidateQueries({ queryKey: ['refund', targetId] })

      toast({
        title: replacedCount > 0 ? 'Certificado reemplazado' : 'Certificado subido',
        description:
          replacedCount > 0
            ? `Se eliminó ${replacedCount} certificado(s) previo(s) y se subió el nuevo a la carpeta del cliente.`
            : 'El documento está disponible en la carpeta del cliente como "Certificado de cobertura"',
      })
      setOpen(false)
    } catch (error) {
      console.error('Error uploading certificate:', error)
      toast({
        title: 'Error al subir',
        description: error instanceof Error ? error.message : 'No se pudo subir el certificado',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
      setConfirmReplaceOpen(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!isMandateSigned} className="gap-1.5">
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Cert.</span> Cesantía
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
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle className="flex items-center gap-2">
            {step === 'form' ? 'Certificado de Cesantía' : 'Previsualización del Certificado'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto pr-4">
          {step === 'form' ? (
            <div className="space-y-6 py-2">
              {/* Datos del Asegurado */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Antecedentes del Asegurado</h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={fetchRutInfo}
                    disabled={isLoadingRut}
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    {isLoadingRut ? 'Buscando...' : 'Buscar por RUT'}
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombres">Nombres</Label>
                    <Input
                      id="nombres"
                      value={formData.nombres}
                      onChange={(e) => handleChange('nombres', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellidoPaterno">Apellido Paterno</Label>
                    <Input
                      id="apellidoPaterno"
                      value={formData.apellidoPaterno}
                      onChange={(e) => handleChange('apellidoPaterno', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellidoMaterno">Apellido Materno</Label>
                    <Input
                      id="apellidoMaterno"
                      value={formData.apellidoMaterno}
                      onChange={(e) => handleChange('apellidoMaterno', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>RUT</Label>
                    <Input value={refund.rut || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fechaNacimiento">Fecha Nacimiento</Label>
                    <Input
                      id="fechaNacimiento"
                      value={formData.fechaNacimiento}
                      onChange={(e) => handleChange('fechaNacimiento', e.target.value)}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estadoCivil">Estado Civil</Label>
                    <Select 
                      value={formData.estadoCivil} 
                      onValueChange={(v) => handleChange('estadoCivil', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Soltero/a">Soltero/a</SelectItem>
                        <SelectItem value="Casado/a">Casado/a</SelectItem>
                        <SelectItem value="Divorciado/a">Divorciado/a</SelectItem>
                        <SelectItem value="Viudo/a">Viudo/a</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => handleChange('direccion', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="comuna">Comuna</Label>
                    <Input
                      id="comuna"
                      value={formData.comuna}
                      onChange={(e) => handleChange('comuna', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Región</Label>
                    <Input
                      id="region"
                      value={formData.region}
                      onChange={(e) => handleChange('region', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => handleChange('telefono', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                  />
                </div>
              </div>

              {/* Antecedentes del Seguro */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Antecedentes del Seguro</h3>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Folio <span className="text-destructive">*</span></Label>
                    {isAssigningFolio ? (
                      <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Asignando...</span>
                      </div>
                    ) : formData.correlativo ? (
                      <div className="flex items-center gap-1.5 h-10 px-3 border rounded-md bg-muted">
                        <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-sm font-medium flex-1">{formData.correlativo}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => {
                                  if (window.confirm(`¿Reasignar un nuevo folio?\n\nEl folio actual (${formData.correlativo}) será reemplazado por uno nuevo. Esta acción no se puede deshacer.`)) {
                                    setFormData(prev => ({ ...prev, correlativo: '' }))
                                    assignFolio(true)
                                  }
                                }}
                              >
                                <RefreshCw className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">Reasignar nuevo folio</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full h-10 gap-1.5 text-xs border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => assignFolio()}
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Reintentar asignar folio
                        </Button>
                        {folioError && (
                          <p className="text-[10px] text-destructive">{folioError}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nroOperacion">Nro Operación</Label>
                    <Input
                      id="nroOperacion"
                      value={formData.nroOperacion}
                      onChange={(e) => handleChange('nroOperacion', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inicioVigencia">Inicio Vigencia</Label>
                    <Input
                      id="inicioVigencia"
                      value={formData.inicioVigencia}
                      onChange={(e) => handleChange('inicioVigencia', e.target.value)}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="montoCredito">Monto Crédito</Label>
                    <Input
                      id="montoCredito"
                      value={formData.montoCredito}
                      onChange={(e) => handleChange('montoCredito', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="montoCuota">Monto Cuota</Label>
                    <Input
                      id="montoCuota"
                      value={formData.montoCuota}
                      onChange={(e) => handleChange('montoCuota', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plazoMeses">Plazo (meses)</Label>
                    <Input
                      id="plazoMeses"
                      value={formData.plazoMeses}
                      onChange={(e) => handleChange('plazoMeses', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="terminoVigencia">Término Vigencia</Label>
                    <Input
                      id="terminoVigencia"
                      value={formData.terminoVigencia}
                      onChange={(e) => handleChange('terminoVigencia', e.target.value)}
                      placeholder="DD/MM/AAAA"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Prima Neta Estimada:</span>
                  <span className="text-xl font-bold text-primary">
                    ${calculatePrimaNeta().toLocaleString('es-CL')} CLP
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fórmula: Monto crédito × Tasa ({getTasaCesantia(parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.')) || 0)}%) × Plazo
                </p>
              </div>
            </div>
          ) : (
            /* Preview Mode */
            <div className="space-y-4 py-2">
              <div className="border rounded-lg p-4 bg-white">
                <div className="text-center mb-4">
                  <p className="text-lg font-bold">PÓLIZA DE SEGURO DE DESEMPLEO INVOLUNTARIO</p>
                  <p className="text-sm">CERTIFICADO DE COBERTURA</p>
                </div>
                
                <div className="space-y-4 text-sm">
                  <p><strong>Nro Póliza:</strong> 0020121737 - {formData.correlativo || 'correlativo'}</p>
                  
                  <div className="border-t pt-2">
                    <p className="font-semibold mb-2">Antecedentes del Asegurado</p>
                    <div className="grid grid-cols-2 gap-2">
                      <p><strong>Nombre:</strong> {formData.nombres} {formData.apellidoPaterno} {formData.apellidoMaterno}</p>
                      <p><strong>RUT:</strong> {refund.rut}</p>
                      <p><strong>Fecha Nacimiento:</strong> {formData.fechaNacimiento}</p>
                      <p><strong>Estado Civil:</strong> {formData.estadoCivil}</p>
                      <p><strong>Dirección:</strong> {formData.direccion}</p>
                      <p><strong>Comuna:</strong> {formData.comuna}</p>
                      <p><strong>Email:</strong> {formData.email}</p>
                      <p><strong>Teléfono:</strong> {formData.telefono}</p>
                    </div>
                  </div>

                  <div className="border-t pt-2">
                    <p className="font-semibold mb-2">Antecedentes del Seguro</p>
                    <div className="grid grid-cols-2 gap-2">
                      <p><strong>Monto Crédito:</strong> ${parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.') || '0').toLocaleString('es-CL')}</p>
                      <p><strong>Plazo:</strong> {formData.plazoMeses} meses</p>
                      <p><strong>Inicio Vigencia:</strong> {formData.inicioVigencia}</p>
                      <p><strong>Prima Neta:</strong> ${calculatePrimaNeta().toLocaleString('es-CL')}</p>
                    </div>
                  </div>

                  <div className="border-t pt-2">
                    <p className="font-semibold mb-2">Cobertura</p>
                    <p><strong>Desempleo Involuntario:</strong> Hasta 3 cuotas mensuales con tope máximo de UF 15 por cuota.</p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Prima Neta del Seguro:</span>
                  <span className="text-xl font-bold text-primary">${calculatePrimaNeta().toLocaleString('es-CL')} CLP</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tasa aplicada: {getTasaCesantia(parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.')) || 0)}% ({getTramoLabel(parseFloat(formData.montoCredito.replace(/\./g, '').replace(',', '.')) || 0)})
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-3 border-t mt-2">
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handlePreview} className="gap-2">
                <Eye className="h-4 w-4" />
                Previsualizar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBackToEdit} className="gap-2" disabled={isGenerating || isUploading}>
                <ArrowLeft className="h-4 w-4" />
                Volver a Editar
              </Button>
              <Button
                variant="outline"
                onClick={uploadToClient}
                disabled={isGenerating || isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  'Subiendo...'
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Subir a carpeta del cliente
                  </>
                )}
              </Button>
              <Button onClick={generatePDF} disabled={isGenerating || isUploading} className="gap-2">
                {isGenerating ? (
                  'Generando...'
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Descargar PDF
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ya existe un certificado de cobertura</AlertDialogTitle>
          <AlertDialogDescription>
            En la carpeta del cliente {existingDocsCount > 1 ? `existen ${existingDocsCount} certificados de cobertura previos` : 'existe un certificado de cobertura previo'}.
            Si continúas, se eliminarán y se reemplazarán por el nuevo certificado generado.
            ¿Deseas continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUploading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isUploading}
            onClick={(e) => {
              e.preventDefault()
              performUpload(existingDocsCount)
            }}
          >
            {isUploading ? 'Reemplazando...' : 'Sí, reemplazar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
