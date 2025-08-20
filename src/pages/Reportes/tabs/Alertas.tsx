import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Settings, Bell, CheckCircle2 } from 'lucide-react';
import { useAlertas } from '../hooks/useReportsData';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Mock data para reglas de alertas
const reglasAlertas = [
  {
    id: 'regla-1',
    nombre: 'Tiempo promedio > 20 días',
    descripcion: 'Alerta cuando el tiempo promedio total exceda 20 días',
    activa: true,
    severidad: 'High' as const,
    ultimaEjecucion: '2024-01-15T10:30:00Z'
  },
  {
    id: 'regla-2',
    nombre: 'Tasa de éxito < 85%',
    descripcion: 'Alerta cuando la tasa de éxito semanal sea menor al 85%',
    activa: true,
    severidad: 'Med' as const,
    ultimaEjecucion: '2024-01-15T08:15:00Z'
  },
  {
    id: 'regla-3',
    nombre: 'Volumen bajo vs promedio',
    descripcion: 'Alerta cuando el volumen diario sea 50% menor al promedio',
    activa: false,
    severidad: 'Low' as const,
    ultimaEjecucion: '2024-01-10T14:20:00Z'
  },
  {
    id: 'regla-4',
    nombre: 'Error rate > 10%',
    descripcion: 'Alerta cuando la tasa de errores supere el 10%',
    activa: true,
    severidad: 'High' as const,
    ultimaEjecucion: '2024-01-15T12:45:00Z'
  },
  {
    id: 'regla-5',
    nombre: 'SLA breach compañías',
    descripcion: 'Alerta cuando una compañía exceda consistentemente el SLA',
    activa: false,
    severidad: 'Med' as const,
    ultimaEjecucion: '2024-01-12T16:00:00Z'
  }
];

export function TabAlertas() {
  const { data: alertas, isLoading } = useAlertas();
  const [reglas, setReglas] = useState(reglasAlertas);

  const toggleRegla = (id: string) => {
    setReglas(prev => prev.map(regla => 
      regla.id === id ? { ...regla, activa: !regla.activa } : regla
    ));
  };

  const getSeverityBadge = (severidad: 'Low' | 'Med' | 'High') => {
    switch (severidad) {
      case 'High':
        return <Badge className="bg-red-100 text-red-800">Alta</Badge>;
      case 'Med':
        return <Badge className="bg-amber-100 text-amber-800">Media</Badge>;
      case 'Low':
        return <Badge className="bg-blue-100 text-blue-800">Baja</Badge>;
    }
  };

  const getSeverityIcon = (severidad: 'Low' | 'Med' | 'High') => {
    switch (severidad) {
      case 'High':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'Med':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'Low':
        return <Bell className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Alertas activas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas Activas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : alertas?.length ? (
            <div className="space-y-4">
              {alertas.filter(a => a.activa).map((alerta) => (
                <div 
                  key={alerta.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {getSeverityIcon(alerta.severidad)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{alerta.regla}</h4>
                      {getSeverityBadge(alerta.severidad)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Detectada el {format(new Date(alerta.fecha), 'PPP', { locale: es })}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Revisar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-emerald-800">No hay alertas activas</h3>
                <p className="text-sm text-muted-foreground">
                  Todos los indicadores están dentro de los parámetros normales.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración de reglas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración de Reglas
            </CardTitle>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configurar reglas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {reglas.map((regla) => (
              <div 
                key={regla.id}
                className="flex items-start gap-4 p-4 border rounded-lg"
              >
                <Switch
                  checked={regla.activa}
                  onCheckedChange={() => toggleRegla(regla.id)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{regla.nombre}</h4>
                    {getSeverityBadge(regla.severidad)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {regla.descripcion}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Última ejecución: {format(new Date(regla.ultimaEjecucion), 'PPp', { locale: es })}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  Editar
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resumen de configuración */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Reglas Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reglas.filter(r => r.activa).length}
            </div>
            <p className="text-xs text-muted-foreground">
              de {reglas.length} reglas configuradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Alertas Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alertas?.filter(a => a.activa).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              alertas generadas hoy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Última Revisión</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2m</div>
            <p className="text-xs text-muted-foreground">
              hace 2 minutos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Historial de alertas */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Alertas (últimos 7 días)</CardTitle>
        </CardHeader>
        <CardContent>
          {alertas?.length ? (
            <div className="space-y-3">
              {alertas.map((alerta) => (
                <div 
                  key={alerta.id}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    alerta.activa ? 'bg-red-50 border-red-200' : 'bg-muted/20'
                  }`}
                >
                  {getSeverityIcon(alerta.severidad)}
                  <div className="flex-1">
                    <div className="font-medium">{alerta.regla}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(alerta.fecha), 'PPp', { locale: es })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(alerta.severidad)}
                    {alerta.activa ? (
                      <Badge variant="destructive">Activa</Badge>
                    ) : (
                      <Badge variant="secondary">Resuelta</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay historial de alertas disponible
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}