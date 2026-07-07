import { useState } from 'react';
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
import { TabAlertas } from './tabs/Alertas';
import { exportCSV, exportXLSX } from '@/services/reportesService';
import { useToast } from '@/hooks/use-toast';

const tabs = [
  { value: 'resumen', label: 'Resumen', disabled: false },
  { value: 'detalle-financiero', label: 'Detalle Financiero', disabled: true },
  { value: 'tendencias', label: 'Tendencias', disabled: true },
  { value: 'cuellos', label: 'Cuellos de botella', disabled: true },
  { value: 'segmentos', label: 'Segmentos', disabled: true },
  { value: 'alertas', label: 'Alertas', disabled: true },
];

export default function Operacion() {
  const [tabActivo, setTabActivo] = useState('resumen');
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
    <div className="flex-1 space-y-6 p-4 sm:p-6">
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
      <FiltersBar onExport={handleExport} />

      {/* Tabs principales */}
      <Tabs value={tabActivo} onValueChange={setTabActivo} className="space-y-6">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="overflow-x-auto -mx-1 px-1 scrollbar-none">
            <TabsList className="inline-flex w-max md:grid md:w-full md:grid-cols-6 md:max-w-4xl">
              <TabsTrigger value="resumen" className="whitespace-nowrap">Resumen</TabsTrigger>
              <TabsTrigger value="detalle-financiero" className="whitespace-nowrap">Detalle Financiero</TabsTrigger>
              <TabsTrigger value="tendencias" className="whitespace-nowrap">Tendencias</TabsTrigger>
              <TabsTrigger value="cuellos" className="whitespace-nowrap">Cuellos de botella</TabsTrigger>
              <TabsTrigger value="segmentos" className="whitespace-nowrap">Segmentos</TabsTrigger>
              <TabsTrigger value="alertas" className="whitespace-nowrap">Alertas</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="resumen" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="alertas" className="space-y-6">
          <TabAlertas />
        </TabsContent>
      </Tabs>
    </div>
  );
}