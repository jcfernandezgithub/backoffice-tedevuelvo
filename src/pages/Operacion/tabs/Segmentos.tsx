import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '../components/KpiCard';
import { DataGrid } from '@/components/datagrid/DataGrid';
import { useFilters } from '../hooks/useFilters';
import { useDistribucionPorAlianza, useTablaResumen } from '../hooks/useReportsData';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

// Mock data para diferentes segmentos
const kpisPorAlianza = [
  {
    titulo: 'Solicitudes Promedio',
    valor: 145,
    formato: 'numero' as const,
    icono: 'FileText',
    tooltip: 'Promedio de solicitudes por alianza'
  },
  {
    titulo: 'Tasa de Conversión',
    valor: 78.5,
    formato: 'porcentaje' as const,
    icono: 'TrendingUp',
    tooltip: 'Tasa promedio de conversión'
  },
  {
    titulo: 'Comisión Promedio',
    valor: 11.2,
    formato: 'porcentaje' as const,
    icono: 'Percent',
    tooltip: 'Comisión promedio por alianza'
  }
];

const datosPorTipoSeguro = [
  { tipo: 'Cesantía', solicitudes: 156, conversion: 82.1, montoPromedio: 850000 },
  { tipo: 'Desgravamen', solicitudes: 89, conversion: 74.2, montoPromedio: 1200000 },
];

const datosPorUsuario = [
  { usuario: 'María González', solicitudes: 45, conversion: 85.6, eficiencia: 'Alta' },
  { usuario: 'Carlos Rodríguez', solicitudes: 38, conversion: 79.8, eficiencia: 'Alta' },
  { usuario: 'Ana Pérez', solicitudes: 42, conversion: 76.2, eficiencia: 'Media' },
  { usuario: 'Luis Martínez', solicitudes: 35, conversion: 81.4, eficiencia: 'Alta' },
  { usuario: 'Sofia López', solicitudes: 28, conversion: 73.9, eficiencia: 'Media' },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function TabSegmentos() {
  const { filtros } = useFilters();
  const [segmentoActivo, setSegmentoActivo] = useState('alianza');
  
  const { data: distribucionAlianza, isLoading: loadingAlianza } = useDistribucionPorAlianza(filtros);
  const { data: tablaData, isLoading: loadingTabla } = useTablaResumen(filtros, 1, 20);

  const renderSegmentoAlianza = () => (
    <div className="space-y-6">
      {/* KPIs por alianza */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpisPorAlianza.map((kpi, index) => (
          <KpiCard key={index} data={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por alianza */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Alianza</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAlianza ? (
              <Skeleton className="h-64 w-full" />
            ) : distribucionAlianza?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distribucionAlianza}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ categoria, porcentaje }) => `${porcentaje.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="valor"
                  >
                    {distribucionAlianza.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value.toLocaleString('es-CL'), 'Solicitudes']} />
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

        {/* Tabla detallada por alianza */}
        <Card>
          <CardHeader>
            <CardTitle>Top Alianzas</CardTitle>
          </CardHeader>
          <CardContent>
            {distribucionAlianza?.length ? (
              <div className="space-y-3">
                {distribucionAlianza.slice(0, 5).map((item, index) => (
                  <div key={item.categoria} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{item.categoria}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{item.valor.toLocaleString('es-CL')}</div>
                      <div className="text-sm text-muted-foreground">{item.porcentaje.toFixed(1)}%</div>
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
    </div>
  );

  const renderSegmentoTipoSeguro = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Análisis por Tipo de Seguro</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={datosPorTipoSeguro} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="tipo" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="solicitudes" fill="hsl(var(--primary))" name="Solicitudes" />
              <Bar dataKey="conversion" fill="hsl(var(--accent))" name="Conversión %" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {datosPorTipoSeguro.map((tipo) => (
          <Card key={tipo.tipo}>
            <CardHeader>
              <CardTitle>{tipo.tipo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Solicitudes:</span>
                <span className="font-semibold">{tipo.solicitudes.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conversión:</span>
                <span className="font-semibold">{tipo.conversion}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monto promedio:</span>
                <span className="font-semibold">
                  {new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    maximumFractionDigits: 0
                  }).format(tipo.montoPromedio)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderSegmentoUsuario = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento por Usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <DataGrid
            data={datosPorUsuario}
            columns={[
              { key: 'usuario', header: 'Usuario', sortable: true },
              { key: 'solicitudes', header: 'Solicitudes', sortable: true },
              { 
                key: 'conversion', 
                header: 'Conversión (%)', 
                sortable: true,
                render: (item) => `${item.conversion}%`
              },
              { 
                key: 'eficiencia', 
                header: 'Eficiencia', 
                sortable: false,
                render: (item) => (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.eficiencia === 'Alta' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.eficiencia}
                  </span>
                )
              },
            ]}
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs value={segmentoActivo} onValueChange={setSegmentoActivo}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="alianza">Por Alianza</TabsTrigger>
          <TabsTrigger value="tipo">Por Tipo de Seguro</TabsTrigger>
          <TabsTrigger value="usuario">Por Usuario</TabsTrigger>
        </TabsList>
        
        <TabsContent value="alianza" className="mt-6">
          {renderSegmentoAlianza()}
        </TabsContent>
        
        <TabsContent value="tipo" className="mt-6">
          {renderSegmentoTipoSeguro()}
        </TabsContent>
        
        <TabsContent value="usuario" className="mt-6">
          {renderSegmentoUsuario()}
        </TabsContent>
      </Tabs>
    </div>
  );
}