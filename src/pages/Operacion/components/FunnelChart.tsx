import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ClipboardCheck,
  FileCheck2,
  FileInput,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Banknote,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import { useAllRefunds } from '../hooks/useAllRefunds';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { FunnelStep } from '../types/reportTypes';
import type { RefundStatus } from '@/types/refund';

interface FunnelChartProps {
  data?: FunnelStep[];
  title: string;
  isLoading?: boolean;
}

const STAGE_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  shadow: string;
  badgeClass: string;
  statusMap: RefundStatus[];
}> = {
  qualifying: {
    icon: ClipboardCheck,
    gradient: 'linear-gradient(135deg, hsl(43,96%,56%), hsl(38,92%,50%))',
    shadow: '0 4px 20px hsla(43,96%,56%,0.35)',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    statusMap: ['qualifying'],
  },
  docs_received: {
    icon: FileCheck2,
    gradient: 'linear-gradient(135deg, hsl(271,91%,65%), hsl(265,85%,58%))',
    shadow: '0 4px 20px hsla(271,91%,65%,0.35)',
    badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    statusMap: ['docs_received'],
  },
  submitted: {
    icon: FileInput,
    gradient: 'linear-gradient(135deg, hsl(239,84%,67%), hsl(232,78%,60%))',
    shadow: '0 4px 20px hsla(239,84%,67%,0.35)',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    statusMap: ['submitted'],
  },
  approved: {
    icon: CheckCircle2,
    gradient: 'linear-gradient(135deg, hsl(142,71%,45%), hsl(138,65%,38%))',
    shadow: '0 4px 20px hsla(142,71%,45%,0.35)',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    statusMap: ['approved'],
  },
  payment_scheduled: {
    icon: CalendarClock,
    gradient: 'linear-gradient(135deg, hsl(187,92%,45%), hsl(192,85%,38%))',
    shadow: '0 4px 20px hsla(187,92%,45%,0.35)',
    badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    statusMap: ['payment_scheduled'],
  },
  paid: {
    icon: Banknote,
    gradient: 'linear-gradient(135deg, hsl(160,84%,39%), hsl(155,78%,32%))',
    shadow: '0 4px 20px hsla(160,84%,39%,0.35)',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    statusMap: ['paid'],
  },
  rejected: {
    icon: XCircle,
    gradient: 'linear-gradient(135deg, hsl(0,84%,60%), hsl(0,78%,52%))',
    shadow: '0 4px 20px hsla(0,84%,60%,0.30)',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    statusMap: ['rejected'],
  },
};

const STATUS_LABELS: Record<string, string> = {
  qualifying: 'En Calificación',
  docs_received: 'Docs Recibidos',
  submitted: 'Ingresadas',
  approved: 'Aprobadas',
  rejected: 'Rechazadas',
  payment_scheduled: 'Pago Programado',
  paid: 'Pagadas',
};

const FUNNEL_STAGES = ['qualifying', 'docs_received', 'submitted', 'approved', 'payment_scheduled', 'paid'];

// Anchura mínima y máxima del funnel (en % del contenedor)
const WIDTH_MAX = 100;
const WIDTH_MIN = 30;

export function FunnelChart({ data, title, isLoading }: FunnelChartProps) {
  const navigate = useNavigate();
  const [selectedEtapa, setSelectedEtapa] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: allRefunds = [] } = useAllRefunds();

  const filteredRefunds = selectedEtapa
    ? allRefunds.filter(r => {
        const config = STAGE_CONFIG[selectedEtapa];
        return config?.statusMap.includes(r.status as RefundStatus);
      })
    : [];

  const handleEtapaClick = (etapa: string) => {
    setSelectedEtapa(etapa);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedEtapa(null), 300);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4">
            {[100, 84, 68, 54, 40, 28].map((w, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" style={{ width: `${w}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No hay datos para mostrar
          </div>
        </CardContent>
      </Card>
    );
  }

  const funnelSteps = data.filter(s => FUNNEL_STAGES.includes(s.etapa));
  const rejectedStep = data.find(s => s.etapa === 'rejected');

  const maxCantidad = funnelSteps[0]?.cantidad || 1;
  const firstCount = funnelSteps[0]?.cantidad || 1;
  const lastCount = funnelSteps[funnelSteps.length - 1]?.cantidad || 0;
  const conversionTotal = firstCount > 0 ? (lastCount / firstCount) * 100 : 0;

  // Calcular anchura de cada barra: interpolación lineal entre WIDTH_MAX y WIDTH_MIN
  // basada en la posición (index), NO en el volumen, para garantizar forma de embudo perfecta
  const getWidth = (index: number, total: number) => {
    if (total <= 1) return WIDTH_MAX;
    const t = index / (total - 1); // 0 → 1
    return WIDTH_MAX - t * (WIDTH_MAX - WIDTH_MIN);
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>{title}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Conversión total:
                <span className="ml-1 font-bold text-foreground text-base">
                  {conversionTotal.toFixed(1)}%
                </span>
              </span>
              {rejectedStep && (
                <span>
                  Rechazadas:
                  <span className="ml-1 font-bold text-destructive text-base">
                    {rejectedStep.cantidad.toLocaleString('es-CL')}
                  </span>
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* ── Funnel centrado ────────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-0 py-2">
            {funnelSteps.map((step, index) => {
              const config = STAGE_CONFIG[step.etapa];
              const Icon = config?.icon ?? ClipboardCheck;
              const widthPct = getWidth(index, funnelSteps.length);

              const prevStep = funnelSteps[index - 1];
              const perdida = prevStep ? prevStep.cantidad - step.cantidad : 0;
              const perdidaPct =
                prevStep && prevStep.cantidad > 0
                  ? (perdida / prevStep.cantidad) * 100
                  : 0;
              const isLast = index === funnelSteps.length - 1;

              return (
                <div key={step.etapa} className="w-full flex flex-col items-center">
                  {/* Triángulo conector entre barras */}
                  {index > 0 && (
                    <div className="relative w-full flex justify-center" style={{ height: '18px' }}>
                      {/* Triángulo SVG que une la barra anterior con la actual */}
                      <svg
                        viewBox="0 0 100 18"
                        preserveAspectRatio="none"
                        className="absolute"
                        style={{
                          width: `${getWidth(index - 1, funnelSteps.length)}%`,
                          height: '18px',
                          overflow: 'visible',
                        }}
                      >
                        {/* Fondo del trapecio de transición */}
                        <polygon
                          points={`0,0 100,0 ${50 + (50 * getWidth(index, funnelSteps.length)) / getWidth(index - 1, funnelSteps.length)},18 ${50 - (50 * getWidth(index, funnelSteps.length)) / getWidth(index - 1, funnelSteps.length)},18`}
                          className="fill-muted opacity-40"
                        />
                      </svg>

                      {/* Indicador de pérdida flotante */}
                      {perdida > 0 && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 flex items-center gap-1 px-2 py-0.5 bg-destructive/10 border border-destructive/25 rounded-md text-xs z-10 whitespace-nowrap"
                          style={{ right: `calc(50% - ${getWidth(index - 1, funnelSteps.length) / 2}% - 8px)`, transform: 'translateX(calc(100% + 8px)) translateY(-50%)' }}
                        >
                          <TrendingDown className="h-3 w-3 text-destructive flex-shrink-0" />
                          <span className="font-semibold text-destructive">−{perdida.toLocaleString('es-CL')}</span>
                          <span className="text-muted-foreground">({perdidaPct.toFixed(0)}%)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barra del funnel */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleEtapaClick(step.etapa)}
                        className="group relative focus:outline-none"
                        style={{ width: `${widthPct}%` }}
                      >
                        <div
                          className="rounded-xl px-5 py-3.5 flex items-center justify-center gap-3 transition-all duration-200 group-hover:scale-[1.02] group-hover:brightness-110"
                          style={{
                            background: config?.gradient,
                            boxShadow: config?.shadow,
                          }}
                        >
                          <Icon className="h-4 w-4 text-white flex-shrink-0 opacity-90" />
                          <span className="font-semibold text-sm text-white truncate">
                            {step.label || STATUS_LABELS[step.etapa] || step.etapa}
                          </span>
                          <div className="ml-auto flex items-baseline gap-1.5 flex-shrink-0">
                            <span className="text-white font-bold text-lg leading-none">
                              {step.cantidad.toLocaleString('es-CL')}
                            </span>
                            <span className="text-white/75 text-xs">
                              {step.porcentaje.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Indicador de última etapa */}
                        {isLast && (
                           <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full opacity-60 bg-primary" />
                         )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[220px]">
                      <p className="font-semibold">{step.label || STATUS_LABELS[step.etapa]}</p>
                      <p className="text-sm text-muted-foreground">
                        {step.cantidad.toLocaleString('es-CL')} solicitudes · {step.porcentaje.toFixed(1)}%
                      </p>
                      {perdida > 0 && (
                        <p className="text-xs text-destructive mt-1">
                          Fuga: −{perdida.toLocaleString('es-CL')} ({perdidaPct.toFixed(1)}%)
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-1 italic">Clic para ver solicitudes</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>

          {/* ── Rechazadas — separada como salida lateral ──────────────────── */}
          {rejectedStep && (() => {
            const config = STAGE_CONFIG.rejected;
            const Icon = config.icon;
            const rejWidthPct = Math.max(
              (rejectedStep.cantidad / (funnelSteps[0]?.cantidad || 1)) * (WIDTH_MAX - WIDTH_MIN) + WIDTH_MIN,
              22
            );
            return (
              <div className="mt-6 pt-5 border-t border-border/40 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest">
                  <div className="h-px w-12 bg-border" />
                  Salidas del proceso
                  <div className="h-px w-12 bg-border" />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleEtapaClick('rejected')}
                      className="group focus:outline-none"
                      style={{ width: `${rejWidthPct}%` }}
                    >
                      <div
                        className="rounded-xl px-5 py-3.5 flex items-center justify-center gap-3 transition-all duration-200 group-hover:scale-[1.02] group-hover:brightness-110"
                        style={{ background: config.gradient, boxShadow: config.shadow }}
                      >
                        <Icon className="h-4 w-4 text-white flex-shrink-0 opacity-90" />
                        <span className="font-semibold text-sm text-white">
                          {rejectedStep.label || 'Rechazadas'}
                        </span>
                        <div className="ml-auto flex items-baseline gap-1.5 flex-shrink-0">
                          <span className="text-white font-bold text-lg leading-none">
                            {rejectedStep.cantidad.toLocaleString('es-CL')}
                          </span>
                          <span className="text-white/75 text-xs">
                            {rejectedStep.porcentaje.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">Solicitudes Rechazadas</p>
                    <p className="text-sm text-muted-foreground">
                      {rejectedStep.cantidad.toLocaleString('es-CL')} · {rejectedStep.porcentaje.toFixed(1)}% del total
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1 italic">Clic para ver solicitudes</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })()}
        </CardContent>

        {/* ── Drawer detalle ─────────────────────────────────────────────────── */}
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {selectedEtapa && STAGE_CONFIG[selectedEtapa] && (() => {
                  const Icon = STAGE_CONFIG[selectedEtapa].icon;
                  return <Icon className="h-5 w-5" />;
                })()}
                {selectedEtapa ? (STATUS_LABELS[selectedEtapa] || selectedEtapa) : 'Detalle'}
              </SheetTitle>
              <SheetDescription>
                {filteredRefunds.length} solicitudes actualmente en este estado
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6">
              {filteredRefunds.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Público</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>RUT</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Monto est.</TableHead>
                        <TableHead>Creación</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRefunds.slice(0, 200).map((refund) => (
                        <TableRow key={refund.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {refund.publicId}
                          </TableCell>
                          <TableCell className="font-medium">{refund.fullName || '—'}</TableCell>
                          <TableCell>{refund.rut || '—'}</TableCell>
                          <TableCell>
                            {selectedEtapa && (
                              <Badge className={STAGE_CONFIG[selectedEtapa]?.badgeClass ?? ''}>
                                {STATUS_LABELS[refund.status] || refund.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {new Intl.NumberFormat('es-CL', {
                              style: 'currency',
                              currency: 'CLP',
                              maximumFractionDigits: 0,
                            }).format(refund.estimatedAmountCLP || 0)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(refund.createdAt), 'dd/MM/yyyy', { locale: es })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                navigate(`/refunds/${refund.id}`);
                                handleCloseDrawer();
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredRefunds.length > 200 && (
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      Mostrando 200 de {filteredRefunds.length} solicitudes
                    </p>
                  )}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-muted-foreground">
                  No hay solicitudes en este estado
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </Card>
    </TooltipProvider>
  );
}
