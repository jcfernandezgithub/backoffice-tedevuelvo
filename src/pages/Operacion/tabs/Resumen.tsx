import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { useFilters } from '../hooks/useFilters';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSerieTemporal } from '../hooks/useReportsData';
import { useDashboardCounts, metricTotal, metricObj } from '../hooks/useDashboardCounts';
import { useFinancialSummary, pickNumber } from '../hooks/useFinancialSummary';
import { useRequestsTimeseries, useStatusDistribution } from '../hooks/useDashboardCharts';
import { readStageObjectives } from '@/hooks/useStageObjectives';
import type { Granularidad } from '../types/reportTypes';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { 
  ClipboardCheck, 
  FileCheck2,
  FileInput, 
  CheckCircle2, 
  XCircle, 
  CalendarClock, 
  Banknote,
  PieChart as PieChartIcon,
  BarChart3,
  Zap,
  Info,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InstitutionBreakdownSheet } from '../components/InstitutionBreakdownSheet';

// Colores que coinciden con las calugas KPI
const ESTADO_COLORS: Record<string, string> = {
  'Sin Simulación': 'hsl(215, 16%, 65%)',      // slate-400
  'Simulada': 'hsl(199, 89%, 60%)',            // sky-500
  'Solicitada': 'hsl(217, 91%, 68%)',          // blue-400
  'En Calificación': 'hsl(43, 96%, 56%)',      // amber-500
  'Documentos Pendientes': 'hsl(31, 91%, 62%)',// orange-500
  'Documentos Recibidos': 'hsl(271, 91%, 65%)',// violet-500
  'Docs Recibidos': 'hsl(271, 91%, 65%)',      // violet-500
  'Ingresada': 'hsl(239, 84%, 67%)',           // indigo-500
  'Ingresadas': 'hsl(239, 84%, 67%)',          // indigo-500
  'Aprobada': 'hsl(142, 71%, 45%)',            // green-500
  'Aprobadas': 'hsl(142, 71%, 45%)',           // green-500
  'Rechazada': 'hsl(0, 84%, 60%)',             // red-500
  'Rechazadas': 'hsl(0, 84%, 60%)',            // red-500
  'Pago Programado': 'hsl(187, 92%, 69%)',     // cyan-400
  'Pagada Cliente': 'hsl(160, 84%, 39%)',      // emerald-600
  'Pagadas': 'hsl(160, 84%, 39%)',             // emerald-600
  'Cancelada': 'hsl(0, 0%, 55%)',              // gray
};

// Fallback por status enum (por si el label difiere del esperado)
const ESTADO_COLORS_BY_STATUS: Record<string, string> = {
  datos_sin_simulacion: 'hsl(215, 16%, 65%)',
  simulated: 'hsl(199, 89%, 60%)',
  requested: 'hsl(217, 91%, 68%)',
  qualifying: 'hsl(43, 96%, 56%)',
  docs_pending: 'hsl(31, 91%, 62%)',
  docs_received: 'hsl(271, 91%, 65%)',
  submitted: 'hsl(239, 84%, 67%)',
  approved: 'hsl(142, 71%, 45%)',
  rejected: 'hsl(0, 84%, 60%)',
  payment_scheduled: 'hsl(187, 92%, 69%)',
  paid: 'hsl(160, 84%, 39%)',
  canceled: 'hsl(0, 0%, 55%)',
};

// Etiquetas amigables cuando el API entrega el enum crudo
const STATUS_FRIENDLY_LABEL: Record<string, string> = {
  DATOS_SIN_SIMULACION: 'Sin Simulación',
};

/** Tooltip enriquecido para el gráfico de distribución por estado. */
function StatusDistTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const color =
    ESTADO_COLORS[p.categoria] || ESTADO_COLORS_BY_STATUS[p.status] || '#8884d8';
  return (
    <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
        <span className="font-semibold text-sm">{p.categoria}</span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Cantidad</span>
          <span className="font-semibold tabular-nums">
            {p.valor.toLocaleString('es-CL')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Participación</span>
          <span className="font-semibold tabular-nums">
            {p.porcentaje?.toFixed(1) ?? '0.0'}%
          </span>
        </div>
        {typeof p.monto === 'number' && p.monto > 0 && (
          <div className="flex items-center justify-between gap-4 pt-1 border-t">
            <span className="text-muted-foreground">Monto estimado</span>
            <span className="font-semibold tabular-nums">
              {new Intl.NumberFormat('es-CL', {
                style: 'currency',
                currency: 'CLP',
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(p.monto)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Badge compacto de alerta de tiempo excedido para las calugas del pipeline */
function OverdueBadge({ count, stageLabel, objetivo }: { count: number; stageLabel: string; objetivo?: number }) {
  if (!count) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <UITooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 animate-pulse cursor-default">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 tabular-nums">{count}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px]">
          <p className="text-xs">
            <strong>{count}</strong> solicitud{count !== 1 ? 'es' : ''} en "{stageLabel}" {objetivo ? `superan los ${objetivo} días objetivo` : 'superan el tiempo objetivo'}.
          </p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

export function TabResumen() {
  const { filtros } = useFilters();
  const navigate = useNavigate();
  const [granularidad, setGranularidad] = useState<Granularidad>('week');
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [submittedBreakdownOpen, setSubmittedBreakdownOpen] = useState(false);

  // Helper para construir URL con filtros de fecha incluidos
  const buildRefundsUrl = (params: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    // Siempre incluir las fechas del filtro actual para consistencia
    if (filtros.fechaDesde) searchParams.set('from', filtros.fechaDesde);
    if (filtros.fechaHasta) searchParams.set('to', filtros.fechaHasta);
    searchParams.set('autoSearch', 'true');
    // Alinear el conteo del listado con la caluga: solo solicitudes que ACTUALMENTE
    // están en el estado seleccionado Y transicionaron a él dentro del rango.
    searchParams.set('currentStatusOnly', 'true');
    return `/refunds?${searchParams.toString()}`;
  };

  // ── Gráficos alimentados por endpoints del Dashboard (filtran por updatedAt) ─
  const { data: timeseriesData, isLoading: loadingTimeseries } = useRequestsTimeseries({
    since: filtros.fechaDesde,
    to: filtros.fechaHasta,
    granularity: granularidad,
  });
  const { data: statusDistData, isLoading: loadingStatusDist } = useStatusDistribution({
    since: filtros.fechaDesde,
    to: filtros.fechaHasta,
  });

  // NOTA: Esta pestaña ya no consume /admin/listV2. Todas las cifras se
  // alimentan directamente de los endpoints agregados del dashboard:
  //   • /dashboard/counts, /dashboard/financial-summary,
  //   • /dashboard/requests-timeseries, /dashboard/status-distribution.

  // ── Conteos del dashboard desde el endpoint dedicado ─────────────────────────
  // Las calugas SOLO leen de este endpoint — no hay cálculos del lado cliente.
  const { data: countsData, isLoading: loadingCounts } = useDashboardCounts({
    since: filtros.fechaDesde,
    to: filtros.fechaHasta,
  });

  // ── Resumen Financiero: alimentado exclusivamente por /v2/dashboard/financial-summary ──
  const { data: financialSummary, isLoading: loadingFinancial } = useFinancialSummary({
    since: filtros.fechaDesde,
    to: filtros.fechaHasta,
  });

  // La respuesta viene como { totalToPayClients: { amount, count, description }, ... }
  // Mantenemos fallbacks a los nombres planos anteriores por compatibilidad.
  const fs: any = financialSummary || {};
  const finToPayAmount = Number(fs.totalToPayClients?.amount ?? fs.totalToPay ?? fs.scheduledPaymentAmount ?? fs.toPayAmount ?? 0);
  const finToPayCount = Number(fs.totalToPayClients?.count ?? fs.scheduledCount ?? fs.scheduledPaymentCount ?? 0);
  const finToPayDescription: string | undefined = fs.totalToPayClients?.description;
  const finToPayTitle: string = fs.totalToPayClients?.title ?? 'Monto Total a Pagar a Clientes';
  const finScheduledPremiumAmount = Number(fs.totalScheduledPremium?.amount ?? fs.totalScheduledPremiumAmount ?? 0);
  const finScheduledPremiumCount = Number(fs.totalScheduledPremium?.count ?? fs.totalScheduledPremiumCount ?? 0);
  const finScheduledPremiumDescription: string | undefined = fs.totalScheduledPremium?.description;
  const finScheduledPremiumTitle: string = fs.totalScheduledPremium?.title ?? 'Monto Total Primas';
  const finSubmittedSavingAmount = Number(fs.totalSubmittedSaving?.amount ?? fs.totalSubmittedSavingAmount ?? 0);
  const finSubmittedSavingCount = Number(fs.totalSubmittedSaving?.count ?? fs.totalSubmittedSavingCount ?? 0);
  const finSubmittedSavingDescription: string | undefined = fs.totalSubmittedSaving?.description;
  const finSubmittedSavingTitle: string = fs.totalSubmittedSaving?.title ?? 'Monto Total Solicitado';
  const finSubmittedPremiumAmount = Number(fs.totalSubmittedPremium?.amount ?? fs.totalSubmittedPremiumAmount ?? 0);
  const finSubmittedPremiumCount = Number(fs.totalSubmittedPremium?.count ?? fs.totalSubmittedPremiumCount ?? 0);
  const finSubmittedPremiumDescription: string | undefined = fs.totalSubmittedPremium?.description;
  const finSubmittedPremiumTitle: string = fs.totalSubmittedPremium?.title ?? 'Monto Total Estimado de Primas por Emitir';

  const finPaidAmount = Number(fs.totalPaidClients?.amount ?? fs.totalPaid ?? fs.paidAmount ?? 0);
  const finPaidCount = Number(fs.totalPaidClients?.count ?? fs.paidCount ?? 0);
  const finPaidDescription: string | undefined = fs.totalPaidClients?.description;
  const finPaidTitle: string = fs.totalPaidClients?.title ?? 'Monto Total Pagado a Clientes';
  const finPremium = Number(fs.totalIssuedPremium?.amount ?? fs.totalPremium ?? fs.emittedPremium ?? fs.premiumAmount ?? 0);
  const finPremiumDescription: string | undefined = fs.totalIssuedPremium?.description;
  const finPremiumTitle: string = fs.totalIssuedPremium?.title ?? 'Prima Total Emitida';


  const c = useMemo(() => {
    const qualification = metricObj(countsData?.qualification);
    const documentsReceived = metricObj(countsData?.documentsReceived);
    const entered = metricObj(countsData?.entered);
    const approved = metricObj(countsData?.approved);
    const rejected = metricObj(countsData?.rejected);
    const scheduledPayment = metricObj(countsData?.scheduledPayment);
    const paid = metricObj(countsData?.paid);
    return {
      qualification: {
        total: metricTotal(countsData?.qualification),
        signed: qualification.signed ?? 0,
        pending: qualification.pending ?? 0,
        overdue: qualification.overdue ?? 0,
      },
      documentsReceived: {
        total: metricTotal(countsData?.documentsReceived),
        overdue: documentsReceived.overdue ?? 0,
      },
      entered: {
        total: metricTotal(countsData?.entered),
        overdue: entered.overdue ?? 0,
        byInstitution: (entered.byInstitution ?? [])
          .map((it) => {
            const rawId = it.institutionId ?? it.institution ?? it.name ?? it.displayName;
            const id = rawId != null ? String(rawId) : '';
            const name = it.displayName ?? it.name ?? it.institution;
            return {
              institutionId: id,
              displayName: name && String(name).trim() ? String(name) : id,
              count: it.count ?? it.total ?? 0,
              overdueCount: it.overdueCount ?? it.alert ?? 0,
            };
          })
          .filter((it) => it.institutionId && it.displayName),
      },
      approved: {
        total: metricTotal(countsData?.approved),
        overdue: approved.overdue ?? 0,
      },
      rejected: {
        total: metricTotal(countsData?.rejected),
      },
      scheduledPayment: {
        total: metricTotal(countsData?.scheduledPayment),
        withBank: scheduledPayment.withBank ?? scheduledPayment.transferPending ?? 0,
        withoutBank: scheduledPayment.withoutBank ?? scheduledPayment.missingTransferData ?? 0,
        overdue: scheduledPayment.overdue ?? 0,
      },
      paid: {
        total: metricTotal(countsData?.paid),
        overdue: paid.overdue ?? 0,
      },
    };
  }, [countsData]);

  const procesoOperativoTotalCounts =
    c.documentsReceived.total +
    c.entered.total +
    c.approved.total +
    c.scheduledPayment.total +
    c.paid.total;

  // Mapa de objetivos por etapa (para el badge de tiempo excedido y el sheet).
  // El conteo excedido lo aporta el propio endpoint counts en el futuro; aquí
  // sólo necesitamos el "objetivo" configurado para cada etapa.
  const stageObjectives = readStageObjectives();
  const overdueByStage = useMemo(() => {
    const map: Record<string, { objetivo: number }> = {};
    stageObjectives.forEach((o) => {
      map[o.key] = { objetivo: o.objetivo || 0 };
    });
    return map;
  }, [stageObjectives]);

  // Mapear serie del API al formato de TimeSeriesChart, exponiendo las 3 métricas
  // para que el modo `combined` renderice barras (cantidad) + líneas (montos).
  const timeseriesChartData = (timeseriesData?.series ?? []).map((b) => ({
    fecha: b.bucketStart,
    bucketLabel: b.bucketLabel,
    valor: b.count,
    count: b.count,
    estimatedAmount: b.estimatedAmount,
    paidAmount: b.paidAmount,
  }));
  const timeseriesTotals = timeseriesData?.totals;

  // Distribución por estado desde el endpoint /dashboard/status-distribution.
  // Se normalizan etiquetas (ej. DATOS_SIN_SIMULACION → "Sin Simulación") y se
  // ordena descendente para una lectura más natural en el gráfico de barras.
  const distribucionEstado = useMemo(() => {
    const items = statusDistData?.items ?? [];
    return items
      .map((it) => ({
        categoria: STATUS_FRIENDLY_LABEL[it.status] || it.label,
        status: it.status,
        valor: it.count,
        porcentaje: it.percentage,
        monto: it.estimatedAmount,
      }))
      .filter((item) => item.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [statusDistData]);
  const distribucionTotal = statusDistData?.total ?? 0;

  return (
    <div className="space-y-6">

      {/* ── Caluga destacada: Proceso Operativo ────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pipeline de Solicitudes</h2>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Banner Proceso Operativo */}
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <div
                className="relative mb-4 rounded-2xl overflow-hidden cursor-default select-none"
                style={{
                  background: 'linear-gradient(135deg, hsl(221,83%,53%) 0%, hsl(262,83%,58%) 50%, hsl(221,83%,53%) 100%)',
                  backgroundSize: '200% 200%',
                  boxShadow: '0 8px 32px hsla(221,83%,53%,0.35), 0 2px 8px hsla(262,83%,58%,0.2)',
                }}
              >
                {/* Puntos decorativos de fondo */}
                <div className="absolute inset-0 opacity-[0.07]" style={{
                  backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
                  backgroundSize: '28px 28px',
                }} />

                <div className="relative flex flex-col md:flex-row md:items-center md:justify-between px-4 py-4 sm:px-6 gap-4 md:gap-6">
                  {/* Lado izquierdo: icono + título */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex-shrink-0">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-sm sm:text-base leading-none">En Proceso Operativo</p>
                        <Info className="h-3.5 w-3.5 text-white/60" />
                      </div>
                      <p className="text-white/70 text-[11px] sm:text-xs mt-1 truncate">
                        Docs Recibidos · Ingresadas · Aprobadas · Pago Programado · Pagadas
                      </p>
                    </div>
                  </div>

                  {/* Lado derecho: desglose + número principal */}
                  <div className="flex items-center justify-between md:justify-end gap-4 sm:gap-6 flex-wrap md:flex-nowrap">
                    {/* Desglose compacto */}
                    <div className="hidden md:flex items-center gap-2 flex-wrap">
                      {[
                        { label: 'Docs', count: c.documentsReceived.total },
                        { label: 'Ingresadas', count: c.entered.total },
                        { label: 'Aprobadas', count: c.approved.total },
                        { label: 'Pago Prog.', count: c.scheduledPayment.total },
                        { label: 'Pagadas', count: c.paid.total },
                      ].map(({ label, count }) => (
                        <div key={label} className="flex flex-col items-center px-2.5 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm">
                          <span className="text-white font-bold text-lg leading-none">{count}</span>
                          <span className="text-white/65 text-[10px] mt-0.5 whitespace-nowrap">{label}</span>
                        </div>
                      ))}
                      <div className="w-px h-8 bg-white/25 mx-1" />
                    </div>

                    {/* Total grande */}
                    <div
                      className="text-right flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity ml-auto"
                      onClick={() => navigate(buildRefundsUrl({ status: 'docs_received,submitted,approved,payment_scheduled,paid' }))}
                    >
                      <div className="text-white font-black text-3xl sm:text-4xl leading-none tabular-nums">
                        {procesoOperativoTotalCounts.toLocaleString('es-CL')}
                      </div>
                      <div className="text-white/60 text-xs mt-1 underline underline-offset-2">solicitudes</div>
                    </div>
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[340px] p-4">
              <p className="font-bold text-sm mb-2 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-primary" />
                ¿Qué es "En Proceso Operativo"?
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Representa la <strong>venta potencial del período</strong>: todas las solicitudes que ya superaron la calificación inicial y están activamente avanzando en el proceso.
              </p>
              <div className="space-y-1.5 text-xs">
                {[
                  { label: 'Documentos Recibidos', desc: 'Listos para ingresar al banco', count: c.documentsReceived.total },
                  { label: 'Ingresadas', desc: 'En evaluación bancaria', count: c.entered.total },
                  { label: 'Aprobadas', desc: 'Banco aprobó la devolución', count: c.approved.total },
                  { label: 'Pago Programado', desc: 'Con fecha de transferencia asignada', count: c.scheduledPayment.total },
                  { label: 'Pagadas', desc: 'Devolución completada', count: c.paid.total },
                ].map(({ label, desc, count }) => (
                  <div key={label} className="flex items-center justify-between gap-3">
                    <div>
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground/70 ml-1">— {desc}</span>
                    </div>
                    <span className="font-bold tabular-nums">{count}</span>
                  </div>
                ))}
                <div className="border-t border-border mt-2 pt-2 flex items-center justify-between font-bold">
                  <span>Total Proceso Operativo</span>
                  <span className="text-primary">{procesoOperativoTotalCounts}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-3 italic">
                * No incluye solicitudes en calificación ni rechazadas, ya que aún no han entrado al proceso activo.
              </p>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingCounts ? (
          <>
            {Array.from({ length: 7 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-full" />
                  {i === 0 && <Skeleton className="h-3 w-1/2 mt-2" />}
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            {/* Card: Solicitudes en Calificación - con sub-filtros clickeables */}
            <Card className="border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Solicitudes en Calificación
                  </CardTitle>
                  <ClipboardCheck className="h-5 w-5 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  className="text-3xl font-bold text-amber-700 dark:text-amber-400 cursor-pointer hover:underline"
                  onClick={() => navigate(buildRefundsUrl({ status: 'qualifying' }))}
                >
                  {c.qualification.total}
                </div>
                <div className="flex gap-4 mt-3">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(buildRefundsUrl({ status: 'qualifying', mandate: 'signed' }))}
                  >
                    <Badge variant="default" className="bg-green-600">Firmado</Badge>
                    <span className="font-semibold">{c.qualification.signed}</span>
                  </div>
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(buildRefundsUrl({ status: 'qualifying', mandate: 'pending' }))}
                  >
                    <Badge variant="secondary">Pendiente</Badge>
                    <span className="font-semibold">{c.qualification.pending}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card: Documentos Recibidos */}
            <Card 
              className={`border-l-4 cursor-pointer transition-all ${
                c.documentsReceived.total >= 1
                  ? 'border-l-orange-500 bg-orange-50/40 dark:bg-orange-950/15 hover:shadow-lg ring-1 ring-orange-300 dark:ring-orange-700'
                  : 'border-l-violet-500 bg-violet-50/30 dark:bg-violet-950/10 hover:shadow-md'
              }`}
              onClick={() => navigate(buildRefundsUrl({ status: 'docs_received' }))}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Documentos Recibidos
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {c.documentsReceived.total >= 1 && (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                      </span>
                    )}
                    <FileCheck2 className={`h-5 w-5 ${c.documentsReceived.total >= 1 ? 'text-orange-500' : 'text-violet-500'}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-bold ${c.documentsReceived.total >= 1 ? 'text-orange-700 dark:text-orange-400' : 'text-violet-700 dark:text-violet-400'}`}>
                    {c.documentsReceived.total}
                  </span>
                  <OverdueBadge count={c.documentsReceived.overdue} stageLabel="Docs Recibidos" objetivo={overdueByStage.docs_received?.objetivo} />
                </div>
                <p className={`text-xs mt-1 font-medium ${c.documentsReceived.total >= 1 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                  {c.documentsReceived.total >= 1 ? '⚠ Acción requerida · Ingresar al banco' : 'Listos para ingresar al banco'}
                </p>
              </CardContent>
            </Card>

            {/* Card: Solicitudes Ingresadas */}
            {(() => {
              const submittedObjetivo = overdueByStage.submitted?.objetivo;
              const breakdown = c.entered.byInstitution;
              const topInstitutions = [...breakdown].sort((a, b) => b.count - a.count).slice(0, 3);
              const restCount = breakdown.length - topInstitutions.length;
              const maxCount = topInstitutions[0]?.count || 1;
              return (
                <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/10 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => navigate(buildRefundsUrl({ status: 'submitted' }))}
                    >
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Solicitudes Ingresadas
                      </CardTitle>
                      <FileInput className="h-5 w-5 text-indigo-500" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => navigate(buildRefundsUrl({ status: 'submitted' }))}
                    >
                      <span className="text-3xl font-bold text-indigo-700 dark:text-indigo-400">
                        {c.entered.total}
                      </span>
                      <OverdueBadge
                        count={c.entered.overdue}
                        stageLabel="Ingresadas"
                        objetivo={submittedObjetivo}
                      />
                    </div>

                    {topInstitutions.length > 0 && (
                      <>
                        <div className="mt-3 pt-3 border-t border-indigo-200/50 dark:border-indigo-800/30 space-y-1.5">
                          {topInstitutions.map((inst) => {
                            const widthPct = Math.max(8, (inst.count / maxCount) * 100);
                            return (
                              <button
                                key={inst.institutionId}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    buildRefundsUrl({
                                      status: 'submitted',
                                      institution: inst.institutionId,
                                    }),
                                  );
                                }}
                                className="w-full group"
                                title={`${inst.displayName} — ${inst.count} solicitudes${
                                  inst.overdueCount ? ` · ${inst.overdueCount} excedidas` : ''
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-xs mb-0.5">
                                  <span className="truncate text-foreground/80 group-hover:text-foreground font-medium max-w-[60%]">
                                    {inst.displayName}
                                  </span>
                                  <span className="flex items-center gap-1.5 tabular-nums">
                                    {inst.overdueCount > 0 && (
                                      <span className="inline-flex items-center gap-0.5 text-destructive">
                                        <AlertTriangle className="h-3 w-3" />
                                        {inst.overdueCount}
                                      </span>
                                    )}
                                    <span className="font-bold text-indigo-700 dark:text-indigo-400">
                                      {inst.count}
                                    </span>
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500 rounded-full transition-all group-hover:bg-indigo-600"
                                    style={{ width: `${widthPct}%` }}
                                  />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubmittedBreakdownOpen(true);
                          }}
                          className="mt-2 w-full text-xs text-indigo-600 dark:text-indigo-400 hover:underline text-left"
                        >
                          {restCount > 0
                            ? `+ ${restCount} institución${restCount === 1 ? '' : 'es'} más · Ver desglose →`
                            : 'Ver desglose completo →'}
                        </button>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Card: Solicitudes Rechazadas */}
            <Card 
              className="border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(buildRefundsUrl({ status: 'rejected' }))}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Solicitudes Rechazadas
                  </CardTitle>
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{c.rejected.total}</div>
              </CardContent>
            </Card>

            {/* Card: Pago Programado - con sub-filtros clickeables */}
            <Card className={`border-l-4 transition-all ${
              c.scheduledPayment.withBank > 0
                ? 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10 ring-1 ring-red-300 dark:ring-red-700'
                : 'border-l-cyan-500 bg-cyan-50/30 dark:bg-cyan-950/10'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pago Programado
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {c.scheduledPayment.withBank > 0 && (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                      </span>
                    )}
                    <CalendarClock className={`h-5 w-5 ${c.scheduledPayment.withBank > 0 ? 'text-red-500' : 'text-cyan-500'}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span 
                    className={`text-3xl font-bold cursor-pointer hover:underline ${c.scheduledPayment.withBank > 0 ? 'text-red-700 dark:text-red-400' : 'text-cyan-700 dark:text-cyan-400'}`}
                    onClick={() => navigate(buildRefundsUrl({ status: 'payment_scheduled' }))}
                  >
                    {c.scheduledPayment.total}
                  </span>
                  <OverdueBadge count={c.scheduledPayment.overdue} stageLabel="Pago Programado" objetivo={overdueByStage.payment_scheduled?.objetivo} />
                </div>
                <div className="flex flex-col gap-2 mt-3">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(buildRefundsUrl({ status: 'payment_scheduled', bank: 'ready' }))}
                  >
                    <Badge variant="default" className={`text-xs ${c.scheduledPayment.withBank > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}>
                      {c.scheduledPayment.withBank > 0 ? '⚠ Transferencia pendiente' : 'Con datos para transferencia'}
                    </Badge>
                    <span className="font-semibold">{c.scheduledPayment.withBank}</span>
                  </div>
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(buildRefundsUrl({ status: 'payment_scheduled', bank: 'pending' }))}
                  >
                    <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs">Sin datos para transferencia</Badge>
                    <span className="font-semibold">{c.scheduledPayment.withoutBank}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card: Solicitudes Pagadas */}
            <Card 
              className="border-l-4 border-l-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(buildRefundsUrl({ status: 'paid' }))}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Solicitudes Pagadas
                  </CardTitle>
                  <Banknote className="h-5 w-5 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{c.paid.total}</span>
                  <OverdueBadge count={c.paid.overdue} stageLabel="Pagadas" objetivo={overdueByStage.paid?.objetivo} />
                </div>
              </CardContent>
            </Card>
          </>
        )}
        </div>
      </div>

      {/* Resumen Financiero */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Resumen Financiero</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        {loadingFinancial ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-3/4" /></CardHeader>
                <CardContent><Skeleton className="h-10 w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Monto Total Solicitado (Solicitudes Ingresadas / Submitted) */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-indigo-950/30 dark:to-slate-950/20 border-indigo-200 dark:border-indigo-800"
              onClick={() => navigate(buildRefundsUrl({ status: 'submitted' }))}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{finSubmittedSavingTitle}</p>
                    <p className="text-3xl font-bold text-indigo-800 dark:text-indigo-300">
                      {new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        maximumFractionDigits: 0
                      }).format(finSubmittedSavingAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {finSubmittedSavingDescription ?? `${finSubmittedSavingCount} solicitud${finSubmittedSavingCount !== 1 ? 'es' : ''} ingresada${finSubmittedSavingCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                    <FileInput className="h-7 w-7 text-indigo-700 dark:text-indigo-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monto Total a Pagar a Clientes (Pago Programado) */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/30 dark:to-sky-950/20 border-cyan-200 dark:border-cyan-800"
              onClick={() => navigate(buildRefundsUrl({ status: 'payment_scheduled' }))}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{finToPayTitle}</p>
                    <p className="text-3xl font-bold text-cyan-800 dark:text-cyan-300">
                      {new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        maximumFractionDigits: 0
                      }).format(finToPayAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {finToPayDescription ?? `${finToPayCount} solicitud${finToPayCount !== 1 ? 'es' : ''} en pago programado`}
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
                    <CalendarClock className="h-7 w-7 text-cyan-700 dark:text-cyan-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monto Total Primas */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800"
              onClick={() => navigate(buildRefundsUrl({ status: 'payment_scheduled' }))}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{finScheduledPremiumTitle}</p>
                    <p className="text-3xl font-bold text-blue-800 dark:text-blue-300">
                      {new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        maximumFractionDigits: 0
                      }).format(finScheduledPremiumAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {finScheduledPremiumDescription ?? `${finScheduledPremiumCount} solicitud${finScheduledPremiumCount !== 1 ? 'es' : ''} en pago programado`}
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Banknote className="h-7 w-7 text-blue-700 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monto Total Pagado */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border-green-200 dark:border-green-800"
              onClick={() => navigate(buildRefundsUrl({ status: 'paid' }))}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{finPaidTitle}</p>
                    <p className="text-3xl font-bold text-green-800 dark:text-green-300">
                      {new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        maximumFractionDigits: 0
                      }).format(finPaidAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {finPaidDescription ?? `Basado en ${finPaidCount} solicitudes pagadas`}
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                    <Banknote className="h-7 w-7 text-green-700 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prima Total */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 border-violet-200 dark:border-violet-800"
              onClick={() => navigate(buildRefundsUrl({ status: 'paid' }))}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{finPremiumTitle}</p>
                    <p className="text-3xl font-bold text-violet-800 dark:text-violet-300">
                      {new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        maximumFractionDigits: 0
                      }).format(finPremium)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {finPremiumDescription ?? 'Prima mensual × cuotas restantes'}
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                    <Banknote className="h-7 w-7 text-violet-700 dark:text-violet-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico combinado de solicitudes y montos */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Evolución de Solicitudes y Montos</CardTitle>
                {timeseriesTotals && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2 h-2 rounded-sm bg-primary/60" />
                      <span className="font-semibold text-foreground tabular-nums">
                        {(timeseriesTotals.count ?? 0).toLocaleString('es-CL')}
                      </span>
                      solicitudes
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2 h-0.5 bg-blue-500" />
                      <span className="font-semibold text-foreground tabular-nums">
                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', notation: 'compact', maximumFractionDigits: 1 }).format(timeseriesTotals.estimatedAmount ?? 0)}
                      </span>
                      estimado
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2 h-0.5 bg-emerald-500" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', notation: 'compact', maximumFractionDigits: 1 }).format(timeseriesTotals.paidAmount ?? 0)}
                      </span>
                      pagado
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTimeseries ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <TimeSeriesChart
                data={timeseriesChartData}
                title=""
                granularidad={granularidad}
                onGranularidadChange={setGranularidad}
                tipo="combined"
              />
            )}
          </CardContent>
        </Card>

        {/* Distribución por estado */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Distribución por Estado</CardTitle>
              {distribucionTotal > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="font-semibold text-foreground tabular-nums">
                    {distribucionTotal.toLocaleString('es-CL')}
                  </span>{' '}
                  solicitudes en {distribucionEstado.length} estado{distribucionEstado.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <ToggleGroup type="single" value={chartType} onValueChange={(value) => value && setChartType(value as 'pie' | 'bar')}>
              <ToggleGroupItem value="pie" aria-label="Gráfico de torta" className="h-8 w-8 p-0">
                <PieChartIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="bar" aria-label="Gráfico de barras" className="h-8 w-8 p-0">
                <BarChart3 className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </CardHeader>
          <CardContent>
            {loadingStatusDist ? (
              <Skeleton className="h-64 w-full" />
            ) : distribucionEstado?.length ? (
              <ResponsiveContainer width="100%" height={320}>
                {chartType === 'pie' ? (
                  <PieChart>
                    <Pie
                      data={distribucionEstado}
                      cx="50%"
                      cy="45%"
                      labelLine={false}
                      label={({ porcentaje }) => (porcentaje >= 3 ? `${porcentaje.toFixed(1)}%` : '')}
                      outerRadius={95}
                      innerRadius={45}
                      paddingAngle={2}
                      fill="#8884d8"
                      dataKey="valor"
                      nameKey="categoria"
                    >
                      {distribucionEstado.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={ESTADO_COLORS[entry.categoria] || ESTADO_COLORS_BY_STATUS[entry.status] || '#8884d8'}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<StatusDistTooltip />} />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      formatter={(value: string) => (
                        <span className="text-muted-foreground">{value}</span>
                      )}
                    />
                  </PieChart>
                ) : (
                  <BarChart data={distribucionEstado} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => new Intl.NumberFormat('es-CL', { notation: 'compact' }).format(v)}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="categoria" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                      width={130}
                    />
                    <Tooltip content={<StatusDistTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: 'hsl(var(--muted-foreground))', formatter: (v: number) => v.toLocaleString('es-CL') }}>
                      {distribucionEstado.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={ESTADO_COLORS[entry.categoria] || ESTADO_COLORS_BY_STATUS[entry.status] || '#8884d8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sheet: desglose por institución de Solicitudes Ingresadas */}
      <InstitutionBreakdownSheet
        open={submittedBreakdownOpen}
        onOpenChange={setSubmittedBreakdownOpen}
        title="Solicitudes Ingresadas — Desglose por Institución"
        description="Identifica qué institución no ha hecho la gestión"
        items={(c.entered.byInstitution ?? []).map((inst) => ({
          institutionId: inst.institutionId,
          displayName: inst.displayName,
          count: inst.count,
          avgDaysInStage: 0,
          overdueCount: inst.overdueCount ?? 0,
        }))}
        baseUrlParams={{
          status: 'submitted',
          ...(filtros.fechaDesde ? { from: filtros.fechaDesde } : {}),
          ...(filtros.fechaHasta ? { to: filtros.fechaHasta } : {}),
        }}
        stageObjectiveDays={overdueByStage.submitted?.objetivo}
        hideAvgDays
      />
    </div>
  );
}