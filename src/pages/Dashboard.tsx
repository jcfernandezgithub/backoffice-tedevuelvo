import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { solicitudesService } from '@/services/solicitudesService'
import { alianzasService } from '@/services/alianzasService'
import { Money } from '@/components/common/Money'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const { data: solicitudes = [] } = useQuery({ queryKey: ['solicitudes'], queryFn: () => solicitudesService.list() })
  const { data: alianzas = [] } = useQuery({ queryKey: ['alianzas'], queryFn: () => alianzasService.list() })

  const kpis = {
    solicitudes: solicitudes.length,
    alianzas: alianzas.length,
    montoEstimado: solicitudes.reduce((a, s) => a + (s.montoADevolverEstimado || 0), 0),
    pagadas: solicitudes.filter((s) => s.estado === 'PAGADA_CLIENTE').length,
  }

  const porEstado = Object.entries(
    solicitudes.reduce<Record<string, number>>((acc, s) => {
      acc[s.estado] = (acc[s.estado] || 0) + 1
      return acc
    }, {})
  ).map(([estado, count]) => ({ estado, count }))

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi title="Solicitudes" value={kpis.solicitudes} />
        <Kpi title="Alianzas" value={kpis.alianzas} />
        <Kpi title="Monto estimado" value={<Money value={kpis.montoEstimado} />} />
        <Kpi title="Pagadas" value={kpis.pagadas} />
      </section>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes por estado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porEstado}>
                  <XAxis dataKey="estado" hide />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Últimas actividades</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {solicitudes.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between">
                  <span className="truncate">{s.cliente.nombre} · {s.estado}</span>
                  <span className="text-muted-foreground">{new Date(s.updatedAt).toLocaleDateString('es-CL')}</span>
                </li>
              ))}
              {solicitudes.length === 0 && <li className="text-muted-foreground">Sin actividad</li>}
            </ul>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function Kpi({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card className="hover:shadow-md transition">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  )
}
