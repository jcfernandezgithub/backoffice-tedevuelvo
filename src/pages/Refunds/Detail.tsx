import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { refundAdminApi } from '@/services/refundAdminApi'
import { alianzasService } from '@/services/alianzasService'
import { allianceUsersClient } from '@/pages/Alianzas/services/allianceUsersClient'
import { getInstitutionDisplayName } from '@/lib/institutionHomologation'
import { RefundStatus, AdminUpdateStatusDto } from '@/types/refund'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentsSection } from './components/DocumentsSection'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowLeft, Download, Edit, FileText, Copy, Check, AlertCircle, CheckCircle, Landmark, CreditCard, Shield, Briefcase, Calculator, TrendingDown, Mail } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/state/AuthContext'
import { authService } from '@/services/authService'
import { EditClientDialog } from './components/EditClientDialog'
import { EditBankInfoDialog } from './components/EditBankInfoDialog'
import { EditSnapshotDialog } from './components/EditSnapshotDialog'
import { GenerateCorteDialog } from './components/GenerateCorteDialog'
import { GenerateCertificateDialog } from './components/GenerateCertificateDialog'
import { GenerateCesantiaCertificateDialog } from './components/GenerateCesantiaCertificateDialog'
import { Money } from '@/components/common/Money'
import { InsuranceBreakdown } from './components/InsuranceBreakdown'
import tasasSeguro from '@/data/tasas_formateadas_te_devuelvo.json'

const MAPEO_INSTITUCIONES_DETAIL: Record<string, string> = {
  santander: 'BANCO SANTANDER', bci: 'BANCO BCI', 'lider-bci': 'LIDER-BCI',
  scotiabank: 'SCOTIABANK', chile: 'BANCO CHILE', security: 'BANCO SECURITY',
  'itau-corpbanca': 'BANCO ITAU-CORPBANCA', bice: 'BANCO BICE', estado: 'BANCO ESTADO',
  ripley: 'BANCO RIPLEY', falabella: 'BANCO FALABELLA', consorcio: 'BANCO CONSORCIO',
  coopeuch: 'COOPEUCH', cencosud: 'BANCO CENCOSUD', forum: 'FORUM', tanner: 'TANNER',
  cooperativas: 'COOPERATIVAS',
}

const UMBRAL_MONTO_ALTO_DETAIL = 20000000
const TASA_PREF_HASTA_55 = 0.0003
const TASA_PREF_DESDE_56 = 0.00039
const TASA_PREF_HASTA_55_ALTO = 0.000344
const TASA_PREF_DESDE_56_ALTO = 0.000343

function getRatesForSnapshot(snapshot: any): { tasaBanco: number | null; tasaTDV: number | null } {
  if (!snapshot) return { tasaBanco: null, tasaTDV: null }
  const institutionId = (snapshot.institutionId || '').toLowerCase()
  const bancoKey = MAPEO_INSTITUCIONES_DETAIL[institutionId] || institutionId.toUpperCase()
  const edad = snapshot.age || 0
  const monto = snapshot.totalAmount || 0
  const saldo = snapshot.confirmedAverageInsuredBalance || snapshot.averageInsuredBalance || monto
  const cuotas = snapshot.originalInstallments || 0
  const tramo = edad <= 55 ? 'hasta_55' : 'desde_56'

  let tasaBanco: number | null = null
  try {
    const datosBanco = (tasasSeguro as any)[bancoKey]
    if (datosBanco) {
      const datosTramo = datosBanco[tramo]
      const montoRedondeado = Math.min(Math.max(Math.round(monto / 1000000) * 1000000, 2000000), 60000000)
      const datosMonto = datosTramo?.[montoRedondeado.toString()]
      if (datosMonto) {
        tasaBanco = datosMonto[cuotas.toString()] ?? null
        if (tasaBanco === null) {
          const disponibles = Object.keys(datosMonto).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b)
          const cercana = disponibles.reduce((prev, curr) => Math.abs(curr - cuotas) < Math.abs(prev - cuotas) ? curr : prev, disponibles[0])
          if (cercana) tasaBanco = datosMonto[cercana.toString()] ?? null
        }
      }
    }
  } catch { /* ignore */ }

  const tasaTDV = saldo > UMBRAL_MONTO_ALTO_DETAIL
    ? (edad <= 55 ? TASA_PREF_HASTA_55_ALTO : TASA_PREF_DESDE_56_ALTO)
    : (edad <= 55 ? TASA_PREF_HASTA_55 : TASA_PREF_DESDE_56)

  return { tasaBanco, tasaTDV }
}

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

const statusVariants: Record<RefundStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  simulated: 'secondary',
  requested: 'secondary',
  qualifying: 'secondary',
  docs_pending: 'outline',
  docs_received: 'outline',
  submitted: 'default',
  approved: 'default',
  rejected: 'destructive',
  payment_scheduled: 'default',
  paid: 'default',
  canceled: 'destructive',
  datos_sin_simulacion: 'outline',
}

interface RefundDetailProps {
  backUrl?: string
  showDocumentButtons?: boolean
  contextLabel?: string
}

// Helper para obtener el tipo de seguro normalizado desde calculationSnapshot
const getInsuranceType = (snapshot: any): 'desgravamen' | 'cesantia' | 'ambos' | null => {
  if (!snapshot) return null
  
  // Primero buscar tipoSeguro (formato antiguo/local)
  if (snapshot.tipoSeguro) {
    const tipo = snapshot.tipoSeguro.toLowerCase()
    if (tipo === 'desgravamen' || tipo === 'cesantia' || tipo === 'ambos') {
      return tipo
    }
  }
  
  // Luego buscar insuranceToEvaluate (formato API)
  if (snapshot.insuranceToEvaluate) {
    const tipo = snapshot.insuranceToEvaluate.toLowerCase()
    if (tipo === 'desgravamen') return 'desgravamen'
    if (tipo === 'cesantia') return 'cesantia'
    if (tipo === 'ambos') return 'ambos'
  }
  
  return null
}

export default function RefundDetail({ backUrl: propBackUrl = '/refunds', showDocumentButtons = true, contextLabel }: RefundDetailProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [snapshotView, setSnapshotView] = useState<'parsed' | 'raw'>('parsed')

  // Usar backUrl del state de navegación si existe, sino usar prop
  const backUrl = (location.state as any)?.backUrl || propBackUrl

  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [snapshotFields, setSnapshotFields] = useState({ nroPoliza: '', nroCredito: '' })
  const [updateForm, setUpdateForm] = useState<AdminUpdateStatusDto>({
    status: 'simulated',
    note: '',
    by: user?.email || '',
    force: false,
    realAmount: undefined,
  })

  const handleCopyId = () => {
    if (refund?.publicId) {
      navigator.clipboard.writeText(refund.publicId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        title: 'ID copiado',
        description: 'El ID público se copió al portapapeles',
      })
    }
  }

  const { data: refund, isLoading } = useQuery({
    queryKey: ['refund', id],
    queryFn: () => refundAdminApi.getById(id!),
    enabled: !!id,
  })

  const { data: documents } = useQuery({
    // Misma query key que DocumentsSection para mantener la validación sincronizada tras uploads/deletes
    queryKey: ['refund-documents', refund?.publicId],
    queryFn: () => refundAdminApi.listDocs(refund!.publicId),
    enabled: !!refund?.publicId,
  })

  const fetchExperianStatus = async (publicId: string) => {
    const token = authService.getAccessToken()
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    const response = await fetch(
      `https://tedevuelvo-app-be.onrender.com/api/v1/refund-requests/${publicId}/experian/status`,
      { headers }
    )

    if (!response.ok) throw new Error('Error al obtener estado de mandato')
    return response.json()
  }

  const { data: experianStatus } = useQuery({
    queryKey: ['experian-status', refund?.publicId],
    queryFn: () => fetchExperianStatus(refund!.publicId),
    enabled: !!refund?.publicId,
  })

  // Fetch partner name for origin display
  const { data: partnerName } = useQuery({
    queryKey: ['partner-name', refund?.partnerId],
    queryFn: async () => {
      const result = await alianzasService.list()
      const partners = Array.isArray(result) ? result : (result as any).items || []
      const partner = partners.find((p: any) => p.id === refund!.partnerId)
      return partner?.nombre || null
    },
    enabled: !!refund?.partnerId,
    staleTime: 30 * 60 * 1000,
  })

  // Fetch gestor name
  const { data: gestorName } = useQuery({
    queryKey: ['gestor-name', refund?.partnerId, refund?.partnerUserId],
    queryFn: async () => {
      const result = await allianceUsersClient.listAllianceUsers(refund!.partnerId!, { pageSize: 100 })
      const users = (result as any).users || (result as any).items || []
      const user = users.find((u: any) => u.id === refund!.partnerUserId)
      return user?.name || null
    },
    enabled: !!refund?.partnerId && !!refund?.partnerUserId,
    staleTime: 30 * 60 * 1000,
  })

  const updateMutation = useMutation({
    mutationFn: (dto: AdminUpdateStatusDto) => refundAdminApi.updateStatus(id!, dto),
    onSuccess: () => {
      toast({ title: 'Estado actualizado', description: 'El refund se actualizó correctamente' })
      queryClient.invalidateQueries({ queryKey: ['refund', id] })
      queryClient.invalidateQueries({ queryKey: ['refunds'] })
      setUpdateDialogOpen(false)
    },
    onError: (error: Error) => {
      if (error.message.includes('Transición inválida') || error.message.includes('transición')) {
        toast({
          title: 'Transición no permitida',
          description: 'Puedes activar "Forzar cambio" para continuar de todas formas',
          variant: 'destructive',
        })
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    },
  })

  const sendBankEmailMutation = useMutation({
    mutationFn: () => {
      // Usar realAmount directamente del refund (campo top-level)
      const montoReal = (refund as any)?.realAmount || 0
      
      const payload = {
        nombre_cliente: (refund as any)?.fullName || '',
        email: (refund as any)?.email || '',
        idSolicitud: (refund as any)?.publicId || id || '',
        monto_aprobado: montoReal,
        estado: (refund as any)?.status || '',
        linkAccion: 'https://www.tedevuelvo.cl/login',
      }
      return refundAdminApi.resendScheduledPaymentEmail(id!, payload)
    },
    onSuccess: () => {
      toast({ title: 'Correo enviado', description: 'Se envió la solicitud de datos bancarios al cliente' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  const [bankEmailDialogOpen, setBankEmailDialogOpen] = useState(false)

  const handleConfirmSendBankEmail = () => {
    setBankEmailDialogOpen(false)
    sendBankEmailMutation.mutate()
  }

  const handleUpdateStatus = async () => {
    // Validar documentos obligatorios para estados "Ingresado" o "Documentos recibidos"
    // (el backend auto-promueve docs_received → submitted)
    if (updateForm.status === 'submitted' || updateForm.status === 'docs_received') {
      const requiredKinds = [
        { kind: 'cedula-frente', label: 'Cédula frontal' },
        { kind: 'cedula-trasera', label: 'Cédula trasera' },
        { kind: 'signed-mandate', label: 'Mandato firmado' },
        { kind: 'carta-de-corte', label: 'Carta de corte' },
      ]
      const uploadedKinds = (documents || []).map((d: any) => d.kind)
      const missing = requiredKinds.filter(r => !uploadedKinds.includes(r.kind))
      if (missing.length > 0) {
        toast({
          title: 'Documentos faltantes',
          description: `No se puede continuar. Faltan: ${missing.map(m => m.label).join(', ')}`,
          variant: 'destructive',
        })
        return
      }
    }

    // Validar monto real obligatorio para pago programado
    if (updateForm.status === 'payment_scheduled' && (!updateForm.realAmount || updateForm.realAmount <= 0)) {
      toast({
        title: 'Monto requerido',
        description: 'Debes ingresar el monto real de devolución para programar el pago',
        variant: 'destructive',
      })
      return
    }

    // Validar datos de crédito obligatorios para docs_received
    if (updateForm.status === 'docs_received') {
      if (!snapshotFields.nroPoliza?.trim() || !snapshotFields.nroCredito?.trim()) {
        toast({
          title: 'Datos de crédito requeridos',
          description: 'Estos datos deben cargarse previamente desde la generación de la Carta de Corte',
          variant: 'destructive',
        })
        return
      }
    }

    updateMutation.mutate(updateForm)
  }

  const handleViewMandate = async () => {
    if (!refund?.publicId) return
    
    try {
      const data = await fetchExperianStatus(refund.publicId)
      
      if (data.signedPdfUrl) {
        const decodedUrl = decodeURIComponent(data.signedPdfUrl)
        window.open(decodedUrl, '_blank')
      } else {
        toast({
          title: 'Mandato no disponible',
          description: 'El mandato firmado aún no está disponible',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo obtener el mandato firmado',
        variant: 'destructive',
      })
    }
  }

  const formatBirthDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    try {
      // Extract date parts directly from ISO string to avoid timezone shift
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
      return 'N/A'
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!refund) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Refund no encontrado</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(backUrl)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        {contextLabel && (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            {contextLabel}
          </Badge>
        )}
      </div>

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{refund.fullName}</h1>
          <div className="flex items-center gap-2">
            <code className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
              {refund.publicId}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyId}
              className="h-7 px-2"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-600" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Badge variant={statusVariants[refund.status]} className="text-base px-3 py-1">
            {statusLabels[refund.status]}
          </Badge>
          {/* Badge de tipo de seguro */}
          {(() => {
            const insuranceType = getInsuranceType(refund.calculationSnapshot)
            if (!insuranceType) return null
            return (
              <Badge 
                variant="outline" 
                className={`text-sm px-3 py-1 ${
                  insuranceType === 'ambos' 
                    ? 'bg-purple-100 text-purple-700 border-purple-300' 
                    : insuranceType === 'desgravamen'
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-amber-100 text-amber-700 border-amber-300'
                }`}
              >
                {insuranceType === 'desgravamen' && (
                  <>
                    <Shield className="h-3 w-3 mr-1" />
                    Desgravamen
                  </>
                )}
                {insuranceType === 'cesantia' && (
                  <>
                    <Briefcase className="h-3 w-3 mr-1" />
                    Cesantía
                  </>
                )}
                {insuranceType === 'ambos' && (
                  <>
                    <Shield className="h-3 w-3 mr-1" />
                    Desgravamen + Cesantía
                  </>
                )}
              </Badge>
            )
          })()}
          {experianStatus && (
            <Badge 
              variant={experianStatus.hasSignedPdf ? "default" : "destructive"}
              className="text-sm px-3 py-1"
            >
              {experianStatus.hasSignedPdf ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Mandato firmado
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Mandato pendiente
                </>
              )}
            </Badge>
          )}
          <Button variant="outline" onClick={handleViewMandate}>
            <FileText className="h-4 w-4 mr-2" />
            Ver Mandato
          </Button>
          
          {/* Certificados de cobertura: visible para admin o call center */}
          {(showDocumentButtons || user?.email === 'admin@callcenter.cl') && (
            (() => {
              const insuranceType = getInsuranceType(refund.calculationSnapshot)
              const showDesgravamen = insuranceType === 'desgravamen' || insuranceType === 'ambos'
              const showCesantia = insuranceType === 'cesantia' || insuranceType === 'ambos'
              
              // Validate confirmed fields exist and are non-zero
              const snap = refund.calculationSnapshot
              const hasConfirmedData = !!(
                snap?.confirmedTotalAmount && snap.confirmedTotalAmount > 0 &&
                snap?.confirmedAverageInsuredBalance && snap.confirmedAverageInsuredBalance > 0 &&
                snap?.confirmedOriginalInstallments && snap.confirmedOriginalInstallments > 0 &&
                snap?.confirmedRemainingInstallments && snap.confirmedRemainingInstallments > 0
              )
              
              const missingFieldsTooltip = 'Los datos confirmados del crédito deben estar completos. Edite el snapshot de cálculo para confirmar: Monto, Saldo Insoluto, Cuotas Originales y Cuotas Restantes.'
              
              return (
                <>
                  {/* Certificado Desgravamen */}
                  {!showDesgravamen || !hasConfirmedData ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled
                            className="gap-1.5"
                          >
                            <Shield className="h-4 w-4" />
                            <span className="hidden sm:inline">Cert.</span> Desgravamen
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {!insuranceType ? 'Tipo de seguro no disponible' 
                          : !showDesgravamen ? 'No aplica - Solicitud de tipo cesantía' 
                          : missingFieldsTooltip}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <GenerateCertificateDialog 
                      refund={refund} 
                      isMandateSigned={experianStatus?.hasSignedPdf}
                      certificateType="desgravamen"
                    />
                  )}
                  
                  {/* Certificado Cesantía */}
                  {!showCesantia || !hasConfirmedData ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled
                            className="gap-1.5"
                          >
                            <Briefcase className="h-4 w-4" />
                            <span className="hidden sm:inline">Cert.</span> Cesantía
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {!insuranceType ? 'Tipo de seguro no disponible' 
                          : !showCesantia ? 'No aplica - Solicitud de tipo desgravamen'
                          : missingFieldsTooltip}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <GenerateCesantiaCertificateDialog 
                      refund={refund} 
                      isMandateSigned={experianStatus?.hasSignedPdf}
                    />
                  )}
                </>
              )
            })()
          )}
          {/* Corte: visible para admin o call center */}
          {(showDocumentButtons || user?.email === 'admin@callcenter.cl') && (
            <GenerateCorteDialog refund={refund} isMandateSigned={experianStatus?.hasSignedPdf} />
          )}
          {/* Reenviar email datos bancarios - solo en payment_scheduled */}
          {refund.status === 'payment_scheduled' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    disabled={sendBankEmailMutation.isPending}
                    onClick={handleSendBankDataEmail}
                  >
                    <Mail className="h-4 w-4" />
                    {sendBankEmailMutation.isPending ? 'Enviando...' : 'Solicitar datos bancarios'}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">Envía un correo al cliente para que ingrese sus datos de transferencia</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Dialog open={updateDialogOpen} onOpenChange={(open) => {
              setUpdateDialogOpen(open)
              if (open && refund) {
                const snap = refund.calculationSnapshot || {}
                setSnapshotFields({
                  nroPoliza: snap.nroPoliza || '',
                  nroCredito: snap.nroCredito || '',
                })
              }
            }}>
            <DialogTrigger asChild>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Cambiar estado
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Actualizar estado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nuevo estado</Label>
                  <Select
                    value={updateForm.status}
                    onValueChange={(v) => setUpdateForm({ ...updateForm, status: v as RefundStatus, realAmount: undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels)
                        .filter(([value]) => {
                          if (user?.email === 'admin@callcenter.cl') {
                            return ['canceled', 'docs_pending', 'docs_received'].includes(value)
                          }
                          return true
                        })
                        .map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {updateForm.status === 'docs_received' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 dark:bg-amber-950/30 dark:border-amber-700 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                          Antes de continuar, verifica que:
                        </p>
                      </div>
                      <ul className="ml-6 space-y-1 text-sm text-amber-700 dark:text-amber-400 list-disc">
                        <li>El <strong>mandato</strong> esté firmado</li>
                        <li>La imagen de <strong>cédula frontal</strong> esté cargada</li>
                        <li>La imagen de <strong>cédula trasera</strong> esté cargada</li>
                        <li>La <strong>carta de rechazo</strong> esté cargada</li>
                        <li>Todos los documentos tengan su <strong>tipo correspondiente</strong> asignado</li>
                      </ul>
                    </div>

                    {snapshotFields.nroPoliza?.trim() && snapshotFields.nroCredito?.trim() ? (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                            Datos del crédito verificados
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Nº de Póliza</Label>
                            <p className="text-sm font-medium font-mono bg-background/50 rounded px-2 py-1.5 border">{snapshotFields.nroPoliza}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Nº de Crédito</Label>
                            <p className="text-sm font-medium font-mono bg-background/50 rounded px-2 py-1.5 border">{snapshotFields.nroCredito}</p>
                          </div>
                        </div>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 ml-6">
                          Cargados desde la generación de la Carta de Corte.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/30 space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                          <p className="text-sm font-semibold text-destructive">
                            Datos del crédito pendientes
                          </p>
                        </div>
                        <p className="text-xs text-destructive/80 ml-6">
                          El Nº de Póliza y Nº de Crédito deben ser cargados previamente desde la <strong>generación de la Carta de Corte</strong>. No es posible cambiar al estado "Documentos recibidos" sin estos datos.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {updateForm.status === 'payment_scheduled' && (
                  <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Label className="text-primary font-medium">
                      Monto real de devolución <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        value={updateForm.realAmount || ''}
                        onChange={(e) => setUpdateForm({ ...updateForm, realAmount: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="Ingresa el monto confirmado"
                        className="pl-7"
                        min={1}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Monto estimado: <span className="font-medium">${refund.estimatedAmountCLP?.toLocaleString('es-CL') || 'N/A'}</span> CLP
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Nota (opcional)</Label>
                  <Textarea
                    value={updateForm.note || ''}
                    onChange={(e) => setUpdateForm({ ...updateForm, note: e.target.value })}
                    placeholder="Agregar comentario sobre el cambio..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Usuario</Label>
                  <Input
                    value={updateForm.by || ''}
                    onChange={(e) => setUpdateForm({ ...updateForm, by: e.target.value })}
                    placeholder="admin@tedevuelvo.cl"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="force"
                    checked={updateForm.force}
                    onCheckedChange={(checked) => setUpdateForm({ ...updateForm, force: checked })}
                  />
                  <Label htmlFor="force" className="text-sm">
                    Forzar cambio (omitir validaciones de transición)
                  </Label>
                </div>

                <Button
                  onClick={handleUpdateStatus}
                  className="w-full"
                  disabled={
                    updateMutation.isPending ||
                    (updateForm.status === 'docs_received' && (!snapshotFields.nroPoliza?.trim() || !snapshotFields.nroCredito?.trim()))
                  }
                >
                  {updateMutation.isPending ? 'Actualizando...' : 'Actualizar estado'}
                </Button>
                {updateForm.status === 'docs_received' && (!snapshotFields.nroPoliza?.trim() || !snapshotFields.nroCredito?.trim()) && (
                  <p className="text-xs text-destructive text-center">
                    Genera la Carta de Corte para cargar los datos del crédito
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="documents">Documentos públicos</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Datos del cliente</CardTitle>
              <EditClientDialog refund={refund} />
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nombre completo</p>
                <p className="font-medium">{refund.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">RUT</p>
                <p className="font-medium">{refund.rut}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{refund.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Teléfono</p>
                <p className="font-medium">{refund.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha de nacimiento</p>
                <p className="font-medium">{formatBirthDate(refund.calculationSnapshot?.birthDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Edad</p>
                <p className="font-medium">{refund.calculationSnapshot?.age ? `${refund.calculationSnapshot.age} años` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Origen</p>
                <p className="font-medium">
                  {refund.partnerId ? (
                    <Link 
                      to={`/alianzas/${refund.partnerId}`}
                      className="text-primary hover:underline"
                    >
                      {partnerName || 'Alianza'}
                    </Link>
                  ) : (
                    'Directo'
                  )}
                </p>
              </div>
              {refund.partnerId && (
                <div>
                  <p className="text-sm text-muted-foreground">Gestor</p>
                  <p className="font-medium">{gestorName || '-'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sección de datos bancarios para Pago Programado */}
          {(refund.status === 'payment_scheduled' || refund.status === 'paid') && refund.bankInfo && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-emerald-600">
                  <Landmark className="h-5 w-5" />
                  Datos para devolución
                </CardTitle>
                <EditBankInfoDialog refund={refund} />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">
                    Los datos bancarios ya fueron registrados para procesar la devolución
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Banco</p>
                    <p className="font-medium">{refund.bankInfo.bank || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo de cuenta</p>
                    <p className="font-medium">{refund.bankInfo.accountType || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Número de cuenta</p>
                    <p className="font-medium font-mono">{refund.bankInfo.accountNumber || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Cálculo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Institución</p>
                  <p className="font-medium">{getInstitutionDisplayName(refund.institutionId)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monto estimado</p>
                  <p className="font-medium text-lg">
                    {typeof refund.estimatedAmountCLP === 'number' ? (
                      <>
                        <Money value={refund.estimatedAmountCLP} /> {refund.currency}
                      </>
                    ) : (
                      'N/A'
                    )}
                  </p>
                </div>
              </div>

              {refund.calculationSnapshot && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">Snapshot de cálculo</p>
                    <div className="flex gap-1">
                      <EditSnapshotDialog refund={refund} />
                      <Button
                        variant={snapshotView === 'parsed' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSnapshotView('parsed')}
                      >
                        Parseado
                      </Button>
                      <Button
                        variant={snapshotView === 'raw' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSnapshotView('raw')}
                      >
                        JSON
                      </Button>
                    </div>
                  </div>
                  
                  {snapshotView === 'parsed' ? (
                    <div className="space-y-5">
                      {/* ── Datos confirmados del crédito ── */}
                      {(() => {
                        const snap = refund.calculationSnapshot
                        const hasConfirmed = snap.confirmedTotalAmount || snap.confirmedAverageInsuredBalance || snap.confirmedOriginalInstallments || snap.confirmedRemainingInstallments
                        const allConfirmed = snap.confirmedTotalAmount && snap.confirmedAverageInsuredBalance && snap.confirmedOriginalInstallments && snap.confirmedRemainingInstallments

                        return (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-foreground">Datos confirmados del crédito</h4>
                              {allConfirmed ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-700 text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Completado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700 text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Pendiente
                                </Badge>
                              )}
                            </div>

                            {!hasConfirmed ? (
                              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
                                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                    Datos confirmados pendientes
                                  </p>
                                  <p className="text-xs text-amber-700 dark:text-amber-400">
                                    Aún no se han confirmado los datos reales del crédito. Edita el snapshot para completar esta información antes de avanzar con la solicitud.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className={`grid grid-cols-2 gap-3 p-4 rounded-lg border ${allConfirmed ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' : 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'}`}>
                                <div>
                                  <p className="text-xs text-muted-foreground">Monto total confirmado</p>
                                  <p className="font-medium">
                                    {snap.confirmedTotalAmount
                                      ? `$${Number(snap.confirmedTotalAmount).toLocaleString('es-CL')} CLP`
                                      : <span className="text-amber-600 dark:text-amber-400 italic text-sm">Sin confirmar</span>}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Saldo insoluto confirmado</p>
                                  <p className="font-medium">
                                    {snap.confirmedAverageInsuredBalance
                                      ? `$${Number(snap.confirmedAverageInsuredBalance).toLocaleString('es-CL')} CLP`
                                      : <span className="text-amber-600 dark:text-amber-400 italic text-sm">Sin confirmar</span>}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Cuotas originales confirmadas</p>
                                  <p className="font-medium">
                                    {snap.confirmedOriginalInstallments || <span className="text-amber-600 dark:text-amber-400 italic text-sm">Sin confirmar</span>}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Cuotas restantes confirmadas</p>
                                  <p className="font-medium">
                                    {snap.confirmedRemainingInstallments || <span className="text-amber-600 dark:text-amber-400 italic text-sm">Sin confirmar</span>}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* ── Datos de simulación ── */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-muted-foreground">Datos de simulación</h4>
                          <Badge variant="secondary" className="text-xs">
                            <Calculator className="h-3 w-3 mr-1" />
                            Simulado
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 p-4 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/40">
                          <div>
                            <p className="text-xs text-muted-foreground">Tipo de crédito</p>
                            <p className="font-medium capitalize">{refund.calculationSnapshot.creditType || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Seguro evaluado</p>
                            <p className="font-medium capitalize">{refund.calculationSnapshot.insuranceToEvaluate || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Monto total crédito</p>
                            <p className="font-medium">
                              ${(refund.calculationSnapshot.totalAmount || 0).toLocaleString('es-CL')} CLP
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Saldo insoluto</p>
                            <p className="font-medium">
                              ${(refund.calculationSnapshot.averageInsuredBalance || 0).toLocaleString('es-CL')} CLP
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Cuotas originales</p>
                            <p className="font-medium">{refund.calculationSnapshot.originalInstallments || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Cuotas restantes</p>
                            <p className="font-medium">{refund.calculationSnapshot.remainingInstallments || 'N/A'}</p>
                          </div>

                          {/* ── Tasas utilizadas ── */}
                          {(() => {
                            const snap = { ...refund.calculationSnapshot, institutionId: refund.institutionId }
                            const { tasaBanco, tasaTDV } = getRatesForSnapshot(snap)
                            const formatTasa = (t: number | null) => t !== null ? `${(t * 100).toFixed(4)}%` : 'N/A'
                            return (
                              <div className="col-span-2 mt-1 p-3 rounded-md bg-muted/60 border border-dashed border-muted-foreground/20">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tasas desgravamen utilizadas</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Tasa banco</p>
                                    <p className="font-mono font-semibold text-sm">{formatTasa(tasaBanco)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Tasa preferencial TDV</p>
                                    <p className="font-mono font-semibold text-sm text-emerald-600 dark:text-emerald-400">{formatTasa(tasaTDV)}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* ── Primas con tooltip de fórmula ── */}
                          {(() => {
                            const snap = { ...refund.calculationSnapshot, institutionId: refund.institutionId }
                            const { tasaBanco, tasaTDV } = getRatesForSnapshot(snap)
                            const saldo = snap.confirmedAverageInsuredBalance || snap.averageInsuredBalance || snap.totalAmount || 0
                            const cuotasOrig = snap.originalInstallments || 0
                            const cuotasUsadas = snap.originalInstallments || 0 // closest match
                            const currentPremium = snap.currentMonthlyPremium || 0
                            const newPremium = snap.newMonthlyPremium || 0
                            const remaining = snap.remainingInstallments || 0

                            // Intermediate values for bank premium
                            const primaUnica = tasaBanco ? saldo * tasaBanco : 0
                            const seguroTotal = cuotasUsadas ? (primaUnica / cuotasUsadas) * cuotasOrig : 0

                            return (
                              <>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs text-muted-foreground">Prima mensual actual</p>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                                          <AlertCircle className="h-3 w-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs p-3 space-y-1.5 text-xs">
                                        <p className="font-semibold text-[11px] uppercase tracking-wide">Fórmula prima banco</p>
                                        <div className="space-y-0.5 font-mono text-[11px]">
                                          <p><span className="text-muted-foreground">Prima única =</span> Saldo × Tasa banco</p>
                                          <p className="text-muted-foreground pl-2">${saldo.toLocaleString('es-CL')} × {tasaBanco ? (tasaBanco * 100).toFixed(4) + '%' : 'N/A'} = ${Math.round(primaUnica).toLocaleString('es-CL')}</p>
                                          <p><span className="text-muted-foreground">Seguro total =</span> (Prima única / Cuotas tabla) × Cuotas orig.</p>
                                          <p className="text-muted-foreground pl-2">(${Math.round(primaUnica).toLocaleString('es-CL')} / {cuotasUsadas}) × {cuotasOrig} = ${Math.round(seguroTotal).toLocaleString('es-CL')}</p>
                                          <p><span className="text-muted-foreground">Prima mensual =</span> Seguro total / Cuotas orig.</p>
                                          <p className="text-muted-foreground pl-2">${Math.round(seguroTotal).toLocaleString('es-CL')} / {cuotasOrig} = <span className="font-semibold text-foreground">${Math.round(seguroTotal / (cuotasOrig || 1)).toLocaleString('es-CL')}</span></p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  <p className="font-medium">
                                    ${currentPremium.toLocaleString('es-CL')} CLP
                                  </p>
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs text-muted-foreground">Nueva prima mensual</p>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                                          <AlertCircle className="h-3 w-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs p-3 space-y-1.5 text-xs">
                                        <p className="font-semibold text-[11px] uppercase tracking-wide">Fórmula prima TDV</p>
                                        <div className="space-y-0.5 font-mono text-[11px]">
                                          <p><span className="text-muted-foreground">Nueva prima =</span> Saldo × Tasa TDV</p>
                                          <p className="text-muted-foreground pl-2">${saldo.toLocaleString('es-CL')} × {tasaTDV ? (tasaTDV * 100).toFixed(4) + '%' : 'N/A'}</p>
                                          <p className="text-muted-foreground pl-2">= <span className="font-semibold text-emerald-600">${Math.round(saldo * (tasaTDV || 0)).toLocaleString('es-CL')}</span></p>
                                        </div>
                                        <div className="border-t border-dashed pt-1 mt-1">
                                          <p className="text-muted-foreground text-[10px]">Tasa {saldo > 20000000 ? '> 20M' : '≤ 20M'}, edad {(snap.age || 0) <= 55 ? '≤ 55' : '> 55'}</p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                                    ${newPremium.toLocaleString('es-CL')} CLP
                                  </p>
                                </div>
                              </>
                            )
                          })()}
                          {/* ── Ahorro mensual con desglose ── */}
                          {(() => {
                            const snap = refund.calculationSnapshot
                            const currentPremium = snap.currentMonthlyPremium || 0
                            const newPremium = snap.newMonthlyPremium || 0
                            const monthlySaving = snap.monthlySaving || 0
                            return (
                              <div className="col-span-2 mt-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs text-muted-foreground">Ahorro mensual</p>
                                </div>
                                <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                                  ${monthlySaving.toLocaleString('es-CL')} CLP
                                </p>
                                <div className="p-3 rounded-md bg-muted/40 border border-dashed border-muted-foreground/15 space-y-1.5">
                                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <Calculator className="h-3 w-3" />
                                    Fórmula: Prima banco − Prima TDV
                                  </p>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="text-center p-2 rounded bg-background border">
                                      <p className="text-muted-foreground mb-0.5">Prima banco</p>
                                      <p className="font-mono font-semibold">${currentPremium.toLocaleString('es-CL')}</p>
                                    </div>
                                    <div className="flex items-center justify-center text-muted-foreground font-bold text-base">−</div>
                                    <div className="text-center p-2 rounded bg-background border">
                                      <p className="text-muted-foreground mb-0.5">Prima TDV</p>
                                      <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">${newPremium.toLocaleString('es-CL')}</p>
                                    </div>
                                  </div>
                                  <div className="text-center pt-1 border-t border-dashed border-muted-foreground/15">
                                    <p className="text-xs text-muted-foreground">= <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">${monthlySaving.toLocaleString('es-CL')} CLP</span></p>
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* ── Ahorro total con desglose ── */}
                          {(() => {
                            const snap = refund.calculationSnapshot
                            const currentPremium = snap.currentMonthlyPremium || 0
                            const newPremium = snap.newMonthlyPremium || 0
                            const remaining = snap.confirmedRemainingInstallments || snap.remainingInstallments || 0
                            const totalSaving = snap.totalSaving || 0
                            const primaTotalBanco = currentPremium * remaining
                            const primaTotalTDV = newPremium * remaining
                            const MARGEN_FIJO = 10
                            const devolucionBruta = primaTotalBanco - primaTotalTDV
                            const totalCalculado = Math.round(devolucionBruta * (1 - MARGEN_FIJO / 100))
                            return (
                              <div className="col-span-2 mt-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs text-muted-foreground">Ahorro total (devolución al cliente)</p>
                                </div>
                                <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400 mb-2">
                                  ${totalSaving.toLocaleString('es-CL')} CLP
                                </p>
                                <div className="p-3 rounded-md bg-muted/40 border border-dashed border-muted-foreground/15 space-y-2">
                                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <Calculator className="h-3 w-3" />
                                    Fórmula: (Prima total banco − Prima total TDV) × (1 − margen)
                                  </p>
                                  {/* Step 1: Prima totals */}
                                  <div className="space-y-1">
                                    <p className="text-[11px] text-muted-foreground font-medium">Paso 1: Primas totales restantes</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="p-2 rounded bg-background border">
                                        <p className="text-muted-foreground mb-0.5">Prima banco × Cuotas</p>
                                        <p className="font-mono text-[11px] text-muted-foreground">${currentPremium.toLocaleString('es-CL')} × {remaining}</p>
                                        <p className="font-mono font-semibold mt-0.5">= ${primaTotalBanco.toLocaleString('es-CL')}</p>
                                      </div>
                                      <div className="p-2 rounded bg-background border">
                                        <p className="text-muted-foreground mb-0.5">Prima TDV × Cuotas</p>
                                        <p className="font-mono text-[11px] text-muted-foreground">${newPremium.toLocaleString('es-CL')} × {remaining}</p>
                                        <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">= ${primaTotalTDV.toLocaleString('es-CL')}</p>
                                      </div>
                                    </div>
                                  </div>
                                  {/* Step 2: Gross refund */}
                                  <div className="space-y-1">
                                    <p className="text-[11px] text-muted-foreground font-medium">Paso 2: Devolución bruta</p>
                                    <div className="p-2 rounded bg-background border text-xs">
                                      <p className="font-mono text-[11px] text-muted-foreground">${primaTotalBanco.toLocaleString('es-CL')} − ${primaTotalTDV.toLocaleString('es-CL')}</p>
                                      <p className="font-mono font-semibold mt-0.5">= ${devolucionBruta.toLocaleString('es-CL')} CLP</p>
                                    </div>
                                  </div>
                                  {/* Step 3: Apply margin */}
                                  <div className="space-y-1">
                                    <p className="text-[11px] text-muted-foreground font-medium">Paso 3: Aplicar margen ({MARGEN_FIJO}%)</p>
                                    <div className="p-2 rounded bg-background border text-xs">
                                      <p className="font-mono text-[11px] text-muted-foreground">${devolucionBruta.toLocaleString('es-CL')} × {((100 - MARGEN_FIJO) / 100).toFixed(2)}</p>
                                      <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">= ${totalSaving.toLocaleString('es-CL')} CLP</p>
                                      {totalCalculado !== totalSaving && (
                                        <p className="text-[10px] text-muted-foreground mt-1 italic">
                                          Cálculo teórico: ${totalCalculado.toLocaleString('es-CL')} — diferencia por redondeos en primas intermedias
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })()}
                          {refund.calculationSnapshot.rateSet && (
                            <div>
                              <p className="text-xs text-muted-foreground">Versión tarifas</p>
                              <p className="font-medium">{refund.calculationSnapshot.rateSet}</p>
                            </div>
                          )}
                          {refund.calculationSnapshot.createdAt && (
                            <div>
                              <p className="text-xs text-muted-foreground">Creado</p>
                              <p className="font-medium">
                                {new Date(refund.calculationSnapshot.createdAt).toLocaleString('es-CL')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">
                      {JSON.stringify(refund.calculationSnapshot, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {/* Desglose por tipo de seguro (solo para "ambos") */}
              <InsuranceBreakdown snapshot={refund.calculationSnapshot} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Historial de estados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {refund.statusHistory.map((entry, idx) => {
                  // Determinar color del indicador según el estado final
                  const getStatusColor = (status: RefundStatus) => {
                    switch (status) {
                      case 'simulated':
                        return 'bg-blue-500 border-blue-200'
                      case 'requested':
                        return 'bg-blue-400 border-blue-100'
                      case 'qualifying':
                        return 'bg-yellow-500 border-yellow-200'
                      case 'docs_pending':
                        return 'bg-orange-500 border-orange-200'
                      case 'docs_received':
                        return 'bg-cyan-500 border-cyan-200'
                      case 'submitted':
                        return 'bg-indigo-500 border-indigo-200'
                      case 'approved':
                        return 'bg-green-500 border-green-200'
                      case 'payment_scheduled':
                        return 'bg-emerald-500 border-emerald-200'
                      case 'paid':
                        return 'bg-green-600 border-green-300'
                      case 'rejected':
                        return 'bg-red-500 border-red-200'
                      case 'canceled':
                        return 'bg-gray-500 border-gray-200'
                      default:
                        return 'bg-primary border-primary/20'
                    }
                  }

                  const getBorderColor = (status: RefundStatus) => {
                    switch (status) {
                      case 'simulated':
                        return 'border-blue-300'
                      case 'requested':
                        return 'border-blue-200'
                      case 'qualifying':
                        return 'border-yellow-300'
                      case 'docs_pending':
                        return 'border-orange-300'
                      case 'docs_received':
                        return 'border-cyan-300'
                      case 'submitted':
                        return 'border-indigo-300'
                      case 'approved':
                        return 'border-green-300'
                      case 'payment_scheduled':
                        return 'border-emerald-300'
                      case 'paid':
                        return 'border-green-400'
                      case 'rejected':
                        return 'border-red-300'
                      case 'canceled':
                        return 'border-gray-300'
                      default:
                        return 'border-primary'
                    }
                  }

                  return (
                    <div key={idx} className={`flex gap-4 border-l-2 ${getBorderColor(entry.to)} pl-4 pb-4 relative`}>
                      <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${getStatusColor(entry.to)}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.from && (
                            <Badge variant="outline" className="text-xs">
                              {statusLabels[entry.from as RefundStatus] || entry.from}
                            </Badge>
                          )}
                          <span className="text-muted-foreground">→</span>
                          <Badge variant={statusVariants[entry.to as RefundStatus] || 'default'} className="text-xs">
                            {statusLabels[entry.to as RefundStatus] || entry.to}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {entry.at ? new Date(entry.at).toLocaleString('es-CL') : 'Fecha no disponible'}
                          {entry.by && ` • por ${entry.by}`}
                        </p>
                        {entry.note && <p className="text-sm mt-2">{entry.note}</p>}
                        {entry.realAmount && (entry.to === 'payment_scheduled' || entry.to === 'paid') && (
                          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            <span>Monto real:</span>
                            <span>${entry.realAmount.toLocaleString('es-CL')} CLP</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsSection 
            publicId={refund.publicId} 
            clientToken={refund.clientTokenHash}
            documents={documents}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
