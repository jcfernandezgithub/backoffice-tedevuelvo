import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { solicitudesService } from '@/services/solicitudesService'
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
  const { data = [], isLoading } = useQuery({ queryKey: ['solicitudes'], queryFn: () => solicitudesService.list() })
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { toast } = useToast()

  const filteredData = useMemo(() => {
    if (!alianzaIdFilter) return data
    return data.filter(s => s.alianzaId === alianzaIdFilter)
  }, [data, alianzaIdFilter])

  const columns: Column<any>[] = [
    { key: 'id', header: 'ID', sortable: true },
    { key: 'cliente', header: 'Cliente', render: (r) => r.cliente?.nombre, sortable: true },
    { key: 'estado', header: 'Estado', sortable: true },
    { key: 'alianzaId', header: 'Alianza', sortable: true },
    { key: 'montoADevolverEstimado', header: 'Estimado', render: (r) => <Money value={r.montoADevolverEstimado} />, sortable: true },
    { key: 'updatedAt', header: 'Actualizado', render: (r) => new Date(r.updatedAt).toLocaleDateString('es-CL'), sortable: true },
    { key: 'acciones', header: 'Acciones', render: (r) => <Button size="sm" variant="outline" onClick={() => navigate(`/solicitudes/${r.id}`)}>Abrir</Button> },
  ]

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

  const exportarCSV = () => exportCSV(data, 'solicitudes.csv')
  const exportarXLSX = () => exportXLSX(data, 'solicitudes.xlsx')

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
          {isLoading ? 'Cargando...' : <DataGrid data={filteredData} columns={columns} />}
        </CardContent>
      </Card>
    </main>
  )
}
