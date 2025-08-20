import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Filter, X, Search } from 'lucide-react';
import type { AllianceUserFilters as Filters } from '../types/allianceUserTypes';

interface AllianceUserFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  onClear: () => void;
}

export function AllianceUserFilters({
  filters,
  onFiltersChange,
  onClear
}: AllianceUserFiltersProps) {
  const [localFilters, setLocalFilters] = useState<Filters>(filters);

  const roles = [
    { value: 'ALIANZA_ADMIN', label: 'Administrador' },
    { value: 'ALIANZA_OPERADOR', label: 'Operador' },
  ] as const;

  const states = [
    { value: 'ACTIVE', label: 'Activo' },
    { value: 'BLOCKED', label: 'Bloqueado' },
    { value: 'PENDING', label: 'Pendiente' },
  ] as const;

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    const currentRoles = localFilters.role || [];
    if (checked) {
      setLocalFilters(prev => ({
        ...prev,
        role: [...currentRoles, role as any]
      }));
    } else {
      setLocalFilters(prev => ({
        ...prev,
        role: currentRoles.filter(r => r !== role)
      }));
    }
  };

  const handleStateChange = (state: string, checked: boolean) => {
    const currentStates = localFilters.state || [];
    if (checked) {
      setLocalFilters(prev => ({
        ...prev,
        state: [...currentStates, state as any]
      }));
    } else {
      setLocalFilters(prev => ({
        ...prev,
        state: currentStates.filter(s => s !== state)
      }));
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.role?.length) count++;
    if (filters.state?.length) count++;
    if (filters.createdFrom || filters.createdTo) count++;
    if (filters.lastLoginFrom || filters.lastLoginTo) count++;
    return count;
  };

  return (
    <div className="flex items-center gap-4">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o teléfono"
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-10"
        />
      </div>

      {/* Filters Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <Filter className="mr-2 h-4 w-4" />
            Filtros
            {getActiveFiltersCount() > 0 && (
              <Badge 
                variant="destructive" 
                className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
              >
                {getActiveFiltersCount()}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filtros</h4>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setLocalFilters({});
                  onClear();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Role Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Rol</Label>
              <div className="space-y-2">
                {roles.map((role) => (
                  <div key={role.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role.value}`}
                      checked={localFilters.role?.includes(role.value) || false}
                      onCheckedChange={(checked) => 
                        handleRoleChange(role.value, checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={`role-${role.value}`} 
                      className="text-sm font-normal"
                    >
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* State Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Estado</Label>
              <div className="space-y-2">
                {states.map((state) => (
                  <div key={state.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`state-${state.value}`}
                      checked={localFilters.state?.includes(state.value) || false}
                      onCheckedChange={(checked) => 
                        handleStateChange(state.value, checked as boolean)
                      }
                    />
                    <Label 
                      htmlFor={`state-${state.value}`} 
                      className="text-sm font-normal"
                    >
                      {state.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Date Filters */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fecha de creación</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="created-from" className="text-xs text-muted-foreground">
                    Desde
                  </Label>
                  <Input
                    id="created-from"
                    type="date"
                    value={localFilters.createdFrom || ''}
                    onChange={(e) => setLocalFilters(prev => ({ 
                      ...prev, 
                      createdFrom: e.target.value 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="created-to" className="text-xs text-muted-foreground">
                    Hasta
                  </Label>
                  <Input
                    id="created-to"
                    type="date"
                    value={localFilters.createdTo || ''}
                    onChange={(e) => setLocalFilters(prev => ({ 
                      ...prev, 
                      createdTo: e.target.value 
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Último acceso</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="login-from" className="text-xs text-muted-foreground">
                    Desde
                  </Label>
                  <Input
                    id="login-from"
                    type="date"
                    value={localFilters.lastLoginFrom || ''}
                    onChange={(e) => setLocalFilters(prev => ({ 
                      ...prev, 
                      lastLoginFrom: e.target.value 
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="login-to" className="text-xs text-muted-foreground">
                    Hasta
                  </Label>
                  <Input
                    id="login-to"
                    type="date"
                    value={localFilters.lastLoginTo || ''}
                    onChange={(e) => setLocalFilters(prev => ({ 
                      ...prev, 
                      lastLoginTo: e.target.value 
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleApplyFilters} className="flex-1">
                Aplicar filtros
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear Filters */}
      {getActiveFiltersCount() > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Limpiar
        </Button>
      )}
    </div>
  );
}