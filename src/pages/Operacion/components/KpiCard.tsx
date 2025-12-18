import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KpiData } from '../types/reportTypes';

interface KpiCardProps {
  data: KpiData;
  className?: string;
}

export function KpiCard({ data, className }: KpiCardProps) {
  const formatValue = (valor: number | string, formato: string) => {
    if (typeof valor === 'string') return valor;
    
    switch (formato) {
      case 'moneda':
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
          maximumFractionDigits: 0
        }).format(valor);
      case 'porcentaje':
        return `${valor.toFixed(1)}%`;
      case 'numero':
      default:
        return new Intl.NumberFormat('es-CL').format(valor);
    }
  };

  const getDeltaColor = (delta?: number) => {
    if (delta === undefined) return '';
    if (delta > 0) return 'text-emerald-600';
    if (delta < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getDeltaIcon = (delta?: number) => {
    if (delta === undefined) return null;
    if (delta > 0) return <Icons.TrendingUp className="h-3 w-3" />;
    if (delta < 0) return <Icons.TrendingDown className="h-3 w-3" />;
    return <Icons.Minus className="h-3 w-3" />;
  };

  // Obtener el ícono dinámicamente
  const IconComponent = Icons[data.icono as keyof typeof Icons] as React.ComponentType<{ className?: string }>;

  const card = (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {data.titulo}
        </CardTitle>
        {IconComponent && (
          <IconComponent className="h-4 w-4 text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {formatValue(data.valor, data.formato)}
        </div>
        {data.delta !== undefined && (
          <div className={cn('flex items-center text-xs mt-1', getDeltaColor(data.delta))}>
            {getDeltaIcon(data.delta)}
            <span className="ml-1">
              {data.delta > 0 ? '+' : ''}{data.delta.toFixed(1)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (data.tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {card}
        </TooltipTrigger>
        <TooltipContent>
          <p>{data.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return card;
}