import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, Clock } from 'lucide-react';
import { useCacheStatus } from '../hooks/useCacheStatus';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';

dayjs.extend(relativeTime);
dayjs.locale('es');

/** Formatea el tiempo transcurrido en modo compacto: "hace 3 min", "hace 1 h", etc. */
function formatRelative(timestamp: number): string {
  if (!timestamp) return '—';
  return dayjs(timestamp).fromNow();
}

export function CacheIndicator() {
  const { isFetching, dataUpdatedAt, refresh } = useCacheStatus();

  // Fuerza re-render cada 30s para mantener el tiempo relativo actualizado
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const hasDatos = dataUpdatedAt > 0;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Etiqueta de cuándo se cargaron los datos */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-default">
              <div
                className={`h-2 w-2 rounded-full flex-shrink-0 transition-colors ${
                  isFetching
                    ? 'bg-amber-400 animate-pulse'
                    : hasDatos
                    ? 'bg-emerald-500'
                    : 'bg-muted-foreground/40'
                }`}
              />
              <Clock className="h-3 w-3" />
              <span>
                {isFetching
                  ? 'Actualizando…'
                  : hasDatos
                  ? formatRelative(dataUpdatedAt)
                  : 'Sin datos'}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-center">
            {isFetching ? (
              <p>Cargando datos frescos desde el servidor…</p>
            ) : hasDatos ? (
              <>
                <p className="font-semibold">Datos en caché</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Última carga: {dayjs(dataUpdatedAt).format('DD/MM/YYYY HH:mm:ss')}
                </p>
                <p className="text-xs text-muted-foreground">
                  Se refresca automáticamente cada 10 min
                </p>
              </>
            ) : (
              <p>Aún no se han cargado datos</p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Botón de refresco manual */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={refresh}
              disabled={isFetching}
              aria-label="Refrescar datos"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Refrescar datos ahora
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
