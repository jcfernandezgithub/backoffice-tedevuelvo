import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'
import { Money } from '@/components/common/Money'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useMemo, useState } from 'react'
import { dashboardService, type Aggregation } from '@/services/dashboardService'
import { dashboardDataMock } from '@/mocks/dashboardData'
import { FileCheck, Clock, Building2, Wallet, Bell, CheckCircle2, XCircle, LucideIcon } from 'lucide-react'

const fmtCLP = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

const ESTADO_LABELS: Record<string, string> = {
  SIMULACION_CONFIRMADA: 'Simulación confirmada',
  EN_PROCESO: 'En proceso',
  DEVOLUCION_CONFIRMADA_COMPANIA: 'Devolución confirmada compañía',
  FONDOS_RECIBIDOS_TD: 'Fondos recibidos TD',
  CLIENTE_NOTIFICADO: 'Cliente notificado',
  PAGADA_CLIENTE: 'Pagada cliente',
  RECHAZADO: 'Rechazado',
}

const ESTADO_ICONS: Record<string, LucideIcon> = {
  SIMULACION_CONFIRMADA: FileCheck,
  EN_PROCESO: Clock,
  DEVOLUCION_CONFIRMADA_COMPANIA: Building2,
  FONDOS_RECIBIDOS_TD: Wallet,
  CLIENTE_NOTIFICADO: Bell,
  PAGADA_CLIENTE: CheckCircle2,
  RECHAZADO: XCircle,
}

export default function Dashboard() {
  // Rango de fechas por defecto: últimos 30 días
  const [desde, setDesde] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [agg, setAgg] = useState<Aggregation>('day')

  const { data: counts } = useQuery({
    queryKey: ['dashboard', 'counts', desde, hasta],
    queryFn: () => dashboardService.getSolicitudesPorEstado(desde, hasta),
  })

  const { data: pagosAgg } = useQuery({
    queryKey: ['dashboard', 'pagos-agg', desde, hasta, agg],
    queryFn: () => dashboardService.getPagosAggregate(desde, hasta, agg),
  })

  const estadoCards = useMemo(() => (
    [
      'SIMULACION_CONFIRMADA',
      'EN_PROCESO',
      'DEVOLUCION_CONFIRMADA_COMPANIA',
      'FONDOS_RECIBIDOS_TD',
      'CLIENTE_NOTIFICADO',
      'PAGADA_CLIENTE',
      'RECHAZADO',
    ].map((k) => ({ 
      key: k, 
      title: ESTADO_LABELS[k], 
      value: counts?.[k] ?? 0,
      icon: ESTADO_ICONS[k]
    }))
  ), [counts])

  return (
    <main className="p-4 space-y-4" role="main" aria-label="Panel principal del Dashboard">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">KPIs por estado y evolución de pagos a clientes (CLP)</p>
      </header>

      <section aria-label="Filtros" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rango de fechas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="fecha-desde" className="text-xs text-muted-foreground">Desde</label>
              <input
                id="fecha-desde"
                type="date"
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={desde}
                max={hasta}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="fecha-hasta" className="text-xs text-muted-foreground">Hasta</label>
              <input
                id="fecha-hasta"
                type="date"
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={hasta}
                min={desde}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Agrupación</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="agg" className="text-xs text-muted-foreground">Agrupar por</label>
              <select
                id="agg"
                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={agg}
                onChange={(e) => setAgg(e.target.value as Aggregation)}
                aria-label="Seleccionar agrupación"
              >
                <option value="day">Día</option>
                <option value="week">Semana</option>
                <option value="month">Mes</option>
              </select>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-sm">Monto total pagado a clientes (CLP)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {pagosAgg ? <Money value={pagosAgg.total} /> : '—'}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" aria-label="Métricas por estado">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Estados en proceso</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {estadoCards.slice(0, 4).map((c) => (
              <Kpi key={c.key} title={c.title} value={c.value} icon={c.icon} />
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Estados finales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {estadoCards.slice(4).map((c) => (
              <Kpi key={c.key} title={c.title} value={c.value} icon={c.icon} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Evolución de pagos a clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {pagosAgg && pagosAgg.series.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pagosAgg.series} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} tickFormatter={(v) => v.toLocaleString('es-CL')} />
                    <Tooltip formatter={(value: number) => fmtCLP(value)} labelFormatter={(l) => `${l}`} />
                    <Bar dataKey="monto" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sin datos en el rango seleccionado</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function Kpi({ title, value, icon: Icon }: { title: string; value: number | React.ReactNode; icon?: LucideIcon }) {
  return (
    <Card className="hover:shadow-md transition">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{typeof value === 'number' ? value : value}</CardContent>
    </Card>
  )
}
