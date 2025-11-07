import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarIcon, Filter, X, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useFilters } from '../hooks/useFilters';
import { useAlianzas, useCompanias } from '../hooks/useReportsData';
import type { EstadoSolicitud, TipoSeguro } from '../types/reportTypes';

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

  const handleDateChange = (field: 'fechaDesde' | 'fechaHasta', date?: Date) => {
    if (!date) return;
    const fechaISO = format(date, 'yyyy-MM-dd');
    setLocalFiltros(prev => ({ ...prev, [field]: fechaISO }));
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Fecha desde</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !localFiltros.fechaDesde && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {localFiltros.fechaDesde ? (
                    format(new Date(localFiltros.fechaDesde), 'P', { locale: es })
                  ) : (
                    <span>Seleccionar fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={localFiltros.fechaDesde ? new Date(localFiltros.fechaDesde) : undefined}
                  onSelect={(date) => handleDateChange('fechaDesde', date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Fecha hasta</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !localFiltros.fechaHasta && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {localFiltros.fechaHasta ? (
                    format(new Date(localFiltros.fechaHasta), 'P', { locale: es })
                  ) : (
                    <span>Seleccionar fecha</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={localFiltros.fechaHasta ? new Date(localFiltros.fechaHasta) : undefined}
                  onSelect={(date) => handleDateChange('fechaHasta', date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
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