import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { refundAdminApi } from '@/services/refundAdminApi'
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
import { ArrowLeft, Download, Edit, FileText, Copy, Check } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/state/AuthContext'
import { GenerateCorteDialog } from './components/GenerateCorteDialog'

const statusLabels: Record<RefundStatus, string> = {
  REQUESTED: 'Solicitado',
  QUALIFYING: 'En calificación',
  DOCS_PENDING: 'Docs pendientes',
  DOCS_RECEIVED: 'Docs recibidos',
  SUBMITTED: 'Enviado',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  PAYMENT_SCHEDULED: 'Pago programado',
  PAID: 'Pagado',
  CANCELED: 'Cancelado',
}

const statusVariants: Record<RefundStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  REQUESTED: 'secondary',
  QUALIFYING: 'secondary',
  DOCS_PENDING: 'outline',
  DOCS_RECEIVED: 'outline',
  SUBMITTED: 'default',
  APPROVED: 'default',
  REJECTED: 'destructive',
  PAYMENT_SCHEDULED: 'default',
  PAID: 'default',
  CANCELED: 'destructive',
}

export default function RefundDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [snapshotView, setSnapshotView] = useState<'parsed' | 'raw'>('parsed')

  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [updateForm, setUpdateForm] = useState<AdminUpdateStatusDto>({
    status: 'REQUESTED',
    note: '',
    by: user?.email || '',
    force: false,
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
    updateMutation.mutate(updateForm)
  }

  const handleViewMandate = async () => {
    if (!refund?.publicId) return
    
    try {
      const response = await fetch(
        `https://tedevuelvo-app-be.onrender.com/api/v1/refund-requests/${refund.publicId}/experian/status`
      )
      
      if (!response.ok) {
        throw new Error('Error al obtener el mandato')
      }
      
      const data = await response.json()
      
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
        <Button variant="ghost" size="sm" onClick={() => navigate('/refunds')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
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
        <div className="flex gap-2 items-center">
          <Badge variant={statusVariants[refund.status]} className="text-base px-3 py-1">
            {statusLabels[refund.status]}
          </Badge>
          <Button variant="outline" onClick={handleViewMandate}>
            <FileText className="h-4 w-4 mr-2" />
            Ver Mandato
          </Button>
          <GenerateCorteDialog refund={refund} />
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
                    onValueChange={(v) => setUpdateForm({ ...updateForm, status: v as RefundStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
            <CardHeader>
              <CardTitle>Datos del cliente</CardTitle>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cálculo</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Institución</p>
                <p className="font-medium">{refund.institutionId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monto estimado</p>
                <p className="font-medium text-lg">
                  ${refund.estimatedAmountCLP.toLocaleString('es-CL')} {refund.currency}
                </p>
              </div>
              {refund.calculationSnapshot && (
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Snapshot de cálculo</p>
                    <div className="flex gap-1">
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
                      case 'REQUESTED':
                        return 'bg-blue-500 border-blue-200'
                      case 'QUALIFYING':
                        return 'bg-yellow-500 border-yellow-200'
                      case 'DOCS_PENDING':
                        return 'bg-orange-500 border-orange-200'
                      case 'DOCS_RECEIVED':
                        return 'bg-cyan-500 border-cyan-200'
                      case 'SUBMITTED':
                        return 'bg-indigo-500 border-indigo-200'
                      case 'APPROVED':
                        return 'bg-green-500 border-green-200'
                      case 'PAYMENT_SCHEDULED':
                        return 'bg-emerald-500 border-emerald-200'
                      case 'PAID':
                        return 'bg-green-600 border-green-300'
                      case 'REJECTED':
                        return 'bg-red-500 border-red-200'
                      case 'CANCELED':
                        return 'bg-gray-500 border-gray-200'
                      default:
                        return 'bg-primary border-primary/20'
                    }
                  }

                  const getBorderColor = (status: RefundStatus) => {
                    switch (status) {
                      case 'REQUESTED':
                        return 'border-blue-300'
                      case 'QUALIFYING':
                        return 'border-yellow-300'
                      case 'DOCS_PENDING':
                        return 'border-orange-300'
                      case 'DOCS_RECEIVED':
                        return 'border-cyan-300'
                      case 'SUBMITTED':
                        return 'border-indigo-300'
                      case 'APPROVED':
                        return 'border-green-300'
                      case 'PAYMENT_SCHEDULED':
                        return 'border-emerald-300'
                      case 'PAID':
                        return 'border-green-400'
                      case 'REJECTED':
                        return 'border-red-300'
                      case 'CANCELED':
                        return 'border-gray-300'
                      default:
                        return 'border-primary'
                    }
                  }

                  return (
                    <div key={idx} className={`flex gap-4 border-l-2 ${getBorderColor(entry.to)} pl-4 pb-4 relative`}>
                      <div className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${getStatusColor(entry.to)}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {entry.from && (
                            <Badge variant="outline" className="text-xs">
                              {statusLabels[entry.from]}
                            </Badge>
                          )}
                          <span className="text-muted-foreground">→</span>
                          <Badge variant={statusVariants[entry.to]} className="text-xs">
                            {statusLabels[entry.to]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(entry.at).toLocaleString('es-CL')}
                          {entry.by && ` • por ${entry.by}`}
                        </p>
                        {entry.note && <p className="text-sm mt-2">{entry.note}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsSection publicId={refund.publicId} clientToken={refund.clientTokenHash} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
