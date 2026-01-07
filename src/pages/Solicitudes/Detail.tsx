import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { solicitudesService } from '@/services/solicitudesService'
import { refundAdminApi } from '@/services/refundAdminApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Timeline } from '@/components/common/Timeline'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { EstadoSolicitud } from '@/types/domain'
import { Money } from '@/components/common/Money'
import { getInstitutionDisplayName } from '@/lib/institutionHomologation'
import { RefundStatus } from '@/types/refund'

const pasos: EstadoSolicitud[] = [
  'SIMULACION_CONFIRMADA',
  'DEVOLUCION_CONFIRMADA_COMPANIA',
  'FONDOS_RECIBIDOS_TD',
  'CERTIFICADO_EMITIDO',
  'CLIENTE_NOTIFICADO',
  'PAGADA_CLIENTE',
]

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

export default function SolicitudDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()

  // Intentar primero obtener del API real, si falla buscar en mock local
  const { data: solicitud, isLoading, error } = useQuery({
    queryKey: ['solicitud', id],
    queryFn: async () => {
      if (!id) throw new Error('ID no proporcionado')
      
      // Primero intentar el API real
      try {
        const realData = await refundAdminApi.getById(id) as any
        if (realData) {
          // Mapear datos del API real al formato esperado
          return {
            id: realData._id || realData.id || realData.publicId,
            publicId: realData.publicId,
            isRealData: true,
            cliente: {
              nombre: realData.fullName,
              rut: realData.rut,
              email: realData.email,
              banco: realData.institutionId,
            },
            estado: realData.status,
            montoADevolverEstimado: realData.estimatedAmountCLP,
            timeline: realData.timeline || [],
            createdAt: realData.createdAt,
            updatedAt: realData.updatedAt,
            ...realData,
          }
        }
      } catch (apiError) {
        console.log('API real no encontró la solicitud, buscando en mock local...')
      }
      
      // Si no se encontró en el API, buscar en mock local
      const mockData = await solicitudesService.get(id)
      if (mockData) {
        return { ...mockData, isRealData: false }
      }
      
      throw new Error('Solicitud no encontrada')
    },
    enabled: !!id,
  })

  const [nuevoPaso, setNuevoPaso] = useState<EstadoSolicitud | undefined>(undefined)
  const [detalle, setDetalle] = useState('')
  const [monto, setMonto] = useState<number | undefined>(undefined)

  const avanzar = async () => {
    if (!id || !nuevoPaso) return
    try {
      await solicitudesService.avanzarEstado(id, nuevoPaso, detalle, monto)
      toast({ title: 'Avance registrado' })
      qc.invalidateQueries({ queryKey: ['solicitud', id] })
      qc.invalidateQueries({ queryKey: ['solicitudes'] })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  if (isLoading) return <main className="p-4">Cargando...</main>
  
  if (error || !solicitud) {
    return (
      <main className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Solicitud no encontrada</h1>
          <Button variant="outline" onClick={() => navigate(-1)}>Volver</Button>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No se pudo cargar la información de esta solicitud.
          </CardContent>
        </Card>
      </main>
    )
  }

  const isRealData = (solicitud as any).isRealData

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Solicitud {solicitud.publicId || solicitud.id}
        </h1>
        <Button variant="outline" onClick={() => navigate(-1)}>Volver</Button>
      </div>
      
      {/* Información del cliente */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nombre</p>
                <p className="font-medium">{(solicitud as any).fullName || solicitud.cliente?.nombre || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">RUT</p>
                <p className="font-medium">{(solicitud as any).rut || solicitud.cliente?.rut || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{(solicitud as any).email || solicitud.cliente?.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Institución</p>
                <p className="font-medium">{getInstitutionDisplayName((solicitud as any).institutionId || solicitud.cliente?.banco)}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge className="mt-1">
                    {statusLabels[(solicitud as any).status as RefundStatus] || solicitud.estado || '-'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monto Estimado</p>
                  <p className="font-medium text-lg">
                    <Money value={(solicitud as any).estimatedAmountCLP || solicitud.montoADevolverEstimado} />
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha Creación</p>
                  <p className="font-medium">
                    {solicitud.createdAt ? new Date(solicitud.createdAt).toLocaleDateString('es-CL') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Última Actualización</p>
                  <p className="font-medium">
                    {solicitud.updatedAt ? new Date(solicitud.updatedAt).toLocaleDateString('es-CL') : '-'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel de acciones - solo para datos mock */}
        {!isRealData && (
          <Card>
            <CardHeader>
              <CardTitle>Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm">Nuevo estado</label>
                <Select onValueChange={(v) => setNuevoPaso(v as EstadoSolicitud)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {pasos.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">Detalle</label>
                <Input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Comentario" />
              </div>
              <div>
                <label className="text-sm">Monto recibido (si aplica)</label>
                <Input type="number" value={monto ?? ''} onChange={(e) => setMonto(e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <Button onClick={avanzar}>Registrar avance</Button>
            </CardContent>
          </Card>
        )}

        {/* Para datos reales, mostrar info adicional */}
        {isRealData && (
          <Card>
            <CardHeader>
              <CardTitle>Detalles Adicionales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">ID Público</p>
                <p className="font-mono text-sm">{(solicitud as any).publicId || '-'}</p>
              </div>
              {(solicitud as any).partnerId && (
                <div>
                  <p className="text-sm text-muted-foreground">Partner ID</p>
                  <p className="font-mono text-sm">{(solicitud as any).partnerId}</p>
                </div>
              )}
              {(solicitud as any).partnerUserId && (
                <div>
                  <p className="text-sm text-muted-foreground">Gestor ID</p>
                  <p className="font-mono text-sm">{(solicitud as any).partnerUserId}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Timeline - solo si hay datos */}
      {solicitud.timeline && solicitud.timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline items={solicitud.timeline} />
          </CardContent>
        </Card>
      )}
    </main>
  )
}
