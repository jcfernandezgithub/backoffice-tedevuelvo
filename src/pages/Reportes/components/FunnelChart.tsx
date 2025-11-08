import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TrendingDown, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { refundAdminApi } from '@/services/refundAdminApi';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { FunnelStep } from '../types/reportTypes';
import type { RefundRequest, RefundStatus } from '@/types/refund';

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

// Mapeo inverso de estados de reportes a estados de API
const ESTADO_TO_STATUS_MAP: Record<string, RefundStatus[]> = {
  'SIMULACION_CONFIRMADA': ['simulated', 'qualifying', 'docs_pending'],
  'DEVOLUCION_CONFIRMADA_COMPANIA': ['docs_received'],
  'FONDOS_RECIBIDOS_TD': ['submitted'],
  'CERTIFICADO_EMITIDO': ['approved'],
  'CLIENTE_NOTIFICADO': ['payment_scheduled'],
  'PAGADA_CLIENTE': ['paid'],
};

const STATUS_LABELS: Record<string, string> = {
  'simulated': 'Simulado',
  'qualifying': 'Calificando',
  'docs_pending': 'Docs pendientes',
  'docs_received': 'Docs recibidos',
  'submitted': 'Enviado',
  'approved': 'Aprobado',
  'payment_scheduled': 'Pago programado',
  'paid': 'Pagado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'simulated': 'outline',
  'qualifying': 'secondary',
  'docs_pending': 'secondary',
  'docs_received': 'secondary',
  'submitted': 'default',
  'approved': 'default',
  'payment_scheduled': 'default',
  'paid': 'default',
};

export function FunnelChart({ data, title, isLoading }: FunnelChartProps) {
  const navigate = useNavigate();
  const [selectedEtapa, setSelectedEtapa] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Obtener todas las solicitudes
  const { data: allRefunds = [] } = useQuery({
    queryKey: ['refunds-all'],
    queryFn: async () => {
      const response = await refundAdminApi.list({ pageSize: 10000 });
      return Array.isArray(response) ? response : response.items || [];
    }
  });

  // Filtrar solicitudes por etapa seleccionada
  const filteredRefunds = selectedEtapa
    ? allRefunds.filter(refund => {
        const allowedStatuses = ESTADO_TO_STATUS_MAP[selectedEtapa] || [];
        return allowedStatuses.includes(refund.status);
      })
    : [];

  const handleEtapaClick = (etapa: string) => {
    setSelectedEtapa(etapa);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedEtapa(null), 300);
  };

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
              <div className="flex items-center gap-4">
                {/* Barra del funnel - Clickeable */}
                <button
                  onClick={() => handleEtapaClick(step.etapa)}
                  className={cn(
                    'bg-gradient-to-r from-primary to-accent rounded-lg p-4 text-primary-foreground relative overflow-hidden flex-1 transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer',
                    isFirst && 'from-emerald-500 to-emerald-600',
                    isLast && 'from-blue-600 to-blue-700'
                  )}
                  style={{ maxWidth: `${Math.max(widthPercentage, 15)}%` }}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      {ESTADO_LABELS[step.etapa] || step.etapa}
                      <ExternalLink className="h-3 w-3 opacity-70" />
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
                </button>

                {/* Indicador de pérdida al costado - VISIBLE Y CLARO */}
                {perdida > 0 && (
                  <div className="flex items-center gap-2 ml-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      <div className="text-sm">
                        <div className="font-semibold text-destructive">
                          -{perdida.toLocaleString('es-CL')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {perdidaPorcentaje.toFixed(1)}% fuga
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Conector al siguiente paso */}
              {!isLast && (
                <div className="flex justify-start my-3 ml-8">
                  <div className="w-px h-6 bg-border" />
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

      {/* Drawer con detalle de solicitudes */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedEtapa ? ESTADO_LABELS[selectedEtapa] : 'Detalle'}
            </SheetTitle>
            <SheetDescription>
              {filteredRefunds.length} solicitudes en este estado
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            {filteredRefunds.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Público</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>RUT</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Creación</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRefunds.map((refund) => (
                      <TableRow key={refund.id}>
                        <TableCell className="font-mono text-sm">
                          {refund.publicId}
                        </TableCell>
                        <TableCell>{refund.fullName || '-'}</TableCell>
                        <TableCell>{refund.rut || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {refund.email || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[refund.status] || 'outline'}>
                            {STATUS_LABELS[refund.status] || refund.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {new Intl.NumberFormat('es-CL', {
                            style: 'currency',
                            currency: 'CLP',
                            maximumFractionDigits: 0
                          }).format(refund.estimatedAmountCLP)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(refund.createdAt), 'dd/MM/yyyy', { locale: es })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigate(`/refunds/${refund.id}`);
                              handleCloseDrawer();
                            }}
                          >
                            Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                No hay solicitudes en este estado
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}