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
  ArrowDown,
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

// Configuración visual de cada etapa — coherente con el pipeline de Resumen
const STAGE_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;          // color del fondo de la barra
  textColor: string;      // color del texto sobre la barra
  badgeClass: string;     // clase para el badge en el drawer
  statusMap: RefundStatus[];
}> = {
  qualifying: {
    icon: ClipboardCheck,
    color: 'from-amber-500 to-amber-600',
    textColor: 'text-white',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    statusMap: ['qualifying'],
  },
  docs_received: {
    icon: FileCheck2,
    color: 'from-violet-500 to-violet-600',
    textColor: 'text-white',
    badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    statusMap: ['docs_received'],
  },
  submitted: {
    icon: FileInput,
    color: 'from-indigo-500 to-indigo-600',
    textColor: 'text-white',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    statusMap: ['submitted'],
  },
  approved: {
    icon: CheckCircle2,
    color: 'from-green-500 to-green-600',
    textColor: 'text-white',
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    statusMap: ['approved'],
  },
  rejected: {
    icon: XCircle,
    color: 'from-red-400 to-red-500',
    textColor: 'text-white',
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    statusMap: ['rejected'],
  },
  payment_scheduled: {
    icon: CalendarClock,
    color: 'from-cyan-500 to-cyan-600',
    textColor: 'text-white',
    badgeClass: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    statusMap: ['payment_scheduled'],
  },
  paid: {
    icon: Banknote,
    color: 'from-emerald-600 to-emerald-700',
    textColor: 'text-white',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    statusMap: ['paid'],
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

// Etapas que forman el funnel lineal (excluye rechazadas que son salida lateral)
const FUNNEL_STAGES = ['qualifying', 'docs_received', 'submitted', 'approved', 'payment_scheduled', 'paid'];

export function FunnelChart({ data, title, isLoading }: FunnelChartProps) {
  const navigate = useNavigate();
  const [selectedEtapa, setSelectedEtapa] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Reutiliza el caché compartido — sin fetch duplicado
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
        <CardContent className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-14 rounded-xl" style={{ width: `${100 - i * 10}%` }} />
            </div>
          ))}
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

  // Separar el funnel lineal de las rechazadas
  const funnelSteps = data.filter(s => FUNNEL_STAGES.includes(s.etapa));
  const rejectedStep = data.find(s => s.etapa === 'rejected');
  const maxCantidad = funnelSteps.length > 0 ? funnelSteps[0].cantidad : 1;
  const firstCount = funnelSteps[0]?.cantidad || 1;
  const lastCount = funnelSteps[funnelSteps.length - 1]?.cantidad || 0;
  const conversionTotal = firstCount > 0 ? (lastCount / firstCount) * 100 : 0;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
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
          <div className="space-y-1">
            {funnelSteps.map((step, index) => {
              const config = STAGE_CONFIG[step.etapa];
              const Icon = config?.icon ?? ClipboardCheck;
              const widthPct = maxCantidad > 0 ? Math.max((step.cantidad / maxCantidad) * 100, 18) : 18;

              // Pérdida respecto al paso anterior (solo funnel lineal)
              const prevStep = funnelSteps[index - 1];
              const perdida = prevStep ? prevStep.cantidad - step.cantidad : 0;
              const perdidaPct = prevStep && prevStep.cantidad > 0
                ? (perdida / prevStep.cantidad) * 100
                : 0;

              const isLast = index === funnelSteps.length - 1;

              return (
                <div key={step.etapa}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleEtapaClick(step.etapa)}
                        className="w-full group text-left"
                        style={{ transition: 'all 0.2s' }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Barra del funnel */}
                          <div
                            className={`bg-gradient-to-r ${config?.color ?? 'from-primary to-primary/80'} rounded-xl px-4 py-3 flex items-center justify-between gap-3 group-hover:shadow-lg group-hover:brightness-105 transition-all`}
                            style={{ width: `${widthPct}%`, minWidth: '220px' }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className={`h-4 w-4 ${config?.textColor ?? 'text-white'} flex-shrink-0`} />
                              <span className={`font-semibold text-sm truncate ${config?.textColor ?? 'text-white'}`}>
                                {step.label || STATUS_LABELS[step.etapa] || step.etapa}
                              </span>
                            </div>
                            <div className={`text-right flex-shrink-0 ${config?.textColor ?? 'text-white'}`}>
                              <div className="font-bold text-lg leading-none">
                                {step.cantidad.toLocaleString('es-CL')}
                              </div>
                              <div className="text-xs opacity-80 mt-0.5">
                                {step.porcentaje.toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          {/* Indicador de pérdida — lateral, alineado */}
                          {perdida > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-destructive/10 border border-destructive/25 rounded-lg text-sm">
                              <TrendingDown className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                              <div>
                                <span className="font-semibold text-destructive">
                                  −{perdida.toLocaleString('es-CL')}
                                </span>
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({perdidaPct.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Icono "ver detalle" al hover */}
                          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="font-semibold">{step.label || STATUS_LABELS[step.etapa]}</p>
                      <p className="text-sm text-muted-foreground">
                        {step.cantidad.toLocaleString('es-CL')} solicitudes · {step.porcentaje.toFixed(1)}% del total
                      </p>
                      {perdida > 0 && (
                        <p className="text-sm text-destructive mt-1">
                          Fuga desde etapa anterior: {perdida.toLocaleString('es-CL')} ({perdidaPct.toFixed(1)}%)
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Clic para ver solicitudes</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Conector con flecha entre pasos */}
                  {!isLast && (
                    <div className="flex items-center my-0.5 ml-5">
                      <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Rechazadas — salida lateral separada visualmente */}
            {rejectedStep && (
              <div className="mt-6 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-px h-4 bg-border mx-5" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Salidas del proceso
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleEtapaClick(rejectedStep.etapa)}
                      className="group text-left w-full"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`bg-gradient-to-r ${STAGE_CONFIG.rejected.color} rounded-xl px-4 py-3 flex items-center justify-between gap-3 group-hover:shadow-lg group-hover:brightness-105 transition-all`}
                          style={{ width: `${Math.max((rejectedStep.cantidad / maxCantidad) * 100, 18)}%`, minWidth: '220px' }}
                        >
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-white flex-shrink-0" />
                            <span className="font-semibold text-sm text-white">
                              {rejectedStep.label || 'Rechazadas'}
                            </span>
                          </div>
                          <div className="text-right text-white flex-shrink-0">
                            <div className="font-bold text-lg leading-none">
                              {rejectedStep.cantidad.toLocaleString('es-CL')}
                            </div>
                            <div className="text-xs opacity-80 mt-0.5">
                              {rejectedStep.porcentaje.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-semibold">Solicitudes Rechazadas</p>
                    <p className="text-sm text-muted-foreground">
                      {rejectedStep.cantidad.toLocaleString('es-CL')} solicitudes · {rejectedStep.porcentaje.toFixed(1)}% del total
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Clic para ver solicitudes</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </CardContent>

        {/* Drawer con detalle de solicitudes por etapa */}
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {selectedEtapa && STAGE_CONFIG[selectedEtapa] && (
                  (() => {
                    const Icon = STAGE_CONFIG[selectedEtapa].icon;
                    return <Icon className="h-5 w-5" />;
                  })()
                )}
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
