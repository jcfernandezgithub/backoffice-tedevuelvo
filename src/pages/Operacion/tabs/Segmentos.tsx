import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '../components/KpiCard';
import { DataGrid } from '@/components/datagrid/DataGrid';
import { useFilters } from '../hooks/useFilters';
import { useDistribucionPorAlianza, useDistribucionPorTipoSeguro, useKpisSegmentos } from '../hooks/useReportsData';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d884d8', '#84d8c9', '#d8a984'];

export function TabSegmentos() {
  const { filtros } = useFilters();
  const [segmentoActivo, setSegmentoActivo] = useState('alianza');
  
  const { data: distribucionAlianza, isLoading: loadingAlianza } = useDistribucionPorAlianza(filtros);
  const { data: distribucionTipoSeguro, isLoading: loadingTipoSeguro } = useDistribucionPorTipoSeguro(filtros);
  const { data: kpisSegmentos, isLoading: loadingKpis } = useKpisSegmentos(filtros);

  const renderSegmentoAlianza = () => (
    <div className="space-y-6">
      {/* KPIs por alianza */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loadingKpis ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <KpiCard data={{
              titulo: 'Ticket Promedio',
              valor: kpisSegmentos?.ticketPromedio || 0,
              formato: 'moneda',
              icono: 'Wallet',
              tooltip: 'Monto estimado promedio por solicitud'
            }} />
            <KpiCard data={{
              titulo: 'Prima Promedio',
              valor: kpisSegmentos?.primaPromedio || 0,
              formato: 'moneda',
              icono: 'CreditCard',
              tooltip: 'Promedio de nuevas primas mensuales'
            }} />
            <KpiCard data={{
              titulo: 'Tasa de Conversión',
              valor: kpisSegmentos?.tasaConversion || 0,
              formato: 'porcentaje',
              icono: 'Percent',
              tooltip: 'Porcentaje de solicitudes que llegaron a PAGADO'
            }} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por alianza */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Institución</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAlianza ? (
              <Skeleton className="h-64 w-full" />
            ) : distribucionAlianza?.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distribucionAlianza.slice(0, 10)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="valor"
                    label={false}
                    labelLine={false}
                  >
                    {distribucionAlianza.slice(0, 10).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-semibold">{data.name}</p>
                            <p className="text-muted-foreground">{data.valor.toLocaleString('es-CL')} solicitudes ({data.porcentaje.toFixed(1)}%)</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend 
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: '10px', paddingTop: '16px' }}
                    formatter={(value, entry: any) => (
                      <span className="text-xs">{entry.payload.name}</span>
                    )}
                  />
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
            <CardTitle>Top Instituciones</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAlianza ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : distribucionAlianza?.length ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {distribucionAlianza.slice(0, 10).map((item, index) => (
                  <div key={item.categoria} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium text-sm truncate max-w-[150px]">{item.name}</span>
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
          {loadingTipoSeguro ? (
            <Skeleton className="h-[300px] w-full" />
          ) : distribucionTipoSeguro?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distribucionTipoSeguro} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                          <p className="font-semibold">{data.name}</p>
                          <p>Solicitudes: {data.valor?.toLocaleString('es-CL')}</p>
                          <p>Conversión: {data.conversion?.toFixed(1)}%</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="valor" fill="hsl(var(--primary))" name="Solicitudes" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay datos para mostrar
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loadingTipoSeguro ? (
          <>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        ) : distribucionTipoSeguro?.map((tipo: any) => (
          <Card key={tipo.categoria}>
            <CardHeader>
              <CardTitle className="text-lg">{tipo.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Solicitudes:</span>
                <span className="font-semibold">{tipo.valor?.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conversión:</span>
                <span className="font-semibold">{tipo.conversion?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monto promedio:</span>
                <span className="font-semibold">
                  {new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: 'CLP',
                    maximumFractionDigits: 0
                  }).format(tipo.montoPromedio || 0)}
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
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p className="text-center">
              La segmentación por usuario estará disponible próximamente.<br />
              <span className="text-sm">Requiere integración con datos de gestores.</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs value={segmentoActivo} onValueChange={setSegmentoActivo}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="alianza">Por Institución</TabsTrigger>
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
