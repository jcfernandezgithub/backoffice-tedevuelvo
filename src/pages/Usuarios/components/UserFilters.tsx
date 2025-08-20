import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover as DatePopover,
  PopoverContent as DatePopoverContent,
  PopoverTrigger as DatePopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import type { UserListParams, Role, UserState } from '../types/userTypes';

interface UserFiltersProps {
  params: UserListParams;
  onParamsChange: (params: UserListParams) => void;
}

const roleOptions: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'CONSULTANT', label: 'Consultor' }
];

const stateOptions: { value: UserState; label: string }[] = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'BLOCKED', label: 'Bloqueado' },
  { value: 'PENDING', label: 'Pendiente' }
];

export function UserFilters({ params, onParamsChange }: UserFiltersProps) {
  const [localSearch, setLocalSearch] = useState(params.search || '');

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      onParamsChange({ ...params, search: value || undefined, page: 1 });
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleRoleChange = (role: Role, checked: boolean) => {
    const currentRoles = params.role || [];
    const newRoles = checked
      ? [...currentRoles, role]
      : currentRoles.filter(r => r !== role);
    
    onParamsChange({
      ...params,
      role: newRoles.length > 0 ? newRoles : undefined,
      page: 1
    });
  };

  const handleStateChange = (state: UserState, checked: boolean) => {
    const currentStates = params.state || [];
    const newStates = checked
      ? [...currentStates, state]
      : currentStates.filter(s => s !== state);
    
    onParamsChange({
      ...params,
      state: newStates.length > 0 ? newStates : undefined,
      page: 1
    });
  };

  const handleDateChange = (field: keyof UserListParams, date: Date | undefined) => {
    onParamsChange({
      ...params,
      [field]: date ? format(date, 'yyyy-MM-dd') : undefined,
      page: 1
    });
  };

  const clearFilters = () => {
    setLocalSearch('');
    onParamsChange({
      page: 1,
      pageSize: params.pageSize
    });
  };

  const hasActiveFilters = !!(
    params.search ||
    params.role?.length ||
    params.state?.length ||
    params.createdFrom ||
    params.createdTo ||
    params.lastLoginFrom ||
    params.lastLoginTo
  );

  const getActiveFiltersCount = () => {
    let count = 0;
    if (params.search) count++;
    if (params.role?.length) count++;
    if (params.state?.length) count++;
    if (params.createdFrom || params.createdTo) count++;
    if (params.lastLoginFrom || params.lastLoginTo) count++;
    return count;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por nombre o correo..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
              {hasActiveFilters && (
                <Badge 
                  variant="secondary" 
                  className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
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
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-auto p-1"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Role Filter */}
              <div className="space-y-2">
                <Label>Perfil</Label>
                <div className="space-y-2">
                  {roleOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${option.value}`}
                        checked={params.role?.includes(option.value) || false}
                        onCheckedChange={(checked) => 
                          handleRoleChange(option.value, checked as boolean)
                        }
                      />
                      <Label htmlFor={`role-${option.value}`}>{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* State Filter */}
              <div className="space-y-2">
                <Label>Estado</Label>
                <div className="space-y-2">
                  {stateOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`state-${option.value}`}
                        checked={params.state?.includes(option.value) || false}
                        onCheckedChange={(checked) => 
                          handleStateChange(option.value, checked as boolean)
                        }
                      />
                      <Label htmlFor={`state-${option.value}`}>{option.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Creation Date Filter */}
              <div className="space-y-2">
                <Label>Fecha de creación</Label>
                <div className="grid grid-cols-2 gap-2">
                  <DatePopover>
                    <DatePopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !params.createdFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {params.createdFrom 
                          ? format(new Date(params.createdFrom), 'dd/MM/yy', { locale: es })
                          : 'Desde'
                        }
                      </Button>
                    </DatePopoverTrigger>
                    <DatePopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={params.createdFrom ? new Date(params.createdFrom) : undefined}
                        onSelect={(date) => handleDateChange('createdFrom', date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </DatePopoverContent>
                  </DatePopover>

                  <DatePopover>
                    <DatePopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !params.createdTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {params.createdTo 
                          ? format(new Date(params.createdTo), 'dd/MM/yy', { locale: es })
                          : 'Hasta'
                        }
                      </Button>
                    </DatePopoverTrigger>
                    <DatePopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={params.createdTo ? new Date(params.createdTo) : undefined}
                        onSelect={(date) => handleDateChange('createdTo', date)}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </DatePopoverContent>
                  </DatePopover>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {params.search && (
            <Badge variant="secondary">
              Búsqueda: {params.search}
              <button
                onClick={() => {
                  setLocalSearch('');
                  onParamsChange({ ...params, search: undefined, page: 1 });
                }}
                className="ml-1 hover:bg-secondary/80"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {params.role?.map((role) => (
            <Badge key={role} variant="secondary">
              {roleOptions.find(r => r.value === role)?.label}
              <button
                onClick={() => handleRoleChange(role, false)}
                className="ml-1 hover:bg-secondary/80"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          
          {params.state?.map((state) => (
            <Badge key={state} variant="secondary">
              {stateOptions.find(s => s.value === state)?.label}
              <button
                onClick={() => handleStateChange(state, false)}
                className="ml-1 hover:bg-secondary/80"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}