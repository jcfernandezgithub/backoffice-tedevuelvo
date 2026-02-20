import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
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
import type { RefundRequest } from '@/types/refund';
import { readStageObjectives } from '@/hooks/useStageObjectives';

// Metadatos estáticos por etapa (icono, gradiente, etapa previa)
const STAGE_META: Record<string, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  prevStage: string | null;
}> = {
  qualifying: {
    label: 'En Calificación',
    icon: ClipboardCheck,
    gradient: 'linear-gradient(135deg, hsl(43,96%,56%), hsl(38,92%,50%))',
    prevStage: null,
  },
  docs_received: {
    label: 'Docs Recibidos',
    icon: FileCheck2,
    gradient: 'linear-gradient(135deg, hsl(271,91%,65%), hsl(265,85%,58%))',
    prevStage: 'qualifying',
  },
  submitted: {
    label: 'Ingresadas',
    icon: FileInput,
    gradient: 'linear-gradient(135deg, hsl(239,84%,67%), hsl(232,78%,60%))',
    prevStage: 'docs_received',
  },
  approved: {
    label: 'Aprobadas',
    icon: CheckCircle,
    gradient: 'linear-gradient(135deg, hsl(142,71%,45%), hsl(138,65%,38%))',
    prevStage: 'submitted',
  },
  payment_scheduled: {
    label: 'Pago Programado',
    icon: CalendarClock,
    gradient: 'linear-gradient(135deg, hsl(187,92%,45%), hsl(192,85%,38%))',
    prevStage: 'approved',
  },
  paid: {
    label: 'Pagadas',
    icon: Banknote,
    gradient: 'linear-gradient(135deg, hsl(160,84%,39%), hsl(155,78%,32%))',
    prevStage: 'payment_scheduled',
  },
};

// 'qualifying' se excluye: es el punto de entrada del proceso, no tiene etapa previa medible
const STAGE_ORDER = ['docs_received', 'submitted', 'approved', 'payment_scheduled', 'paid'];

/**
 * Mide el tiempo de TRANSICIÓN hacia una etapa:
 * - Para qualifying: desde createdAt hasta que entró a qualifying
 * - Para el resto: desde que entró a la etapa anterior hasta que entró a esta etapa
 *
 * Solo se incluyen solicitudes que hayan alcanzado ambos puntos (origen y destino),
 * lo que garantiza que el promedio refleja el tiempo real de proceso.
 */
function calcularTiempoTransicion(
  refunds: RefundRequest[],
  stage: string,
  prevStage: string | null,
): { promedio: number | null; muestra: number } {
  const tiempos: number[] = [];

  refunds.forEach(r => {
    const history = [...(r.statusHistory || [])].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
    );

    // Momento en que llegó a ESTE estado
    const llegadaEntry = history.find(h => h.to === stage);
    if (!llegadaEntry) return; // nunca llegó a esta etapa

    const llegadaAt = llegadaEntry.at;

    // Momento de ORIGEN (etapa anterior o creación)
    let origenAt: string | null = null;
    if (prevStage === null) {
      // qualifying: se mide desde createdAt
      origenAt = r.createdAt;
    } else {
      const prevEntry = history.find(h => h.to === prevStage);
      origenAt = prevEntry ? prevEntry.at : null;
    }

    if (!origenAt) return; // no tenemos punto de origen

    const diff = dayjs(llegadaAt).diff(dayjs(origenAt), 'hour') / 24;
    if (diff >= 0 && diff < 365) {
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

  // Leer objetivos configurables desde localStorage (Ajustes)
  const stageObjectives = readStageObjectives();
  const objetivoMap = Object.fromEntries(stageObjectives.map(o => [o.key, o.objetivo]));

  // Combinar metadatos estáticos con objetivos dinámicos
  const STAGE_CONFIG = Object.fromEntries(
    STAGE_ORDER.map(key => [key, { ...STAGE_META[key], objetivo: objetivoMap[key] ?? 3 }])
  );

  const etapasConTiempos = STAGE_ORDER.map(key => {
    const cfg = STAGE_CONFIG[key];
    const { promedio, muestra } = calcularTiempoTransicion(allRefunds, key, cfg.prevStage);
    const tieneData = promedio !== null;
    const excede = tieneData && promedio! > cfg.objetivo;
    const pct = tieneData ? (promedio! / (cfg.objetivo * 1.5)) * 100 : 0;
    const pctVsObjetivo = tieneData
      ? ((promedio! - cfg.objetivo) / cfg.objetivo) * 100
      : null;

    return { key, cfg, promedio, muestra, tieneData, excede, pct: Math.min(pct, 100), pctVsObjetivo };
  });

  // Tiempo total de punta a punta: desde que entró a qualifying hasta que llegó a paid
  const OBJETIVO_TOTAL = STAGE_ORDER.reduce((sum, key) => sum + STAGE_CONFIG[key].objetivo, 0);

  const tiempoPuntaAPunta = useMemo(() => {
    const tiempos: number[] = [];
    allRefunds.forEach(r => {
      const history = [...(r.statusHistory || [])].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
      );
      const entradaQualifying = history.find(h => h.to === 'qualifying');
      const llegadaPaid = history.find(h => h.to === 'paid');
      if (!entradaQualifying || !llegadaPaid) return;
      const diff = dayjs(llegadaPaid.at).diff(dayjs(entradaQualifying.at), 'hour') / 24;
      if (diff >= 0 && diff < 730) tiempos.push(diff);
    });
    if (tiempos.length === 0) return null;
    return {
      promedio: tiempos.reduce((a, b) => a + b, 0) / tiempos.length,
      muestra: tiempos.length,
    };
  }, [allRefunds]);

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
        <CardContent className="space-y-5">
          {/* Banner punta a punta */}
          {loadingRefunds ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : (
            <div className="rounded-xl overflow-hidden border border-border/50">
              <div
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                style={{ background: 'linear-gradient(135deg, hsl(220,70%,50%), hsl(240,65%,43%))' }}
              >
                <div className="flex-1">
                  <p className="text-white/80 text-xs font-medium uppercase tracking-wide">
                    Proceso completo · Calificación → Pagada
                  </p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    {tiempoPuntaAPunta ? (
                      <>
                        <span className="text-white font-bold text-3xl leading-none">
                          {tiempoPuntaAPunta.promedio.toFixed(1)}
                        </span>
                        <span className="text-white/70 text-sm">días promedio</span>
                        <span
                          className={`ml-auto text-sm font-semibold px-2.5 py-0.5 rounded-full ${
                            tiempoPuntaAPunta.promedio > OBJETIVO_TOTAL
                              ? 'bg-red-500/30 text-red-100'
                              : 'bg-emerald-500/30 text-emerald-100'
                          }`}
                        >
                          {tiempoPuntaAPunta.promedio > OBJETIVO_TOTAL
                            ? `+${(tiempoPuntaAPunta.promedio - OBJETIVO_TOTAL).toFixed(1)}d sobre objetivo`
                            : `${(OBJETIVO_TOTAL - tiempoPuntaAPunta.promedio).toFixed(1)}d bajo objetivo ✓`}
                        </span>
                      </>
                    ) : (
                      <span className="text-white/60 italic text-sm">Sin solicitudes pagadas con historial completo</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white/60 text-xs">Objetivo acumulado</p>
                  <p className="text-white font-semibold text-lg">{OBJETIVO_TOTAL}d</p>
                  {tiempoPuntaAPunta && (
                    <p className="text-white/50 text-xs">{tiempoPuntaAPunta.muestra} solicitud{tiempoPuntaAPunta.muestra !== 1 ? 'es' : ''}</p>
                  )}
                </div>
              </div>
              {/* Mini barra visual */}
              {tiempoPuntaAPunta && (
                <div className="h-1.5 bg-muted">
                  <div
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${Math.min((tiempoPuntaAPunta.promedio / (OBJETIVO_TOTAL * 1.5)) * 100, 100)}%`,
                      background: tiempoPuntaAPunta.promedio > OBJETIVO_TOTAL ? 'hsl(0,84%,60%)' : 'hsl(142,71%,45%)',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Desglose por etapa */}
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
                            Tiempo promedio: <strong>{promedio!.toFixed(1)} días</strong>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Objetivo: {cfg.objetivo} días
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Tiempo desde etapa anterior hasta llegar a {cfg.label.toLowerCase()},
                            calculado sobre {muestra} solicitud{muestra !== 1 ? 'es' : ''}.
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Sin solicitudes con transición completa hacia esta etapa aún.
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

      {/* Recomendaciones dinámicas */}
      {(() => {
        const etapasExcedidas = etapasConTiempos.filter(e => e.tieneData && e.excede);
        const etapasOk       = etapasConTiempos.filter(e => e.tieneData && !e.excede);
        const sinDatos       = etapasConTiempos.filter(e => !e.tieneData);

        // Acciones sugeridas por etapa
        const ACCIONES: Record<string, string> = {
          qualifying:        'Revisar el proceso de calificación inicial y documentos requeridos para agilizar la validación.',
          docs_received:     'Establecer recordatorios automáticos a clientes y revisar el flujo de recepción de documentos.',
          submitted:         'Verificar que los expedientes estén completos antes de ingresarlos al banco para evitar reprocesos.',
          approved:          'Coordinar con las compañías aseguradoras para acelerar la aprobación de solicitudes ingresadas.',
          payment_scheduled: 'Revisar el proceso de programación de pagos y reducir tiempos de confirmación bancaria.',
          paid:              'Automatizar la ejecución de transferencias una vez aprobado el pago programado.',
        };

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Recomendaciones de Mejora
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Generadas automáticamente en base a los tiempos reales del proceso
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sin datos suficientes */}
              {etapasConTiempos.every(e => !e.tieneData) && (
                <div className="p-4 border border-border rounded-lg text-sm text-muted-foreground">
                  Sin suficientes solicitudes con historial completo para generar recomendaciones.
                </div>
              )}

              {/* Cuellos de botella detectados */}
              {etapasExcedidas.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 overflow-hidden">
                  <div className="flex items-start gap-3 p-4">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground">
                        {etapasExcedidas.length === 1
                          ? '1 etapa supera el objetivo'
                          : `${etapasExcedidas.length} etapas superan el objetivo`}
                      </h4>
                      <ul className="mt-3 space-y-3">
                        {etapasExcedidas.map(({ key, cfg, promedio, pctVsObjetivo }) => {
                          const Icon = cfg.icon;
                          return (
                            <li key={key} className="flex items-start gap-3">
                              <div
                                className="p-1.5 rounded-md shrink-0 mt-0.5"
                                style={{ background: cfg.gradient }}
                              >
                                <Icon className="h-3 w-3 text-white" />
                              </div>
                              <div className="text-sm">
                                <span className="font-medium text-foreground">{cfg.label}</span>
                                <span className="text-destructive font-medium ml-2">
                                  {promedio!.toFixed(1)}d
                                  {pctVsObjetivo !== null && ` (+${pctVsObjetivo.toFixed(0)}% sobre ${cfg.objetivo}d obj.)`}
                                </span>
                                <p className="text-muted-foreground mt-0.5">{ACCIONES[key]}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Etapas dentro del objetivo */}
              {etapasOk.length > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 overflow-hidden">
                  <div className="flex items-start gap-3 p-4">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground">
                        {etapasOk.length === 1
                          ? '1 etapa dentro del objetivo ✓'
                          : `${etapasOk.length} etapas dentro del objetivo ✓`}
                      </h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {etapasOk.map(({ key, cfg, promedio }) => {
                          const Icon = cfg.icon;
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium"
                            >
                              <Icon className="h-3 w-3" />
                              {cfg.label} · {promedio!.toFixed(1)}d
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Etapas sin historial */}
              {sinDatos.length > 0 && (
                <p className="text-xs text-muted-foreground px-1">
                  Sin datos aún para: {sinDatos.map(e => e.cfg.label).join(', ')}.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
    </TooltipProvider>
  );
}