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
          <TabsTrigger value="documents">Documentos</TabsTrigger>
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
                  <p className="text-sm text-muted-foreground mb-2">Snapshot de cálculo</p>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">
                    {JSON.stringify(refund.calculationSnapshot, null, 2)}
                  </pre>
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
                {refund.statusHistory.map((entry, idx) => (
                  <div key={idx} className="flex gap-4 border-l-2 border-primary pl-4 pb-4">
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
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              {!documents || documents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay documentos</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tamaño</TableHead>
                      <TableHead>Formato</TableHead>
                      <TableHead>Creación</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.kind}</TableCell>
                        <TableCell>{(doc.size / 1024).toFixed(2)} KB</TableCell>
                        <TableCell>{doc.contentType}</TableCell>
                        <TableCell>{new Date(doc.createdAt).toLocaleDateString('es-CL')}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refundAdminApi.downloadDoc(refund.publicId, doc.id)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Descargar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
