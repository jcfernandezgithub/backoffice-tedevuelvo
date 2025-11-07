import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '../components/KpiCard';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { useFilters } from '../hooks/useFilters';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { refundAdminApi } from '@/services/refundAdminApi';
import {
  useKpisResumen,
  useSerieTemporal,
  useDistribucionPorEstado
} from '../hooks/useReportsData';
import type { Granularidad } from '../types/reportTypes';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_COLORS = {
  'SIMULACION_CONFIRMADA': 'hsl(221, 83%, 53%)', // blue
  'DEVOLUCION_CONFIRMADA_COMPANIA': 'hsl(238, 56%, 58%)', // indigo  
  'FONDOS_RECIBIDOS_TD': 'hsl(142, 71%, 45%)', // green
  'CERTIFICADO_EMITIDO': 'hsl(160, 84%, 39%)', // emerald
  'CLIENTE_NOTIFICADO': 'hsl(45, 93%, 47%)', // yellow
  'PAGADA_CLIENTE': 'hsl(142, 76%, 36%)', // dark green
};

const STATUS_LABELS: Record<string, string> = {
  'REQUESTED': 'Simulado',
  'QUALIFYING': 'Calificando',
  'DOCS_PENDING': 'Docs pendientes',
  'DOCS_RECEIVED': 'Docs recibidos',
  'SUBMITTED': 'Enviado',
  'APPROVED': 'Aprobado',
  'PAYMENT_SCHEDULED': 'Pago programado',
  'PAID': 'Pagado',
  'REJECTED': 'Rechazado',
  'CANCELED': 'Cancelado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'REQUESTED': 'outline',
  'QUALIFYING': 'secondary',
  'DOCS_PENDING': 'secondary',
  'DOCS_RECEIVED': 'secondary',
  'SUBMITTED': 'default',
  'APPROVED': 'default',
  'PAYMENT_SCHEDULED': 'default',
  'PAID': 'default',
  'REJECTED': 'destructive',
  'CANCELED': 'destructive',
};

export function TabResumen() {
  const { filtros } = useFilters();
  const navigate = useNavigate();
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
  
  // Obtener todas las solicitudes del sistema usando el mismo servicio que la página de Solicitudes
  const { data: refunds = [], isLoading: loadingRefunds } = useQuery({
    queryKey: ['refunds-all'],
    queryFn: async () => {
      const response = await refundAdminApi.list({ pageSize: 10000 });
      return Array.isArray(response) ? response : response.items || [];
    }
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
          <CardTitle>
            Resumen Detallado
            {refunds.length > 0 && (
              <span className="text-muted-foreground ml-2">({refunds.length} total)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRefunds ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : refunds.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Público</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>RUT</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Mandato</TableHead>
                    <TableHead className="text-right">Monto estimado</TableHead>
                    <TableHead>Institución</TableHead>
                    <TableHead>Creación</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((refund) => (
                    <TableRow key={refund.id}>
                      <TableCell className="font-mono text-sm">
                        {refund.publicId}
                      </TableCell>
                      <TableCell>{refund.fullName || '-'}</TableCell>
                      <TableCell>{refund.rut || '-'}</TableCell>
                      <TableCell>{refund.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[refund.status] || 'outline'}>
                          {STATUS_LABELS[refund.status] || refund.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {refund.mandateStatus === 'SIGNED' ? (
                          <Badge variant="default" className="bg-green-600">Firmado</Badge>
                        ) : refund.mandateStatus === 'PENDING' ? (
                          <Badge variant="secondary">Pendiente</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {new Intl.NumberFormat('es-CL', {
                          style: 'currency',
                          currency: 'CLP',
                          maximumFractionDigits: 0
                        }).format(refund.estimatedAmountCLP)}
                      </TableCell>
                      <TableCell>{refund.institutionId || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(refund.createdAt), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/solicitudes/${refund.id}`)}
                        >
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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