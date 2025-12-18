import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { FiltersBar } from './components/FiltersBar';
import { TabResumen } from './tabs/Resumen';
import { TabTendencias } from './tabs/Tendencias';
import { TabCuellosBotella } from './tabs/CuellosBotella';
import { TabSegmentos } from './tabs/Segmentos';
import { TabAlertas } from './tabs/Alertas';
import { exportCSV, exportXLSX } from '@/services/reportesService';
import { useToast } from '@/hooks/use-toast';

export default function Reportes() {
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
      const filename = `reportes-${tabActivo}-${timestamp}`;

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
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operación</h1>
          <p className="text-muted-foreground">
            Análisis completo de solicitudes, tendencias y métricas operacionales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Programar reporte
          </Button>
        </div>
      </div>

      {/* Filtros globales */}
      <FiltersBar onExport={handleExport} />

      {/* Tabs principales */}
      <Tabs value={tabActivo} onValueChange={setTabActivo} className="space-y-6">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="tendencias">Tendencias</TabsTrigger>
            <TabsTrigger value="cuellos">Cuellos de botella</TabsTrigger>
            <TabsTrigger value="segmentos">Segmentos</TabsTrigger>
            <TabsTrigger value="alertas">Alertas</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumen" className="space-y-6">
          <TabResumen />
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