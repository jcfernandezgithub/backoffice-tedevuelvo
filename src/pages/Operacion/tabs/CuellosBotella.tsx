import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileInput,
  CheckCircle,
  CalendarClock,
  Banknote,
} from 'lucide-react';
import { FunnelChart } from '../components/FunnelChart';
import { useFilters } from '../hooks/useFilters';
import { useFunnelData } from '../hooks/useReportsData';
import { useAllRefunds } from '../hooks/useAllRefunds';
import dayjs from 'dayjs';
import type { RefundRequest, RefundStatus } from '@/types/refund';

// Mismos colores y nombres que el funnel
const STAGE_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  objetivo: number; // días objetivo en esta etapa
}> = {
  qualifying: {
    label: 'En Calificación',
    icon: ClipboardCheck,
    gradient: 'linear-gradient(135deg, hsl(43,96%,56%), hsl(38,92%,50%))',
    objetivo: 3,
  },
  docs_received: {
    label: 'Docs Recibidos',
    icon: FileCheck2,
    gradient: 'linear-gradient(135deg, hsl(271,91%,65%), hsl(265,85%,58%))',
    objetivo: 5,
  },
  submitted: {
    label: 'Ingresadas',
    icon: FileInput,
    gradient: 'linear-gradient(135deg, hsl(239,84%,67%), hsl(232,78%,60%))',
    objetivo: 4,
  },
  approved: {
    label: 'Aprobadas',
    icon: CheckCircle,
    gradient: 'linear-gradient(135deg, hsl(142,71%,45%), hsl(138,65%,38%))',
    objetivo: 7,
  },
  payment_scheduled: {
    label: 'Pago Programado',
    icon: CalendarClock,
    gradient: 'linear-gradient(135deg, hsl(187,92%,45%), hsl(192,85%,38%))',
    objetivo: 3,
  },
  paid: {
    label: 'Pagadas',
    icon: Banknote,
    gradient: 'linear-gradient(135deg, hsl(160,84%,39%), hsl(155,78%,32%))',
    objetivo: 2,
  },
};

const STAGE_ORDER = ['qualifying', 'docs_received', 'submitted', 'approved', 'payment_scheduled', 'paid'];

/**
 * Mide cuántos días pasó cada solicitud EN un estado determinado.
 * - Entrada al estado: la entrada del historial donde h.to === stage
 * - Salida del estado: la entrada donde h.from === stage
 * - Si aún está en ese estado (no hay salida), usa updatedAt como proxy
 *
 * Fallback para 'qualifying': si no hay historial, usa createdAt → siguiente transición.
 */
function calcularTiempoEnEtapa(
  refunds: RefundRequest[],
  stage: RefundStatus
): { promedio: number | null; muestra: number } {
  const tiempos: number[] = [];

  refunds.forEach(r => {
    const history = [...(r.statusHistory || [])].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
    );

    // Cuándo ENTRÓ al estado
    let entradaAt: string | null = null;

    if (history.length === 0) {
      // Sin historial: si la solicitud está en este estado usamos createdAt
      if ((r.status as string) === stage) {
        entradaAt = r.createdAt;
      }
    } else {
      const entradaEntry = history.find(h => h.to === stage);
      if (entradaEntry) {
        entradaAt = entradaEntry.at;
      } else if ((r.status as string) === stage) {
        // Llegó a este estado pero sin registro explícito → usar createdAt
        entradaAt = r.createdAt;
      }
    }

    if (!entradaAt) return;

    // Cuándo SALIÓ del estado
    const salidaEntry = history.find(h => h.from === stage);
    const salidaAt = salidaEntry ? salidaEntry.at : r.updatedAt;

    const diff = dayjs(salidaAt).diff(dayjs(entradaAt), 'hour') / 24;
    if (diff >= 0 && diff < 365) {
      // Descartamos valores absurdos (>1 año = dato corrupto)
      tiempos.push(diff);
    }
  });

  if (tiempos.length === 0) return { promedio: null, muestra: 0 };
  const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
  return { promedio, muestra: tiempos.length };
}

export function TabCuellosBotella() {
  const { filtros } = useFilters();
  const { data: funnelData, isLoading: loadingFunnel } = useFunnelData(filtros);
  const { data: allRefunds = [], isLoading: loadingRefunds } = useAllRefunds();

  const etapasConTiempos = STAGE_ORDER.map(key => {
    const cfg = STAGE_CONFIG[key];
    const { promedio, muestra } = calcularTiempoEnEtapa(allRefunds, key as RefundStatus);
    const tieneData = promedio !== null;
    const excede = tieneData && promedio! > cfg.objetivo;
    const pct = tieneData ? (promedio! / (cfg.objetivo * 1.5)) * 100 : 0;
    const pctVsObjetivo = tieneData
      ? ((promedio! - cfg.objetivo) / cfg.objetivo) * 100
      : null;

    return { key, cfg, promedio, muestra, tieneData, excede, pct: Math.min(pct, 100), pctVsObjetivo };
  });

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Funnel del proceso */}
      <FunnelChart
        data={funnelData}
        title="Funnel del Proceso de Devolución"
        isLoading={loadingFunnel}
      />

      {/* Tiempo promedio por etapa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Tiempo Promedio por Etapa (días)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Calculado desde el historial real de cada solicitud
          </p>
        </CardHeader>
        <CardContent>
          {loadingRefunds ? (
            <div className="space-y-5">
              {STAGE_ORDER.map(k => <Skeleton key={k} className="h-16 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {etapasConTiempos.map(({ key, cfg, promedio, muestra, tieneData, excede, pct, pctVsObjetivo }) => {
                const Icon = cfg.icon;
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div className="rounded-xl border border-border/50 overflow-hidden cursor-default hover:border-border transition-colors">
                        {/* Header de la etapa */}
                        <div
                          className="px-4 py-2.5 flex items-center gap-3"
                          style={{ background: cfg.gradient }}
                        >
                          <Icon className="h-4 w-4 text-white/90 flex-shrink-0" />
                          <span className="font-semibold text-sm text-white flex-1">
                            {cfg.label}
                          </span>
                          <div className="flex items-baseline gap-1.5 flex-shrink-0">
                            {tieneData ? (
                              <>
                                <span className="font-bold text-white text-base leading-none">
                                  {promedio!.toFixed(1)}d
                                </span>
                                <span className="text-white/70 text-xs">
                                  / obj {cfg.objetivo}d
                                </span>
                              </>
                            ) : (
                              <span className="text-white/60 text-xs italic">sin datos</span>
                            )}
                          </div>
                        </div>

                        {/* Barra de progreso */}
                        <div className="px-4 py-2.5 bg-card space-y-1.5">
                          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                            {/* Línea de objetivo */}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-foreground/20 z-10"
                              style={{ left: `${(cfg.objetivo / (cfg.objetivo * 1.5)) * 100}%` }}
                            />
                            {/* Relleno */}
                            {tieneData && (
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${pct}%`,
                                  background: excede
                                    ? 'hsl(0,84%,60%)'
                                    : 'hsl(142,71%,45%)',
                                }}
                              />
                            )}
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0d</span>
                            {tieneData && pctVsObjetivo !== null && (
                              <span className={excede ? 'text-destructive font-medium' : 'text-emerald-600 font-medium'}>
                                {excede
                                  ? `+${pctVsObjetivo.toFixed(1)}% sobre objetivo`
                                  : `${Math.abs(pctVsObjetivo).toFixed(1)}% bajo objetivo ✓`}
                              </span>
                            )}
                            <span>{cfg.objetivo * 1.5}d</span>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[240px]">
                      <p className="font-semibold">{cfg.label}</p>
                      {tieneData ? (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Promedio real: <strong>{promedio!.toFixed(1)} días</strong>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Objetivo: {cfg.objetivo} días
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Calculado sobre {muestra} solicitud{muestra !== 1 ? 'es' : ''} con historial
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Sin solicitudes con historial de estado para esta etapa aún.
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recomendaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Recomendaciones de Mejora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border border-warning/30 bg-warning/5 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground">Cuellos de botella identificados</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Las etapas que superen el objetivo se marcan en rojo en el gráfico de tiempos</li>
                    <li>• Alta tasa de rechazo por documentación incompleta</li>
                    <li>• Tiempo de procesamiento irregular entre Ingresadas y Aprobadas</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground">Acciones sugeridas</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• Implementar validación automática de documentos</li>
                    <li>• Crear checklist digital para reducir documentación incompleta</li>
                    <li>• Establecer alertas automáticas para procesos que excedan 7 días</li>
                    <li>• Revisar proceso de confirmación con compañías aseguradoras</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}