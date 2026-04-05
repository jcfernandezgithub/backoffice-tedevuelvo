import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { readStageObjectives, type StageObjective } from '@/hooks/useStageObjectives';
import { AlertTriangle, Clock, ChevronDown, ChevronUp, Eye, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OverdueInfo {
  stageKey: string;
  stageLabel: string;
  objetivo: number;
  overdueCount: number;
  overdueIds: Set<string>;
}

/**
 * Calcula los días que una solicitud lleva en su estado actual.
 * Busca la última transición "to" que coincide con el status actual.
 */
function getDaysInCurrentStatus(refund: any): number | null {
  const status = refund.status?.toLowerCase?.() || refund.status;
  if (!refund.statusHistory?.length) return null;

  // Buscar la última entrada donde se transitó AL estado actual
  const entries = [...refund.statusHistory]
    .filter((h: any) => {
      const to = h.to?.toLowerCase?.() || h.to;
      return to === status;
    })
    .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (entries.length === 0) return null;

  const enteredAt = new Date(entries[0].at);
  const now = new Date();
  const diffMs = now.getTime() - enteredAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function useOverdueData(refunds: any[]) {
  const objectives = readStageObjectives();

  return useMemo(() => {
    const overdueMap: Record<string, OverdueInfo> = {};
    const overdueRefundIds = new Set<string>();

    objectives.forEach((obj) => {
      overdueMap[obj.key] = {
        stageKey: obj.key,
        stageLabel: obj.label,
        objetivo: obj.objetivo,
        overdueCount: 0,
        overdueIds: new Set(),
      };
    });

    refunds.forEach((refund) => {
      const status = refund.status?.toLowerCase?.() || refund.status;
      // Solo evaluar estados que tienen objetivo configurado y no son finales
      const objective = overdueMap[status];
      if (!objective) return;

      const days = getDaysInCurrentStatus(refund);
      if (days !== null && days > objective.objetivo) {
        objective.overdueCount++;
        objective.overdueIds.add(refund.id || refund.publicId);
        overdueRefundIds.add(refund.id || refund.publicId);
      }
    });

    const overdueStages = Object.values(overdueMap).filter((s) => s.overdueCount > 0);
    const totalOverdue = overdueRefundIds.size;

    return { overdueStages, overdueRefundIds, totalOverdue, getDaysInCurrentStatus };
  }, [refunds, objectives]);
}

interface OverdueAlertsBannerProps {
  refunds: any[];
  activeOverdueFilter: string | null;
  onFilterByOverdue: (stageKey: string | null) => void;
}

const stageColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  docs_received:     { bg: 'bg-cyan-50 dark:bg-cyan-950/30',    text: 'text-cyan-700 dark:text-cyan-300',    border: 'border-cyan-200 dark:border-cyan-800',    icon: 'text-cyan-500' },
  submitted:         { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800', icon: 'text-indigo-500' },
  approved:          { bg: 'bg-green-50 dark:bg-green-950/30',   text: 'text-green-700 dark:text-green-300',   border: 'border-green-200 dark:border-green-800',   icon: 'text-green-500' },
  payment_scheduled: { bg: 'bg-amber-50 dark:bg-amber-950/30',   text: 'text-amber-700 dark:text-amber-300',   border: 'border-amber-200 dark:border-amber-800',   icon: 'text-amber-500' },
  paid:              { bg: 'bg-emerald-50 dark:bg-emerald-950/30',text: 'text-emerald-700 dark:text-emerald-300',border: 'border-emerald-200 dark:border-emerald-800',icon: 'text-emerald-500' },
};

export function OverdueAlertsBanner({ refunds, activeOverdueFilter, onFilterByOverdue }: OverdueAlertsBannerProps) {
  const { overdueStages, totalOverdue } = useOverdueData(refunds);
  const [expanded, setExpanded] = useState(true);

  if (totalOverdue === 0) return null;

  return (
    <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/20 overflow-hidden animate-fade-in">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-100/40 dark:hover:bg-red-900/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/60 p-1.5">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              {totalOverdue} solicitud{totalOverdue !== 1 ? 'es' : ''} con tiempo excedido
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              Superan el tiempo objetivo configurado en Ajustes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeOverdueFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-600 hover:text-red-800 dark:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                onFilterByOverdue(null);
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Quitar filtro
            </Button>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-red-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-red-400" />
          )}
        </div>
      </button>

      {/* Detail cards per stage */}
      {expanded && (
        <div className="px-4 pb-4 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            <TooltipProvider delayDuration={200}>
              {overdueStages.map((stage) => {
                const colors = stageColors[stage.stageKey] || stageColors.submitted;
                const isActive = activeOverdueFilter === stage.stageKey;

                return (
                  <Tooltip key={stage.stageKey}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onFilterByOverdue(isActive ? null : stage.stageKey)}
                        className={`
                          relative flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all
                          ${isActive
                            ? 'ring-2 ring-red-400 border-red-300 dark:border-red-700 bg-red-100/60 dark:bg-red-900/30 shadow-sm'
                            : `${colors.border} ${colors.bg} hover:shadow-sm hover:scale-[1.02]`
                          }
                        `}
                      >
                        <span className={`text-2xl font-bold tabular-nums ${isActive ? 'text-red-700 dark:text-red-300' : colors.text}`}>
                          {stage.overdueCount}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground leading-tight text-center">
                          {stage.stageLabel}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3 text-red-500" />
                          <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">
                            &gt; {stage.objetivo} días
                          </span>
                        </div>
                        {isActive && (
                          <div className="absolute -top-1 -right-1">
                            <Eye className="h-4 w-4 text-red-500" />
                          </div>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">
                        {stage.overdueCount} solicitud{stage.overdueCount !== 1 ? 'es' : ''} llevan más de {stage.objetivo} día{stage.objetivo !== 1 ? 's' : ''} en "{stage.stageLabel}".
                        <br />
                        <strong>Clic para {isActive ? 'quitar filtro' : 'filtrar'}.</strong>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Badge inline para mostrar en cada fila de la tabla que la solicitud está atrasada.
 */
export function OverdueRowIndicator({ refund, objectives }: { refund: any; objectives?: StageObjective[] }) {
  const objs = objectives || readStageObjectives();
  const status = refund.status?.toLowerCase?.() || refund.status;
  const objective = objs.find((o) => o.key === status);
  if (!objective) return null;

  const days = getDaysInCurrentStatus(refund);
  if (days === null || days <= objective.objetivo) return null;

  const excess = days - objective.objetivo;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 tabular-nums">
              +{excess}d
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            Lleva <strong>{days} días</strong> en "{objective.label}" (objetivo: {objective.objetivo} días).
            <br />
            Excedido por <strong>{excess} día{excess !== 1 ? 's' : ''}</strong>.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
