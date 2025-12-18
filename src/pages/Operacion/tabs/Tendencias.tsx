import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { useFilters } from '../hooks/useFilters';
import { useSerieTemporal } from '../hooks/useReportsData';
import type { Granularidad } from '../types/reportTypes';
import dayjs from 'dayjs';

export function TabTendencias() {
  const { filtros } = useFilters();
  const [granularidad, setGranularidad] = useState<Granularidad>('week');
  const [metrica, setMetrica] = useState<'cantidad' | 'montoRecuperado' | 'montoPagado' | 'tasaExito'>('cantidad');

  const { data: seriePrincipal, isLoading } = useSerieTemporal(filtros, granularidad, metrica);

  // Calcular métricas de comparación
  const calcularComparacion = () => {
    if (!seriePrincipal?.length) return null;

    const mitad = Math.ceil(seriePrincipal.length / 2);
    const periodoActual = seriePrincipal.slice(mitad);
    const periodoAnterior = seriePrincipal.slice(0, mitad);

    if (!periodoActual.length || !periodoAnterior.length) return null;

    const promedioActual = periodoActual.reduce((acc, p) => acc + p.valor, 0) / periodoActual.length;
    const promedioAnterior = periodoAnterior.reduce((acc, p) => acc + p.valor, 0) / periodoAnterior.length;

    const variacion = promedioAnterior > 0 ? ((promedioActual - promedioAnterior) / promedioAnterior) * 100 : 0;

    return {
      actual: promedioActual,
      anterior: promedioAnterior,
      variacion,
      tendencia: variacion > 5 ? 'up' : variacion < -5 ? 'down' : 'stable'
    };
  };

  const comparacion = calcularComparacion();

  const formatMetricValue = (value: number) => {
    switch (metrica) {
      case 'montoRecuperado':
      case 'montoPagado':
        return new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
          notation: 'compact',
          maximumFractionDigits: 0
        }).format(value);
      case 'tasaExito':
        return `${value.toFixed(1)}%`;
      case 'cantidad':
      default:
        return new Intl.NumberFormat('es-CL', {
          notation: 'compact'
        }).format(value);
    }
  };

  const getTrendIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-emerald-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (tendencia: string) => {
    switch (tendencia) {
      case 'up':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'down':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getMetricTitle = () => {
    switch (metrica) {
      case 'montoRecuperado':
        return 'Montos Recuperados';
      case 'montoPagado':
        return 'Montos Pagados';
      case 'tasaExito':
        return 'Tasa de Éxito';
      case 'cantidad':
      default:
        return 'Solicitudes';
    }
  };

  const getMetricFormat = () => {
    switch (metrica) {
      case 'montoRecuperado':
      case 'montoPagado':
        return 'moneda';
      case 'tasaExito':
        return 'porcentaje';
      case 'cantidad':
      default:
        return 'numero';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Granularidad:</label>
          <Select value={granularidad} onValueChange={(value: Granularidad) => setGranularidad(value)}>
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

        <div className="space-y-2">
          <label className="text-sm font-medium">Métrica:</label>
          <Select value={metrica} onValueChange={(value: any) => setMetrica(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cantidad">Solicitudes</SelectItem>
              <SelectItem value="montoRecuperado">Montos Recuperados</SelectItem>
              <SelectItem value="montoPagado">Montos Pagados</SelectItem>
              <SelectItem value="tasaExito">Tasa de Éxito</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comparación periodo vs periodo */}
      {comparacion && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Periodo Actual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMetricValue(comparacion.actual)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Promedio del período
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Periodo Anterior</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatMetricValue(comparacion.anterior)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Promedio del período anterior
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Variación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getTrendIcon(comparacion.tendencia)}
                <div className="text-2xl font-bold">
                  {comparacion.variacion > 0 ? '+' : ''}{comparacion.variacion.toFixed(1)}%
                </div>
              </div>
              <Badge 
                className={`mt-2 ${getTrendColor(comparacion.tendencia)}`}
                variant="secondary"
              >
                {comparacion.tendencia === 'up' ? 'Crecimiento' : 
                 comparacion.tendencia === 'down' ? 'Decrecimiento' : 'Estable'}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráfico principal */}
      <TimeSeriesChart
        data={seriePrincipal}
        title={`Tendencia de ${getMetricTitle()}`}
        granularidad={granularidad}
        onGranularidadChange={setGranularidad}
        formato={getMetricFormat()}
        tipo="line"
        isLoading={isLoading}
      />

      {/* Métricas adicionales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Análisis de estacionalidad */}
        <Card>
          <CardHeader>
            <CardTitle>Análisis de Tendencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Puntos de datos:</span>
                <span className="font-medium">{seriePrincipal?.length || 0}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valor máximo:</span>
                <span className="font-medium">
                  {seriePrincipal?.length ? 
                    formatMetricValue(Math.max(...seriePrincipal.map(p => p.valor))) : 
                    'N/A'
                  }
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valor mínimo:</span>
                <span className="font-medium">
                  {seriePrincipal?.length ? 
                    formatMetricValue(Math.min(...seriePrincipal.map(p => p.valor))) : 
                    'N/A'
                  }
                </span>
              </div>

              {seriePrincipal?.length && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Período analizado:</span>
                  <span className="font-medium text-sm">
                    {dayjs(seriePrincipal[0].fecha).format('DD MMM')} - {' '}
                    {dayjs(seriePrincipal[seriePrincipal.length - 1].fecha).format('DD MMM YYYY')}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Proyección simple */}
        <Card>
          <CardHeader>
            <CardTitle>Proyección Simple</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Basado en la tendencia actual del período seleccionado.
              </p>
              
              {comparacion && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tendencia:</span>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(comparacion.tendencia)}
                      <span className="font-medium capitalize">
                        {comparacion.tendencia === 'up' ? 'Alcista' : 
                         comparacion.tendencia === 'down' ? 'Bajista' : 'Neutral'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Próximo período (estimado):
                    </span>
                    <span className="font-medium">
                      {formatMetricValue(
                        comparacion.actual * (1 + (comparacion.variacion / 100))
                      )}
                    </span>
                  </div>
                </>
              )}
              
              <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-lg">
                <strong>Nota:</strong> Esta proyección es solo referencial y se basa en 
                tendencias históricas. Los resultados reales pueden variar.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}