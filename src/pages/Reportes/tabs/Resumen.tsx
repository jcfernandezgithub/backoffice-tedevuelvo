import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { useFilters } from '../hooks/useFilters';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { refundAdminApi } from '@/services/refundAdminApi';
import {
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
import { 
  ClipboardCheck, 
  FileInput, 
  CheckCircle2, 
  XCircle, 
  CalendarClock, 
  Banknote 
} from 'lucide-react';

const ESTADO_COLORS = {
  'SIMULACION_CONFIRMADA': 'hsl(221, 83%, 53%)', // blue
  'DEVOLUCION_CONFIRMADA_COMPANIA': 'hsl(238, 56%, 58%)', // indigo  
  'FONDOS_RECIBIDOS_TD': 'hsl(142, 71%, 45%)', // green
  'CERTIFICADO_EMITIDO': 'hsl(160, 84%, 39%)', // emerald
  'CLIENTE_NOTIFICADO': 'hsl(45, 93%, 47%)', // yellow
  'PAGADA_CLIENTE': 'hsl(142, 76%, 36%)', // dark green
};

// Status labels y colores (consistente con la pantalla de Solicitudes)
const statusLabels: Record<string, string> = {
  simulated: 'Simulado',
  requested: 'Solicitado',
  qualifying: 'En calificación',
  docs_pending: 'Documentos pendientes',
  docs_received: 'Documentos recibidos',
  submitted: 'Ingresado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  payment_scheduled: 'Pago programado',
  paid: 'Pagado',
  canceled: 'Cancelado',
  datos_sin_simulacion: 'Datos (sin simulación)',
};

const getStatusColors = (status: string): string => {
  switch (status) {
    case 'simulated':
      return 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500'
    case 'requested':
      return 'bg-blue-400 hover:bg-blue-500 text-white border-blue-400'
    case 'qualifying':
      return 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500'
    case 'docs_pending':
      return 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
    case 'docs_received':
      return 'bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-500'
    case 'submitted':
      return 'bg-indigo-500 hover:bg-indigo-600 text-white border-indigo-500'
    case 'approved':
      return 'bg-green-500 hover:bg-green-600 text-white border-green-500'
    case 'payment_scheduled':
      return 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500'
    case 'paid':
      return 'bg-green-600 hover:bg-green-700 text-white border-green-600'
    case 'rejected':
      return 'bg-red-500 hover:bg-red-600 text-white border-red-500'
    case 'canceled':
      return 'bg-gray-500 hover:bg-gray-600 text-white border-gray-500'
    case 'datos_sin_simulacion':
      return 'bg-purple-500 hover:bg-purple-600 text-white border-purple-500'
    default:
      return 'bg-primary hover:bg-primary/90 text-white border-primary'
  }
}

export function TabResumen() {
  const { filtros } = useFilters();
  const navigate = useNavigate();
  const [granularidad, setGranularidad] = useState<Granularidad>('week');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
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
    queryKey: ['refunds-all', filtros],
    queryFn: async () => {
      const response = await refundAdminApi.list({ pageSize: 10000 });
      return Array.isArray(response) ? response : response.items || [];
    }
  });

  // Filtrar refunds por fechas según los filtros
  const filteredRefunds = refunds.filter((r: any) => {
    if (!r.createdAt) return false;
    const createdDate = new Date(r.createdAt);
    if (filtros.fechaDesde) {
      const desde = new Date(filtros.fechaDesde);
      desde.setHours(0, 0, 0, 0);
      if (createdDate < desde) return false;
    }
    if (filtros.fechaHasta) {
      const hasta = new Date(filtros.fechaHasta);
      hasta.setHours(23, 59, 59, 999);
      if (createdDate > hasta) return false;
    }
    return true;
  });

  // Query para obtener estados de mandatos de todas las solicitudes filtradas
  const allFilteredPublicIds = filteredRefunds.map((r: any) => r.publicId);
  
  const { data: mandateStatuses, isLoading: loadingMandates } = useQuery({
    queryKey: ['mandate-statuses-resumen', allFilteredPublicIds],
    queryFn: async () => {
      const statuses: Record<string, any> = {};
      await Promise.all(
        allFilteredPublicIds.map(async (publicId: string) => {
          try {
            const response = await fetch(
              `https://tedevuelvo-app-be.onrender.com/api/v1/refund-requests/${publicId}/experian/status`
            );
            if (response.ok) {
              statuses[publicId] = await response.json();
            }
          } catch (error) {
            // Silently fail for individual requests
          }
        })
      );
      return statuses;
    },
    enabled: allFilteredPublicIds.length > 0,
    staleTime: 30 * 1000,
  });

  // Paginación
  const totalPages = Math.ceil(filteredRefunds.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRefunds = filteredRefunds.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const combinedSeriesData = serieSolicitudes?.map((punto, index) => ({
    fecha: punto.fecha,
    solicitudes: punto.valor,
    montos: serieMontos?.[index]?.valor || 0,
  })) || [];

  // Filtrar solicitudes en estado de calificación usando mandateStatuses
  const qualifyingRefunds = filteredRefunds.filter((r: any) => r.status === 'qualifying');
  const qualifyingWithSignature = qualifyingRefunds.filter((r: any) => 
    mandateStatuses?.[r.publicId]?.hasSignedPdf === true
  );
  const qualifyingWithoutSignature = qualifyingRefunds.filter((r: any) => 
    !mandateStatuses?.[r.publicId]?.hasSignedPdf
  );

  // Filtrar solicitudes en estado "Ingresado"
  const submittedRefunds = filteredRefunds.filter((r: any) => r.status === 'submitted');

  // Filtrar solicitudes en estado "Aprobado"
  const approvedRefunds = filteredRefunds.filter((r: any) => r.status === 'approved');

  // Filtrar solicitudes en estado "Rechazado"
  const rejectedRefunds = filteredRefunds.filter((r: any) => r.status === 'rejected');

  // Filtrar solicitudes en estado "Pago Programado"
  const paymentScheduledRefunds = filteredRefunds.filter((r: any) => r.status === 'payment_scheduled');
  const paymentScheduledWithBank = paymentScheduledRefunds.filter((r: any) => r.bankInfo);
  const paymentScheduledWithoutBank = paymentScheduledRefunds.filter((r: any) => !r.bankInfo);

  // Filtrar solicitudes en estado "Pagado" y calcular montos
  const paidRefunds = filteredRefunds.filter((r: any) => r.status === 'paid');
  const totalPaidAmount = paidRefunds.reduce((sum: number, r: any) => {
    // Buscar realAmount en statusHistory (payment_scheduled o paid)
    const realAmountEntry = r.statusHistory?.slice().reverse().find(
      (entry: any) => {
        const toStatus = entry.to?.toLowerCase();
        return (toStatus === 'payment_scheduled' || toStatus === 'paid') && entry.realAmount;
      }
    );
    return sum + (realAmountEntry?.realAmount || r.estimatedAmountCLP || 0);
  }, 0);
  const totalPaidPremium = paidRefunds.reduce((sum: number, r: any) => 
    sum + (r.calculationSnapshot?.newMonthlyPremium || 0), 0
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingRefunds || loadingMandates ? (
          <>
            {Array.from({ length: 7 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-full" />
                  {i === 0 && <Skeleton className="h-3 w-1/2 mt-2" />}
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            {/* Card: Solicitudes en Calificación - con sub-filtros clickeables */}
            <Card className="border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Solicitudes en Calificación
                  </CardTitle>
                  <ClipboardCheck className="h-5 w-5 text-amber-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  className="text-3xl font-bold text-amber-700 dark:text-amber-400 cursor-pointer hover:underline"
                  onClick={() => navigate('/solicitudes?status=qualifying')}
                >
                  {qualifyingRefunds.length}
                </div>
                <div className="flex gap-4 mt-3">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/solicitudes?status=qualifying&mandate=signed')}
                  >
                    <Badge variant="default" className="bg-green-600">Firmado</Badge>
                    <span className="font-semibold">{qualifyingWithSignature.length}</span>
                  </div>
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/solicitudes?status=qualifying&mandate=pending')}
                  >
                    <Badge variant="secondary">Pendiente</Badge>
                    <span className="font-semibold">{qualifyingWithoutSignature.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card: Solicitudes Ingresadas */}
            <Card 
              className="border-l-4 border-l-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/solicitudes?status=submitted')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Solicitudes Ingresadas
                  </CardTitle>
                  <FileInput className="h-5 w-5 text-indigo-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-400">{submittedRefunds.length}</div>
              </CardContent>
            </Card>

            {/* Card: Solicitudes Aprobadas */}
            <Card 
              className="border-l-4 border-l-green-500 bg-green-50/30 dark:bg-green-950/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/solicitudes?status=approved')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Solicitudes Aprobadas
                  </CardTitle>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-700 dark:text-green-400">{approvedRefunds.length}</div>
              </CardContent>
            </Card>

            {/* Card: Solicitudes Rechazadas */}
            <Card 
              className="border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-950/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/solicitudes?status=rejected')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Solicitudes Rechazadas
                  </CardTitle>
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{rejectedRefunds.length}</div>
              </CardContent>
            </Card>

            {/* Card: Pago Programado - con sub-filtros clickeables */}
            <Card className="border-l-4 border-l-cyan-500 bg-cyan-50/30 dark:bg-cyan-950/10">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pago Programado
                  </CardTitle>
                  <CalendarClock className="h-5 w-5 text-cyan-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  className="text-3xl font-bold text-cyan-700 dark:text-cyan-400 cursor-pointer hover:underline"
                  onClick={() => navigate('/solicitudes?status=payment_scheduled')}
                >
                  {paymentScheduledRefunds.length}
                </div>
                <div className="flex flex-col gap-2 mt-3">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/solicitudes?status=payment_scheduled&bank=ready')}
                  >
                    <Badge variant="default" className="bg-emerald-500 text-xs">Con datos para transferencia</Badge>
                    <span className="font-semibold">{paymentScheduledWithBank.length}</span>
                  </div>
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/solicitudes?status=payment_scheduled&bank=pending')}
                  >
                    <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs">Sin datos para transferencia</Badge>
                    <span className="font-semibold">{paymentScheduledWithoutBank.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card: Solicitudes Pagadas */}
            <Card 
              className="border-l-4 border-l-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/solicitudes?status=paid')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Solicitudes Pagadas
                  </CardTitle>
                  <Banknote className="h-5 w-5 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{paidRefunds.length}</div>
              </CardContent>
            </Card>

            {/* Card: Monto Total Pagado */}
            <Card 
              className="border-l-4 border-l-green-700 bg-green-50/40 dark:bg-green-950/20 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/solicitudes?status=paid')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Monto Total Pagado
                  </CardTitle>
                  <Banknote className="h-5 w-5 text-green-700" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-800 dark:text-green-400">
                  {new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    maximumFractionDigits: 0
                  }).format(totalPaidAmount)}
                </div>
              </CardContent>
            </Card>

            {/* Card: Prima Total */}
            <Card 
              className="border-l-4 border-l-violet-600 bg-violet-50/30 dark:bg-violet-950/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/solicitudes?status=paid')}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Prima Total (Pagados)
                  </CardTitle>
                  <Banknote className="h-5 w-5 text-violet-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-violet-700 dark:text-violet-400">
                  {new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    maximumFractionDigits: 0
                  }).format(totalPaidPremium)}
                </div>
              </CardContent>
            </Card>
          </>
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
            {filteredRefunds.length > 0 && (
              <span className="text-muted-foreground ml-2">({filteredRefunds.length} total)</span>
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
          ) : filteredRefunds.length > 0 ? (
            <>
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
                    {paginatedRefunds.map((refund) => (
                      <TableRow key={refund.id}>
                        <TableCell className="font-mono text-sm">
                          {refund.publicId}
                        </TableCell>
                        <TableCell>{refund.fullName || '-'}</TableCell>
                        <TableCell>{refund.rut || '-'}</TableCell>
                        <TableCell>{refund.email || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColors(refund.status)}>
                            {statusLabels[refund.status] || refund.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mandateStatuses?.[refund.publicId]?.hasSignedPdf ? (
                            <Badge variant="default" className="bg-green-600">Firmado</Badge>
                          ) : (
                            <Badge variant="secondary">Pendiente</Badge>
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
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/refunds/${refund.id}`)}
                          >
                            Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredRefunds.length)} de {filteredRefunds.length} solicitudes
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber;
                        if (totalPages <= 5) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(pageNumber)}
                            className="w-9"
                          >
                            {pageNumber}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
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