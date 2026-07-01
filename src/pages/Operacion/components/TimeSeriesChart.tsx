import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { TimeSeriesPoint, Granularidad } from '../types/reportTypes';

// Punto extendido opcional: cuando el consumidor pasa `count`, `estimatedAmount`
// y `paidAmount`, el modo `combined` muestra 3 métricas simultáneas con doble eje Y.
export interface TimeSeriesExtendedPoint extends TimeSeriesPoint {
  count?: number;
  estimatedAmount?: number;
  paidAmount?: number;
  bucketLabel?: string; // etiqueta pre-formateada desde el API (ej: "jun 1")
}

interface TimeSeriesChartProps {
  data?: TimeSeriesExtendedPoint[];
  title: string;
  granularidad: Granularidad;
  onGranularidadChange: (value: Granularidad) => void;
  formato?: 'numero' | 'moneda' | 'porcentaje';
  tipo?: 'line' | 'bar' | 'combined';
  isLoading?: boolean;
}

export function TimeSeriesChart({
  data,
  title,
  granularidad,
  onGranularidadChange,
  formato = 'numero',
  tipo = 'line',
  isLoading
}: TimeSeriesChartProps) {
  const formatValue = (value: number) => {
    switch (formato) {
      case 'moneda':
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
          notation: 'compact',
          maximumFractionDigits: 0
        }).format(value);
      case 'porcentaje':
        return `${value.toFixed(1)}%`;
      case 'numero':
      default:
        return new Intl.NumberFormat('es-CL', {
          notation: 'compact'
        }).format(value);
    }
  };

  const formatXAxisLabel = (fecha: string) => {
    try {
      const date = new Date(fecha);
      switch (granularidad) {
        case 'day':
          return format(date, 'd MMM', { locale: es });
        case 'week':
          return format(date, "d 'de' MMM", { locale: es });
        case 'month':
          return format(date, 'MMM yyyy', { locale: es });
        default:
          return fecha;
      }
    } catch {
      return fecha;
    }
  };

  const formatMoney = (v: number) =>
    new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0]?.payload ?? {};
      const hasExtended =
        typeof point.count === 'number' ||
        typeof point.estimatedAmount === 'number' ||
        typeof point.paidAmount === 'number';
      if (hasExtended) {
        return (
          <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg min-w-[200px]">
            <p className="font-semibold text-sm mb-2 text-foreground">
              {point.bucketLabel || formatXAxisLabel(label)}
            </p>
            <div className="space-y-1.5 text-xs">
              {typeof point.count === 'number' && (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2 h-2 rounded-sm bg-primary/60" />
                    Solicitudes
                  </span>
                  <span className="font-semibold tabular-nums">
                    {point.count.toLocaleString('es-CL')}
                  </span>
                </div>
              )}
              {typeof point.estimatedAmount === 'number' && (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2 h-0.5 bg-blue-500" />
                    Monto estimado
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(point.estimatedAmount)}
                  </span>
                </div>
              )}
              {typeof point.paidAmount === 'number' && (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2 h-0.5 bg-emerald-500" />
                    Monto pagado
                  </span>
                  <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMoney(point.paidAmount)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      }
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{formatXAxisLabel(label)}</p>
          <p className="text-primary">
            {formatValue(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (!data?.length) {
      return (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No hay datos para mostrar
        </div>
      );
    }

    const chartData = data.map(point => ({
      ...point,
      // Prefiere la etiqueta ya formateada por el API si está disponible
      fechaFormateada: point.bucketLabel || formatXAxisLabel(point.fecha),
    }));

    const hasExtended = chartData.some(
      p =>
        typeof p.estimatedAmount === 'number' ||
        typeof p.paidAmount === 'number',
    );

    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (tipo) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="fechaFormateada"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={formatValue}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      
      case 'combined':
        // Modo enriquecido: barras = cantidad (eje izq), líneas = montos (eje der)
        if (hasExtended) {
          return (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart {...commonProps} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="fechaFormateada"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(v) => new Intl.NumberFormat('es-CL', { notation: 'compact' }).format(v)}
                  label={{ value: 'Solicitudes', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={formatMoney}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                <Bar yAxisId="left" dataKey="count" fill="hsl(var(--primary))" opacity={0.35} radius={[3, 3, 0, 0]} name="Solicitudes" />
                <Line yAxisId="right" type="monotone" dataKey="estimatedAmount" stroke="hsl(217, 91%, 60%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Monto estimado" />
                <Line yAxisId="right" type="monotone" dataKey="paidAmount" stroke="hsl(160, 84%, 39%)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} name="Monto pagado" />
              </ComposedChart>
            </ResponsiveContainer>
          );
        }
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="fechaFormateada"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={formatValue}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} opacity={0.6} />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        );
      
      case 'line':
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="fechaFormateada"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={formatValue}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, fill: 'hsl(var(--accent))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Select value={granularidad} onValueChange={onGranularidadChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Día</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          renderChart()
        )}
      </CardContent>
    </Card>
  );
}