import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, X, Download } from 'lucide-react';
import { useFilters } from '../hooks/useFilters';
import { useAlianzas, useCompanias } from '../hooks/useReportsData';
import type { EstadoSolicitud, TipoSeguro } from '../types/reportTypes';

// Helper para obtener fecha local en formato YYYY-MM-DD
const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ESTADOS: { value: EstadoSolicitud; label: string }[] = [
  { value: 'SIMULACION_CONFIRMADA', label: 'Simulación confirmada' },
  { value: 'DEVOLUCION_CONFIRMADA_COMPANIA', label: 'Devolución confirmada' },
  { value: 'FONDOS_RECIBIDOS_TD', label: 'Fondos recibidos' },
  { value: 'CERTIFICADO_EMITIDO', label: 'Certificado emitido' },
  { value: 'CLIENTE_NOTIFICADO', label: 'Cliente notificado' },
  { value: 'PAGADA_CLIENTE', label: 'Pagada al cliente' },
];

const TIPOS_SEGURO: { value: TipoSeguro; label: string }[] = [
  { value: 'cesantia', label: 'Cesantía' },
  { value: 'desgravamen', label: 'Desgravamen' },
];

interface FiltersBarProps {
  onExport: (format: 'csv' | 'xlsx' | 'pdf') => void;
}

export function FiltersBar({ onExport }: FiltersBarProps) {
  const { filtros, actualizarFiltros, limpiarFiltros } = useFilters();
  const { data: alianzas = [] } = useAlianzas();
  const { data: companias = [] } = useCompanias();
  
  // Sincronizar filtros locales con los globales cuando cambien
  const [localFiltros, setLocalFiltros] = useState(filtros);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Actualizar filtros locales cuando cambien los globales
  useEffect(() => {
    setLocalFiltros(filtros);
  }, [filtros]);

  const handleDateChange = (field: 'fechaDesde' | 'fechaHasta', value: string) => {
    setLocalFiltros(prev => ({ ...prev, [field]: value }));
  };

  const handleDateRangeChange = (desde: string, hasta: string) => {
    setLocalFiltros(prev => ({ ...prev, fechaDesde: desde, fechaHasta: hasta }));
  };

  const handleMultiSelectChange = (
    field: 'estados' | 'alianzas' | 'companias' | 'tiposSeguro',
    value: string,
    checked: boolean
  ) => {
    setLocalFiltros(prev => {
      const currentValues = prev[field] || [];
      if (checked) {
        return { ...prev, [field]: [...currentValues, value] };
      } else {
        return { ...prev, [field]: currentValues.filter(v => v !== value) };
      }
    });
  };

  const aplicarFiltros = () => {
    actualizarFiltros(localFiltros);
  };

  const limpiar = () => {
    limpiarFiltros();
    setLocalFiltros(filtros);
  };

  const contarFiltrosActivos = () => {
    let count = 0;
    if (localFiltros.estados?.length) count++;
    if (localFiltros.alianzas?.length) count++;
    if (localFiltros.companias?.length) count++;
    if (localFiltros.tiposSeguro?.length) count++;
    if (localFiltros.montoMin) count++;
    if (localFiltros.montoMax) count++;
    return count;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Reportes
          </CardTitle>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onExport('csv')}
                  >
                    Exportar CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onExport('xlsx')}
                  >
                    Exportar Excel
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onExport('pdf')}
                  >
                    Exportar PDF
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rango de fechas - siempre visible */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Fecha:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const hoy = toLocalDateString(new Date());
                handleDateRangeChange(hoy, hoy);
              }}
              className="h-7 text-xs px-2"
            >
              Hoy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const ayer = new Date();
                ayer.setDate(ayer.getDate() - 1);
                const ayerStr = toLocalDateString(ayer);
                handleDateRangeChange(ayerStr, ayerStr);
              }}
              className="h-7 text-xs px-2"
            >
              Ayer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const hoy = new Date();
                const semanaAtras = new Date();
                semanaAtras.setDate(hoy.getDate() - 7);
                handleDateRangeChange(toLocalDateString(semanaAtras), toLocalDateString(hoy));
              }}
              className="h-7 text-xs px-2"
            >
              Última semana
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const hoy = new Date();
                const mesAtras = new Date();
                mesAtras.setMonth(hoy.getMonth() - 1);
                handleDateRangeChange(toLocalDateString(mesAtras), toLocalDateString(hoy));
              }}
              className="h-7 text-xs px-2"
            >
              Último mes
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Desde</Label>
              <Input
                type="date"
                value={localFiltros.fechaDesde || ''}
                onChange={(e) => handleDateChange('fechaDesde', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Hasta</Label>
              <Input
                type="date"
                value={localFiltros.fechaHasta || ''}
                onChange={(e) => handleDateChange('fechaHasta', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Botón para mostrar filtros avanzados */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Ocultar' : 'Mostrar'} filtros avanzados
            {contarFiltrosActivos() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {contarFiltrosActivos()}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filtros avanzados */}
        {showAdvanced && (
          <>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Estados */}
              <div className="space-y-2">
                <Label>Estados</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {ESTADOS.map(estado => (
                    <div key={estado.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`estado-${estado.value}`}
                        checked={localFiltros.estados?.includes(estado.value) || false}
                        onCheckedChange={(checked) =>
                          handleMultiSelectChange('estados', estado.value, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`estado-${estado.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {estado.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alianzas */}
              <div className="space-y-2">
                <Label>Alianzas</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {alianzas.map(alianza => (
                    <div key={alianza.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`alianza-${alianza.id}`}
                        checked={localFiltros.alianzas?.includes(alianza.id) || false}
                        onCheckedChange={(checked) =>
                          handleMultiSelectChange('alianzas', alianza.id, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`alianza-${alianza.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {alianza.nombre}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compañías */}
              <div className="space-y-2">
                <Label>Compañías</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {companias.map(compania => (
                    <div key={compania.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`compania-${compania.id}`}
                        checked={localFiltros.companias?.includes(compania.id) || false}
                        onCheckedChange={(checked) =>
                          handleMultiSelectChange('companias', compania.id, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`compania-${compania.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {compania.nombre}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tipos de seguro */}
              <div className="space-y-2">
                <Label>Tipos de seguro</Label>
                <div className="space-y-2">
                  {TIPOS_SEGURO.map(tipo => (
                    <div key={tipo.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tipo-${tipo.value}`}
                        checked={localFiltros.tiposSeguro?.includes(tipo.value) || false}
                        onCheckedChange={(checked) =>
                          handleMultiSelectChange('tiposSeguro', tipo.value, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`tipo-${tipo.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {tipo.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rango de montos */}
              <div className="space-y-2">
                <Label>Monto mínimo (CLP)</Label>
                <Input
                  type="number"
                  placeholder="100,000"
                  value={localFiltros.montoMin || ''}
                  onChange={(e) =>
                    setLocalFiltros(prev => ({
                      ...prev,
                      montoMin: e.target.value ? Number(e.target.value) : undefined
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Monto máximo (CLP)</Label>
                <Input
                  type="number"
                  placeholder="2,000,000"
                  value={localFiltros.montoMax || ''}
                  onChange={(e) =>
                    setLocalFiltros(prev => ({
                      ...prev,
                      montoMax: e.target.value ? Number(e.target.value) : undefined
                    }))
                  }
                />
              </div>
            </div>
          </>
        )}

        {/* Botones de acción */}
        <div className="flex items-center gap-2 pt-4">
          <Button onClick={aplicarFiltros}>
            Aplicar filtros
          </Button>
          <Button variant="outline" onClick={limpiar}>
            Limpiar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}