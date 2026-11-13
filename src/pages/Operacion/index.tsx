import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FiltersBar } from './components/FiltersBar';
import { TabResumen } from './tabs/Resumen';
import { TabDetalleFinanciero } from './tabs/DetalleFinanciero';
import { TabTendencias } from './tabs/Tendencias';
import { TabCuellosBotella } from './tabs/CuellosBotella';
import { TabSegmentos } from './tabs/Segmentos';
import { OperationalAlerts } from '@/components/operational-alerts/OperationalAlerts';
import { useAuth } from '@/state/AuthContext';
import { alertsAccess } from '@/lib/operationalAlerts';
import { hasPageAccess } from '@/lib/pageAccess';
import { exportCSV, exportXLSX } from '@/services/reportesService';
import { useToast } from '@/hooks/use-toast';

const tabs = [
  { value: 'resumen', label: 'Resumen', disabled: false },
  { value: 'detalle-financiero', label: 'Detalle Financiero', disabled: true },
  { value: 'tendencias', label: 'Tendencias', disabled: true },
  { value: 'cuellos', label: 'Cuellos de botella', disabled: true },
  { value: 'segmentos', label: 'Segmentos', disabled: true },
];

export default function Operacion() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const canSeeAlerts = alertsAccess(user).allowed;
  const canSeeReports = hasPageAccess(user?.pages, 'OPERACION', user?.rol) || !user?.pages?.length;
  const [selectedTab, setTabActivo] = useState(() => canSeeReports ? 'resumen' : 'alertas');
  const requestedTab = searchParams.get('tab') === 'alertas' ? 'alertas' : selectedTab;
  const tabActivo = requestedTab === 'alertas' ? (canSeeAlerts ? 'alertas' : 'resumen') : (canSeeReports ? requestedTab : 'alertas');
  const changeTab = (value: string) => {
    setTabActivo(value);
    setSearchParams(current => { const next = new URLSearchParams(current); next.delete('tab'); next.delete('alertView'); return next; });
  };
  const visibleTabs = [
    ...(canSeeReports ? tabs : []),
    ...(canSeeAlerts ? [{ value: 'alertas', label: 'Alertas operativas', disabled: false }] : []),
  ];
  const { toast } = useToast();

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      // Mock data para exportar
      const mockData = [
        { id: 'SOL-001', fecha: '2024-01-15', estado: 'PAGADA_CLIENTE', monto: 850000 },
        { id: 'SOL-002', fecha: '2024-01-14', estado: 'CERTIFICADO_EMITIDO', monto: 1200000 },
        { id: 'SOL-003', fecha: '2024-01-13', estado: 'FONDOS_RECIBIDOS_TD', monto: 750000 },
      ];

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `operacion-${tabActivo}-${timestamp}`;

      switch (format) {
        case 'csv':
          exportCSV(mockData, filename);
          break;
        case 'xlsx':
          exportXLSX(mockData, filename);
          break;
        case 'pdf':
          // Implementar exportación PDF con html2canvas + jsPDF
          toast({
            title: 'Funcionalidad en desarrollo',
            description: 'La exportación a PDF estará disponible próximamente.',
          });
          return;
      }

      toast({
        title: 'Exportación exitosa',
        description: `El archivo ${format.toUpperCase()} se ha descargado correctamente.`,
      });
    } catch (error) {
      toast({
        title: 'Error en la exportación',
        description: 'No se pudo exportar el archivo. Inténtalo nuevamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-w-0 flex-1 space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Operación</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Análisis completo de solicitudes, tendencias y métricas operacionales
          </p>
        </div>
        <div className="flex items-center gap-3" />
      </div>

      {/* Filtros globales */}
      {canSeeReports && tabActivo !== 'alertas' && <FiltersBar onExport={handleExport} />}

      {/* Tabs principales */}
      <TooltipProvider delayDuration={100}>
        <Tabs value={tabActivo} onValueChange={changeTab} className="space-y-6">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="overflow-x-auto -mx-1 px-1 scrollbar-none">
              <TabsList className="inline-flex w-max h-auto">
                {visibleTabs.map((tab) => {
                  const trigger = (
                    <TabsTrigger
                      value={tab.value}
                      disabled={tab.disabled}
                      className={cn(
                        'whitespace-nowrap gap-1.5 w-auto min-h-11 xl:min-h-0 h-full',
                        tab.disabled && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      {tab.label}
                      {tab.disabled && (
                        <Wrench className="h-3 w-3 text-muted-foreground" />
                      )}
                    </TabsTrigger>
                  );

                  return tab.disabled ? (
                    <Tooltip key={tab.value}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex shrink-0 w-auto h-full cursor-not-allowed">{trigger}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>Sección en mantenimiento</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span key={tab.value} className="inline-flex shrink-0 w-auto h-full">
                      {trigger}
                    </span>
                  );
                })}
              </TabsList>
            </div>
          </div>

          {canSeeReports && <><TabsContent value="resumen" className="space-y-6">
            <TabResumen />
          </TabsContent>

          <TabsContent value="detalle-financiero" className="space-y-6">
            <TabDetalleFinanciero />
          </TabsContent>

          <TabsContent value="tendencias" className="space-y-6">
            <TabTendencias />
          </TabsContent>

          <TabsContent value="cuellos" className="space-y-6">
            <TabCuellosBotella />
          </TabsContent>

          <TabsContent value="segmentos" className="space-y-6">
            <TabSegmentos />
          </TabsContent></>}

          {canSeeAlerts && <TabsContent value="alertas" className="space-y-6">
            <OperationalAlerts />
          </TabsContent>}
        </Tabs>
      </TooltipProvider>
    </div>
  );
}