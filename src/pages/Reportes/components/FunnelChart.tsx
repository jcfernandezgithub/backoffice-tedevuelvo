import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { FunnelStep } from '../types/reportTypes';

interface FunnelChartProps {
  data?: FunnelStep[];
  title: string;
  isLoading?: boolean;
}

const ESTADO_LABELS: Record<string, string> = {
  'SIMULACION_CONFIRMADA': 'Simulación confirmada',
  'DEVOLUCION_CONFIRMADA_COMPANIA': 'Devolución confirmada',
  'FONDOS_RECIBIDOS_TD': 'Fondos recibidos',
  'CERTIFICADO_EMITIDO': 'Certificado emitido',
  'CLIENTE_NOTIFICADO': 'Cliente notificado',
  'PAGADA_CLIENTE': 'Pagada al cliente',
};

export function FunnelChart({ data, title, isLoading }: FunnelChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No hay datos para mostrar
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxCantidad = Math.max(...data.map(step => step.cantidad));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {data.map((step, index) => {
          const widthPercentage = maxCantidad > 0 ? (step.cantidad / maxCantidad) * 100 : 0;
          const isLast = index === data.length - 1;
          const isFirst = index === 0;
          
          // Calcular pérdida respecto al paso anterior
          const perdida = index > 0 ? data[index - 1].cantidad - step.cantidad : 0;
          const perdidaPorcentaje = index > 0 && data[index - 1].cantidad > 0 
            ? (perdida / data[index - 1].cantidad) * 100 
            : 0;

          return (
            <div key={step.etapa} className="relative">
              {/* Barra del funnel */}
              <div
                className={cn(
                  'bg-gradient-to-r from-primary to-accent rounded-lg p-4 text-primary-foreground relative overflow-hidden',
                  isFirst && 'from-emerald-500 to-emerald-600',
                  isLast && 'from-blue-600 to-blue-700'
                )}
                style={{ width: `${Math.max(widthPercentage, 15)}%` }}
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm">
                    {ESTADO_LABELS[step.etapa] || step.etapa}
                  </h4>
                  <div className="text-right">
                    <div className="font-bold">
                      {step.cantidad.toLocaleString('es-CL')}
                    </div>
                    <div className="text-xs opacity-90">
                      {step.porcentaje.toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                {/* Forma de funnel */}
                <div
                  className="absolute right-0 top-0 h-full w-4 bg-gradient-to-r from-transparent to-background"
                  style={{
                    clipPath: 'polygon(0 0, 100% 20%, 100% 80%, 0 100%)'
                  }}
                />
              </div>

              {/* Indicador de pérdida */}
              {perdida > 0 && (
                <div className="flex items-center mt-2 text-sm text-muted-foreground">
                  <div className="w-4 h-px bg-destructive mr-2" />
                  <span>
                    Pérdida: {perdida.toLocaleString('es-CL')} ({perdidaPorcentaje.toFixed(1)}%)
                  </span>
                </div>
              )}

              {/* Conector al siguiente paso */}
              {!isLast && (
                <div className="flex justify-center my-2">
                  <div className="w-px h-4 bg-border" />
                </div>
              )}
            </div>
          );
        })}

        {/* Resumen */}
        <div className="mt-6 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Tasa de conversión total:</span>
              <div className="font-semibold text-lg">
                {data.length > 0 && data[0].cantidad > 0
                  ? ((data[data.length - 1].cantidad / data[0].cantidad) * 100).toFixed(1)
                  : '0.0'
                }%
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Pérdida total:</span>
              <div className="font-semibold text-lg text-destructive">
                {data.length > 0
                  ? (data[0].cantidad - data[data.length - 1].cantidad).toLocaleString('es-CL')
                  : '0'
                }
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}