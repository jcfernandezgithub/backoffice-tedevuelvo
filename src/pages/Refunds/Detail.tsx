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
import { ArrowLeft, Download, Edit, FileText, Copy, Check, AlertCircle, CheckCircle, Landmark, CreditCard, Shield, Briefcase } from 'lucide-react'
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
    queryKey: ['refund-docs', refund?.publicId],
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

  const handleUpdateStatus = () => {
    // Validar monto real obligatorio para pago programado
    if (updateForm.status === 'payment_scheduled' && (!updateForm.realAmount || updateForm.realAmount <= 0)) {
      toast({
        title: 'Monto requerido',
        description: 'Debes ingresar el monto real de devolución para programar el pago',
        variant: 'destructive',
      })
      return
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
              
              return (
                <>
                  {/* Certificado Desgravamen */}
                  {!showDesgravamen ? (
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
                      <TooltipContent>
                        {!insuranceType ? 'Tipo de seguro no disponible' : 'No aplica - Solicitud de tipo cesantía'}
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
                  {!showCesantia ? (
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
                      <TooltipContent>
                        {!insuranceType ? 'Tipo de seguro no disponible' : 'No aplica - Solicitud de tipo desgravamen'}
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
          <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
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

                <Button onClick={handleUpdateStatus} className="w-full" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Actualizando...' : 'Actualizar estado'}
                </Button>
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
            <CardContent className="grid grid-cols-2 gap-4">
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
              {refund.calculationSnapshot && (
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
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
                    <div className="grid grid-cols-2 gap-3 bg-muted p-4 rounded">
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
                        <p className="text-xs text-muted-foreground">Saldo asegurado promedio</p>
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
                      <div>
                        <p className="text-xs text-muted-foreground">Prima mensual actual</p>
                        <p className="font-medium">
                          ${(refund.calculationSnapshot.currentMonthlyPremium || 0).toLocaleString('es-CL')} CLP
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nueva prima mensual</p>
                        <p className="font-medium text-green-600">
                          ${(refund.calculationSnapshot.newMonthlyPremium || 0).toLocaleString('es-CL')} CLP
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ahorro mensual</p>
                        <p className="font-medium text-green-600">
                          ${(refund.calculationSnapshot.monthlySaving || 0).toLocaleString('es-CL')} CLP
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Ahorro total</p>
                        <p className="font-semibold text-lg text-green-600">
                          ${(refund.calculationSnapshot.totalSaving || 0).toLocaleString('es-CL')} CLP
                        </p>
                      </div>
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
