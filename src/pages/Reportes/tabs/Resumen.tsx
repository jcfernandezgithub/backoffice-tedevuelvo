import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '../components/KpiCard';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { DataGrid } from '@/components/datagrid/DataGrid';
import { Money } from '@/components/common/Money';
import { useFilters } from '../hooks/useFilters';
import {
  useKpisResumen,
  useSerieTemporal,
  useDistribucionPorEstado
} from '../hooks/useReportsData';
import { useQuery } from '@tanstack/react-query';
import { solicitudesService } from '@/services/solicitudesService';
import type { Granularidad } from '../types/reportTypes';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const ESTADO_COLORS = {
  'SIMULACION_CONFIRMADA': 'hsl(221, 83%, 53%)', // blue
  'DEVOLUCION_CONFIRMADA_COMPANIA': 'hsl(238, 56%, 58%)', // indigo  
  'FONDOS_RECIBIDOS_TD': 'hsl(142, 71%, 45%)', // green
  'CERTIFICADO_EMITIDO': 'hsl(160, 84%, 39%)', // emerald
  'CLIENTE_NOTIFICADO': 'hsl(45, 93%, 47%)', // yellow
  'PAGADA_CLIENTE': 'hsl(142, 76%, 36%)', // dark green
};

export function TabResumen() {
  const { filtros } = useFilters();
  const [granularidad, setGranularidad] = useState<Granularidad>('week');

  const { data: kpis, isLoading: loadingKpis } = useKpisResumen(filtros);
  const { data: serieSolicitudes, isLoading: loadingSerie } = useSerieTemporal(
    filtros,
    granularidad,
    'cantidad'
  );
  const { data: serieMontos, isLoading: loadingMontos } = useSerieTemporal(
    filtros,
    granularidad,
    'montoRecuperado'
  );
  const { data: distribucionEstado, isLoading: loadingDistribucion } = useDistribucionPorEstado(filtros);
  
  // Obtener todas las solicitudes del sistema
  const { data: solicitudes = [], isLoading: loadingSolicitudes } = useQuery({
    queryKey: ['solicitudes'],
    queryFn: () => solicitudesService.list()
  });

  const combinedSeriesData = serieSolicitudes?.map((punto, index) => ({
    fecha: punto.fecha,
    solicitudes: punto.valor,
    montos: serieMontos?.[index]?.valor || 0,
  })) || [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {loadingKpis ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-3 w-1/2 mt-2" />
              </CardContent>
            </Card>
          ))
        ) : (
          kpis?.map((kpi, index) => (
            <KpiCard key={index} data={kpi} />
          ))
        )}
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico combinado de solicitudes y montos */}
        <Card>
          <CardHeader>
            <CardTitle>Evolución de Solicitudes y Montos</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSerie || loadingMontos ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <TimeSeriesChart
                data={combinedSeriesData.map(d => ({ fecha: d.fecha, valor: d.solicitudes }))}
                title=""
                granularidad={granularidad}
                onGranularidadChange={setGranularidad}
                tipo="combined"
              />
            )}
          </CardContent>
        </Card>

        {/* Distribución por estado */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDistribucion ? (
              <Skeleton className="h-64 w-full" />
            ) : distribucionEstado?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distribucionEstado}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ categoria, porcentaje }) => `${porcentaje.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="valor"
                  >
                    {distribucionEstado.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={ESTADO_COLORS[entry.categoria as keyof typeof ESTADO_COLORS] || '#8884d8'} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString('es-CL'), 'Cantidad']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla resumen */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Detallado</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSolicitudes ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : solicitudes.length > 0 ? (
            <DataGrid
              data={solicitudes}
              columns={[
                { key: 'id', header: 'ID', sortable: true },
                { 
                  key: 'cliente', 
                  header: 'Cliente', 
                  render: (r) => r.cliente?.nombre,
                  sortable: true 
                },
                { key: 'estado', header: 'Estado', sortable: true },
                { key: 'alianzaId', header: 'Alianza', sortable: true },
                { 
                  key: 'montoADevolverEstimado', 
                  header: 'Estimado', 
                  render: (r) => <Money value={r.montoADevolverEstimado} />, 
                  sortable: true 
                },
                { 
                  key: 'updatedAt', 
                  header: 'Actualizado', 
                  render: (r) => new Date(r.updatedAt).toLocaleDateString('es-CL'), 
                  sortable: true 
                },
              ]}
              pageSize={10}
            />
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              No hay datos para mostrar
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}