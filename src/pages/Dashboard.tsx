import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Money } from '@/components/common/Money'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'
import { useMemo, useState } from 'react'
import { dashboardService, type Aggregation } from '@/services/dashboardService'

import { dashboardDataMock } from '@/mocks/dashboardData'
import { FileCheck, Clock, Building2, Wallet, Bell, CheckCircle2, XCircle, LucideIcon, FileSignature, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const fmtCLP = (v: number) => v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

const ESTADO_LABELS: Record<string, string> = {
  SIMULACION_CONFIRMADA: 'Simulado',
  EN_PROCESO: 'En proceso',
  DEVOLUCION_CONFIRMADA_COMPANIA: 'Enviado',
  FONDOS_RECIBIDOS_TD: 'Aprobado',
  CLIENTE_NOTIFICADO: 'Pago programado',
  PAGADA_CLIENTE: 'Pagado',
  RECHAZADO: 'Rechazado',
  DATOS_SIN_SIMULACION: 'Datos (sin simulación)',
}

const ESTADO_COLORS: Record<string, string> = {
  SIMULACION_CONFIRMADA: 'hsl(221, 83%, 53%)', // blue
  EN_PROCESO: 'hsl(43, 96%, 56%)', // yellow
  DEVOLUCION_CONFIRMADA_COMPANIA: 'hsl(238, 56%, 58%)', // indigo
  FONDOS_RECIBIDOS_TD: 'hsl(142, 71%, 45%)', // green
  CLIENTE_NOTIFICADO: 'hsl(160, 84%, 39%)', // emerald
  PAGADA_CLIENTE: 'hsl(142, 76%, 36%)', // dark green
  RECHAZADO: 'hsl(0, 84%, 60%)', // red
  DATOS_SIN_SIMULACION: 'hsl(270, 70%, 60%)', // purple
}

const ESTADO_ICONS: Record<string, LucideIcon> = {
  SIMULACION_CONFIRMADA: FileCheck,
  EN_PROCESO: Clock,
  DEVOLUCION_CONFIRMADA_COMPANIA: Building2,
  FONDOS_RECIBIDOS_TD: Wallet,
  CLIENTE_NOTIFICADO: Bell,
  PAGADA_CLIENTE: CheckCircle2,
  RECHAZADO: XCircle,
  DATOS_SIN_SIMULACION: FileCheck,
}

// Mapeo de estados del dashboard a estados de refunds (lowercase para URL)
const DASHBOARD_TO_REFUND_STATUS: Record<string, string> = {
  SIMULACION_CONFIRMADA: 'requested',
  EN_PROCESO: 'qualifying', // Agrupa QUALIFYING, DOCS_PENDING, DOCS_RECEIVED
  DEVOLUCION_CONFIRMADA_COMPANIA: 'submitted',
  FONDOS_RECIBIDOS_TD: 'approved',
  CLIENTE_NOTIFICADO: 'payment_scheduled',
  PAGADA_CLIENTE: 'paid',
  RECHAZADO: 'rejected',
  DATOS_SIN_SIMULACION: 'datos_sin_simulacion',
}

// Helper para obtener fecha local en formato YYYY-MM-DD
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  // Rango de fechas por defecto: últimos 30 días
  const [desde, setDesde] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return toLocalDateString(d)
  })
  const [hasta, setHasta] = useState<string>(() => toLocalDateString(new Date()))
  const [agg, setAgg] = useState<Aggregation>('day')

  const { data: counts, isLoading: isLoadingCounts, isFetching: isFetchingCounts } = useQuery({
    queryKey: ['dashboard', 'counts', desde, hasta],
    queryFn: () => dashboardService.getSolicitudesPorEstado(desde, hasta),
    staleTime: 30 * 1000, // 30 segundos
    placeholderData: (previousData) => previousData,
  })

  const { data: pagosAgg, isFetching: isFetchingPagos } = useQuery({
    queryKey: ['dashboard', 'pagos-agg', desde, hasta, agg],
    queryFn: () => dashboardService.getPagosAggregate(desde, hasta, agg),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const { data: solicitudesAgg, isFetching: isFetchingSolicitudes } = useQuery({
    queryKey: ['dashboard', 'solicitudes-agg', desde, hasta, agg],
    queryFn: () => dashboardService.getSolicitudesAggregate(desde, hasta, agg),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })

  // Obtener publicIds de solicitudes para consultar estado de mandato
  const { data: solicitudesIds, isFetching: isFetchingIds } = useQuery({
    queryKey: ['dashboard', 'solicitudes-ids', desde, hasta],
    queryFn: () => dashboardService.getSolicitudesParaMandato(desde, hasta),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })

  // Query para obtener estados de mandatos de todas las solicitudes
  const { data: mandateStatuses, isFetching: isFetchingMandates } = useQuery({
    queryKey: ['dashboard', 'mandate-statuses', solicitudesIds?.join(',')],
    queryFn: async () => {
      if (!solicitudesIds || solicitudesIds.length === 0) return {}
      const statuses: Record<string, any> = {}
      await Promise.all(
        solicitudesIds.map(async (publicId: string) => {
          try {
            const response = await fetch(
              `https://tedevuelvo-app-be.onrender.com/api/v1/refund-requests/${publicId}/experian/status`
            )
            if (response.ok) {
              statuses[publicId] = await response.json()
            }
          } catch (error) {
            // Silently fail for individual requests
          }
        })
      )
      return statuses
    },
    enabled: !!solicitudesIds && solicitudesIds.length > 0,
    staleTime: 60 * 1000, // 1 minuto para mandatos
    placeholderData: (previousData) => previousData,
  })

  // Query para obtener monto total pagado con paginación paralela
  const { data: totalPaidAmount = 0, isFetching: isFetchingPaid } = useQuery({
    queryKey: ['dashboard', 'total-paid', desde, hasta],
    queryFn: () => dashboardService.getTotalPaidAmount(desde, hasta),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })

  // Estado general de carga
  const isLoading = isLoadingCounts || (isFetchingCounts && !counts)
  const isRefreshing = isFetchingCounts || isFetchingPagos || isFetchingSolicitudes || isFetchingIds || isFetchingMandates || isFetchingPaid

  // Conteo de solicitudes firmadas en proceso
  const solicitudesFirmadas = useMemo(() => {
    if (!mandateStatuses) return 0
    return Object.values(mandateStatuses).filter((s: any) => s?.hasSignedPdf === true).length
  }, [mandateStatuses])

  const estadoCards = useMemo(() => (
    [
      { key: 'DATOS_SIN_SIMULACION', color: 'purple' },
      { key: 'SIMULACION_CONFIRMADA', color: 'blue' },
      { key: 'EN_PROCESO', color: 'yellow' },
      { key: 'DEVOLUCION_CONFIRMADA_COMPANIA', color: 'indigo' },
      { key: 'FONDOS_RECIBIDOS_TD', color: 'green' },
      { key: 'CLIENTE_NOTIFICADO', color: 'emerald' },
      { key: 'PAGADA_CLIENTE', color: 'success' },
      { key: 'RECHAZADO', color: 'destructive' },
    ].map((item) => ({ 
      key: item.key, 
      title: ESTADO_LABELS[item.key], 
      value: counts?.[item.key] ?? 0,
      icon: ESTADO_ICONS[item.key],
      color: item.color,
      refundStatus: DASHBOARD_TO_REFUND_STATUS[item.key]
    }))
  ), [counts])

  const totalSolicitudes = useMemo(() => {
    if (!counts) return 0
    return Object.values(counts).reduce((sum, val) => sum + val, 0)
  }, [counts])

  const pieChartData = useMemo(() => {
    if (!counts) return []
    const total = Object.values(counts).reduce((sum, val) => sum + val, 0)
    if (total === 0) return []

    return Object.entries(ESTADO_LABELS).map(([key, label]) => ({
      name: label,
      value: counts[key] || 0,
      percentage: total > 0 ? ((counts[key] || 0) / total * 100).toFixed(1) : '0.0',
      color: ESTADO_COLORS[key]
    })).filter(item => item.value > 0)
  }, [counts])

  if (isLoading) {
    return (
      <main className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6">
        <header className="flex flex-col gap-1 sm:gap-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Cargando datos...</p>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          <Skeleton className="h-32 lg:col-span-5" />
          <Skeleton className="h-32 lg:col-span-3" />
          <Skeleton className="h-32 lg:col-span-4" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </main>
    )
  }

  return (
    <main className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6" role="main" aria-label="Panel principal del Dashboard">
      <header className="flex flex-col gap-1 sm:gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">Dashboard</h1>
          {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">KPIs por estado y evolución de pagos a clientes (CLP)</p>
      </header>

      <section aria-label="Filtros" className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        <Card className="lg:col-span-5">
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm">Rango de fechas</CardTitle>
              <div className="flex flex-wrap gap-1">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const hoy = toLocalDateString(new Date())
                    setDesde(hoy)
                    setHasta(hoy)
                  }}
                  className="h-6 text-xs px-2"
                >
                  Hoy
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const ayer = new Date()
                    ayer.setDate(ayer.getDate() - 1)
                    const ayerStr = toLocalDateString(ayer)
                    setDesde(ayerStr)
                    setHasta(ayerStr)
                  }}
                  className="h-6 text-xs px-2"
                >
                  Ayer
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const hoy = new Date()
                    const semanaAtras = new Date()
                    semanaAtras.setDate(hoy.getDate() - 7)
                    setDesde(toLocalDateString(semanaAtras))
                    setHasta(toLocalDateString(hoy))
                  }}
                  className="h-6 text-xs px-2"
                >
                  Última semana
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const hoy = new Date()
                    const mesAtras = new Date()
                    mesAtras.setMonth(hoy.getMonth() - 1)
                    setDesde(toLocalDateString(mesAtras))
                    setHasta(toLocalDateString(hoy))
                  }}
                  className="h-6 text-xs px-2"
                >
                  Último mes
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 grid grid-cols-2 gap-3">
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
        <Card className="lg:col-span-3">
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Agrupación</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
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
        <Card className="border-primary lg:col-span-5">
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Monto total pagado a clientes (CLP)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-semibold">
            <Money value={totalPaidAmount} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3 sm:space-y-4" aria-label="Métricas por estado">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2 className="text-xs sm:text-sm font-medium text-muted-foreground">Estados en proceso</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-sm font-semibold">
              Total: {totalSolicitudes} solicitudes
            </Badge>
            <Badge variant="outline" className="text-sm font-semibold flex items-center gap-1.5">
              <FileSignature className="h-3.5 w-3.5" />
              Mandatos firmados: {solicitudesFirmadas}
            </Badge>
          </div>
        </div>
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {estadoCards.slice(0, 4).map((c) => (
              <Kpi 
                key={c.key} 
                title={c.title} 
                value={c.value} 
                icon={c.icon} 
                color={c.color} 
                refundStatus={c.refundStatus}
              />
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Estados finales</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {estadoCards.slice(4).map((c) => (
              <Kpi key={c.key} title={c.title} value={c.value} icon={c.icon} color={c.color} refundStatus={c.refundStatus} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg md:text-xl">Análisis de solicitudes</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Tabs defaultValue="distribucion" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto">
                <TabsTrigger value="distribucion" className="text-xs sm:text-sm px-2 py-2">
                  <span className="hidden sm:inline">Distribución por estado</span>
                  <span className="sm:hidden">Distribución</span>
                </TabsTrigger>
                <TabsTrigger value="pagos" className="text-xs sm:text-sm px-2 py-2">
                  <span className="hidden sm:inline">Evolución de pagos</span>
                  <span className="sm:hidden">Pagos</span>
                </TabsTrigger>
                <TabsTrigger value="tendencia" className="text-xs sm:text-sm px-2 py-2">
                  <span className="hidden sm:inline">Tendencia de solicitudes</span>
                  <span className="sm:hidden">Tendencia</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="distribucion" className="mt-3 sm:mt-4">
                <div className="h-64 sm:h-72 md:h-80">
                  {pieChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                          labelLine={true}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string, props: any) => [
                            `${value} solicitudes (${props.payload.percentage}%)`,
                            props.payload.name
                          ]} 
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs sm:text-sm text-muted-foreground">
                      Sin datos en el rango seleccionado
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pagos" className="mt-3 sm:mt-4">
                <div className="h-64 sm:h-72 md:h-80">
                  {pagosAgg && pagosAgg.series.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pagosAgg.series} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} tickFormatter={(v) => v.toLocaleString('es-CL')} />
                        <Tooltip formatter={(value: number) => fmtCLP(value)} labelFormatter={(l) => `${l}`} />
                        <Bar dataKey="monto" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs sm:text-sm text-muted-foreground">
                      Sin datos en el rango seleccionado
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tendencia" className="mt-3 sm:mt-4">
                <div className="h-64 sm:h-72 md:h-80">
                  {solicitudesAgg && solicitudesAgg.series.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={solicitudesAgg.series}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip 
                          formatter={(value: number) => [`${value} solicitudes`, 'Cantidad']}
                          labelFormatter={(label) => `Período: ${label}`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="cantidad" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs sm:text-sm text-muted-foreground">
                      Sin datos en el rango seleccionado
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
         </Card>
      </section>
    </main>
  )
}

function Kpi({ title, value, icon: Icon, color, refundStatus, extraInfo }: { 
  title: string; 
  value: number | React.ReactNode; 
  icon?: LucideIcon;
  color?: string;
  refundStatus?: string;
  extraInfo?: { label: string; value: number; icon?: LucideIcon };
}) {
  const navigate = useNavigate()
  
  const handleClick = () => {
    if (refundStatus) {
      navigate(`/refunds?status=${refundStatus}`)
    }
  }
  
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 hover:shadow-blue-200/50 dark:hover:shadow-blue-900/30',
    yellow: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/50 hover:shadow-yellow-200/50 dark:hover:shadow-yellow-900/30',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 hover:shadow-indigo-200/50 dark:hover:shadow-indigo-900/30',
    green: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50 hover:shadow-green-200/50 dark:hover:shadow-green-900/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/30',
    success: 'bg-green-100 dark:bg-green-950/30 border-green-300 dark:border-green-800/50 hover:shadow-green-300/50 dark:hover:shadow-green-800/30',
    destructive: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 hover:shadow-red-200/50 dark:hover:shadow-red-900/30',
    purple: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50 hover:shadow-purple-200/50 dark:hover:shadow-purple-900/30',
  }

  const iconColorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    green: 'text-green-600 dark:text-green-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    success: 'text-green-700 dark:text-green-500',
    destructive: 'text-red-600 dark:text-red-400',
    purple: 'text-purple-600 dark:text-purple-400',
  }

  const cardClass = color ? colorClasses[color as keyof typeof colorClasses] : ''
  const iconClass = color ? iconColorClasses[color as keyof typeof iconColorClasses] : 'text-muted-foreground'

  return (
    <Card 
      className={`hover:shadow-lg transition-all duration-300 sm:hover:scale-105 ${cardClass} ${refundStatus ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4 md:p-6">
        <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
        {Icon && (
          <div className={`p-1.5 sm:p-2 rounded-lg bg-background/50 ${iconClass}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0 md:p-6 md:pt-0">
        <div className="text-2xl sm:text-3xl font-bold">{typeof value === 'number' ? value : value}</div>
        {extraInfo && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            {extraInfo.icon && <extraInfo.icon className="h-3.5 w-3.5" />}
            <span>{extraInfo.label}: <strong className="text-foreground">{extraInfo.value}</strong></span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
