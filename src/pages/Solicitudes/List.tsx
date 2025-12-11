import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { solicitudesService } from '@/services/solicitudesService'
import { refundAdminApi } from '@/services/refundAdminApi'
import { DataGrid, Column } from '@/components/datagrid/DataGrid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Money } from '@/components/common/Money'
import { useToast } from '@/hooks/use-toast'
import { exportCSV, exportXLSX } from '@/services/reportesService'
import { useMemo } from 'react'

export default function SolicitudesList() {
  const [searchParams] = useSearchParams()
  const alianzaIdFilter = searchParams.get('alianzaId')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { toast } = useToast()

  // Si hay partnerId, usar el endpoint real, sino usar mock local
  const { data: partnerData = [], isLoading: isLoadingPartner } = useQuery({
    queryKey: ['partner-solicitudes', alianzaIdFilter],
    queryFn: () => refundAdminApi.listByPartner(alianzaIdFilter!),
    enabled: !!alianzaIdFilter,
  })

  const { data: mockData = [], isLoading: isLoadingMock } = useQuery({
    queryKey: ['solicitudes'],
    queryFn: () => solicitudesService.list(),
    enabled: !alianzaIdFilter,
  })

  const data = alianzaIdFilter ? partnerData : mockData
  const isLoading = alianzaIdFilter ? isLoadingPartner : isLoadingMock

  const columns: Column<any>[] = useMemo(() => {
    if (alianzaIdFilter) {
      // Columnas para datos del API real (partner refunds)
      return [
        { key: 'publicId', header: 'ID', sortable: true },
        { key: 'fullName', header: 'Cliente', sortable: true },
        { key: 'status', header: 'Estado', sortable: true },
        { key: 'institutionId', header: 'Institución', sortable: true },
        { key: 'estimatedAmountCLP', header: 'Estimado', render: (r: any) => <Money value={r.estimatedAmountCLP} />, sortable: true },
        { key: 'updatedAt', header: 'Actualizado', render: (r: any) => new Date(r.updatedAt).toLocaleDateString('es-CL'), sortable: true },
        { key: 'acciones', header: 'Acciones', render: (r: any) => <Button size="sm" variant="outline" onClick={() => navigate(`/solicitudes/${r.id}`)}>Abrir</Button> },
      ]
    } else {
      // Columnas para datos mock locales
      return [
        { key: 'id', header: 'ID', sortable: true },
        { key: 'cliente', header: 'Cliente', render: (r: any) => r.cliente?.nombre, sortable: true },
        { key: 'estado', header: 'Estado', sortable: true },
        { key: 'alianzaId', header: 'Alianza', sortable: true },
        { key: 'montoADevolverEstimado', header: 'Estimado', render: (r: any) => <Money value={r.montoADevolverEstimado} />, sortable: true },
        { key: 'updatedAt', header: 'Actualizado', render: (r: any) => new Date(r.updatedAt).toLocaleDateString('es-CL'), sortable: true },
        { key: 'origen', header: 'Origen', render: (r: any) => r.partnerId ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Alianza</span>
        ) : (
          <span className="text-muted-foreground text-xs">Directo</span>
        )},
        { key: 'acciones', header: 'Acciones', render: (r: any) => <Button size="sm" variant="outline" onClick={() => navigate(`/solicitudes/${r.id}`)}>Abrir</Button> },
      ]
    }
  }, [alianzaIdFilter, navigate])

  const crear = async () => {
    const base = {
      cliente: { rut: '11.111.111-1', nombre: 'Nuevo Cliente', email: 'nc@example.com', banco: 'Banco B', edad: 30 },
      credito: { monto: 1000000, cuotasTotales: 24, cuotasPendientes: 20, tipoSeguro: 'CESANTIA' as const },
      estado: 'SIMULACION_CONFIRMADA' as const,
      montoADevolverEstimado: 50000,
    }
    await solicitudesService.create(base as any)
    toast({ title: 'Solicitud creada' })
    qc.invalidateQueries({ queryKey: ['solicitudes'] })
  }

  const exportarCSV = () => exportCSV(data as any, 'solicitudes.csv')
  const exportarXLSX = () => exportXLSX(data as any, 'solicitudes.xlsx')

  return (
    <main className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Solicitudes</h1>
        {alianzaIdFilter && (
          <Button variant="outline" size="sm" onClick={() => navigate('/solicitudes')}>
            Ver todas
          </Button>
        )}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {alianzaIdFilter ? `Solicitudes de alianza ${alianzaIdFilter}` : 'Listado maestro'}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="soft" onClick={exportarCSV}>Exportar CSV</Button>
            <Button variant="soft" onClick={exportarXLSX}>Exportar XLSX</Button>
            <Button variant="hero" onClick={crear}>Nueva solicitud</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? 'Cargando...' : <DataGrid data={data} columns={columns} />}
        </CardContent>
      </Card>
    </main>
  )
}
