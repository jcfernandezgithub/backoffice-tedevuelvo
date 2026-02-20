import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { dashboardService, type Aggregation } from '@/services/dashboardService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Money } from '@/components/common/Money'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  FileText, Clock, CheckCircle2, XCircle, Loader2, ArrowRight,
  Wallet, BanknoteIcon, FileSignature, Users, TrendingUp, AlertCircle,
  FileCheck, Inbox, Building2, ThumbsUp, CalendarCheck, CircleOff,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── helpers ────────────────────────────────────────────────────────────────
const fmtCLP = (v: number) =>
  v.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Definición de fases del flujo ──────────────────────────────────────────
const PHASES = [
  {
    id: 'captacion',
    label: 'Captación',
    color: 'violet',
    stages: [
      { key: 'datos_sin_simulacion', label: 'Datos sin simulación', sublabel: 'Lead inicial', icon: FileText, refundStatus: 'datos_sin_simulacion' },
      { key: 'simulated', label: 'Simulado', sublabel: 'Cálculo completado', icon: FileCheck, refundStatus: 'simulated' },
      { key: 'requested', label: 'Solicitado', sublabel: 'Confirmación cliente', icon: Inbox, refundStatus: 'requested' },
    ],
  },
  {
    id: 'revision',
    label: 'Revisión y Docs',
    color: 'amber',
    stages: [
      { key: 'qualifying', label: 'En calificación', sublabel: 'Revisión de analista', icon: Clock, refundStatus: 'qualifying' },
      { key: 'docs_pending', label: 'Docs. pendientes', sublabel: 'Faltan requisitos', icon: AlertCircle, refundStatus: 'docs_pending' },
      { key: 'docs_received', label: 'Docs. recibidos', sublabel: 'Carga completada', icon: FileSignature, refundStatus: 'docs_received' },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestión Bancaria',
    color: 'sky',
    stages: [
      { key: 'submitted', label: 'Ingresado', sublabel: 'Trámite en entidad', icon: Building2, refundStatus: 'submitted' },
      { key: 'approved', label: 'Aprobado', sublabel: 'Dictamen positivo', icon: ThumbsUp, refundStatus: 'approved' },
      { key: 'payment_scheduled', label: 'Pago programado', sublabel: 'Fondos en proceso', icon: CalendarCheck, refundStatus: 'payment_scheduled' },
      { key: 'paid', label: 'Pagado', sublabel: 'Proceso finalizado', icon: CheckCircle2, refundStatus: 'paid' },
    ],
  },
  {
    id: 'salida',
    label: 'Salidas',
    color: 'red',
    stages: [
      { key: 'rejected', label: 'Rechazado', sublabel: 'Entidad deniega', icon: XCircle, refundStatus: 'rejected' },
      { key: 'canceled', label: 'Cancelado', sublabel: 'Proceso cancelado', icon: CircleOff, refundStatus: 'canceled' },
    ],
  },
]

const PHASE_COLORS: Record<string, { ring: string; bg: string; text: string; badge: string; icon: string; cardHover: string }> = {
  violet: {
    ring: 'border-violet-300 dark:border-violet-700',
    bg: 'bg-violet-50 dark:bg-violet-950/20',
    text: 'text-violet-700 dark:text-violet-300',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-700',
    icon: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/40',
    cardHover: 'hover:border-violet-400 hover:shadow-violet-100 dark:hover:shadow-violet-900/20',
  },
  amber: {
    ring: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700',
    icon: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40',
    cardHover: 'hover:border-amber-400 hover:shadow-amber-100 dark:hover:shadow-amber-900/20',
  },
  sky: {
    ring: 'border-sky-300 dark:border-sky-700',
    bg: 'bg-sky-50 dark:bg-sky-950/20',
    text: 'text-sky-700 dark:text-sky-300',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-700',
    icon: 'text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/40',
    cardHover: 'hover:border-sky-400 hover:shadow-sky-100 dark:hover:shadow-sky-900/20',
  },
  red: {
    ring: 'border-red-300 dark:border-red-700',
    bg: 'bg-red-50 dark:bg-red-950/20',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-700',
    icon: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40',
    cardHover: 'hover:border-red-400 hover:shadow-red-100 dark:hover:shadow-red-900/20',
  },
}

const PIE_COLORS = [
  'hsl(262,83%,58%)', // violet
  'hsl(258,70%,60%)',
  'hsl(45,96%,56%)',  // amber
  'hsl(38,92%,50%)',
  'hsl(201,98%,41%)', // sky
  'hsl(199,89%,48%)',
  'hsl(173,80%,40%)',
  'hsl(142,71%,45%)', // green
  'hsl(0,84%,60%)',   // red
  'hsl(0,72%,51%)',
]

// ─── Componente principal ────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()

  const [desde, setDesde] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return toLocalDateString(d)
  })
  const [hasta, setHasta] = useState<string>(() => toLocalDateString(new Date()))
  const [agg, setAgg] = useState<Aggregation>('day')

  // ── Queries ──
  const { data: granularCounts, isLoading: isLoadingCounts, isFetching: isFetchingCounts } = useQuery({
    queryKey: ['dashboard', 'granular', desde, hasta],
    queryFn: () => dashboardService.getSolicitudesPorEstadoGranular(desde, hasta),
    staleTime: 30_000,
    retry: 3,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 10_000),
  })

  const { data: totalPaidAmount = 0, isFetching: isFetchingPaid } = useQuery({
    queryKey: ['dashboard', 'total-paid', desde, hasta],
    queryFn: () => dashboardService.getTotalPaidAmount(desde, hasta),
    staleTime: 30_000,
    retry: 3,
  })

  const { data: pagosAgg, isFetching: isFetchingPagos } = useQuery({
    queryKey: ['dashboard', 'pagos-agg', desde, hasta, agg],
    queryFn: () => dashboardService.getPagosAggregate(desde, hasta, agg),
    staleTime: 30_000,
    retry: 3,
  })

  const { data: solicitudesAgg, isFetching: isFetchingSolicitudes } = useQuery({
    queryKey: ['dashboard', 'solicitudes-agg', desde, hasta, agg],
    queryFn: () => dashboardService.getSolicitudesAggregate(desde, hasta, agg),
    staleTime: 30_000,
    retry: 3,
  })

  const { data: solicitudesIds } = useQuery({
    queryKey: ['dashboard', 'solicitudes-ids', desde, hasta],
    queryFn: () => dashboardService.getSolicitudesParaMandato(desde, hasta),
    staleTime: 30_000,
    retry: 3,
  })

  const { data: mandateStatuses, isFetching: isFetchingMandates } = useQuery({
    queryKey: ['dashboard', 'mandate-statuses', solicitudesIds?.join(',')],
    queryFn: async () => {
      if (!solicitudesIds || solicitudesIds.length === 0) return {}
      const statuses: Record<string, any> = {}
      await Promise.all(
        solicitudesIds.map(async (publicId: string) => {
          try {
            const res = await fetch(
              `https://tedevuelvo-app-be.onrender.com/api/v1/refund-requests/${publicId}/experian/status`
            )
            if (res.ok) statuses[publicId] = await res.json()
          } catch { /* silencioso */ }
        })
      )
      return statuses
    },
    enabled: !!solicitudesIds && solicitudesIds.length > 0,
    staleTime: 60_000,
    retry: 2,
  })

  const isRefreshing = isFetchingCounts || isFetchingPaid || isFetchingPagos || isFetchingSolicitudes || isFetchingMandates

  // ── Métricas derivadas ──
  const totalSolicitudes = useMemo(() => {
    if (!granularCounts) return 0
    return Object.values(granularCounts).reduce((s, v) => s + v, 0)
  }, [granularCounts])

  const solicitudesFirmadas = useMemo(() => {
    if (!mandateStatuses) return 0
    return Object.values(mandateStatuses).filter((s: any) => s?.hasSignedPdf === true).length
  }, [mandateStatuses])

  const paidCount = granularCounts?.paid ?? 0
  const rejectedCount = (granularCounts?.rejected ?? 0) + (granularCounts?.canceled ?? 0)
  const inProgressCount = (granularCounts?.qualifying ?? 0) +
    (granularCounts?.docs_pending ?? 0) +
    (granularCounts?.docs_received ?? 0) +
    (granularCounts?.submitted ?? 0) +
    (granularCounts?.approved ?? 0) +
    (granularCounts?.payment_scheduled ?? 0)

  const conversionRate = useMemo(() => {
    const base = totalSolicitudes - (granularCounts?.datos_sin_simulacion ?? 0)
    if (!base) return 0
    return Math.round((paidCount / base) * 100)
  }, [paidCount, totalSolicitudes, granularCounts])

  // Pie chart data
  const pieData = useMemo(() => {
    if (!granularCounts) return []
    const labels: Record<string, string> = {
      datos_sin_simulacion: 'Sin simulación',
      simulated: 'Simulado',
      requested: 'Solicitado',
      qualifying: 'En calificación',
      docs_pending: 'Docs. pendientes',
      docs_received: 'Docs. recibidos',
      submitted: 'Ingresado',
      approved: 'Aprobado',
      payment_scheduled: 'Pago programado',
      paid: 'Pagado',
      rejected: 'Rechazado',
      canceled: 'Cancelado',
    }
    return Object.entries(granularCounts)
      .filter(([, v]) => v > 0)
      .map(([k, v], i) => ({
        name: labels[k] ?? k,
        value: v,
        pct: totalSolicitudes > 0 ? ((v / totalSolicitudes) * 100).toFixed(1) : '0',
        color: PIE_COLORS[i % PIE_COLORS.length],
      }))
  }, [granularCounts, totalSolicitudes])

  // ── Navegación al hacer clic en una card ──
  const goToRefunds = (refundStatus: string) => {
    const p = new URLSearchParams()
    p.set('status', refundStatus)
    p.set('autoSearch', 'true')
    p.set('from', desde)
    p.set('to', hasta)
    navigate(`/refunds?${p.toString()}`)
  }

  // ── Preset de fechas ──
  const applyPreset = (days: number | 'month') => {
    const hoy = new Date()
    if (days === 'month') {
      setDesde(toLocalDateString(new Date(hoy.getFullYear(), hoy.getMonth(), 1)))
      setHasta(toLocalDateString(hoy))
    } else {
      const from = new Date()
      from.setDate(hoy.getDate() - days)
      setDesde(toLocalDateString(from))
      setHasta(toLocalDateString(hoy))
    }
  }

  if (isLoadingCounts) {
    return (
      <main className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </main>
    )
  }

  return (
    <main className="p-3 sm:p-4 md:p-6 space-y-6" role="main">

      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Vista general del producto · todas las etapas del flujo</p>
          </div>
          {isRefreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Controles de fecha */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex flex-wrap gap-1">
            {[
              { label: 'Hoy', action: () => { const h = toLocalDateString(new Date()); setDesde(h); setHasta(h) } },
              { label: '7 días', action: () => applyPreset(7) },
              { label: 'Este mes', action: () => applyPreset('month') },
              { label: '30 días', action: () => applyPreset(30) },
            ].map(p => (
              <Button key={p.label} variant="outline" size="sm" className="h-7 text-xs px-2" onClick={p.action}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">Desde</label>
              <input
                type="date" value={desde} max={hasta}
                onChange={e => setDesde(e.target.value)}
                className="h-7 rounded border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-muted-foreground">Hasta</label>
              <input
                type="date" value={hasta} min={desde}
                onChange={e => setHasta(e.target.value)}
                className="h-7 rounded border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>
      </header>

      {/* ── KPIs de resumen ── */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3" aria-label="Resumen general">
        <SummaryKpi
          label="Total solicitudes"
          value={totalSolicitudes}
          icon={Users}
          className="border-border"
        />
        <SummaryKpi
          label="En proceso"
          value={inProgressCount}
          icon={Clock}
          className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
          valueClass="text-amber-700 dark:text-amber-300"
        />
        <SummaryKpi
          label="Pagados"
          value={paidCount}
          icon={CheckCircle2}
          className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20"
          valueClass="text-emerald-700 dark:text-emerald-300"
        />
        <SummaryKpi
          label="Tasa de éxito"
          value={`${conversionRate}%`}
          icon={TrendingUp}
          className="border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/20"
          valueClass="text-sky-700 dark:text-sky-300"
        />
        <SummaryKpi
          label="Monto pagado"
          value={<Money value={totalPaidAmount} />}
          icon={Wallet}
          className="col-span-2 md:col-span-1 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20"
          valueClass="text-violet-700 dark:text-violet-300 text-lg"
        />
      </section>

      {/* ── Pipeline de etapas ── */}
      <section aria-label="Pipeline de solicitudes">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pipeline de solicitudes</h2>
          <Badge variant="secondary" className="text-xs gap-1.5">
            <FileSignature className="h-3 w-3" />
            Mandatos firmados: {solicitudesFirmadas}
          </Badge>
        </div>

        <div className="space-y-4">
          {PHASES.map((phase, phaseIdx) => {
            const colors = PHASE_COLORS[phase.color]
            const phaseTotal = phase.stages.reduce((s, st) => s + (granularCounts?.[st.key] ?? 0), 0)

            return (
              <div key={phase.id} className={`rounded-xl border ${colors.ring} ${colors.bg} p-4`}>
                {/* Cabecera de fase */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${colors.badge}`}>
                    {String(phaseIdx + 1).padStart(2, '0')} {phase.label}
                  </span>
                  <span className={`text-xs font-semibold ${colors.text}`}>{phaseTotal} solicitudes</span>
                </div>

                {/* Grid de etapas */}
                <div className="flex flex-wrap gap-2">
                  {phase.stages.map((stage, stageIdx) => {
                    const count = granularCounts?.[stage.key] ?? 0
                    const IconComp = stage.icon
                    const isLast = stageIdx === phase.stages.length - 1
                    return (
                      <div key={stage.key} className="flex items-center gap-2">
                        <button
                          onClick={() => goToRefunds(stage.refundStatus)}
                          className={`
                            group flex items-center gap-3 rounded-lg border bg-background/80 p-3
                            hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
                            ${colors.cardHover} cursor-pointer min-w-[140px]
                          `}
                          title={`Ver solicitudes: ${stage.label}`}
                        >
                          <div className={`p-2 rounded-lg ${colors.icon} flex-shrink-0`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div className="text-left min-w-0">
                            <p className="text-xs text-muted-foreground leading-none truncate">{stage.label}</p>
                            <p className="text-2xl font-bold leading-tight">{count}</p>
                            <p className="text-[10px] text-muted-foreground/70 truncate">{stage.sublabel}</p>
                          </div>
                        </button>
                        {!isLast && (
                          <ArrowRight className={`h-4 w-4 flex-shrink-0 ${colors.text} opacity-50`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Gráficos ── */}
      <section>
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg">Análisis temporal</CardTitle>
              <div className="flex gap-1">
                {(['day', 'week', 'month'] as const).map(g => (
                  <Button
                    key={g}
                    variant={agg === g ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setAgg(g)}
                  >
                    {{ day: 'Día', week: 'Semana', month: 'Mes' }[g]}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Tabs defaultValue="solicitudes">
              <TabsList className="grid w-full grid-cols-3 h-8 text-xs">
                <TabsTrigger value="solicitudes" className="text-xs">Solicitudes</TabsTrigger>
                <TabsTrigger value="pagos" className="text-xs">Montos pagados</TabsTrigger>
                <TabsTrigger value="distribucion" className="text-xs">Distribución</TabsTrigger>
              </TabsList>

              <TabsContent value="solicitudes" className="mt-4">
                <div className="h-64">
                  {solicitudesAgg && solicitudesAgg.series.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={solicitudesAgg.series} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={55} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(v: number) => [`${v} solicitudes`, 'Cantidad']}
                          labelFormatter={l => `Período: ${l}`}
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        />
                        <Bar dataKey="cantidad" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pagos" className="mt-4">
                <div className="h-64">
                  {pagosAgg && pagosAgg.series.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pagosAgg.series} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={55} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => (v / 1_000_000).toFixed(1) + 'M'} />
                        <Tooltip
                          formatter={(v: number) => [fmtCLP(v), 'Monto']}
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        />
                        <Bar dataKey="monto" fill="hsl(142,71%,45%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="distribucion" className="mt-4">
                <div className="h-64">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%" cy="50%"
                          innerRadius={55} outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={false}
                          labelLine={false}
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const d = payload[0].payload
                            return (
                              <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                                <p className="font-semibold">{d.name}</p>
                                <p className="text-muted-foreground">{d.value} solicitudes · {d.pct}%</p>
                              </div>
                            )
                          }}
                        />
                        <Legend
                          layout="horizontal" verticalAlign="bottom" align="center"
                          wrapperStyle={{ fontSize: '10px', paddingTop: '12px' }}
                          formatter={(_, entry: any) => (
                            <span className="text-xs">{entry.payload.name} ({entry.payload.pct}%)</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
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

// ── Sub-componentes ──────────────────────────────────────────────────────────

function SummaryKpi({
  label, value, icon: Icon, className = '', valueClass = '',
}: {
  label: string
  value: number | string | React.ReactNode
  icon: React.ElementType
  className?: string
  valueClass?: string
}) {
  return (
    <Card className={`border ${className}`}>
      <CardContent className="p-3 sm:p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className={`text-xl sm:text-2xl font-bold ${valueClass}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      Sin datos en el rango seleccionado
    </div>
  )
}
