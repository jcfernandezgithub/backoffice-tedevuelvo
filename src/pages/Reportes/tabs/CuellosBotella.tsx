import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { FunnelChart } from '../components/FunnelChart';
import { useFilters } from '../hooks/useFilters';
import { useFunnelData, useSlaMetrics } from '../hooks/useReportsData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data para motivos de rechazo y tiempos por etapa
const motivosRechazo = [
  { motivo: 'Documentación incompleta', cantidad: 45, porcentaje: 32.1 },
  { motivo: 'Datos inconsistentes', cantidad: 38, porcentaje: 27.1 },
  { motivo: 'No cumple criterios', cantidad: 28, porcentaje: 20.0 },
  { motivo: 'Timeout de proceso', cantidad: 19, porcentaje: 13.6 },
  { motivo: 'Error de sistema', cantidad: 10, porcentaje: 7.1 },
];

const tiemposPorEtapa = [
  { etapa: 'Simulación', promedio: 2.5, objetivo: 2.0, estado: 'warning' },
  { etapa: 'Devolución Confirmada', promedio: 5.2, objetivo: 4.0, estado: 'danger' },
  { etapa: 'Fondos Recibidos', promedio: 8.1, objetivo: 7.0, estado: 'warning' },
  { etapa: 'Certificado Emitido', promedio: 1.8, objetivo: 2.0, estado: 'success' },
  { etapa: 'Cliente Notificado', promedio: 0.5, objetivo: 1.0, estado: 'success' },
  { etapa: 'Pagada Cliente', promedio: 3.2, objetivo: 3.0, estado: 'warning' },
];

export function TabCuellosBotella() {
  const { filtros } = useFilters();
  const { data: funnelData, isLoading: loadingFunnel } = useFunnelData(filtros);
  const { data: slaMetrics, isLoading: loadingSla } = useSlaMetrics(filtros);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'success':
        return 'text-emerald-600';
      case 'warning':
        return 'text-amber-600';
      case 'danger':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'green':
        return <Badge className="bg-emerald-100 text-emerald-800">Óptimo</Badge>;
      case 'yellow':
        return <Badge className="bg-amber-100 text-amber-800">Regular</Badge>;
      case 'red':
        return <Badge className="bg-red-100 text-red-800">Crítico</Badge>;
      default:
        return <Badge variant="secondary">N/A</Badge>;
    }
  };

  return (
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
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tiemposPorEtapa.map((etapa) => (
              <div key={etapa.etapa} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{etapa.etapa}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${getEstadoColor(etapa.estado)}`}>
                      {etapa.promedio} días
                    </span>
                    <span className="text-sm text-muted-foreground">
                      (objetivo: {etapa.objetivo}d)
                    </span>
                  </div>
                </div>
                <Progress 
                  value={(etapa.promedio / (etapa.objetivo * 1.5)) * 100} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Óptimo</span>
                  <span>
                    {etapa.promedio > etapa.objetivo ? 
                      `+${((etapa.promedio - etapa.objetivo) / etapa.objetivo * 100).toFixed(1)}% sobre objetivo` :
                      `${((etapa.objetivo - etapa.promedio) / etapa.objetivo * 100).toFixed(1)}% mejor que objetivo`
                    }
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top motivos de rechazo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Principales Motivos de Rechazo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={motivosRechazo}
                layout="horizontal"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  type="number" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  type="category" 
                  dataKey="motivo" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  width={120}
                />
                <Tooltip
                  formatter={(value: number) => [value, 'Cantidad']}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="cantidad" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* SLA por compañía */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              SLA por Compañía
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSla ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : slaMetrics?.length ? (
              <div className="space-y-4">
                {slaMetrics.map((sla) => (
                  <div key={sla.compania} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{sla.compania}</span>
                      {getEstadoBadge(sla.estado)}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Promedio:</span>
                        <div className="font-semibold">{sla.promedio}d</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">P95:</span>
                        <div className="font-semibold">{sla.p95}d</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">P99:</span>
                        <div className="font-semibold">{sla.p99}d</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                No hay datos disponibles
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recomendaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Recomendaciones de Mejora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-800">Cuellos de botella identificados</h4>
                  <ul className="mt-2 space-y-1 text-sm text-amber-700">
                    <li>• La etapa "Devolución Confirmada" excede el objetivo en un 30%</li>
                    <li>• Alta tasa de rechazo por documentación incompleta (32%)</li>
                    <li>• Tiempo de procesamiento irregular en fondos recibidos</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-800">Acciones sugeridas</h4>
                  <ul className="mt-2 space-y-1 text-sm text-blue-700">
                    <li>• Implementar validación automática de documentos</li>
                    <li>• Crear checklist digital para reducir documentación incompleta</li>
                    <li>• Establecer alertas automáticas para procesos que excedan 7 días</li>
                    <li>• Revisar proceso de confirmación con compañías aseguradoras</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}