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

interface TimeSeriesChartProps {
  data?: TimeSeriesPoint[];
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
          return format(date, 'MMM', { locale: es });
        case 'month':
          return format(date, 'MMM yyyy', { locale: es });
        default:
          return fecha;
      }
    } catch {
      return fecha;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
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
      fechaFormateada: formatXAxisLabel(point.fecha)
    }));

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