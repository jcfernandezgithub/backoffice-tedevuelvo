import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { useFilters } from '../hooks/useFilters';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { refundAdminApi } from '@/services/refundAdminApi';
import { useSerieTemporal } from '../hooks/useReportsData';
import type { Granularidad } from '../types/reportTypes';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { 
  ClipboardCheck, 
  FileCheck2,
  FileInput, 
  CheckCircle2, 
  XCircle, 
  CalendarClock, 
  Banknote,
  PieChart as PieChartIcon,
  BarChart3
} from 'lucide-react';

// Colores que coinciden con las calugas KPI
const ESTADO_COLORS: Record<string, string> = {
  'En Calificación': 'hsl(43, 96%, 56%)',      // amber-500
  'Docs Recibidos': 'hsl(271, 91%, 65%)',      // violet-500
  'Ingresadas': 'hsl(239, 84%, 67%)',          // indigo-500
  'Aprobadas': 'hsl(142, 71%, 45%)',           // green-500
  'Rechazadas': 'hsl(0, 84%, 60%)',            // red-500
  'Pago Programado': 'hsl(187, 92%, 69%)',     // cyan-400
  'Pagadas': 'hsl(160, 84%, 39%)',             // emerald-600
};

export function TabResumen() {
  const { filtros } = useFilters();
  const navigate = useNavigate();
  const [granularidad, setGranularidad] = useState<Granularidad>('week');
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  // Helper para construir URL con filtros de fecha incluidos
  const buildRefundsUrl = (params: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    // Siempre incluir las fechas del filtro actual para consistencia
    if (filtros.fechaDesde) searchParams.set('from', filtros.fechaDesde);
    if (filtros.fechaHasta) searchParams.set('to', filtros.fechaHasta);
    searchParams.set('autoSearch', 'true');
    return `/refunds?${searchParams.toString()}`;
  };

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
  
  // Obtener todas las solicitudes del sistema usando el mismo servicio que la página de Solicitudes
  const { data: refunds = [], isLoading: loadingRefunds } = useQuery({
    queryKey: ['refunds-operacion', filtros.fechaDesde, filtros.fechaHasta],
    queryFn: async () => {
      console.log('[Resumen] Iniciando carga con paginación paralela...');
      const PAGE_SIZE = 100;
      
      // Primera llamada para obtener el total
      const firstPage = await refundAdminApi.list({ pageSize: PAGE_SIZE, page: 1 });
      const total = firstPage.total || 0;
      const totalPages = Math.ceil(total / PAGE_SIZE);
      
      console.log(`[Resumen] Total registros: ${total}, Páginas: ${totalPages}`);
      
      let allItems = [...(firstPage.items || [])];
      
      // Si hay más páginas, obtenerlas en paralelo
      if (totalPages > 1) {
        const pagePromises = [];
        for (let page = 2; page <= totalPages; page++) {
          pagePromises.push(refundAdminApi.list({ pageSize: PAGE_SIZE, page }));
        }
        
        const additionalPages = await Promise.all(pagePromises);
        additionalPages.forEach(pageResult => {
          allItems = allItems.concat(pageResult.items || []);
        });
      }
      
      console.log(`[Resumen] Total items obtenidos: ${allItems.length}`);
      console.log('[Resumen] Primeros 3 items:', allItems.slice(0, 3).map((r: any) => ({ 
        publicId: r.publicId, 
        status: r.status,
        createdAt: r.createdAt 
      })));
      
      // Asegurar normalización a minúsculas
      return allItems.map((r: any) => ({
        ...r,
        status: r.status?.toLowerCase?.() || r.status
      }));
    },
    staleTime: 30 * 1000,
  });

  // Filtrar refunds por fechas según los filtros
  const filteredRefunds = useMemo(() => {
    const filtered = refunds.filter((r: any) => {
      if (!r.createdAt) return false;
      // Extraer solo la parte de fecha (YYYY-MM-DD) para comparar sin problemas de timezone
      const createdDateStr = r.createdAt.split('T')[0];
      
      if (filtros.fechaDesde && createdDateStr < filtros.fechaDesde) {
        return false;
      }
      if (filtros.fechaHasta && createdDateStr > filtros.fechaHasta) {
        return false;
      }
      return true;
    });
    console.log('[Resumen] Refunds después de filtrar por fechas:', filtered.length);
    console.log('[Resumen] Fechas usadas:', { desde: filtros.fechaDesde, hasta: filtros.fechaHasta });
    console.log('[Resumen] Status únicos:', [...new Set(filtered.map((r: any) => r.status))]);
    return filtered;
  }, [refunds, filtros.fechaDesde, filtros.fechaHasta]);

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


  const combinedSeriesData = serieSolicitudes?.map((punto, index) => ({
    fecha: punto.fecha,
    solicitudes: punto.valor,
    montos: serieMontos?.[index]?.valor || 0,
  })) || [];

  // Todas las calugas respetan el filtro de fechas
  const qualifyingRefunds = filteredRefunds.filter((r: any) => r.status === 'qualifying');
  const qualifyingWithSignature = qualifyingRefunds.filter((r: any) => 
    mandateStatuses?.[r.publicId]?.hasSignedPdf === true
  );
  const qualifyingWithoutSignature = qualifyingRefunds.filter((r: any) => 
    !mandateStatuses?.[r.publicId]?.hasSignedPdf
  );

  const docsReceivedRefunds = filteredRefunds.filter((r: any) => r.status === 'docs_received');
  const submittedRefunds = filteredRefunds.filter((r: any) => r.status === 'submitted');
  const approvedRefunds = filteredRefunds.filter((r: any) => r.status === 'approved');
  const rejectedRefunds = filteredRefunds.filter((r: any) => r.status === 'rejected');

  const paymentScheduledRefunds = filteredRefunds.filter((r: any) => r.status === 'payment_scheduled');
  const paymentScheduledWithBank = paymentScheduledRefunds.filter((r: any) => r.bankInfo);
  const paymentScheduledWithoutBank = paymentScheduledRefunds.filter((r: any) => !r.bankInfo);

  // Filtrar solicitudes en estado "Pagado" y calcular montos
  // Pagados SÍ respeta el filtro de fecha (es un KPI histórico/financiero)
  const paidRefunds = filteredRefunds.filter((r: any) => r.status === 'paid');
  const totalPaidAmount = paidRefunds.reduce((sum: number, r: any) => {
    // Buscar realAmount en statusHistory (payment_scheduled o paid)
    const realAmountEntry = r.statusHistory?.slice().reverse().find(
      (entry: any) => {
        const toStatus = entry.to?.toLowerCase();
        return (toStatus === 'payment_scheduled' || toStatus === 'paid') && entry.realAmount;
      }
    );
    return sum + (realAmountEntry?.realAmount || 0);
  }, 0);
  const totalPaidPremium = paidRefunds.reduce((sum: number, r: any) => {
    const newMonthlyPremium = r.calculationSnapshot?.newMonthlyPremium || 0;
    const remainingInstallments = r.calculationSnapshot?.remainingInstallments || 0;
    const primaPorSolicitud = newMonthlyPremium * remainingInstallments;
    console.log('Prima calculada:', { publicId: r.publicId, newMonthlyPremium, remainingInstallments, primaPorSolicitud });
    return sum + primaPorSolicitud;
  }, 0);
  console.log('Total Prima (Pagados):', totalPaidPremium, 'Cantidad pagadas:', paidRefunds.length);

  // Datos para el gráfico de torta basados en las mismas categorías de las calugas
  const distribucionEstado = useMemo(() => {
    const total = qualifyingRefunds.length + docsReceivedRefunds.length + submittedRefunds.length + approvedRefunds.length + 
                  rejectedRefunds.length + paymentScheduledRefunds.length + paidRefunds.length;
    
    if (total === 0) return [];
    
    return [
      { categoria: 'En Calificación', valor: qualifyingRefunds.length, porcentaje: (qualifyingRefunds.length / total) * 100 },
      { categoria: 'Docs Recibidos', valor: docsReceivedRefunds.length, porcentaje: (docsReceivedRefunds.length / total) * 100 },
      { categoria: 'Ingresadas', valor: submittedRefunds.length, porcentaje: (submittedRefunds.length / total) * 100 },
      { categoria: 'Aprobadas', valor: approvedRefunds.length, porcentaje: (approvedRefunds.length / total) * 100 },
      { categoria: 'Rechazadas', valor: rejectedRefunds.length, porcentaje: (rejectedRefunds.length / total) * 100 },
      { categoria: 'Pago Programado', valor: paymentScheduledRefunds.length, porcentaje: (paymentScheduledRefunds.length / total) * 100 },
      { categoria: 'Pagadas', valor: paidRefunds.length, porcentaje: (paidRefunds.length / total) * 100 },
    ].filter(item => item.valor > 0);
  }, [qualifyingRefunds, docsReceivedRefunds, submittedRefunds, approvedRefunds, rejectedRefunds, paymentScheduledRefunds, paidRefunds]);

  return (
    <div className="space-y-6">

      {/* Pipeline de solicitudes */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pipeline de Solicitudes</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
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
                  onClick={() => navigate(buildRefundsUrl({ status: 'qualifying' }))}
                >
                  {qualifyingRefunds.length}
                </div>
                <div className="flex gap-4 mt-3">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(buildRefundsUrl({ status: 'qualifying', mandate: 'signed' }))}
                  >
                    <Badge variant="default" className="bg-green-600">Firmado</Badge>
                    <span className="font-semibold">{qualifyingWithSignature.length}</span>
                  </div>
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(buildRefundsUrl({ status: 'qualifying', mandate: 'pending' }))}
                  >
                    <Badge variant="secondary">Pendiente</Badge>
                    <span className="font-semibold">{qualifyingWithoutSignature.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card: Documentos Recibidos */}
            <Card 
              className={`border-l-4 cursor-pointer transition-all ${
                docsReceivedRefunds.length >= 1
                  ? 'border-l-orange-500 bg-orange-50/40 dark:bg-orange-950/15 hover:shadow-lg ring-1 ring-orange-300 dark:ring-orange-700'
                  : 'border-l-violet-500 bg-violet-50/30 dark:bg-violet-950/10 hover:shadow-md'
              }`}
              onClick={() => navigate(buildRefundsUrl({ status: 'docs_received' }))}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Documentos Recibidos
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {docsReceivedRefunds.length >= 1 && (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                      </span>
                    )}
                    <FileCheck2 className={`h-5 w-5 ${docsReceivedRefunds.length >= 1 ? 'text-orange-500' : 'text-violet-500'}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${docsReceivedRefunds.length >= 1 ? 'text-orange-700 dark:text-orange-400' : 'text-violet-700 dark:text-violet-400'}`}>
                  {docsReceivedRefunds.length}
                </div>
                <p className={`text-xs mt-1 font-medium ${docsReceivedRefunds.length >= 1 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                  {docsReceivedRefunds.length >= 1 ? '⚠ Acción requerida · Ingresar al banco' : 'Listos para ingresar al banco'}
                </p>
              </CardContent>
            </Card>

            {/* Card: Solicitudes Ingresadas */}
            <Card 
              className="border-l-4 border-l-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/10 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(buildRefundsUrl({ status: 'submitted' }))}
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
              onClick={() => navigate(buildRefundsUrl({ status: 'approved' }))}
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
              onClick={() => navigate(buildRefundsUrl({ status: 'rejected' }))}
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
            <Card className={`border-l-4 transition-all ${
              paymentScheduledWithBank.length > 0
                ? 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10 ring-1 ring-red-300 dark:ring-red-700'
                : 'border-l-cyan-500 bg-cyan-50/30 dark:bg-cyan-950/10'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pago Programado
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {paymentScheduledWithBank.length > 0 && (
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                      </span>
                    )}
                    <CalendarClock className={`h-5 w-5 ${paymentScheduledWithBank.length > 0 ? 'text-red-500' : 'text-cyan-500'}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  className={`text-3xl font-bold cursor-pointer hover:underline ${paymentScheduledWithBank.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-cyan-700 dark:text-cyan-400'}`}
                  onClick={() => navigate(buildRefundsUrl({ status: 'payment_scheduled' }))}
                >
                  {paymentScheduledRefunds.length}
                </div>
                <div className="flex flex-col gap-2 mt-3">
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(buildRefundsUrl({ status: 'payment_scheduled', bank: 'ready' }))}
                  >
                    <Badge variant="default" className={`text-xs ${paymentScheduledWithBank.length > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}>
                      {paymentScheduledWithBank.length > 0 ? '⚠ Transferencia pendiente' : 'Con datos para transferencia'}
                    </Badge>
                    <span className="font-semibold">{paymentScheduledWithBank.length}</span>
                  </div>
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(buildRefundsUrl({ status: 'payment_scheduled', bank: 'pending' }))}
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
              onClick={() => navigate(buildRefundsUrl({ status: 'paid' }))}
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
          </>
        )}
        </div>
      </div>

      {/* Resumen Financiero */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Resumen Financiero</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        {loadingRefunds ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-3/4" /></CardHeader>
                <CardContent><Skeleton className="h-10 w-full" /></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Monto Total Pagado */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 border-green-200 dark:border-green-800"
              onClick={() => navigate(buildRefundsUrl({ status: 'paid' }))}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Monto Total Pagado a Clientes</p>
                    <p className="text-3xl font-bold text-green-800 dark:text-green-300">
                      {new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        maximumFractionDigits: 0
                      }).format(totalPaidAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Basado en {paidRefunds.length} solicitudes pagadas</p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                    <Banknote className="h-7 w-7 text-green-700 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prima Total */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 border-violet-200 dark:border-violet-800"
              onClick={() => navigate(buildRefundsUrl({ status: 'paid' }))}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Prima Total Recuperada</p>
                    <p className="text-3xl font-bold text-violet-800 dark:text-violet-300">
                      {new Intl.NumberFormat('es-CL', {
                        style: 'currency',
                        currency: 'CLP',
                        maximumFractionDigits: 0
                      }).format(totalPaidPremium)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Prima mensual × cuotas restantes</p>
                  </div>
                  <div className="h-14 w-14 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                    <Banknote className="h-7 w-7 text-violet-700 dark:text-violet-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>


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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Distribución por Estado</CardTitle>
            <ToggleGroup type="single" value={chartType} onValueChange={(value) => value && setChartType(value as 'pie' | 'bar')}>
              <ToggleGroupItem value="pie" aria-label="Gráfico de torta" className="h-8 w-8 p-0">
                <PieChartIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="bar" aria-label="Gráfico de barras" className="h-8 w-8 p-0">
                <BarChart3 className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </CardHeader>
          <CardContent>
            {loadingRefunds ? (
              <Skeleton className="h-64 w-full" />
            ) : distribucionEstado?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'pie' ? (
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
                      nameKey="categoria"
                    >
                      {distribucionEstado.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={ESTADO_COLORS[entry.categoria] || '#8884d8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [value.toLocaleString('es-CL'), 'Cantidad']}
                    />
                    <Legend />
                  </PieChart>
                ) : (
                  <BarChart data={distribucionEstado} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis 
                      type="category" 
                      dataKey="categoria" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11}
                      width={100}
                    />
                    <Tooltip 
                      formatter={(value: number) => [value.toLocaleString('es-CL'), 'Cantidad']}
                    />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                      {distribucionEstado.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={ESTADO_COLORS[entry.categoria] || '#8884d8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}