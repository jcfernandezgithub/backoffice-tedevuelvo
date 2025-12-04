import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { solicitudesService } from '@/services/solicitudesService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Timeline } from '@/components/common/Timeline'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { EstadoSolicitud } from '@/types/domain'

const pasos: EstadoSolicitud[] = [
  'SIMULACION_CONFIRMADA',
  'DEVOLUCION_CONFIRMADA_COMPANIA',
  'FONDOS_RECIBIDOS_TD',
  'CERTIFICADO_EMITIDO',
  'CLIENTE_NOTIFICADO',
  'PAGADA_CLIENTE',
]

export default function GestionCallCenterDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { data: registro } = useQuery({ queryKey: ['callcenter', id], queryFn: () => solicitudesService.get(id!), enabled: !!id })
  const [nuevoPaso, setNuevoPaso] = useState<EstadoSolicitud | undefined>(undefined)
  const [detalle, setDetalle] = useState('')
  const [monto, setMonto] = useState<number | undefined>(undefined)

  const avanzar = async () => {
    if (!id || !nuevoPaso) return
    try {
      await solicitudesService.avanzarEstado(id, nuevoPaso, detalle, monto)
      toast({ title: 'Avance registrado' })
      qc.invalidateQueries({ queryKey: ['callcenter', id] })
      qc.invalidateQueries({ queryKey: ['callcenter'] })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  if (!registro) return <main className="p-4">Cargando...</main>

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Registro {registro.id}</h1>
        <Button variant="outline" onClick={() => navigate('/gestion-callcenter')}>Volver</Button>
      </div>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline items={registro.timeline} />
          </CardContent>
        </Card>
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
      </section>
    </main>
  )
}
